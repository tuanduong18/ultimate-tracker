"""The background jobs, as plain async functions over a session.

Kept independent of how they are triggered: the /api/v1/tasks endpoints call
them with a request's session, ``python -m app.tasks`` calls them from a
cron-style runner, and an in-process scheduler could call them the same way.
Every job is idempotent, so a scheduler that fires twice or late does no harm.
"""

from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.task import ExchangeRateRefreshRead
from app.services import exchange_rates


async def refresh_exchange_rates(db: AsyncSession) -> ExchangeRateRefreshRead:
    """Daily: the upstream publishes once a day. The only writer of the rates
    table — requests read it but never refresh it."""
    result = await exchange_rates.refresh(db)
    return ExchangeRateRefreshRead(
        currencies=result.quoted, delisted=result.delisted, relisted=result.relisted
    )
