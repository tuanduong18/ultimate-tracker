"""Budget alerts: tell users when a budget is nearly spent, and when it is spent.

Run by the scheduler (``app.tasks``, hourly), never by a request — the same
rule as every other job. Each run measures every budget whose window holds the
user's today exactly as the Budgets tab measures it (``budget_progress``), and
sends:

- a **warning** once spend reaches the budget's ``warn_at_percent`` of the cap,
  unless the user turned the warning off;
- an **exceeded** alert once spend reaches the cap itself.

Each is sent once per budget window and cap: the dedupe key carries both, so a
monthly budget warns afresh every month and a raised cap can warn again, while
a re-run sends nothing new. A budget that jumps straight past its cap gets only
the exceeded alert.

An alert stays in the inbox while it still applies. Each run moves to the
history every inbox alert it would not send now — the warning once the
exceeded alert supersedes it, and any alert whose budget was raised, deleted,
spent less after an edit, or whose window has ended. Currency notices follow the
same rule. Spend that dips under a threshold and climbs back within the same
window and cap is not announced a second time.

Past windows are never alerted: a backdated expense that pushes last month over
its cap is history, not news.
"""

import uuid
from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from typing import Any

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import timezones
from app.core.currencies import format_money
from app.models.finance import Budget, BudgetPeriod
from app.models.notification import BUDGET_ALERT_KINDS, Notification, NotificationKind
from app.models.profile import Profile
from app.services import notifications
from app.services.finance.errors import RateUnavailableError
from app.services.finance.reminders import short_date
from app.services.finance.summaries import budget_progress

logger = structlog.get_logger(__name__)

# The threshold an exceeded alert is filed under, beside a warning's own percent.
CAP = 100


@dataclass
class BudgetAlertRun:
    # Budgets measured in a window that holds the user's today.
    checked: int = 0
    # Alerts sent this run.
    alerted: int = 0
    # Inbox alerts moved to the history because they no longer apply.
    cleared: int = 0


def alert_threshold(spent: Decimal, cap: Decimal, warn_at: int | None) -> int | None:
    """The highest threshold spend has reached: ``CAP`` for the cap itself,
    ``warn_at`` for the early warning, None below both.

    Exact comparison in Decimal, so 80% of 400.00 is reached at 320.00 and not
    a cent before.
    """
    if spent >= cap:
        return CAP
    if warn_at is not None and spent * 100 >= cap * warn_at:
        return warn_at
    return None


def alert_key(progress: dict[str, Any], threshold: int) -> str:
    """One alert per budget, window, threshold and cap.

    The cap is in the key so that raising it lets the budget warn again; the
    window, so that a monthly budget starts every month with a clean slate.
    """
    cap = format(progress["amount"].normalize(), "f")
    window = progress["window_starts_on"].isoformat()
    return f"budget:{progress['id']}:{window}:{threshold}:{cap}{progress['currency']}"


def _window(progress: dict[str, Any]) -> str:
    """ "in October 2026" for a monthly budget, "from 25 Sep to 8 Oct 2026" for a
    custom one — the stretch the figures cover, readable in the history later."""
    start, end = progress["window_starts_on"], progress["window_ends_on"]
    if progress["period"] == BudgetPeriod.MONTHLY:
        return f"in {start:%B %Y}"
    return f"from {short_date(start)} to {short_date(end)} {end:%Y}"


def render(
    user_id: uuid.UUID, progress: dict[str, Any], threshold: int, now: datetime
) -> Notification:
    """The alert for one budget at one threshold. Figures are fixed once sent:
    a notice says what was true when it went out."""
    name, currency = progress["name"], progress["currency"]
    cap, spent = progress["amount"], progress["spent"]
    of = f"{format_money(spent, currency)} of {format_money(cap, currency)}"
    measured = f"{of} spent {_window(progress)}"
    if threshold < CAP:
        kind = NotificationKind.BUDGET_WARNING
        title = f"{name} is {int(spent * 100 // cap)}% spent"
        body = f"{measured}, {format_money(cap - spent, currency)} left."
    elif spent > cap:
        kind = NotificationKind.BUDGET_EXCEEDED
        title = f"{name} is over budget"
        body = f"{measured}, {format_money(spent - cap, currency)} over."
    else:
        kind = NotificationKind.BUDGET_EXCEEDED
        title = f"{name} is fully spent"
        body = f"{measured}, nothing left."
    return Notification(
        user_id=user_id,
        kind=kind,
        title=title,
        body=body,
        dedupe_key=alert_key(progress, threshold),
        alerted_at=now,
    )


async def _users(db: AsyncSession) -> list[tuple[uuid.UUID, str]]:
    """Everyone with a budget, or with an inbox alert that may need clearing —
    someone who deleted their last budget still has its alert."""
    owners = set(await db.scalars(select(Budget.user_id).distinct()))
    owners.update(
        await db.scalars(
            select(Notification.user_id)
            .where(
                Notification.kind.in_(BUDGET_ALERT_KINDS),
                Notification.archived_at.is_(None),
            )
            .distinct()
        )
    )
    if not owners:
        return []
    rows = await db.execute(select(Profile.id, Profile.timezone).where(Profile.id.in_(owners)))
    return [(user_id, timezone) for user_id, timezone in rows]


async def _clear_stale(
    db: AsyncSession,
    measured: set[uuid.UUID],
    candidates: list[Notification],
    now: datetime,
) -> int:
    """Move to the history every inbox alert of a measured user that this run
    would not send. Users who could not be measured keep theirs as they are."""
    if not measured:
        return 0
    current = {(n.user_id, n.dedupe_key) for n in candidates}
    inbox = await db.scalars(
        select(Notification).where(
            Notification.user_id.in_(measured),
            Notification.kind.in_(BUDGET_ALERT_KINDS),
            Notification.archived_at.is_(None),
        )
    )
    stale = [n for n in inbox if (n.user_id, n.dedupe_key) not in current]
    for notice in stale:
        notice.archived_at = now
        notice.read_at = notice.read_at or now
    if stale:
        await db.commit()
    return len(stale)


async def check_budgets(db: AsyncSession, *, now: datetime) -> BudgetAlertRun:
    """Run the budget alert job: send what has been reached, clear what no
    longer applies."""
    run = BudgetAlertRun()
    candidates: list[Notification] = []
    measured: set[uuid.UUID] = set()

    for user_id, timezone in await _users(db):
        today = timezones.today_in(timezone, now)
        try:
            progress = await budget_progress(db, user_id, month=today)
        except RateUnavailableError as exc:
            # No honest figure without a rate. The next run tries again, and
            # until then this user's alerts stay as they were.
            logger.warning("budget_alerts.rate_unavailable", user_id=str(user_id), error=str(exc))
            continue
        measured.add(user_id)
        for budget in progress:
            if not budget["window_starts_on"] <= today <= budget["window_ends_on"]:
                continue
            run.checked += 1
            threshold = alert_threshold(
                budget["spent"], budget["amount"], budget["warn_at_percent"]
            )
            if threshold is not None:
                candidates.append(render(user_id, budget, threshold, now))

    run.cleared = await _clear_stale(db, measured, candidates, now)
    run.alerted = await notifications.deliver_once(db, candidates)
    return run
