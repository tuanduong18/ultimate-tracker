"""Expense CRUD."""

import uuid
from collections.abc import Sequence
from datetime import date

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.finance import Expense
from app.schemas.finance import ExpenseCreate, ExpenseUpdate
from app.services.finance._common import _applied_changes, _check_currency, _check_scale
from app.services.finance.categories import _require_owned_category_ref
from app.services.finance.errors import NotFoundError

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


async def create_expense(db: AsyncSession, user_id: uuid.UUID, data: ExpenseCreate) -> Expense:
    await _check_currency(db, data.currency)
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
    await _check_currency(db, changes.get("currency"), expense.currency)
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
