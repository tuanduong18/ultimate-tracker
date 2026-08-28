"""Finance domain business logic: categories, expenses, and budgets.

Failures are raised as FinanceError subclasses. Each carries the HTTP status
and stable error code the API answers with, so the route layer's translation
is a single line and every handler agrees on the mapping.
"""

import uuid
from collections.abc import Sequence
from datetime import date
from decimal import Decimal
from typing import Any

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.finance import Budget, Category, Expense
from app.schemas.finance import (
    BudgetCreate,
    BudgetUpdate,
    CategoryCreate,
    CategoryUpdate,
    ExpenseCreate,
    ExpenseUpdate,
    check_amount_scale,
)
from app.services import exchange_rates


class FinanceError(Exception):
    """Base for finance domain failures; subclasses pin the HTTP mapping."""

    status_code = 400
    code = "FINANCE_ERROR"


class NotFoundError(FinanceError):
    status_code = 404
    code = "NOT_FOUND"

    def __init__(self, resource: str) -> None:
        super().__init__(f"{resource} not found.")


class CategoryNameTakenError(FinanceError):
    status_code = 409
    code = "CATEGORY_NAME_TAKEN"

    def __init__(self, name: str) -> None:
        super().__init__(f"A category named {name!r} already exists.")


class UnknownCategoryError(FinanceError):
    status_code = 422
    code = "UNKNOWN_CATEGORY"

    def __init__(self) -> None:
        super().__init__("One or more category ids do not exist for this user.")


class InvalidAmountError(FinanceError):
    status_code = 422
    code = "INVALID_AMOUNT"


class InvalidDateRangeError(FinanceError):
    status_code = 422
    code = "INVALID_DATE_RANGE"

    def __init__(self) -> None:
        super().__init__("ends_on must be on or after starts_on.")


def _applied_changes(payload: Any, nullable_fields: frozenset[str]) -> dict[str, Any]:
    """Fields the caller actually sent, minus nulls aimed at non-nullable columns.

    ``exclude_unset`` keeps "not sent" distinct from "sent as null"; the second
    filter stops an explicit ``"amount": null`` from reaching a NOT NULL column
    as a 500 while still letting ``"category_id": null`` mean "uncategorize".
    """
    return {
        field: value
        for field, value in payload.model_dump(exclude_unset=True).items()
        if value is not None or field in nullable_fields
    }


def _check_scale(amount: Any, currency: Any) -> None:
    try:
        check_amount_scale(amount, currency)
    except ValueError as exc:
        raise InvalidAmountError(str(exc)) from exc


# --- Categories ---------------------------------------------------------------

# Seeded for every new profile. A brand-new user would otherwise land on an
# empty finance page unable to create a budget at all, since BudgetCreate
# requires at least one category. Distinct colours so the first chart is
# readable without anyone picking swatches.
DEFAULT_CATEGORIES: tuple[tuple[str, str], ...] = (
    ("Food", "#22c55e"),
    ("Rent", "#ef4444"),
    ("Education", "#3b82f6"),
    ("Entertainment", "#a855f7"),
    ("Other", "#94a3b8"),
)


def build_default_categories(user_id: uuid.UUID) -> list[Category]:
    """The starter set, unsaved.

    Returned rather than committed so the caller can persist them in the same
    transaction that creates the profile — a user with a profile but no
    categories would be a state nothing else in the app expects.
    """
    return [
        Category(user_id=user_id, name=name, colour=colour) for name, colour in DEFAULT_CATEGORIES
    ]


async def list_categories(db: AsyncSession, user_id: uuid.UUID) -> Sequence[Category]:
    result = await db.scalars(
        select(Category).where(Category.user_id == user_id).order_by(Category.name)
    )
    return result.all()


async def _get_owned_category(
    db: AsyncSession, user_id: uuid.UUID, category_id: uuid.UUID
) -> Category:
    category = await db.get(Category, category_id)
    if category is None or category.user_id != user_id:
        raise NotFoundError("Category")
    return category


async def create_category(db: AsyncSession, user_id: uuid.UUID, data: CategoryCreate) -> Category:
    category = Category(user_id=user_id, name=data.name, colour=data.colour)
    db.add(category)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise CategoryNameTakenError(data.name) from exc
    await db.refresh(category)
    return category


