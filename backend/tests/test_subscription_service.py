"""Service-level tests for subscriptions: billing-date arithmetic and CRUD."""

import uuid
from collections.abc import AsyncGenerator
from datetime import date
from decimal import Decimal
from typing import Any

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from app.db.base import Base
from app.models.finance import BillingInterval, Category
from app.schemas.finance import SubscriptionCreate, SubscriptionUpdate
from app.services import finance as finance_service
from app.services import profile as profile_service

USER_ID = uuid.UUID("00000000-0000-0000-0000-000000000003")
OTHER_USER_ID = uuid.UUID("00000000-0000-0000-0000-000000000004")
TODAY = date(2026, 10, 15)

MONTH = BillingInterval.MONTH


@pytest.fixture
async def db() -> AsyncGenerator[AsyncSession]:
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        poolclass=StaticPool,
        connect_args={"check_same_thread": False},
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    factory = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    async with factory() as session:
        # Seeds the default categories, "Subscriptions" among them.
        await profile_service.get_or_create_profile(session, USER_ID)
        await profile_service.get_or_create_profile(session, OTHER_USER_ID)
        yield session
    await engine.dispose()


def _create(**overrides: Any) -> SubscriptionCreate:
    fields: dict[str, Any] = {
        "name": "Streaming",
        "amount": "12.99",
        "currency": "USD",
        "interval_unit": "month",
        "started_on": TODAY,
    }
    return SubscriptionCreate.model_validate(fields | overrides)


async def _category_id(db: AsyncSession, user_id: uuid.UUID, name: str) -> uuid.UUID:
    category_id = await db.scalar(
        select(Category.id).where(Category.user_id == user_id, Category.name == name)
    )
    assert category_id is not None
    return category_id


# --- Billing dates ------------------------------------------------------------


@pytest.mark.parametrize(
    ("k", "expected"),
    [
        (0, date(2026, 1, 31)),
        (1, date(2026, 2, 28)),
        # Back to the 31st: measured from the anchor, not from 28 Feb.
        (2, date(2026, 3, 31)),
        (3, date(2026, 4, 30)),
        (12, date(2027, 1, 31)),
    ],
)
def test_monthly_charges_clamp_to_month_end_without_drifting(k: int, expected: date) -> None:
    assert finance_service.billing_date(date(2026, 1, 31), MONTH, 1, k) == expected


def test_yearly_leap_day_anchor_falls_back_to_28_feb() -> None:
    anchor = date(2028, 2, 29)
    assert finance_service.billing_date(anchor, BillingInterval.YEAR, 1, 1) == date(2029, 2, 28)
    assert finance_service.billing_date(anchor, BillingInterval.YEAR, 1, 4) == date(2032, 2, 29)


@pytest.mark.parametrize(
    ("anchor", "unit", "count", "expected"),
    [
        # Future anchor: the anchor itself.
        (date(2026, 11, 1), MONTH, 1, date(2026, 11, 1)),
        # A charge due today is still upcoming.
        (date(2026, 9, 15), MONTH, 1, date(2026, 10, 15)),
        (date(2026, 9, 16), MONTH, 1, date(2026, 10, 16)),
        (date(2026, 9, 14), MONTH, 1, date(2026, 11, 14)),
        # Quarterly from January: Jan, Apr, Jul, Oct, Jan.
        (date(2026, 1, 10), MONTH, 3, date(2027, 1, 10)),
        (date(2026, 10, 1), BillingInterval.WEEK, 2, date(2026, 10, 15)),
        (date(2026, 10, 2), BillingInterval.WEEK, 2, date(2026, 10, 16)),
        (date(2020, 1, 1), BillingInterval.DAY, 1, TODAY),
        (date(2019, 10, 20), BillingInterval.YEAR, 1, date(2026, 10, 20)),
    ],
)
def test_next_billing_date(anchor: date, unit: BillingInterval, count: int, expected: date) -> None:
    assert finance_service.next_billing_date(anchor, unit, count, TODAY) == expected


# --- Create -------------------------------------------------------------------


async def test_create_defaults_to_the_subscriptions_category(db: AsyncSession) -> None:
    subscription = await finance_service.create_subscription(db, USER_ID, _create(), today=TODAY)

    assert subscription.category_id == await _category_id(db, USER_ID, "Subscriptions")
    assert subscription.next_billing_on == TODAY
    assert subscription.amount == Decimal("12.99")


async def test_explicit_null_category_leaves_it_uncategorized(db: AsyncSession) -> None:
    subscription = await finance_service.create_subscription(
        db, USER_ID, _create(category_id=None), today=TODAY
    )
    assert subscription.category_id is None


async def test_create_rejects_another_users_category(db: AsyncSession) -> None:
    foreign = await _category_id(db, OTHER_USER_ID, "Food")
    with pytest.raises(finance_service.UnknownCategoryError):
        await finance_service.create_subscription(
            db, USER_ID, _create(category_id=str(foreign)), today=TODAY
        )


async def test_trial_moves_the_first_charge_to_its_end(db: AsyncSession) -> None:
    subscription = await finance_service.create_subscription(
        db, USER_ID, _create(trial_ends_on=date(2026, 10, 22)), today=TODAY
    )
    assert subscription.next_billing_on == date(2026, 10, 22)


