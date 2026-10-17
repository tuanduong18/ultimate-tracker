"""Subscription CRUD and the billing-date arithmetic it rests on.

Services take ``today`` from the caller instead of reading the clock, because
"today" depends on the user's timezone and only the route knows the user.
"""

import calendar
import uuid
from collections.abc import Sequence
from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.finance import BillingInterval, Subscription
from app.schemas.finance import SubscriptionCreate, SubscriptionUpdate
from app.services.finance._common import _applied_changes, _check_scale
from app.services.finance.categories import _require_owned_category_ref
from app.services.finance.errors import InvalidDateRangeError, NotFoundError

# --- Billing dates ------------------------------------------------------------


def _add_months(day: date, months: int) -> date:
    """Shift by whole months, clamping to the last day of a shorter month."""
    years, month_index = divmod(day.month - 1 + months, 12)
    year = day.year + years
    month = month_index + 1
    return date(year, month, min(day.day, calendar.monthrange(year, month)[1]))


def billing_date(anchor: date, unit: BillingInterval, count: int, k: int) -> date:
    """The k-th charge counted from the anchor (k = 0 is the anchor itself).

    Always measured from the anchor, never from the previous charge: stepping
    month by month from 31 Jan would clamp to 28 Feb and then stay on the 28th,
    whereas anchor + 2 months is 31 Mar.
    """
    steps = count * k
    match unit:
        case BillingInterval.DAY:
            return anchor + timedelta(days=steps)
        case BillingInterval.WEEK:
            return anchor + timedelta(weeks=steps)
        case BillingInterval.MONTH:
            return _add_months(anchor, steps)
        case BillingInterval.YEAR:
            return _add_months(anchor, 12 * steps)


def next_billing_date(anchor: date, unit: BillingInterval, count: int, on_or_after: date) -> date:
    """The first charge falling on or after a given day."""
    if anchor >= on_or_after:
        return anchor
    # Jump close with a lower-bound estimate, then step. Charges only move
    # forward as k grows, so the loop runs at most a step or two.
    if unit in (BillingInterval.DAY, BillingInterval.WEEK):
        step_days = count * (7 if unit is BillingInterval.WEEK else 1)
        k = (on_or_after - anchor).days // step_days
    else:
        step_months = count * (12 if unit is BillingInterval.YEAR else 1)
        months_apart = (on_or_after.year - anchor.year) * 12 + on_or_after.month - anchor.month
        k = max(0, months_apart // step_months - 1)
    while (charge := billing_date(anchor, unit, count, k)) < on_or_after:
        k += 1
    return charge


def _schedule_next(subscription: Subscription, today: date) -> date:
    # The first paid charge is the end of the trial, when there is one.
    anchor = subscription.trial_ends_on or subscription.started_on
    unit = BillingInterval(subscription.interval_unit)
    return next_billing_date(anchor, unit, subscription.interval_count, today)


# --- CRUD ---------------------------------------------------------------------

_NULLABLE_SUBSCRIPTION_FIELDS = frozenset({"category_id", "trial_ends_on", "cancelled_on", "note"})
# A change to any of these moves the billing dates, so next_billing_on is redone.
# cancelled_on is included so a resumed subscription skips the charges it missed.
_SCHEDULE_FIELDS = frozenset(
    {"interval_unit", "interval_count", "started_on", "trial_ends_on", "cancelled_on"}
)


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
    if data.category_id is not None:
        await _require_owned_category_ref(db, user_id, data.category_id)

    subscription = Subscription(user_id=user_id, **data.model_dump())
    subscription.next_billing_on = _schedule_next(subscription, today)
    db.add(subscription)
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

    for field, value in changes.items():
        setattr(subscription, field, value)
    if _SCHEDULE_FIELDS & changes.keys():
        subscription.next_billing_on = _schedule_next(subscription, today)
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
    await db.delete(subscription)
    await db.commit()
