"""USD-based exchange rates, kept in the exchange_rates table.

The table is also the list of supported currencies. Two sides, kept apart on
purpose:

- **Writing** is the refresh job's alone (``refresh``, run by a scheduler via
  /api/v1/tasks/exchange-rates or ``python -m app.tasks exchange-rates``). It is
  the only code that calls the upstream API. Currencies the upstream quotes are
  updated or added; a stored currency it stops quoting is *delisted*, not
  deleted — it keeps its last rate, so what users recorded in it still converts.
- **Reading** (``get_rates``, ``supported_currencies``) never calls the API. It
  serves the table, cached in memory for the TTL, however old the rows are —
  yesterday's real rates beat the hardcoded table — and logs a warning once they
  pass the staleness limit, so a scheduler that stopped is noticed. Only an
  empty table, before the job has ever run, falls back to the hardcoded rates,
  and those currencies are then the supported ones.

Rates are used for display and cross-currency totals only. Amounts are always
stored in the currency they were entered in, so a stale or missing rate can
degrade a summary but can never corrupt stored data.

Caution for callers: converting on read means a historical total is recomputed
at today's rate, so last January's "total spend" moves a little every day.
"""

import asyncio
import time
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from decimal import ROUND_HALF_UP, Decimal
from typing import Final

import httpx
import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.currencies import is_currency_code, minor_units
from app.models.exchange_rate import ExchangeRate

logger = structlog.get_logger(__name__)

_TIMEOUT: Final = httpx.Timeout(5.0)


class SuspiciousRefreshError(ValueError):
    """The upstream answered, but dropping this many currencies at once is far
    likelier a broken response than real delistings."""


# Errors that mean "the upstream gave us nothing usable".
UPSTREAM_ERRORS: Final = (httpx.HTTPError, ValueError, TypeError, AttributeError)

# Last resort, used only while the table is empty — before the refresh job's
# first run. A hardcoded table drifts a few percent a month — these were within
# 8% of live rates after roughly a year — so it exists to keep the app
# responsive, not to be accurate.
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


class UnsupportedCurrencyError(Exception):
    """A currency new data may not use: never quoted, or since delisted."""

    def __init__(self, currency: str, *, delisted: bool) -> None:
        self.currency = currency
        self.delisted = delisted
        if delisted:
            message = f"{currency} is no longer supported: exchange rates for it are not published."
        else:
            message = f"{currency} is not a supported currency."
        super().__init__(message)


@dataclass(frozen=True)
class RefreshResult:
    quoted: int
    # Only the changes this run made; a re-run reports both empty.
    delisted: list[str] = field(default_factory=list)
    relisted: list[str] = field(default_factory=list)


@dataclass(frozen=True)
class _Snapshot:
    # Every stored rate, delisted ones included: they still convert old entries.
    rates: dict[str, Decimal]
    # The currencies new data may use.
    supported: frozenset[str]


class _RateCache:
    def __init__(self) -> None:
        self.snapshot: _Snapshot | None = None
        self.fetched_at: float = 0.0
        self.lock = asyncio.Lock()

    def is_fresh(self) -> bool:
        age = time.monotonic() - self.fetched_at
        return self.snapshot is not None and age < settings.exchange_rates_ttl_seconds

    def store(self, snapshot: _Snapshot) -> None:
        self.snapshot = snapshot
        self.fetched_at = time.monotonic()


_cache = _RateCache()


def reset_cache() -> None:
    """Drop cached rates. The lock is rebuilt too: an asyncio.Lock binds to the
    first event loop that awaits it, and each test gets a fresh loop."""
    global _cache
    _cache = _RateCache()


async def fetch_upstream() -> dict[str, Decimal]:
    """One call to the rates API. Raises one of UPSTREAM_ERRORS on any failure."""
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        response = await client.get(settings.exchange_rates_url)
        response.raise_for_status()
        payload = response.json()

    raw = payload.get("rates")
    if not raw:
        raise ValueError("rates response contained no 'rates' key")
    # str() first: json parses rates as floats, and Decimal(float) would carry
    # the binary rounding error into every converted amount.
    rates = {code: Decimal(str(value)) for code, value in raw.items()}
    # Only money, and only usable rates: a zero would divide by zero downstream,
    # and the table's CHECK would reject it anyway.
    return {
        code: rate.quantize(Decimal("0.000001"))
        for code, rate in rates.items()
        if is_currency_code(code) and rate > 0
    }


