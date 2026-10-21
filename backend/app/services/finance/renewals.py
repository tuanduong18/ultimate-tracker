"""The renewal job: on each charge date, record the charge.

For every subscription whose next charge has come (in the user's timezone) and
that is not cancelled as of that charge, in a single transaction per
subscription:

1. write an expense for the amount, in the subscription's currency and
   category, dated to the charge it covers rather than the day the job ran;
2. replace the charge's reminder with a renewal notice — in the inbox, or
   straight in the history when the user had snoozed the reminder;
3. advance ``next_billing_on`` to the following charge.

Missed days are caught up charge by charge, each recorded against its own date;
only the latest catch-up notice goes to the inbox, the rest to the history.

One transaction is what makes a re-run safe: once a charge is recorded,
``next_billing_on`` has already moved past it. The row is locked while it is
processed (SKIP LOCKED), so two overlapping runs cannot take the same charge.
"""

from datetime import UTC, date, datetime, timedelta

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import timezones
from app.models.finance import Expense, Subscription
from app.models.notification import Notification, NotificationKind
from app.models.profile import Profile
from app.services import notifications
from app.services.finance.billing import next_charge
from app.services.finance.reminders import money, short_date


def _notice(subscription: Subscription, charge: date, now: datetime) -> Notification:
    if charge == subscription.trial_ends_on:
        title = f"Your {subscription.name} trial ended on {short_date(charge)}"
        body = f"The first charge of {money(subscription)} was logged as an expense."
    else:
        title = f"{subscription.name} auto-renewed on {short_date(charge)}"
        body = f"It cost {money(subscription)}, logged as an expense."
    return Notification(
        user_id=subscription.user_id,
        kind=NotificationKind.SUBSCRIPTION_RENEWED,
        title=title,
        body=body,
        due_on=charge,
        dedupe_key=f"renewed:{subscription.id}:{charge.isoformat()}",
        alerted_at=now,
    )


def _charges(subscription: Subscription, today: date) -> bool:
    charge = subscription.next_billing_on
    stopped = subscription.cancelled_on is not None and subscription.cancelled_on <= charge
    return charge <= today and not stopped


async def _renew(db: AsyncSession, subscription: Subscription, today: date, now: datetime) -> int:
    """Record every charge of one subscription due by ``today``. Does not commit."""
    reminders = await notifications.reminders_for(db, subscription.user_id, subscription.id)
    notices: list[Notification] = []
    while _charges(subscription, today):
        charge = subscription.next_billing_on
        db.add(
            Expense(
                user_id=subscription.user_id,
                category_id=subscription.category_id,
                amount=subscription.amount,
                currency=subscription.currency,
                spent_on=charge,
                description=subscription.name,
            )
        )
        notice = _notice(subscription, charge, now)
        # Snoozed means "I'm renewing anyway": the renewal is then no news.
        if any(r.due_on == charge and r.snoozed_at is not None for r in reminders):
            notice.archived_at = notice.read_at = now
        notices.append(notice)
        subscription.next_billing_on = next_charge(subscription, charge + timedelta(days=1))

    if not notices:
        return 0
    # Catching up on missed days: only the latest charge is news.
    for notice in notices[:-1]:
        notice.archived_at = notice.archived_at or now
        notice.read_at = notice.read_at or now
    for reminder in reminders:
        if reminder.due_on is not None and reminder.due_on < subscription.next_billing_on:
            await db.delete(reminder)
    db.add_all(notices)
    return len(notices)


async def renew_due_subscriptions(db: AsyncSession, *, now: datetime) -> int:
    """Run the renewal job; return how many charges it recorded."""
    # Every timezone's today is within a day of UTC's, so this covers them all.
    latest = now.astimezone(UTC).date() + timedelta(days=1)
    candidates = await db.execute(
        select(Subscription.id, Profile.timezone)
        .join(Profile, Profile.id == Subscription.user_id)
        .where(
            Subscription.next_billing_on <= latest,
            or_(
                Subscription.cancelled_on.is_(None),
                Subscription.cancelled_on > Subscription.next_billing_on,
            ),
        )
    )

    recorded = 0
    for subscription_id, timezone in candidates.all():
        today = timezones.today_in(timezone, now)
        # Re-read under a row lock: another run may have taken it meanwhile,
        # and then it is either locked (skipped) or no longer due.
        subscription = await db.scalar(
            select(Subscription)
            .where(Subscription.id == subscription_id, Subscription.next_billing_on <= today)
            .with_for_update(skip_locked=True)
        )
        if subscription is None:
            continue
        recorded += await _renew(db, subscription, today, now)
        await db.commit()
    return recorded
