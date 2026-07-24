"""Finance domain models: categories, expenses, and budgets."""

import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

# ISO-4217 alphabetic code, e.g. "VND", "USD". Kept as a plain 3-char column so
# adding a currency needs no migration.
_CURRENCY_LEN = 3


class Category(Base):
    """A user-defined expense category. A preset set is seeded at signup."""

    __tablename__ = "categories"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(50), nullable=False)
    # Hex colour for charts, e.g. "#22c55e".
    colour: Mapped[str] = mapped_column(String(7), nullable=False, default="#94a3b8")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    __table_args__ = (
        # Lets the delete flow offer "rename" when the name is already taken.
        UniqueConstraint("user_id", "name", name="uq_categories_user_name"),
        Index("ix_categories_user_id", "user_id"),
    )


class Expense(Base):
    """A single expense entry recorded by a user."""

    __tablename__ = "expenses"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False
    )
    # Nullable on purpose: deleting a category sets this to NULL ("Uncategorized")
    # rather than reassigning rows. Users who want the grouping preserved use the
    # "move to another category" branch of the delete flow instead.
    category_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("categories.id", ondelete="SET NULL"), nullable=True
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(_CURRENCY_LEN), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    spent_on: Mapped[date] = mapped_column(Date, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    __table_args__ = (
        CheckConstraint("amount > 0", name="ck_expenses_amount_positive"),
        # Serves the dominant query: one user's expenses over a date range.
        Index("ix_expenses_user_spent_on", "user_id", "spent_on"),
        Index("ix_expenses_category_id", "category_id"),
    )


class Budget(Base):
    """A spending cap over an arbitrary date range, covering one or more categories."""

    __tablename__ = "budgets"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False
    )
    # A label matters once a budget spans several categories ("Essentials").
    name: Mapped[str] = mapped_column(String(80), nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(_CURRENCY_LEN), nullable=False)
    # Inclusive range, replacing the old month-only cap.
    starts_on: Mapped[date] = mapped_column(Date, nullable=False)
    ends_on: Mapped[date] = mapped_column(Date, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    categories: Mapped[list[Category]] = relationship(
        secondary="budget_categories",
        # selectin is async-safe; a plain lazy load would raise under asyncio.
        lazy="selectin",
    )

    __table_args__ = (
        CheckConstraint("amount > 0", name="ck_budgets_amount_positive"),
        CheckConstraint("ends_on >= starts_on", name="ck_budgets_range_valid"),
        Index("ix_budgets_user_range", "user_id", "starts_on", "ends_on"),
    )


class BudgetCategory(Base):
    """Join table: which categories a budget's cap applies to."""

    __tablename__ = "budget_categories"

    budget_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("budgets.id", ondelete="CASCADE"), primary_key=True
    )
    # Deleting a category detaches it from budgets but leaves the budget itself;
    # it may still cover others. A budget left with no categories is a service-layer
    # concern, not a database one.
    category_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("categories.id", ondelete="CASCADE"), primary_key=True
    )
