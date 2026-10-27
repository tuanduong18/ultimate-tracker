"""Budget CRUD, and the date rules that tell a monthly budget from a custom one."""

import calendar
import uuid
from collections.abc import Sequence
from datetime import date
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.finance import Budget, BudgetPeriod
from app.schemas.finance import BudgetCreate, BudgetUpdate
from app.services.finance._common import _applied_changes, _check_currency, _check_scale
from app.services.finance.categories import _owned_categories
from app.services.finance.errors import InvalidDateRangeError, NotFoundError

# --- Periods ------------------------------------------------------------------


def month_bounds(day: date) -> tuple[date, date]:
    """First and last day of the calendar month containing ``day``."""
    last = calendar.monthrange(day.year, day.month)[1]
    return day.replace(day=1), day.replace(day=last)


def _normalised(
    period: BudgetPeriod, starts_on: date, ends_on: date | None
) -> tuple[date, date | None]:
    """Round a monthly budget out to whole months; leave a custom one alone.

    Storing month edges means a monthly budget's months can be read straight
    off the row, and two budgets created on the 3rd and the 17th of the same
    month cover exactly the same months.
    """
    if period is not BudgetPeriod.MONTHLY:
        return starts_on, ends_on
    return month_bounds(starts_on)[0], month_bounds(ends_on)[1] if ends_on else None


def _check_range(period: BudgetPeriod, starts_on: date, ends_on: date | None) -> None:
    if period is BudgetPeriod.CUSTOM and ends_on is None:
        raise InvalidDateRangeError("A custom budget needs an end date.")
    if ends_on is not None and ends_on < starts_on:
        raise InvalidDateRangeError()


def budget_window(budget: Budget, month: date) -> tuple[date, date] | None:
    """The days a budget is measured over when viewing ``month``, or None.

    - monthly: that calendar month, if the budget is running in it — a fresh
      cap every month, which is what "monthly" means.
    - custom: its whole range, if that range touches the month at all. A trip
      budget from 25 Sep to 5 Oct is one cap, so it shows in both months and is
      measured in full in each.

    None means the budget has nothing to say about that month.
    """
    month_start, month_end = month_bounds(month)
    ends_on = budget.ends_on
    if budget.starts_on > month_end or (ends_on is not None and ends_on < month_start):
        return None
    if budget.period == BudgetPeriod.MONTHLY:
        return month_start, month_end
    assert ends_on is not None  # ck_budgets_custom_has_end
    return budget.starts_on, ends_on


# --- CRUD ---------------------------------------------------------------------


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


async def create_budget(db: AsyncSession, user_id: uuid.UUID, data: BudgetCreate) -> Budget:
    await _check_currency(db, data.currency)
    categories = await _owned_categories(db, user_id, data.category_ids)
    starts_on, ends_on = _normalised(data.period, data.starts_on, data.ends_on)
    budget = Budget(
        user_id=user_id,
        name=data.name,
        amount=data.amount,
        currency=data.currency,
        period=data.period,
        starts_on=starts_on,
        ends_on=ends_on,
        warn_at_percent=data.warn_at_percent,
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
    # ends_on may be sent as null: that is how a monthly budget becomes ongoing.
    # warn_at_percent likewise: null turns the early warning off.
    changes: dict[str, Any] = _applied_changes(data, frozenset({"ends_on", "warn_at_percent"}))
    await _check_currency(db, changes.get("currency"), budget.currency)
    category_ids = changes.pop("category_ids", None)
    if category_ids is not None:
        # Replaces the covered set outright, per the schema's contract.
        budget.categories = await _owned_categories(db, user_id, category_ids)
    _check_scale(changes.get("amount", budget.amount), changes.get("currency", budget.currency))

    # Same partial-update rule for the range and the period: whatever was not
    # sent comes from the stored row, and the merged result is what is checked.
    period = BudgetPeriod(changes.get("period", budget.period))
    starts_on, ends_on = _normalised(
        period,
        changes.get("starts_on", budget.starts_on),
        changes.get("ends_on", budget.ends_on),
    )
    _check_range(period, starts_on, ends_on)
    changes.update(period=period, starts_on=starts_on, ends_on=ends_on)

    for field, value in changes.items():
        setattr(budget, field, value)
    await db.commit()
    return await _get_owned_budget(db, user_id, budget_id)


async def delete_budget(db: AsyncSession, user_id: uuid.UUID, budget_id: uuid.UUID) -> None:
    budget = await _get_owned_budget(db, user_id, budget_id)
    await db.delete(budget)
    await db.commit()
