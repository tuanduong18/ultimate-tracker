"""USD-based exchange rates, fetched on demand and cached in-process.

Rates are used for display and cross-currency totals only. Amounts are always
stored in the currency they were entered in, so a stale or missing rate can
degrade a summary but can never corrupt stored data.

Caution for callers: converting on read means a historical total is recomputed
at today's rate, so last January's "total spend" moves every day. Anything that
needs a stable historical figure must store the rate used alongside the amount.
"""

import asyncio
import time
from decimal import ROUND_HALF_UP, Decimal
from typing import Final

import httpx
import structlog

from app.core.config import settings
from app.core.currencies import minor_units

logger = structlog.get_logger(__name__)

_TIMEOUT: Final = httpx.Timeout(5.0)

# Last resort, used only when the very first fetch of a process fails. A
# hardcoded table drifts a few percent a month — these were within 8% of live
# rates after roughly a year — so it exists to keep the app responsive, not to
# be accurate.
_FALLBACK_RATES: Final[dict[str, Decimal]] = {
    "USD": Decimal("1"),
    "EUR": Decimal("0.878"),
    "GBP": Decimal("0.750"),
    "JPY": Decimal("163.69"),
    "AUD": Decimal("1.434"),
    "CAD": Decimal("1.408"),
    "CHF": Decimal("0.817"),
    "CNY": Decimal("6.783"),
    "SGD": Decimal("1.292"),
    "VND": Decimal("26250"),
}


class _RateCache:
    def __init__(self) -> None:
        self.rates: dict[str, Decimal] = {}
        self.fetched_at: float = 0.0
        self.lock = asyncio.Lock()

    def is_fresh(self) -> bool:
        age = time.monotonic() - self.fetched_at
        return bool(self.rates) and age < settings.exchange_rates_ttl_seconds

    def store(self, rates: dict[str, Decimal]) -> None:
        self.rates = rates
        self.fetched_at = time.monotonic()


_cache = _RateCache()


def reset_cache() -> None:
    """Drop cached rates. The lock is rebuilt too: an asyncio.Lock binds to the
    first event loop that awaits it, and each test gets a fresh loop."""
    global _cache
    _cache = _RateCache()


async def _fetch_rates() -> dict[str, Decimal]:
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        response = await client.get(settings.exchange_rates_url)
        response.raise_for_status()
        payload = response.json()

    raw = payload.get("rates")
    if not raw:
        raise ValueError("rates response contained no 'rates' key")
    # str() first: json parses rates as floats, and Decimal(float) would carry
    # the binary rounding error into every converted amount.
    return {code: Decimal(str(value)) for code, value in raw.items()}


async def get_rates() -> dict[str, Decimal]:
    """Rates quoted against USD, refreshed at most once per TTL."""
    if _cache.is_fresh():
        return _cache.rates

    async with _cache.lock:
        # A concurrent caller may have refreshed while this one waited.
        if _cache.is_fresh():
            return _cache.rates
        try:
            rates = await _fetch_rates()
        except (httpx.HTTPError, ValueError, TypeError, AttributeError) as exc:
            # Yesterday's real rates beat the hardcoded table, so stale wins.
            logger.warning(
                "exchange_rates.fetch_failed",
                error=str(exc),
                serving="stale" if _cache.rates else "fallback",
            )
            return _cache.rates or dict(_FALLBACK_RATES)
        _cache.store(rates)
        return rates


async def convert(amount: Decimal, source: str, target: str) -> Decimal:
    """Convert between currencies via USD, rounded to the target's minor units."""
    if source == target:
        return amount

    rates = await get_rates()
    try:
        source_rate = rates[source]
        target_rate = rates[target]
    except KeyError as exc:
        raise ValueError(f"no exchange rate available for {exc.args[0]}") from exc

    converted = amount / source_rate * target_rate
    quantum = Decimal(1).scaleb(-minor_units(target))
    return converted.quantize(quantum, rounding=ROUND_HALF_UP)
