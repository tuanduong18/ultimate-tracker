"""Budget CRUD."""

import uuid
from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.finance import Budget
from app.schemas.finance import BudgetCreate, BudgetUpdate
from app.services.finance._common import _applied_changes, _check_scale
from app.services.finance.categories import _owned_categories
from app.services.finance.errors import InvalidDateRangeError, NotFoundError


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
