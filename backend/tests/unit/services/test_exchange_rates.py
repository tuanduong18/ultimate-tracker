"""Tests for the exchange-rate service: caching, degradation, conversion."""

from collections.abc import Callable, Iterator
from decimal import Decimal
from typing import Any

import httpx
import pytest

from app.services import exchange_rates

# Captured before any monkeypatching so the stub factory can still build a real client.
_REAL_CLIENT = httpx.AsyncClient

# Deliberately far from the hardcoded fallbacks, so a test can tell which one it got.
_LIVE_RATES = {"USD": 1.0, "EUR": 0.8, "VND": 20000.0}

Handler = Callable[[httpx.Request], httpx.Response]


@pytest.fixture(autouse=True)
def clear_rate_cache() -> Iterator[None]:
    exchange_rates.reset_cache()
    yield
    exchange_rates.reset_cache()


def install(monkeypatch: pytest.MonkeyPatch, handler: Handler) -> None:
    """Route the service's HTTP calls through a stub instead of the network."""

    def factory(**kwargs: Any) -> httpx.AsyncClient:
        return _REAL_CLIENT(**kwargs, transport=httpx.MockTransport(handler))

    monkeypatch.setattr(exchange_rates.httpx, "AsyncClient", factory)


def serving(rates: dict[str, float]) -> Handler:
    return lambda _request: httpx.Response(200, json={"result": "success", "rates": rates})


def failing(_request: httpx.Request) -> httpx.Response:
    return httpx.Response(500)


async def test_parses_rates_as_decimal(monkeypatch: pytest.MonkeyPatch) -> None:
    install(monkeypatch, serving(_LIVE_RATES))

    rates = await exchange_rates.get_rates()

    assert rates["VND"] == Decimal("20000")
    assert isinstance(rates["EUR"], Decimal)


async def test_second_call_is_served_from_cache(monkeypatch: pytest.MonkeyPatch) -> None:
    calls = 0

    def counting(request: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        return serving(_LIVE_RATES)(request)

    install(monkeypatch, counting)

    await exchange_rates.get_rates()
    await exchange_rates.get_rates()

    assert calls == 1


async def test_first_fetch_failure_serves_fallback(monkeypatch: pytest.MonkeyPatch) -> None:
    install(monkeypatch, failing)

    rates = await exchange_rates.get_rates()

    assert rates["USD"] == Decimal("1")
    # A failure must not be cached, or the TTL would pin the app to the fallback.
    assert exchange_rates._cache.rates == {}


async def test_missing_rates_key_is_a_failure(monkeypatch: pytest.MonkeyPatch) -> None:
    install(monkeypatch, lambda _r: httpx.Response(200, json={"result": "error"}))

    rates = await exchange_rates.get_rates()

    assert rates == exchange_rates._FALLBACK_RATES


async def test_refresh_failure_serves_stale_rates(monkeypatch: pytest.MonkeyPatch) -> None:
    install(monkeypatch, serving(_LIVE_RATES))
    await exchange_rates.get_rates()

    monkeypatch.setattr(exchange_rates.settings, "exchange_rates_ttl_seconds", 0)
    install(monkeypatch, failing)

    rates = await exchange_rates.get_rates()

    # Yesterday's real rate, not the fallback table's 26250.
    assert rates["VND"] == Decimal("20000")


async def test_convert_rounds_to_target_minor_units(monkeypatch: pytest.MonkeyPatch) -> None:
    install(monkeypatch, serving(_LIVE_RATES))

    # VND has no minor unit, so the result must carry no decimal places.
    assert await exchange_rates.convert(Decimal("10"), "USD", "VND") == Decimal("200000")
    # 10 EUR -> 12.50 USD -> 250000 VND, proving the cross-rate goes via USD.
    assert await exchange_rates.convert(Decimal("10"), "EUR", "VND") == Decimal("250000")
    assert await exchange_rates.convert(Decimal("10"), "VND", "USD") == Decimal("0.00")


async def test_convert_same_currency_skips_lookup(monkeypatch: pytest.MonkeyPatch) -> None:
    install(monkeypatch, failing)

    assert await exchange_rates.convert(Decimal("10.00"), "VND", "VND") == Decimal("10.00")


async def test_convert_unknown_currency_raises(monkeypatch: pytest.MonkeyPatch) -> None:
    install(monkeypatch, serving(_LIVE_RATES))

    with pytest.raises(ValueError, match="KZT"):
        await exchange_rates.convert(Decimal("10"), "USD", "KZT")
