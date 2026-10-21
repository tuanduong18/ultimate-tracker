"""Billing-date arithmetic: when a subscription charges.

Shared by subscription CRUD, the renewal job and the reminders, so all three
agree on every date.
"""

import calendar
from datetime import date, timedelta

from app.models.finance import BillingInterval, Subscription


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


def anchor_of(subscription: Subscription) -> date:
    """The first paid charge: the end of the trial when there is one."""
    return subscription.trial_ends_on or subscription.started_on


def next_charge(subscription: Subscription, on_or_after: date) -> date:
    """The subscription's first charge falling on or after a given day."""
    unit = BillingInterval(subscription.interval_unit)
    return next_billing_date(
        anchor_of(subscription), unit, subscription.interval_count, on_or_after
    )
