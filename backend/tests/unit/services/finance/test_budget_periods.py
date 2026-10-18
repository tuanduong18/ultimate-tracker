"""Budget period rules: month edges and which days a budget is measured over."""

from datetime import date

import pytest

from app.models.finance import Budget, BudgetPeriod
from app.services.finance.budgets import _normalised, budget_window, month_bounds

MONTHLY = BudgetPeriod.MONTHLY
CUSTOM = BudgetPeriod.CUSTOM


def _budget(period: BudgetPeriod, starts_on: date, ends_on: date | None) -> Budget:
    return Budget(period=period, starts_on=starts_on, ends_on=ends_on)


@pytest.mark.parametrize(
    ("day", "expected"),
    [
        (date(2026, 10, 18), (date(2026, 10, 1), date(2026, 10, 31))),
        (date(2028, 2, 10), (date(2028, 2, 1), date(2028, 2, 29))),
        (date(2026, 2, 28), (date(2026, 2, 1), date(2026, 2, 28))),
    ],
)
def test_month_bounds(day: date, expected: tuple[date, date]) -> None:
    assert month_bounds(day) == expected


def test_a_monthly_budget_is_rounded_out_to_whole_months() -> None:
    assert _normalised(MONTHLY, date(2026, 10, 17), date(2027, 3, 3)) == (
        date(2026, 10, 1),
        date(2027, 3, 31),
    )


def test_an_ongoing_monthly_budget_keeps_no_end() -> None:
    assert _normalised(MONTHLY, date(2026, 10, 17), None) == (date(2026, 10, 1), None)


def test_a_custom_budget_keeps_its_exact_days() -> None:
    assert _normalised(CUSTOM, date(2026, 9, 25), date(2026, 10, 5)) == (
        date(2026, 9, 25),
        date(2026, 10, 5),
    )


def test_a_monthly_budget_is_measured_over_the_chosen_month_alone() -> None:
    ongoing = _budget(MONTHLY, date(2026, 9, 1), None)

    assert budget_window(ongoing, date(2026, 9, 14)) == (date(2026, 9, 1), date(2026, 9, 30))
    # A fresh window every month: October does not carry September's spend.
    assert budget_window(ongoing, date(2026, 10, 2)) == (date(2026, 10, 1), date(2026, 10, 31))
    assert budget_window(ongoing, date(2030, 1, 1)) == (date(2030, 1, 1), date(2030, 1, 31))


def test_a_monthly_budget_says_nothing_outside_its_months() -> None:
    ended = _budget(MONTHLY, date(2026, 9, 1), date(2026, 11, 30))

    assert budget_window(ended, date(2026, 8, 31)) is None
    assert budget_window(ended, date(2026, 12, 1)) is None
    assert budget_window(ended, date(2026, 11, 15)) is not None


def test_a_custom_budget_is_measured_in_full_in_every_month_it_touches() -> None:
    trip = _budget(CUSTOM, date(2026, 9, 25), date(2026, 10, 5))

    assert budget_window(trip, date(2026, 9, 1)) == (date(2026, 9, 25), date(2026, 10, 5))
    assert budget_window(trip, date(2026, 10, 1)) == (date(2026, 9, 25), date(2026, 10, 5))
    assert budget_window(trip, date(2026, 11, 1)) is None
