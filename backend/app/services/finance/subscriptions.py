"""Subscription CRUD, and renewing one by hand. The billing-date arithmetic
lives in ``billing``.

Services take ``today`` from the caller instead of reading the clock, because
"today" depends on the user's timezone and only the route knows the user.

Every write keeps the subscription's reminder in step in the same transaction
(see ``reminders.sync_reminder``), so the bell never shows a stale amount, date
or name — this is the trigger, in code rather than in the database.
"""

import uuid
from collections.abc import Sequence
from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.finance import Expense, Subscription
from app.schemas.finance import SubscriptionCreate, SubscriptionUpdate
from app.services.finance._common import _applied_changes, _check_currency, _check_scale
from app.services.finance.billing import next_charge
from app.services.finance.categories import _require_owned_category_ref
from app.services.finance.errors import (
    InvalidDateRangeError,
    NotFoundError,
    SubscriptionCancelledError,
)
from app.services.finance.reminders import _charge_stopped, remove_reminders, sync_reminder

# --- CRUD ---------------------------------------------------------------------

_NULLABLE_SUBSCRIPTION_FIELDS = frozenset({"category_id", "trial_ends_on", "cancelled_on", "note"})
# A change to any of these moves the billing dates, so next_billing_on is redone.
# cancelled_on is included so a resumed subscription skips the charges it missed.
# Only a real change counts: the edit form sends every field, unchanged or not.
_SCHEDULE_FIELDS = frozenset(
    {"interval_unit", "interval_count", "started_on", "trial_ends_on", "cancelled_on"}
)


# Everything a reminder's text or date is built from. Changing any of these
# rewrites the subscription's reminder at once, and brings it back if snoozed.
_REMINDER_FIELDS = _SCHEDULE_FIELDS | {"name", "amount", "currency"}


async def list_subscriptions(db: AsyncSession, user_id: uuid.UUID) -> Sequence[Subscription]:
    # Live subscriptions first, soonest charge first; cancelled ones after.
    stmt = (
        select(Subscription)
        .where(Subscription.user_id == user_id)
        .order_by(
            Subscription.cancelled_on.is_not(None),
            Subscription.next_billing_on,
            Subscription.name,
        )
    )
    return (await db.scalars(stmt)).all()


def _paid_ahead(subscription: Subscription, today: date) -> int:
    """Charges from today on that are already recorded: today's, once the
    renewal job has taken it, and any the user renewed early."""
    paid = 0
    charge = next_charge(subscription, today)
    while charge < subscription.next_billing_on:
        paid += 1
        charge = next_charge(subscription, charge + timedelta(days=1))
    return paid


def _reschedule(subscription: Subscription, today: date, paid_ahead: int) -> None:
    """Move next_billing_on to the first charge from today on, on the current
    schedule, past the ``paid_ahead`` charges already recorded.

    Counting the paid charges, rather than keeping the old date, is what lets a
    corrected billing day still take effect at once, while an edit made after
    a renewal never charges for the same period twice.
    """
    charge = next_charge(subscription, today)
    for _ in range(paid_ahead):
        charge = next_charge(subscription, charge + timedelta(days=1))
    subscription.next_billing_on = charge


async def _get_owned_subscription(
    db: AsyncSession, user_id: uuid.UUID, subscription_id: uuid.UUID
) -> Subscription:
    subscription = await db.get(Subscription, subscription_id)
    if subscription is None or subscription.user_id != user_id:
        raise NotFoundError("Subscription")
    return subscription


async def create_subscription(
    db: AsyncSession, user_id: uuid.UUID, data: SubscriptionCreate, *, today: date
) -> Subscription:
    """Create a subscription whose next charge is the first one from today on.

    A subscription started in the past does not log its past charges: the user
    has most likely recorded those already, and guessing would double-count.
    """
    await _check_currency(db, data.currency)
    if data.category_id is not None:
        await _require_owned_category_ref(db, user_id, data.category_id)

    subscription = Subscription(user_id=user_id, **data.model_dump())
    subscription.next_billing_on = next_charge(subscription, today)
    db.add(subscription)
    # Flushed first so the reminder can be keyed to the new id.
    await db.flush()
    await sync_reminder(
        db, subscription, today=today, lead_days=settings.subscription_reminder_lead_days
    )
    await db.commit()
    await db.refresh(subscription)
    return subscription