async def update_category(
    db: AsyncSession, user_id: uuid.UUID, category_id: uuid.UUID, data: CategoryUpdate
) -> Category:
    category = await _get_owned_category(db, user_id, category_id)
    for field, value in _applied_changes(data, frozenset()).items():
        setattr(category, field, value)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise CategoryNameTakenError(data.name or "") from exc
    await db.refresh(category)
    return category


async def delete_category(db: AsyncSession, user_id: uuid.UUID, category_id: uuid.UUID) -> None:
    """Delete a category.

    The database uncategorizes its expenses (SET NULL) and detaches it from
    budgets (join rows cascade); neither needs service-side bookkeeping.
    """
    category = await _get_owned_category(db, user_id, category_id)
    await db.delete(category)
    await db.commit()


# --- Expenses -----------------------------------------------------------------

_NULLABLE_EXPENSE_FIELDS = frozenset({"category_id", "description"})


async def list_expenses(
    db: AsyncSession,
    user_id: uuid.UUID,
    *,
    start_date: date | None = None,
    end_date: date | None = None,
    limit: int = 100,
    offset: int = 0,
) -> Sequence[Expense]:
    stmt = select(Expense).where(Expense.user_id == user_id)
    if start_date is not None:
        stmt = stmt.where(Expense.spent_on >= start_date)
    if end_date is not None:
        stmt = stmt.where(Expense.spent_on <= end_date)
    stmt = (
        stmt.order_by(Expense.spent_on.desc(), Expense.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    return (await db.scalars(stmt)).all()


async def _get_owned_expense(
    db: AsyncSession, user_id: uuid.UUID, expense_id: uuid.UUID
) -> Expense:
    expense = await db.get(Expense, expense_id)
    if expense is None or expense.user_id != user_id:
        raise NotFoundError("Expense")
    return expense


async def _require_owned_category_ref(
    db: AsyncSession, user_id: uuid.UUID, category_id: uuid.UUID
) -> None:
    """A bad category *reference* is a 422, not a 404.

    The resource being operated on is the expense (or budget), and it exists;
    what is wrong is a value inside the payload.
    """
    category = await db.get(Category, category_id)
    if category is None or category.user_id != user_id:
        raise UnknownCategoryError()


async def create_expense(db: AsyncSession, user_id: uuid.UUID, data: ExpenseCreate) -> Expense:
    if data.category_id is not None:
        await _require_owned_category_ref(db, user_id, data.category_id)
    expense = Expense(user_id=user_id, **data.model_dump())
    db.add(expense)
    await db.commit()
    await db.refresh(expense)
    return expense


async def update_expense(
    db: AsyncSession, user_id: uuid.UUID, expense_id: uuid.UUID, data: ExpenseUpdate
) -> Expense:
    expense = await _get_owned_expense(db, user_id, expense_id)
    changes = _applied_changes(data, _NULLABLE_EXPENSE_FIELDS)
    if changes.get("category_id") is not None:
        await _require_owned_category_ref(db, user_id, changes["category_id"])
    # The schema can only cross-check amount against currency when both arrive;
    # here the missing half comes from the stored row.
    _check_scale(changes.get("amount", expense.amount), changes.get("currency", expense.currency))
    for field, value in changes.items():
        setattr(expense, field, value)
    await db.commit()
    await db.refresh(expense)
    return expense


async def delete_expense(db: AsyncSession, user_id: uuid.UUID, expense_id: uuid.UUID) -> None:
    expense = await _get_owned_expense(db, user_id, expense_id)
    await db.delete(expense)
    await db.commit()


# --- Budgets ------------------------------------------------------------------


async def list_budgets(db: AsyncSession, user_id: uuid.UUID) -> Sequence[Budget]:
    stmt = (
        select(Budget)
        .where(Budget.user_id == user_id)
        .order_by(Budget.starts_on.desc(), Budget.created_at.desc())
    )
    return (await db.scalars(stmt)).all()


async def _get_owned_budget(db: AsyncSession, user_id: uuid.UUID, budget_id: uuid.UUID) -> Budget:
    # A fresh SELECT rather than db.get: the selectin relationship loads during
    # statement execution, which is the only async-safe moment for it.
    budget = await db.scalar(
        select(Budget).where(Budget.id == budget_id, Budget.user_id == user_id)
    )
    if budget is None:
        raise NotFoundError("Budget")
    return budget


async def _owned_categories(
    db: AsyncSession, user_id: uuid.UUID, category_ids: Sequence[uuid.UUID]
) -> list[Category]:
    unique_ids = set(category_ids)
    found = (
        await db.scalars(
            select(Category).where(Category.id.in_(unique_ids), Category.user_id == user_id)
        )
    ).all()
    if len(found) != len(unique_ids):
        raise UnknownCategoryError()
    return list(found)


async def create_budget(db: AsyncSession, user_id: uuid.UUID, data: BudgetCreate) -> Budget:
    categories = await _owned_categories(db, user_id, data.category_ids)
    budget = Budget(
        user_id=user_id,
        name=data.name,
        amount=data.amount,
        currency=data.currency,
        starts_on=data.starts_on,
        ends_on=data.ends_on,
        categories=categories,
    )
    db.add(budget)
    await db.commit()
    # Re-select so created_at and the relationship come back loaded.
    return await _get_owned_budget(db, user_id, budget.id)


async def update_budget(
    db: AsyncSession, user_id: uuid.UUID, budget_id: uuid.UUID, data: BudgetUpdate
) -> Budget:
    budget = await _get_owned_budget(db, user_id, budget_id)
    changes = _applied_changes(data, frozenset())
    category_ids = changes.pop("category_ids", None)
    if category_ids is not None:
        # Replaces the covered set outright, per the schema's contract.
        budget.categories = await _owned_categories(db, user_id, category_ids)
    _check_scale(changes.get("amount", budget.amount), changes.get("currency", budget.currency))
    # Same partial-update rule for the range: the missing end is the stored one.
    starts_on = changes.get("starts_on", budget.starts_on)
    ends_on = changes.get("ends_on", budget.ends_on)
    if ends_on < starts_on:
        raise InvalidDateRangeError()
    for field, value in changes.items():
        setattr(budget, field, value)
    await db.commit()
    return await _get_owned_budget(db, user_id, budget_id)


async def delete_budget(db: AsyncSession, user_id: uuid.UUID, budget_id: uuid.UUID) -> None:
    budget = await _get_owned_budget(db, user_id, budget_id)
    await db.delete(budget)
    await db.commit()


# --- Summary ------------------------------------------------------------------


class RateUnavailableError(FinanceError):
    status_code = 503
    code = "RATE_UNAVAILABLE"

    def __init__(self, detail: str) -> None:
        super().__init__(f"Could not convert to the display currency: {detail}")


async def _total_in(rows: Sequence[tuple[Decimal, str]], target: str) -> Decimal:
    """Sum (amount, currency) pairs into one target-currency total.

    Converting per row rather than per currency group keeps this honest about
    rounding: each conversion is quantized to the target's minor units, so the
    total cannot claim precision the currency does not have.
    """
    total = Decimal(0)
    for amount, currency in rows:
        total += await exchange_rates.convert(amount, currency, target)
    return total


async def summarize(
    db: AsyncSession,
    user_id: uuid.UUID,
    *,
    start_date: date,
    end_date: date,
    display_currency: str,
) -> dict[str, Any]:
    """Spent, budgeted and remaining over a date range, in one currency."""
    if end_date < start_date:
        raise InvalidDateRangeError()

    spent_rows = (
        await db.execute(
            select(Expense.amount, Expense.currency).where(
                Expense.user_id == user_id,
                Expense.spent_on >= start_date,
                Expense.spent_on <= end_date,
            )
        )
    ).all()

    # A budget counts when its range overlaps the window at all, which is the
    # same rule the UI uses to call a budget "active" for a period.
    budget_rows = (
        await db.execute(
            select(Budget.amount, Budget.currency).where(
                Budget.user_id == user_id,
                Budget.starts_on <= end_date,
                Budget.ends_on >= start_date,
            )
        )
    ).all()

    try:
        spent = await _total_in([(a, c) for a, c in spent_rows], display_currency)
        budgeted = await _total_in([(a, c) for a, c in budget_rows], display_currency)
    except ValueError as exc:
        # No rate for one of the currencies involved — our problem, not the
        # caller's, and temporary. Answering 0 would be a lie about their money.
        raise RateUnavailableError(str(exc)) from exc

    return {
        "currency": display_currency,
        "starts_on": start_date,
        "ends_on": end_date,
        "spent": spent,
        "budgeted": budgeted,
        "remaining": budgeted - spent,
    }
