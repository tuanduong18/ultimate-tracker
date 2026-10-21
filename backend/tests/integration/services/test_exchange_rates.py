"""The exchange-rate table: the refresh job is its only writer, reads never call
the API — fresh, stale or empty — and the table decides which currencies new
data may use."""

from collections.abc import AsyncGenerator, Callable
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import Any

import httpx
import pytest
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.models.exchange_rate import ExchangeRate
from app.services import exchange_rates

# Captured before any monkeypatching so the stub factory can still build a real client.
_REAL_CLIENT = httpx.AsyncClient

# Deliberately far from the hardcoded fallbacks, so a test can tell which one it got.
_LIVE_RATES = {"USD": 1.0, "EUR": 0.8, "VND": 20000.0}

Handler = Callable[[httpx.Request], httpx.Response]


@pytest.fixture
async def db(db_factory: async_sessionmaker[AsyncSession]) -> AsyncGenerator[AsyncSession]:
    async with db_factory() as session:
        yield session


def install(monkeypatch: pytest.MonkeyPatch, handler: Handler) -> list[httpx.Request]:
    """Route the service's HTTP calls through a stub; return the calls it saw."""
    calls: list[httpx.Request] = []

    def recording(request: httpx.Request) -> httpx.Response:
        calls.append(request)
        return handler(request)

    def factory(**kwargs: Any) -> httpx.AsyncClient:
        return _REAL_CLIENT(**kwargs, transport=httpx.MockTransport(recording))

    monkeypatch.setattr(exchange_rates.httpx, "AsyncClient", factory)
    return calls


def serving(rates: dict[str, float]) -> Handler:
    return lambda _request: httpx.Response(200, json={"result": "success", "rates": rates})


def failing(_request: httpx.Request) -> httpx.Response:
    return httpx.Response(500)


async def rows(db: AsyncSession) -> dict[str, ExchangeRate]:
    db.expire_all()
    return {row.currency: row for row in await db.scalars(select(ExchangeRate))}


async def age_table(db: AsyncSession, hours: int) -> None:
    """Pretend the stored rates were written ``hours`` ago."""
    then = datetime.now(UTC) - timedelta(hours=hours)
    await db.execute(update(ExchangeRate).values(updated_at=then))
    await db.commit()
    exchange_rates.reset_cache()


async def delist_amd(db: AsyncSession) -> None:
    """USD and AMD quoted, then a refresh in which AMD is gone."""
    await exchange_rates.store_rates(db, {"USD": Decimal("1"), "AMD": Decimal("390")})
    await exchange_rates.store_rates(db, {"USD": Decimal("1")})


# --- Reads ----------------------------------------------------------------------