async def update_subscription(
    db: AsyncSession,
    user_id: uuid.UUID,
    subscription_id: uuid.UUID,
    data: SubscriptionUpdate,
    *,
    today: date,
) -> Subscription:
    subscription = await _get_owned_subscription(db, user_id, subscription_id)
    changes = _applied_changes(data, _NULLABLE_SUBSCRIPTION_FIELDS)
    await _check_currency(db, changes.get("currency"), subscription.currency)
    if changes.get("category_id") is not None:
        await _require_owned_category_ref(db, user_id, changes["category_id"])
    _check_scale(
        changes.get("amount", subscription.amount),
        changes.get("currency", subscription.currency),
    )

    # The schema only sees the fields that were sent; check the merged result
    # here so a bad combination is a 422 rather than a CHECK violation (a 500).
    started_on = changes.get("started_on", subscription.started_on)
    trial_ends_on = changes.get("trial_ends_on", subscription.trial_ends_on)
    cancelled_on = changes.get("cancelled_on", subscription.cancelled_on)
    if trial_ends_on is not None and trial_ends_on <= started_on:
        raise InvalidDateRangeError("trial_ends_on must be after started_on.")
    if cancelled_on is not None and cancelled_on < started_on:
        raise InvalidDateRangeError("cancelled_on must be on or after started_on.")

    edited = {field for field, value in changes.items() if getattr(subscription, field) != value}
    rescheduled = bool(_SCHEDULE_FIELDS & edited)
    # Counted on the schedule as it stands, before the edit replaces it.
    paid_ahead = _paid_ahead(subscription, today) if rescheduled else 0
    for field, value in changes.items():
        setattr(subscription, field, value)
    if rescheduled:
        _reschedule(subscription, today, paid_ahead)
    if _REMINDER_FIELDS & edited:
        await sync_reminder(
            db,
            subscription,
            today=today,
            lead_days=settings.subscription_reminder_lead_days,
            edited=True,
        )
    await db.commit()
    await db.refresh(subscription)
    return subscription


async def renew_subscription(
    db: AsyncSession, user_id: uuid.UUID, subscription_id: uuid.UUID, *, today: date
) -> Subscription:
    """Record the next charge as paid today: the user renewed ahead of it.

    The expense is dated today, the day the money left, rather than the charge
    date it covers — the one difference from the renewal job. The billing day
    stays: paying early extends a plan from when it would have run out, as a
    prepaid plan or a domain does, so next_billing_on moves to the charge after
    and the job will not record this one again when its day comes. No renewal
    notice: the user is the one who did it.
    """
    # Locked as the renewal job locks it, so the two never take the same charge.
    subscription = await db.scalar(
        select(Subscription)
        .where(Subscription.id == subscription_id, Subscription.user_id == user_id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    if subscription is None:
        raise NotFoundError("Subscription")
    charge = subscription.next_billing_on
    if _charge_stopped(subscription, charge):
        raise SubscriptionCancelledError()

    db.add(
        Expense(
            user_id=user_id,
            category_id=subscription.category_id,
            amount=subscription.amount,
            currency=subscription.currency,
            spent_on=today,
            description=subscription.name,
        )
    )
    subscription.next_billing_on = next_charge(subscription, charge + timedelta(days=1))
    # Removes the paid charge's reminder, and adds the next one's if it is near.
    await sync_reminder(
        db, subscription, today=today, lead_days=settings.subscription_reminder_lead_days
    )
    await db.commit()
    await db.refresh(subscription)
    return subscription


async def delete_subscription(
    db: AsyncSession, user_id: uuid.UUID, subscription_id: uuid.UUID
) -> None:
    """Delete outright. Expenses it already logged stay — the money was spent.

    Cancelling (setting cancelled_on) is the usual path; this is for mistakes.
    """
    subscription = await _get_owned_subscription(db, user_id, subscription_id)
    # Its renewal notices stay: they record money that was spent.
    await remove_reminders(db, subscription)
    await db.delete(subscription)
    await db.commit()
