"""Finance domain schemas — a separate Create/Update/Read set per resource.

Two decisions worth knowing before using these.

Money is carried as ``Decimal`` and Pydantic serialises it to a JSON *string*.
That is deliberate: ``12.10`` as a JSON number becomes a binary float in the
browser, and budget maths that is off by a cent is worse than a string the
frontend has to parse.

``Update`` schemas leave every field optional, so the service layer must apply
them with ``model_dump(exclude_unset=True)``. Otherwise "field not sent" and
"field sent as null" collapse into each other — and for ``ExpenseUpdate`` that
distinction is the difference between leaving a category alone and clearing it.
"""

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Annotated, Self

from pydantic import (
    AfterValidator,
    BaseModel,
    ConfigDict,
    Field,
    StringConstraints,
    model_validator,
)

from app.core.currencies import minor_units, normalize_currency

# Mirrors Numeric(20, 3) on the expense and budget columns. The scale is the
# widest any supported currency needs (KWD, BHD, JOD, OMR, LYD, TND); per-currency
# narrowing happens in check_amount_scale, so USD still stops at 2 and VND at 0.
_COLUMN_SCALE = 3
_MAX_DIGITS = 20

CurrencyCode = Annotated[str, AfterValidator(normalize_currency)]
CategoryName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=50)]
BudgetName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=80)]
# Hex colour for charts, matching the String(7) column.
Colour = Annotated[str, StringConstraints(strip_whitespace=True, pattern=r"^#[0-9a-fA-F]{6}$")]
# The column is unbounded Text; the cap is a schema-level guard on user input.
Description = Annotated[str, StringConstraints(strip_whitespace=True, max_length=500)]
Amount = Annotated[
    Decimal,
    Field(gt=0, max_digits=_MAX_DIGITS, decimal_places=_COLUMN_SCALE, allow_inf_nan=False),
]


def _decimal_places(value: Decimal) -> int:
    """Places the value actually *needs*, not what its representation carries.

    A Numeric(20, 3) column hands back ``Decimal("500.000")`` — three places of
    trailing zeros. Counting those as significant would fail the re-check every
    partial update runs against a stored amount, so normalise first.
    """
    exponent = value.normalize().as_tuple().exponent
    # allow_inf_nan=False rules out the non-int exponents ('n', 'N', 'F').
    return max(0, -exponent) if isinstance(exponent, int) else 0


def check_amount_scale(amount: Decimal, currency: str) -> None:
    """Reject sub-unit precision the currency does not have — VND 1000.50.

    Public because the service layer re-runs it for partial updates, where only
    one of amount/currency arrives and the other must come from the stored row.
    """
    allowed = min(_COLUMN_SCALE, minor_units(currency))
    if _decimal_places(amount) > allowed:
        raise ValueError(
            f"{currency} amounts take at most {allowed} decimal place(s), got {amount}"
        )


# --- Categories ---------------------------------------------------------------


class CategoryCreate(BaseModel):
    name: CategoryName
    colour: Colour = "#94a3b8"


class CategoryUpdate(BaseModel):
    name: CategoryName | None = None
    colour: Colour | None = None


class CategoryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    colour: str
    created_at: datetime


# --- Expenses -----------------------------------------------------------------


class ExpenseCreate(BaseModel):
    amount: Amount
    currency: CurrencyCode
    # Optional on purpose — an expense with no category reads as "Uncategorized".
    category_id: uuid.UUID | None = None
    description: Description | None = None
    spent_on: date

    @model_validator(mode="after")
    def _validate_amount_scale(self) -> Self:
        check_amount_scale(self.amount, self.currency)
        return self


class ExpenseUpdate(BaseModel):
    amount: Amount | None = None
    currency: CurrencyCode | None = None
    category_id: uuid.UUID | None = None
    description: Description | None = None
    spent_on: date | None = None

    @model_validator(mode="after")
    def _validate_amount_scale(self) -> Self:
        # Only checkable when both arrive together. A PATCH carrying just an
        # amount has to be re-checked in the service against the stored currency.
        if self.amount is not None and self.currency is not None:
            check_amount_scale(self.amount, self.currency)
        return self


class ExpenseRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    amount: Decimal
    currency: str
    category_id: uuid.UUID | None
    description: str | None
    spent_on: date
    created_at: datetime


# --- Budgets ------------------------------------------------------------------


class BudgetCreate(BaseModel):
    name: BudgetName
    amount: Amount
    currency: CurrencyCode
    # Inclusive range, both ends.
    starts_on: date
    ends_on: date
    # A budget that caps nothing is meaningless to create. It may still *end up*
    # with none once a category is deleted — that is the service's problem, not
    # a reason to reject the row here.
    category_ids: Annotated[list[uuid.UUID], Field(min_length=1)]

    @model_validator(mode="after")
    def _validate(self) -> Self:
        check_amount_scale(self.amount, self.currency)
        if self.ends_on < self.starts_on:
            raise ValueError("ends_on must be on or after starts_on")
        return self


class BudgetUpdate(BaseModel):
    name: BudgetName | None = None
    amount: Amount | None = None
    currency: CurrencyCode | None = None
    starts_on: date | None = None
    ends_on: date | None = None
    # When present, replaces the covered set outright rather than merging.
    category_ids: Annotated[list[uuid.UUID], Field(min_length=1)] | None = None

    @model_validator(mode="after")
    def _validate(self) -> Self:
        if self.amount is not None and self.currency is not None:
            check_amount_scale(self.amount, self.currency)
        # Same caveat as ExpenseUpdate: a PATCH moving only one end of the range
        # has to be validated in the service against the stored other end.
        if self.starts_on is not None and self.ends_on is not None:
            if self.ends_on < self.starts_on:
                raise ValueError("ends_on must be on or after starts_on")
        return self


class BudgetRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    amount: Decimal
    currency: str
    starts_on: date
    ends_on: date
    # Loaded via the model's selectin relationship; carries name and colour so a
    # chart does not need a second round trip.
    categories: list[CategoryRead]
    created_at: datetime


# --- Summary ------------------------------------------------------------------


class SummaryRead(BaseModel):
    """Totals for a date range, expressed in the profile's display currency.

    Expenses and budgets keep whatever currency they were recorded in; only
    these totals are converted, and at today's rates — so a figure for last
    month can move as rates move. That is the documented trade-off in
    app.services.exchange_rates, not a bug.
    """

    currency: str
    starts_on: date
    ends_on: date
    spent: Decimal
    budgeted: Decimal
    # Can be negative: that is the overspend, and the UI should say so.
    remaining: Decimal
