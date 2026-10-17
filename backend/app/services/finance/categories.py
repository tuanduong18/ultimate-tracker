"""Category CRUD, the seeded defaults, and checks on category references."""

import uuid
from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.finance import Category
from app.schemas.finance import CategoryCreate, CategoryUpdate
from app.services.finance._common import _applied_changes
from app.services.finance.errors import (
    CategoryNameTakenError,
    NotFoundError,
    UnknownCategoryError,
)

# Seeded for every new profile. A brand-new user would otherwise land on an
# empty finance page unable to create a budget at all, since BudgetCreate
# requires at least one category. Distinct colours so the first chart is
# readable without anyone picking swatches.
DEFAULT_CATEGORIES: tuple[tuple[str, str], ...] = (
    ("Food", "#22c55e"),
    ("Rent", "#ef4444"),
    ("Education", "#3b82f6"),
    ("Entertainment", "#a855f7"),
    # Where subscription renewals belong. The server never picks it by name;
    # the subscription form preselects it, so renaming or deleting it is safe.
    ("Subscriptions", "#f59e0b"),
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