async def test_a_past_start_schedules_from_today(db: AsyncSession) -> None:
    subscription = await finance_service.create_subscription(
        db, USER_ID, _create(started_on=date(2026, 3, 20)), today=TODAY
    )
    assert subscription.next_billing_on == date(2026, 10, 20)


# --- Update -------------------------------------------------------------------


async def test_changing_the_interval_reschedules(db: AsyncSession) -> None:
    created = await finance_service.create_subscription(
        db, USER_ID, _create(started_on=date(2026, 1, 20)), today=TODAY
    )
    assert created.next_billing_on == date(2026, 10, 20)

    updated = await finance_service.update_subscription(
        db, USER_ID, created.id, SubscriptionUpdate(interval_unit=BillingInterval.YEAR), today=TODAY
    )
    assert updated.next_billing_on == date(2027, 1, 20)


async def test_a_price_change_leaves_the_schedule_alone(db: AsyncSession) -> None:
    created = await finance_service.create_subscription(db, USER_ID, _create(), today=TODAY)
    later = date(2026, 12, 1)

    updated = await finance_service.update_subscription(
        db, USER_ID, created.id, SubscriptionUpdate(amount=Decimal("15.99")), today=later
    )
    assert updated.amount == Decimal("15.99")
    assert updated.next_billing_on == TODAY


async def test_resuming_skips_the_missed_charges(db: AsyncSession) -> None:
    created = await finance_service.create_subscription(db, USER_ID, _create(), today=TODAY)
    await finance_service.update_subscription(
        db, USER_ID, created.id, SubscriptionUpdate(cancelled_on=TODAY), today=TODAY
    )

    resumed = await finance_service.update_subscription(
        db,
        USER_ID,
        created.id,
        SubscriptionUpdate.model_validate({"cancelled_on": None}),
        today=date(2027, 2, 3),
    )
    assert resumed.cancelled_on is None
    assert resumed.next_billing_on == date(2027, 2, 15)


@pytest.mark.parametrize(
    "payload",
    [
        # Each is fine on its own; it clashes with what is stored: started on
        # TODAY (15 Oct), cancelled on 20 Oct.
        {"trial_ends_on": "2026-10-15"},
        {"cancelled_on": "2026-10-14"},
        {"started_on": "2026-11-01"},
    ],
)
async def test_update_rejects_dates_out_of_order_against_stored_values(
    db: AsyncSession, payload: dict[str, Any]
) -> None:
    created = await finance_service.create_subscription(db, USER_ID, _create(), today=TODAY)
    await finance_service.update_subscription(
        db, USER_ID, created.id, SubscriptionUpdate(cancelled_on=date(2026, 10, 20)), today=TODAY
    )

    with pytest.raises(finance_service.InvalidDateRangeError):
        await finance_service.update_subscription(
            db, USER_ID, created.id, SubscriptionUpdate.model_validate(payload), today=TODAY
        )


async def test_update_amount_is_checked_against_the_stored_currency(db: AsyncSession) -> None:
    created = await finance_service.create_subscription(
        db, USER_ID, _create(amount="99000", currency="VND"), today=TODAY
    )
    with pytest.raises(finance_service.InvalidAmountError):
        await finance_service.update_subscription(
            db, USER_ID, created.id, SubscriptionUpdate(amount=Decimal("1.5")), today=TODAY
        )


# --- List and delete ----------------------------------------------------------


async def test_list_puts_live_subscriptions_first_by_next_charge(db: AsyncSession) -> None:
    later = await finance_service.create_subscription(
        db, USER_ID, _create(name="Later", started_on=date(2026, 11, 2)), today=TODAY
    )
    cancelled = await finance_service.create_subscription(
        db, USER_ID, _create(name="Cancelled"), today=TODAY
    )
    await finance_service.update_subscription(
        db, USER_ID, cancelled.id, SubscriptionUpdate(cancelled_on=TODAY), today=TODAY
    )
    sooner = await finance_service.create_subscription(
        db, USER_ID, _create(name="Sooner", started_on=date(2026, 10, 20)), today=TODAY
    )
    await finance_service.create_subscription(db, OTHER_USER_ID, _create(), today=TODAY)

    listed = await finance_service.list_subscriptions(db, USER_ID)
    assert [s.id for s in listed] == [sooner.id, later.id, cancelled.id]


async def test_another_user_cannot_touch_a_subscription(db: AsyncSession) -> None:
    created = await finance_service.create_subscription(db, USER_ID, _create(), today=TODAY)

    with pytest.raises(finance_service.NotFoundError):
        await finance_service.update_subscription(
            db, OTHER_USER_ID, created.id, SubscriptionUpdate(name="Mine now"), today=TODAY
        )
    with pytest.raises(finance_service.NotFoundError):
        await finance_service.delete_subscription(db, OTHER_USER_ID, created.id)


async def test_delete_removes_the_subscription(db: AsyncSession) -> None:
    created = await finance_service.create_subscription(db, USER_ID, _create(), today=TODAY)
    await finance_service.delete_subscription(db, USER_ID, created.id)
    assert await finance_service.list_subscriptions(db, USER_ID) == []
