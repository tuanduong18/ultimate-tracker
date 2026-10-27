"""The background jobs, as plain async functions over a session.

Kept independent of how they are triggered: the /api/v1/tasks endpoints call
them with a request's session, ``python -m app.tasks`` calls them from a
cron-style runner, and an in-process scheduler could call them the same way.
Every job is idempotent, so a scheduler that fires twice or late does no harm.
"""

from datetime import UTC, datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.schemas.task import BudgetJobRead, ExchangeRateRefreshRead, SubscriptionJobRead
from app.services import exchange_rates
from app.services.finance.budget_alerts import check_budgets
from app.services.finance.currency_notices import notify_delisted_currencies
from app.services.finance.reminders import refresh_reminders
from app.services.finance.renewals import renew_due_subscriptions


async def refresh_exchange_rates(db: AsyncSession) -> ExchangeRateRefreshRead:
    """Daily: the upstream publishes once a day. The only writer of the rates
    table — requests read it but never refresh it. Then tells the users of any
    delisted currency, in the same run."""
    result = await exchange_rates.refresh(db)
    return ExchangeRateRefreshRead(
        currencies=result.quoted,
        delisted=result.delisted,
        relisted=result.relisted,
        notified=await notify_delisted_currencies(db),
    )


async def subscriptions(db: AsyncSession, now: datetime | None = None) -> SubscriptionJobRead:
    """Every couple of hours: record the charges that have come due, then bring
    every reminder's countdown up to date.

    Renewals go first: on a charge day they need the reminder (and whether it
    was snoozed) before the reminder pass would clear it. Running more often
    only moves each user's daily countdown closer to their local midnight.
    """
    now = now or datetime.now(UTC)
    renewed = await renew_due_subscriptions(db, now=now)
    run = await refresh_reminders(db, now=now, lead_days=settings.subscription_reminder_lead_days)
    return SubscriptionJobRead(
        renewed=renewed,
        reminders_created=run.created,
        reminders_updated=run.updated,
        reminders_removed=run.removed,
    )


async def budgets(db: AsyncSession, now: datetime | None = None) -> BudgetJobRead:
    """Hourly: alert on budgets that reached their warning or their cap, and
    clear alerts that no longer apply.

    Its own job rather than a step of another: spend moves whenever anyone logs
    an expense, not on a charge date or a rate refresh. Hourly bounds how long
    an overspend goes unannounced; each run is a few queries per user.
    """
    run = await check_budgets(db, now=now or datetime.now(UTC))
    return BudgetJobRead(checked=run.checked, alerted=run.alerted, cleared=run.cleared)
