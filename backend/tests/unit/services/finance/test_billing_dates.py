"""Billing-date arithmetic: month-end clamping, leap days, multi-unit intervals."""

from datetime import date

import pytest

from app.models.finance import BillingInterval
from app.services import finance as finance_service

TODAY = date(2026, 10, 15)

MONTH = BillingInterval.MONTH


@pytest.mark.parametrize(
    ("k", "expected"),
    [
        (0, date(2026, 1, 31)),
        (1, date(2026, 2, 28)),
        # Back to the 31st: measured from the anchor, not from 28 Feb.
        (2, date(2026, 3, 31)),
        (3, date(2026, 4, 30)),
        (12, date(2027, 1, 31)),
    ],
)
def test_monthly_charges_clamp_to_month_end_without_drifting(k: int, expected: date) -> None:
    assert finance_service.billing_date(date(2026, 1, 31), MONTH, 1, k) == expected


def test_yearly_leap_day_anchor_falls_back_to_28_feb() -> None:
    anchor = date(2028, 2, 29)
    assert finance_service.billing_date(anchor, BillingInterval.YEAR, 1, 1) == date(2029, 2, 28)
    assert finance_service.billing_date(anchor, BillingInterval.YEAR, 1, 4) == date(2032, 2, 29)


@pytest.mark.parametrize(
    ("anchor", "unit", "count", "expected"),
    [
        # Future anchor: the anchor itself.
        (date(2026, 11, 1), MONTH, 1, date(2026, 11, 1)),
        # A charge due today is still upcoming.
        (date(2026, 9, 15), MONTH, 1, date(2026, 10, 15)),
        (date(2026, 9, 16), MONTH, 1, date(2026, 10, 16)),
        (date(2026, 9, 14), MONTH, 1, date(2026, 11, 14)),
        # Quarterly from January: Jan, Apr, Jul, Oct, Jan.
        (date(2026, 1, 10), MONTH, 3, date(2027, 1, 10)),
        (date(2026, 10, 1), BillingInterval.WEEK, 2, date(2026, 10, 15)),
        (date(2026, 10, 2), BillingInterval.WEEK, 2, date(2026, 10, 16)),
        (date(2020, 1, 1), BillingInterval.DAY, 1, TODAY),
        (date(2019, 10, 20), BillingInterval.YEAR, 1, date(2026, 10, 20)),
    ],
)
def test_next_billing_date(anchor: date, unit: BillingInterval, count: int, expected: date) -> None:
    assert finance_service.next_billing_date(anchor, unit, count, TODAY) == expected