async def store_rates(db: AsyncSession, rates: dict[str, Decimal]) -> RefreshResult:
    """Make the table match one upstream response, in one transaction.

    Quoted currencies are updated or added and lose any delisting; stored ones
    missing from ``rates`` are delisted with their last rate kept. Refuses — and
    changes nothing — when the response would delist more currencies at once
    than ``exchange_rates_max_delisted_per_refresh``.
    """
    now = datetime.now(UTC)
    stored = {row.currency: row for row in await db.scalars(select(ExchangeRate))}

    newly_delisted = sorted(
        code for code, row in stored.items() if code not in rates and row.delisted_at is None
    )
    limit = settings.exchange_rates_max_delisted_per_refresh
    if len(newly_delisted) > limit:
        raise SuspiciousRefreshError(
            f"refusing to delist {len(newly_delisted)} currencies in one refresh (limit {limit})"
        )

    relisted = []
    for code, rate in rates.items():
        row = stored.get(code)
        if row is None:
            db.add(ExchangeRate(currency=code, rate_per_usd=rate, updated_at=now))
            continue
        if row.delisted_at is not None:
            relisted.append(code)
        row.rate_per_usd = rate
        row.updated_at = now
        row.delisted_at = None
    for code in newly_delisted:
        stored[code].delisted_at = now
    await db.commit()

    # The process that ran the job reads the new state on its next call.
    _cache.fetched_at = 0.0
    if newly_delisted or relisted:
        logger.warning(
            "exchange_rates.listing_changed", delisted=newly_delisted, relisted=sorted(relisted)
        )
    return RefreshResult(quoted=len(rates), delisted=newly_delisted, relisted=sorted(relisted))


async def refresh(db: AsyncSession) -> RefreshResult:
    """The refresh job: fetch the rates and bring the table in line with them.

    Raises on an upstream failure and leaves the table as it was: the scheduler
    should see the run fail, and readers keep the last good rates meanwhile.
    """
    return await store_rates(db, await fetch_upstream())


async def _load(db: AsyncSession) -> _Snapshot | None:
    rows = (await db.scalars(select(ExchangeRate))).all()
    if not rows:
        return None

    updated_at = max(row.updated_at for row in rows)
    # SQLite hands back naive datetimes; every one we write is UTC.
    if updated_at.tzinfo is None:
        updated_at = updated_at.replace(tzinfo=UTC)
    age = datetime.now(UTC) - updated_at
    if age > timedelta(hours=settings.exchange_rates_stale_after_hours):
        logger.warning(
            "exchange_rates.stale",
            updated_at=updated_at.isoformat(),
            age_hours=int(age.total_seconds() // 3600),
        )

    return _Snapshot(
        rates={row.currency: row.rate_per_usd for row in rows},
        supported=frozenset(row.currency for row in rows if row.delisted_at is None),
    )


async def _snapshot(db: AsyncSession) -> _Snapshot:
    if _cache.is_fresh() and _cache.snapshot is not None:
        return _cache.snapshot

    async with _cache.lock:
        # A concurrent caller may have reloaded while this one waited.
        if _cache.is_fresh() and _cache.snapshot is not None:
            return _cache.snapshot

        snapshot = await _load(db)
        if snapshot is None:
            logger.warning("exchange_rates.empty", serving="fallback")
            # Not cached, so the job's first run is picked up straight away.
            return _Snapshot(rates=dict(_FALLBACK_RATES), supported=frozenset(_FALLBACK_RATES))
        _cache.store(snapshot)
        return snapshot


async def get_rates(db: AsyncSession) -> dict[str, Decimal]:
    """Rates quoted against USD, delisted currencies included. Never calls the
    API and never raises for want of rates — see the module docstring."""
    return (await _snapshot(db)).rates


async def supported_currencies(db: AsyncSession) -> frozenset[str]:
    """The currencies new expenses, budgets, subscriptions and profiles may use."""
    return (await _snapshot(db)).supported


async def require_supported(db: AsyncSession, currency: str, *, current: str | None = None) -> None:
    """Raise UnsupportedCurrencyError unless ``currency`` may be used.

    ``current`` is the value already stored. Keeping it is always allowed, so a
    row recorded in a since-delisted currency can still be edited otherwise.
    """
    if currency == current:
        return
    snapshot = await _snapshot(db)
    if currency not in snapshot.supported:
        raise UnsupportedCurrencyError(currency, delisted=currency in snapshot.rates)


def convert(amount: Decimal, source: str, target: str, rates: dict[str, Decimal]) -> Decimal:
    """Convert between currencies via USD, rounded to the target's minor units.

    Takes the rates rather than looking them up, so a caller converting many
    rows reads them once. Raises ValueError when either currency has no rate.
    """
    if source == target:
        return amount

    try:
        source_rate = rates[source]
        target_rate = rates[target]
    except KeyError as exc:
        raise ValueError(f"no exchange rate available for {exc.args[0]}") from exc

    converted = amount / source_rate * target_rate
    quantum = Decimal(1).scaleb(-minor_units(target))
    return converted.quantize(quantum, rounding=ROUND_HALF_UP)
