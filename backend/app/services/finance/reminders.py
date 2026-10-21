"""Subscription reminders: a live countdown before each charge and trial end.

One reminder per subscription per charge date, kept in step with the
subscription from two sides through the same ``sync_reminder``:

- the scheduled job (app.tasks, every couple of hours) creates it ``lead_days``
  before the charge and rewrites its countdown each day — "renews in 3 days",
  "in 2 days", "tomorrow" — bringing it back as unread unless it is snoozed;
- an edit to the subscription rewrites it at once (and unsnoozes it), and a
  cancellation or deletion removes it.

On the charge day the renewal job (``renewals``) deletes it and sends the
renewal notice in its place, so a reminder never outlives its charge.
"""

from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from typing import Any, cast

import structlog
from sqlalchemy import delete, or_, select
from sqlalchemy.engine import CursorResult
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import timezones
from app.core.currencies import minor_units
from app.models.finance import Subscription
from app.models.notification import REMINDER_KINDS, Notification, NotificationKind
from app.models.profile import Profile
from app.services import notifications
from app.services.finance.billing import next_charge

logger = structlog.get_logger(__name__)


@dataclass
class ReminderRun:
    created: int = 0
    updated: int = 0
    removed: int = 0

    def add(self, other: ReminderRun) -> None:
        self.created += other.created
        self.updated += other.updated
        self.removed += other.removed


def money(subscription: Subscription) -> str:
    """ "USD 12.99", "VND 260,000": the amount in its currency's own minor units."""
    places = minor_units(subscription.currency)
    return f"{subscription.currency} {subscription.amount:,.{places}f}"


def short_date(day: date) -> str:
    return f"{day.day} {day:%b}"


def _when(days_left: int) -> str:
    return "tomorrow" if days_left == 1 else f"in {days_left} days"


def _render(subscription: Subscription, charge: date) -> tuple[NotificationKind, str]:
    """The kind and the body; the title carries the countdown, see _title."""
    on = f"{short_date(charge)} {charge:%Y}"
    if charge == subscription.trial_ends_on:
        body = (
            f"The first charge of {money(subscription)} is on {on}. "
            "Cancel before then if you don't want to keep it."
        )
        return NotificationKind.TRIAL_ENDING, body
    return NotificationKind.SUBSCRIPTION_RENEWAL, f"{money(subscription)} will be charged on {on}."


def _title(subscription: Subscription, kind: NotificationKind, days_left: int) -> str:
    if kind is NotificationKind.TRIAL_ENDING:
        return f"Your {subscription.name} trial ends {_when(days_left)}"
    return f"{subscription.name} renews {_when(days_left)}"


def reminder_key(subscription: Subscription, charge: date) -> str:
    return f"subscription:{subscription.id}:{charge.isoformat()}"


def _charge_stopped(subscription: Subscription, charge: date) -> bool:
    # A cancellation that takes effect on or before the charge stops it.
    return subscription.cancelled_on is not None and subscription.cancelled_on <= charge


def wanted_charge(subscription: Subscription, today: date, lead_days: int) -> date | None:
    """The charge a reminder should be counting down to right now, if any:
    the next one after today, when it is at most ``lead_days`` away and will
    actually happen."""
    charge = next_charge(subscription, today + timedelta(days=1))
    if (charge - today).days > lead_days or _charge_stopped(subscription, charge):
        return None
    return charge


async def sync_reminder(
    db: AsyncSession,
    subscription: Subscription,
    *,
    today: date,
    lead_days: int,
    edited: bool = False,
    now: datetime | None = None,
) -> ReminderRun:
    """Bring one subscription's reminder in line with it. Does not commit.

    ``edited`` is the user changing the subscription: the reminder is then
    rewritten even if its text came out the same, unsnoozed, and brought back
    as unread — the user should see what their edit did.

    A reminder for today or earlier is left to the renewal job, which needs its
    snooze to decide where the renewal notice goes — unless the charge it
    announces will no longer happen.
    """
    now = now or datetime.now(UTC)
    run = ReminderRun()
    charge = wanted_charge(subscription, today, lead_days)
    key = reminder_key(subscription, charge) if charge else None

    current: Notification | None = None
    for reminder in await notifications.reminders_for(db, subscription.user_id, subscription.id):
        due = reminder.due_on
        if due is not None and due <= today and not _charge_stopped(subscription, due):
            continue
        if reminder.dedupe_key == key and current is None:
            current = reminder
            continue
        await db.delete(reminder)
        run.removed += 1

    if charge is None:
        return run

    kind, body = _render(subscription, charge)
    title = _title(subscription, kind, (charge - today).days)
    if current is None:
        db.add(
            Notification(
                user_id=subscription.user_id,
                kind=kind,
                title=title,
                body=body,
                due_on=charge,
                dedupe_key=key,
                alerted_at=now,
            )
        )
        run.created += 1
        return run

    changed = (current.kind, current.title, current.body) != (kind, title, body)
    if not (changed or edited):
        return run
    current.kind, current.title, current.body = kind, title, body
    if edited:
        current.snoozed_at = None
    # A new countdown day asks for attention again — unless it is snoozed,
    # in which case it counts down quietly in the history.
    if current.snoozed_at is None:
        current.read_at = None
        current.alerted_at = now
    run.updated += 1
    return run


async def remove_reminders(db: AsyncSession, subscription: Subscription) -> int:
    """Delete every reminder of a subscription being deleted. Does not commit."""
    reminders = await notifications.reminders_for(db, subscription.user_id, subscription.id)
    for reminder in reminders:
        await db.delete(reminder)
    return len(reminders)


async def refresh_reminders(db: AsyncSession, *, now: datetime, lead_days: int) -> ReminderRun:
    """The scheduled half: create, re-count and clean up every user's reminders.

    Safe to run as often as wanted: a reminder whose text has not changed is
    left alone, so a second run in the same day changes nothing.
    """
    run = ReminderRun()
    utc_today = now.astimezone(UTC).date()
    # Every timezone's today is within a day of UTC's, so this window covers
    # every user's 1..lead_days ahead, whatever their zone. next_billing_on is
    # kept current by the renewal job, so it prunes by index.
    rows = await db.execute(
        select(Subscription, Profile.timezone)
        .join(Profile, Profile.id == Subscription.user_id)
        .where(
            Subscription.next_billing_on <= utc_today + timedelta(days=lead_days + 1),
            or_(
                Subscription.cancelled_on.is_(None),
                Subscription.cancelled_on > utc_today - timedelta(days=1),
            ),
        )
    )
    for subscription, timezone in rows.all():
        today = timezones.today_in(timezone, now)
        run.add(await sync_reminder(db, subscription, today=today, lead_days=lead_days, now=now))

    # Reminders whose day has passed without the renewal job taking them — it
    # skips a charge that a cancellation stopped. Two days back is safely past
    # every timezone's today.
    stale = cast(
        CursorResult[Any],
        await db.execute(
            delete(Notification).where(
                Notification.kind.in_(REMINDER_KINDS),
                Notification.due_on < utc_today - timedelta(days=1),
            )
        ),
    )
    run.removed += stale.rowcount or 0

    try:
        await db.commit()
    except IntegrityError:
        # A user edit created the same reminder meanwhile; theirs stands, and
        # the next run picks up anything this one missed.
        await db.rollback()
        logger.info("reminders.concurrent_edit")
        return ReminderRun()
    return run