async def test_reads_the_table_without_calling_the_api(
    db: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    await exchange_rates.store_rates(db, {"VND": Decimal("25000")})
    calls = install(monkeypatch, serving(_LIVE_RATES))

    rates = await exchange_rates.get_rates(db)

    assert rates == {"VND": Decimal("25000")}
    assert calls == []


async def test_old_rates_are_served_as_they_are_never_refreshed_by_a_read(
    db: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    await exchange_rates.store_rates(db, {"VND": Decimal("23000")})
    await age_table(db, hours=24 * 30)
    calls = install(monkeypatch, serving(_LIVE_RATES))

    rates = await exchange_rates.get_rates(db)

    # Last month's real rate: refreshing is the job's business, not the reader's.
    assert rates["VND"] == Decimal("23000")
    assert calls == []


async def test_empty_table_serves_fallback_without_calling_the_api(
    db: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    calls = install(monkeypatch, serving(_LIVE_RATES))

    rates = await exchange_rates.get_rates(db)

    assert rates == exchange_rates._FALLBACK_RATES
    assert await exchange_rates.supported_currencies(db) == set(exchange_rates._FALLBACK_RATES)
    assert calls == []
    assert await rows(db) == {}
    # Not cached, so the job's first run is read straight away.
    assert exchange_rates._cache.snapshot is None


async def test_second_read_is_served_from_memory(db: AsyncSession) -> None:
    await exchange_rates.store_rates(db, {"VND": Decimal("25000")})
    await exchange_rates.get_rates(db)
    # Written behind the cache's back; the process has not looked again.
    db.add(ExchangeRate(currency="EUR", rate_per_usd=Decimal("0.9")))
    await db.commit()

    assert "EUR" not in await exchange_rates.get_rates(db)


async def test_a_refresh_is_seen_at_once_even_just_after_boot(
    db: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    # Monotonic time starts near zero on a freshly booted machine (a CI runner,
    # a new container), so invalidation cannot lean on "fetched long ago".
    monkeypatch.setattr(exchange_rates.time, "monotonic", lambda: 5.0)
    await exchange_rates.store_rates(db, {"USD": Decimal("1"), "AMD": Decimal("390")})
    assert "AMD" in await exchange_rates.supported_currencies(db)

    await exchange_rates.store_rates(db, {"USD": Decimal("1")})

    assert await exchange_rates.supported_currencies(db) == {"USD"}


# --- Which currencies are supported ---------------------------------------------


async def test_a_delisted_currency_still_converts_but_is_no_longer_supported(
    db: AsyncSession,
) -> None:
    await delist_amd(db)

    assert (await exchange_rates.get_rates(db))["AMD"] == Decimal("390")
    assert await exchange_rates.supported_currencies(db) == {"USD"}


async def test_require_supported_tells_delisted_from_unknown(db: AsyncSession) -> None:
    await delist_amd(db)

    await exchange_rates.require_supported(db, "USD")
    with pytest.raises(exchange_rates.UnsupportedCurrencyError, match="no longer supported"):
        await exchange_rates.require_supported(db, "AMD")
    with pytest.raises(exchange_rates.UnsupportedCurrencyError, match="not a supported"):
        await exchange_rates.require_supported(db, "XYZ")


async def test_keeping_a_delisted_currency_already_stored_is_allowed(db: AsyncSession) -> None:
    await delist_amd(db)

    await exchange_rates.require_supported(db, "AMD", current="AMD")


# --- The refresh job ------------------------------------------------------------


async def test_refresh_updates_quoted_currencies_and_adds_new_ones(
    db: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    await exchange_rates.store_rates(db, {"USD": Decimal("1"), "VND": Decimal("25000")})
    install(monkeypatch, serving(_LIVE_RATES))

    result = await exchange_rates.refresh(db)

    assert result == exchange_rates.RefreshResult(quoted=3)
    assert set(await rows(db)) == {"USD", "EUR", "VND"}
    # The process that ran the job sees the new rates at once.
    assert (await exchange_rates.get_rates(db))["VND"] == Decimal("20000")


async def test_refresh_delists_a_dropped_currency_and_keeps_its_last_rate(
    db: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    install(monkeypatch, serving({**_LIVE_RATES, "AMD": 390.0}))
    await exchange_rates.refresh(db)
    install(monkeypatch, serving(_LIVE_RATES))

    result = await exchange_rates.refresh(db)

    assert result.delisted == ["AMD"]
    amd = (await rows(db))["AMD"]
    assert amd.delisted_at is not None
    assert amd.rate_per_usd == Decimal("390")
    # Reported once: the next run finds nothing new to delist.
    assert (await exchange_rates.refresh(db)).delisted == []


async def test_a_currency_quoted_again_is_relisted(
    db: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    install(monkeypatch, serving({**_LIVE_RATES, "AMD": 390.0}))
    await exchange_rates.refresh(db)
    install(monkeypatch, serving(_LIVE_RATES))
    await exchange_rates.refresh(db)
    install(monkeypatch, serving({**_LIVE_RATES, "AMD": 400.0}))

    result = await exchange_rates.refresh(db)

    assert result.relisted == ["AMD"]
    amd = (await rows(db))["AMD"]
    assert amd.delisted_at is None
    assert amd.rate_per_usd == Decimal("400")
    assert "AMD" in await exchange_rates.supported_currencies(db)


async def test_refresh_refuses_to_delist_too_many_at_once(
    db: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    # Seven currencies vanish in one response: a truncated payload, not news.
    many = {code: 1.0 for code in ("AED", "AMD", "AUD", "BRL", "CAD", "CHF", "CNY")}
    install(monkeypatch, serving({**_LIVE_RATES, **many}))
    await exchange_rates.refresh(db)
    install(monkeypatch, serving(_LIVE_RATES))

    with pytest.raises(exchange_rates.SuspiciousRefreshError):
        await exchange_rates.refresh(db)

    assert all(row.delisted_at is None for row in (await rows(db)).values())


async def test_refresh_keeps_only_money_with_usable_rates(
    db: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    # XDR is a unit of account, "usd1" is no code at all, a zero rate is unusable.
    install(monkeypatch, serving({**_LIVE_RATES, "XDR": 0.7, "usd1": 1.0, "SGD": 0.0}))

    assert (await exchange_rates.refresh(db)).quoted == 3
    assert set(await rows(db)) == {"USD", "EUR", "VND"}


async def test_refresh_rounds_to_six_decimal_places(
    db: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    install(monkeypatch, serving({"USD": 1.0, "KWD": 0.30712345678}))

    await exchange_rates.refresh(db)
    exchange_rates.reset_cache()

    assert (await exchange_rates.get_rates(db))["KWD"] == Decimal("0.307123")


async def test_refresh_failure_raises_and_keeps_the_old_rates(
    db: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    install(monkeypatch, serving(_LIVE_RATES))
    await exchange_rates.refresh(db)
    install(monkeypatch, failing)

    with pytest.raises(httpx.HTTPStatusError):
        await exchange_rates.refresh(db)

    stored = await rows(db)
    assert len(stored) == 3
    assert all(row.delisted_at is None for row in stored.values())


async def test_missing_rates_key_fails_the_refresh(
    db: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    install(monkeypatch, lambda _r: httpx.Response(200, json={"result": "error"}))

    with pytest.raises(ValueError, match="rates"):
        await exchange_rates.refresh(db)
