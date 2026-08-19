"""Validation tests for the finance schemas.

The rules exercised here are exactly the "trivial" money logic CLAUDE.md warns
breaks silently: per-currency decimal scale, currency normalisation, and the
not-sent vs sent-as-null distinction that partial updates depend on.
"""

from datetime import date
from decimal import Decimal

import pytest
from pydantic import ValidationError

from app.schemas.finance import (
    BudgetCreate,
    BudgetUpdate,
    CategoryCreate,
    ExpenseCreate,
    ExpenseUpdate,
)

SPENT_ON = date(2026, 8, 19)
CATEGORY_ID = "11111111-1111-1111-1111-111111111111"


def make_expense(**overrides: object) -> ExpenseCreate:
    payload: dict[str, object] = {
        "amount": Decimal("12.50"),
        "currency": "USD",
        "spent_on": SPENT_ON,
    }
    payload.update(overrides)
    return ExpenseCreate.model_validate(payload)


def make_budget(**overrides: object) -> BudgetCreate:
    payload: dict[str, object] = {
        "name": "Essentials",
        "amount": Decimal("500.00"),
        "currency": "USD",
        "starts_on": date(2026, 8, 1),
        "ends_on": date(2026, 8, 31),
        "category_ids": [CATEGORY_ID],
    }
    payload.update(overrides)
    return BudgetCreate.model_validate(payload)


# --- Currency and amount rules -------------------------------------------------


def test_currency_is_normalised_to_upper_case() -> None:
    assert make_expense(currency="usd").currency == "USD"


def test_unknown_currency_is_rejected() -> None:
    with pytest.raises(ValidationError):
        make_expense(currency="XYZ")


def test_zero_decimal_currency_rejects_cents() -> None:
    with pytest.raises(ValidationError, match="VND"):
        make_expense(amount=Decimal("1000.50"), currency="VND")


def test_three_decimal_currency_is_stored_at_full_precision() -> None:
    assert make_expense(amount=Decimal("1.234"), currency="KWD").amount == Decimal("1.234")


def test_two_decimal_currency_rejects_a_third_place() -> None:
    with pytest.raises(ValidationError, match="USD"):
        make_expense(amount=Decimal("1.234"), currency="USD")


@pytest.mark.parametrize("amount", [Decimal("0"), Decimal("-5")])
def test_non_positive_amounts_are_rejected(amount: Decimal) -> None:
    with pytest.raises(ValidationError):
        make_expense(amount=amount)


# --- Categories ----------------------------------------------------------------


def test_category_name_is_stripped_and_colour_defaults() -> None:
    category = CategoryCreate.model_validate({"name": "  Food  "})
    assert category.name == "Food"
    assert category.colour == "#94a3b8"


def test_blank_category_name_is_rejected() -> None:
    with pytest.raises(ValidationError):
        CategoryCreate.model_validate({"name": "   "})


def test_non_hex_colour_is_rejected() -> None:
    with pytest.raises(ValidationError):
        CategoryCreate.model_validate({"name": "Food", "colour": "green"})


# --- Budgets -------------------------------------------------------------------


def test_budget_range_must_not_be_inverted() -> None:
    with pytest.raises(ValidationError, match="ends_on"):
        make_budget(starts_on=date(2026, 8, 31), ends_on=date(2026, 8, 1))


def test_single_day_budget_is_allowed() -> None:
    budget = make_budget(starts_on=date(2026, 8, 15), ends_on=date(2026, 8, 15))
    assert budget.starts_on == budget.ends_on


def test_budget_must_cover_at_least_one_category() -> None:
    with pytest.raises(ValidationError):
        make_budget(category_ids=[])


def test_budget_update_checks_range_only_when_both_ends_arrive() -> None:
    # One end alone passes the schema; the service checks it against the row.
    assert BudgetUpdate.model_validate({"ends_on": "2026-08-01"}).ends_on == date(2026, 8, 1)
    with pytest.raises(ValidationError):
        BudgetUpdate.model_validate({"starts_on": "2026-08-31", "ends_on": "2026-08-01"})


# --- Partial-update semantics --------------------------------------------------


def test_update_distinguishes_not_sent_from_sent_as_null() -> None:
    cleared = ExpenseUpdate.model_validate({"category_id": None})
    untouched = ExpenseUpdate()
    assert cleared.model_dump(exclude_unset=True) == {"category_id": None}
    assert untouched.model_dump(exclude_unset=True) == {}


def test_update_amount_alone_defers_scale_check_to_the_service() -> None:
    # 2dp passes the wide schema bound even though the stored currency may be
    # VND — the service re-checks against the stored row.
    update = ExpenseUpdate.model_validate({"amount": "10.55"})
    assert update.amount == Decimal("10.55")
