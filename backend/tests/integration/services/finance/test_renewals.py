"""The renewal job against SQLite: each charge becomes an expense once, the
reminder makes way for a renewal notice, and missed days are caught up."""

import uuid
from collections.abc import AsyncGenerator
from datetime import UTC, date, datetime
from decimal import Decimal
from typing import Any

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.models.finance import Expense, Subscription
from app.models.notification import Notification, NotificationKind
from app.models.profile import Profile
from app.services import notifications
from app.services.finance.reminders import refresh_reminders
from app.services.finance.renewals import renew_due_subscriptions

USER = uuid.UUID("00000000-0000-0000-0000-000000000007")
SGT_USER = uuid.UUID("00000000-0000-0000-0000-000000000008")


def at(day: int, hour: int = 12, month: int = 10) -> datetime:
    return datetime(2026, month, day, hour, 0, tzinfo=UTC)


@pytest.fixture
async def db(db_factory: async_sessionmaker[AsyncSession]) -> AsyncGenerator[AsyncSession]:
    async with db_factory() as session:
        session.add_all(
            [Profile(id=USER, timezone="UTC"), Profile(id=SGT_USER, timezone="Asia/Singapore")]
        )
        await session.commit()
        yield session


async def add(db: AsyncSession, **overrides: Any) -> uuid.UUID:
    """A monthly USD 12.99 subscription charging next on 22 Oct."""
    fields: dict[str, Any] = {
        "id": uuid.uuid4(),
        "user_id": USER,
        "name": "Streaming",
        "amount": Decimal("12.99"),
        "currency": "USD",
        "interval_unit": "month",
        "interval_count": 1,
        "started_on": date(2026, 9, 22),
        "next_billing_on": date(2026, 10, 22),
    }
    fields.update(overrides)
    db.add(Subscription(**fields))
    await db.commit()
    return uuid.UUID(str(fields["id"]))


async def renew(db: AsyncSession, now: datetime) -> int:
    return await renew_due_subscriptions(db, now=now)


async def expenses(db: AsyncSession) -> list[Expense]:
    stmt = select(Expense).order_by(Expense.spent_on).execution_options(populate_existing=True)
    return list((await db.scalars(stmt)).all())


async def notices(db: AsyncSession) -> list[Notification]:
    stmt = (
        select(Notification).order_by(Notification.due_on).execution_options(populate_existing=True)
    )
    return list((await db.scalars(stmt)).all())


async def next_billing(db: AsyncSession, subscription_id: uuid.UUID) -> date:
    subscription = await db.get(Subscription, subscription_id, populate_existing=True)
    assert subscription is not None
    return subscription.next_billing_on


async def test_a_charge_day_records_an_expense_and_moves_on(db: AsyncSession) -> None:
    subscription_id = await add(db)

    assert await renew(db, at(22)) == 1

    [expense] = await expenses(db)
    assert (expense.user_id, expense.amount, expense.currency) == (USER, Decimal("12.99"), "USD")
    # Dated to the charge it covers, not the day the job ran.
    assert expense.spent_on == date(2026, 10, 22)
    assert expense.description == "Streaming"
    assert await next_billing(db, subscription_id) == date(2026, 11, 22)


async def test_running_again_records_nothing_more(db: AsyncSession) -> None:
    await add(db)
    await renew(db, at(22))

    assert await renew(db, at(22, hour=23)) == 0
    assert len(await expenses(db)) == 1


async def test_nothing_happens_before_the_charge_day(db: AsyncSession) -> None:
    await add(db)

    assert await renew(db, at(21)) == 0


async def test_the_charge_day_is_the_users_charge_day(db: AsyncSession) -> None:
    await add(db, user_id=SGT_USER)

    # 18:00 UTC on the 21st is 02:00 on the 22nd in Singapore.
    assert await renew(db, at(21, hour=18)) == 1


async def test_missed_days_are_caught_up_charge_by_charge(db: AsyncSession) -> None:
    subscription_id = await add(
        db, interval_unit="week", started_on=date(2026, 10, 1), next_billing_on=date(2026, 10, 1)
    )
    # Charges on 1, 8, 15 and 22 Oct; the job last ran in September.

    assert await renew(db, at(22)) == 4

    spent = [e.spent_on.day for e in await expenses(db)]
    assert spent == [1, 8, 15, 22]
    assert await next_billing(db, subscription_id) == date(2026, 10, 29)
    # Only the latest charge is news; the rest go straight to the history.
    inbox = [n for n in await notices(db) if n.archived_at is None]
    assert [n.due_on for n in inbox] == [date(2026, 10, 22)]


@pytest.mark.parametrize(
    ("cancelled_on", "charged"), [(date(2026, 10, 22), 0), (date(2026, 10, 23), 1)]
)
async def test_a_cancellation_on_or_before_the_charge_stops_it(
    db: AsyncSession, cancelled_on: date, charged: int
) -> None:
    await add(db, cancelled_on=cancelled_on)

    assert await renew(db, at(22)) == charged


async def test_the_renewal_notice_replaces_the_reminder(db: AsyncSession) -> None:
    await add(db)
    await refresh_reminders(db, now=at(20), lead_days=3)

    await renew(db, at(22))

    [notice] = await notices(db)
    assert notice.kind == NotificationKind.SUBSCRIPTION_RENEWED
    assert notice.title == "Streaming auto-renewed on 22 Oct"
    assert notice.body == "It cost USD 12.99, logged as an expense."
    assert notice.archived_at is None
    assert notice.read_at is None


async def test_a_snoozed_reminder_sends_the_notice_to_the_history(db: AsyncSession) -> None:
    await add(db)
    await refresh_reminders(db, now=at(20), lead_days=3)
    [reminder] = await notices(db)
    await notifications.set_snoozed(db, USER, reminder.id, snoozed=True)

    await renew(db, at(22))

    [notice] = await notices(db)
    assert notice.kind == NotificationKind.SUBSCRIPTION_RENEWED
    assert notice.archived_at is not None


async def test_a_trial_ending_says_the_trial_ended(db: AsyncSession) -> None:
    await add(
        db,
        started_on=date(2026, 10, 15),
        trial_ends_on=date(2026, 10, 22),
        next_billing_on=date(2026, 10, 22),
    )

    await renew(db, at(22))

    [notice] = await notices(db)
    assert notice.title == "Your Streaming trial ended on 22 Oct"
    assert notice.body == "The first charge of USD 12.99 was logged as an expense."
