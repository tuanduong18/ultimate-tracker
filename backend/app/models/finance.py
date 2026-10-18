"""Finance domain models: categories, expenses, budgets, and subscriptions."""

import uuid
from datetime import date, datetime
from decimal import Decimal
from enum import StrEnum

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Numeric,
    SmallInteger,
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

# Money columns. Scale 3 because KWD, BHD, JOD, OMR, LYD and TND are quoted in
# thousandths — scale 2 would silently round every amount in those currencies.
# Precision 20 leaves headroom for the currencies with no minor unit at all: a
# mid-range car is a ten-digit number of VND before any decimals are involved.
# numeric is variable-width in Postgres, so the generous bound costs no storage.
_AMOUNT_PRECISION = 20
_AMOUNT_SCALE = 3


class BillingInterval(StrEnum):
    """Unit of a subscription's billing cycle; paired with an interval count."""

    DAY = "day"
    WEEK = "week"
    MONTH = "month"
    YEAR = "year"


# A plain string column guarded by a CHECK, not a Postgres enum type: adding a
# unit is then a one-line constraint swap instead of an ALTER TYPE migration.
_INTERVAL_UNIT_LEN = 5
_INTERVAL_UNIT_CHECK = "interval_unit IN ({})".format(
    ", ".join(f"'{unit.value}'" for unit in BillingInterval)
)


class Category(Base):
    """A user-defined expense category.

    A starter set is seeded when the profile is first created — see
    DEFAULT_CATEGORIES in app.services.finance.categories. Users are free to rename,
    recolour or delete any of them.
    """

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
    amount: Mapped[Decimal] = mapped_column(
        Numeric(_AMOUNT_PRECISION, _AMOUNT_SCALE), nullable=False
    )
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
    amount: Mapped[Decimal] = mapped_column(
        Numeric(_AMOUNT_PRECISION, _AMOUNT_SCALE), nullable=False
    )
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


class Subscription(Base):
    """A recurring charge, e.g. a monthly streaming plan or a yearly domain.

    The billing schedule is anchored on the first paid charge: trial_ends_on when
    there is a free trial, otherwise started_on. Each later charge is computed as
    anchor + k * interval rather than previous + interval, so a 31 Jan anchor
    bills on 28 Feb and then 31 Mar instead of drifting to the 28th for good.
    """

    __tablename__ = "subscriptions"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False
    )
    # Copied onto each auto-logged expense. Nullable for the same reason as
    # Expense.category_id: deleting a category leaves the subscription in place.
    category_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("categories.id", ondelete="SET NULL"), nullable=True
    )
    name: Mapped[str] = mapped_column(String(80), nullable=False)
    amount: Mapped[Decimal] = mapped_column(
        Numeric(_AMOUNT_PRECISION, _AMOUNT_SCALE), nullable=False
    )
    currency: Mapped[str] = mapped_column(String(_CURRENCY_LEN), nullable=False)
    # "Every interval_count interval_units": quarterly is (month, 3).
    interval_unit: Mapped[str] = mapped_column(String(_INTERVAL_UNIT_LEN), nullable=False)
    interval_count: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=1)
    # The day the user signed up, trial or not.
    started_on: Mapped[date] = mapped_column(Date, nullable=False)
    # First paid charge when the subscription began with a free trial.
    trial_ends_on: Mapped[date | None] = mapped_column(Date, nullable=True)
    # Denormalised next charge, advanced by the renewal job, so finding what is
    # due is an indexed range scan instead of date arithmetic over every row.
    next_billing_on: Mapped[date] = mapped_column(Date, nullable=False)
    # Set on cancel instead of deleting, so the row still records the user's history.
    cancelled_on: Mapped[date | None] = mapped_column(Date, nullable=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    __table_args__ = (
        CheckConstraint("amount > 0", name="ck_subscriptions_amount_positive"),
        CheckConstraint(_INTERVAL_UNIT_CHECK, name="ck_subscriptions_interval_unit"),
        CheckConstraint("interval_count > 0", name="ck_subscriptions_interval_count_positive"),
        CheckConstraint("trial_ends_on > started_on", name="ck_subscriptions_trial_after_start"),
        CheckConstraint(
            "next_billing_on >= COALESCE(trial_ends_on, started_on)",
            name="ck_subscriptions_next_billing_after_anchor",
        ),
        CheckConstraint("cancelled_on >= started_on", name="ck_subscriptions_cancel_after_start"),
        Index("ix_subscriptions_user_id", "user_id"),
        # The daily job scans across all users by date, so it needs an index that
        # leads with the date rather than user_id.
        Index("ix_subscriptions_next_billing_on", "next_billing_on"),
        Index("ix_subscriptions_category_id", "category_id"),
    )
