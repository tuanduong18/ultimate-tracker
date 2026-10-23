"""Subscription reminders against Postgres: the daily countdown, re-alerting,
snoozing, and how edits rewrite them."""

import uuid
from collections.abc import AsyncGenerator
from datetime import UTC, date, datetime
from decimal import Decimal
from typing import Any

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.models.finance import Subscription
from app.models.notification import Notification, NotificationKind
from app.models.profile import Profile
from app.schemas.finance import SubscriptionCreate, SubscriptionUpdate
from app.services import finance as finance_service
from app.services import notifications
from app.services.finance.reminders import ReminderRun, refresh_reminders

UTC_USER = uuid.UUID("00000000-0000-0000-0000-000000000005")
SGT_USER = uuid.UUID("00000000-0000-0000-0000-000000000006")
# Noon UTC on 20 Oct: still the 20th in Singapore (20:00), so both users agree.
NOON = datetime(2026, 10, 20, 12, 0, tzinfo=UTC)
TODAY = NOON.date()
LEAD = 3


@pytest.fixture
async def db(db_factory: async_sessionmaker[AsyncSession]) -> AsyncGenerator[AsyncSession]:
    async with db_factory() as session:
        session.add_all(
            [
                Profile(id=UTC_USER, timezone="UTC"),
                Profile(id=SGT_USER, timezone="Asia/Singapore"),
            ]
        )
        await session.commit()
        yield session


async def add(db: AsyncSession, **overrides: Any) -> uuid.UUID:
    """A monthly USD 12.99 subscription charging next on 22 Oct, two days out.

    Returns the id, not the row: jobs commit, which expires loaded rows.
    """
    fields: dict[str, Any] = {
        "id": uuid.uuid4(),
        "user_id": UTC_USER,
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


async def run(db: AsyncSession, now: datetime = NOON) -> ReminderRun:
    return await refresh_reminders(db, now=now, lead_days=LEAD)


async def reminders(db: AsyncSession) -> list[Notification]:
    # populate_existing: rows already loaded are refreshed, not served stale.
    stmt = (
        select(Notification)
        .order_by(Notification.created_at)
        .execution_options(populate_existing=True)
    )
    return list((await db.scalars(stmt)).all())


async def only(db: AsyncSession) -> Notification:
    [reminder] = await reminders(db)
    return reminder


def at(day: int, hour: int = 12) -> datetime:
    return datetime(2026, 10, day, hour, 0, tzinfo=UTC)


# --- The countdown --------------------------------------------------------------


async def test_a_charge_within_the_lead_time_gets_a_reminder(db: AsyncSession) -> None:
    subscription_id = await add(db)

    assert await run(db) == ReminderRun(created=1)

    reminder = await only(db)
    assert reminder.user_id == UTC_USER
    assert reminder.kind == NotificationKind.SUBSCRIPTION_RENEWAL
    assert reminder.title == "Streaming renews in 2 days"
    assert reminder.body == "USD 12.99 will be charged on 22 Oct 2026."
    assert reminder.due_on == date(2026, 10, 22)
    assert reminder.dedupe_key == f"subscription:{subscription_id}:2026-10-22"


async def test_the_countdown_is_rewritten_each_day_and_alerts_again(db: AsyncSession) -> None:
    await add(db, started_on=date(2026, 9, 23), next_billing_on=date(2026, 10, 23))
    await run(db, at(20))
    first = await only(db)
    assert first.title == "Streaming renews in 3 days"
    await notifications.set_read(db, UTC_USER, first.id, read=True)

    assert await run(db, at(21)) == ReminderRun(updated=1)

    reminder = await only(db)
    assert reminder.title == "Streaming renews in 2 days"
    assert reminder.read_at is None
    await run(db, at(22))
    assert (await only(db)).title == "Streaming renews tomorrow"


async def test_running_again_the_same_day_changes_nothing(db: AsyncSession) -> None:
    await add(db)
    await run(db)
    reminder = await only(db)
    await notifications.set_read(db, UTC_USER, reminder.id, read=True)

    assert await run(db, at(20, hour=22)) == ReminderRun()
    assert (await only(db)).read_at is not None


@pytest.mark.parametrize(
    ("charge", "reminded"),
    [
        (date(2026, 10, 20), False),  # today: the renewal job's business
        (date(2026, 10, 21), True),
        (date(2026, 10, 23), True),  # exactly the lead time
        (date(2026, 10, 24), False),  # too early
    ],
)
async def test_only_charges_within_the_lead_time_count(
    db: AsyncSession, charge: date, reminded: bool
) -> None:
    await add(db, started_on=charge.replace(month=9), next_billing_on=charge)

    assert (await run(db)).created == int(reminded)


async def test_trial_ending_says_so(db: AsyncSession) -> None:
    await add(
        db,
        started_on=date(2026, 10, 15),
        trial_ends_on=date(2026, 10, 22),
        next_billing_on=date(2026, 10, 22),
    )

    await run(db)

    reminder = await only(db)
    assert reminder.kind == NotificationKind.TRIAL_ENDING
    assert reminder.title == "Your Streaming trial ends in 2 days"
    assert reminder.body.startswith("The first charge of USD 12.99 is on 22 Oct 2026.")


async def test_money_is_written_in_the_currencys_own_minor_units(db: AsyncSession) -> None:
    await add(db, amount=Decimal("260000"), currency="VND")

    await run(db)

    assert (await only(db)).body == "VND 260,000 will be charged on 22 Oct 2026."


@pytest.mark.parametrize(
    ("cancelled_on", "reminded"),
    [
        (date(2026, 10, 1), False),  # already over
        (date(2026, 10, 22), False),  # ends on the charge date, so no charge
        (date(2026, 10, 25), True),  # ends after the charge, which still happens
    ],
)
async def test_cancellation_decides_whether_the_charge_happens(
    db: AsyncSession, cancelled_on: date, reminded: bool
) -> None:
    await add(db, cancelled_on=cancelled_on)

    assert (await run(db)).created == int(reminded)


async def test_the_countdown_is_counted_from_the_users_today(db: AsyncSession) -> None:
    """20:00 UTC on the 20th is already 04:00 on the 21st in Singapore, so a
    charge on the 24th is three days out there and four days out in UTC."""
    for user in (UTC_USER, SGT_USER):
        await add(
            db, user_id=user, started_on=date(2026, 9, 24), next_billing_on=date(2026, 10, 24)
        )

    assert (await run(db, at(20, hour=20))).created == 1
    assert (await only(db)).user_id == SGT_USER


async def test_a_reminder_left_behind_is_cleaned_up(db: AsyncSession) -> None:
    await add(db)
    await run(db)

    # Days later, with no renewal having taken it (as for a stopped charge).
    assert (await run(db, at(25))).removed == 1
    assert await reminders(db) == []


# --- Snoozing ------------------------------------------------------------------


async def test_a_snoozed_reminder_counts_down_quietly(db: AsyncSession) -> None:
    await add(db, started_on=date(2026, 9, 23), next_billing_on=date(2026, 10, 23))
    await run(db, at(20))
    snoozed = await notifications.set_snoozed(db, UTC_USER, (await only(db)).id, snoozed=True)
    alerted = snoozed.alerted_at

    await run(db, at(21))

    reminder = await only(db)
    assert reminder.title == "Streaming renews in 2 days"
    assert reminder.snoozed_at is not None
    assert reminder.read_at is not None
    assert reminder.alerted_at == alerted


# --- Edits ---------------------------------------------------------------------


async def update(db: AsyncSession, subscription_id: uuid.UUID, **changes: Any) -> None:
    await finance_service.update_subscription(
        db, UTC_USER, subscription_id, SubscriptionUpdate(**changes), today=TODAY
    )


async def test_creating_a_subscription_due_soon_reminds_at_once(db: AsyncSession) -> None:
    await finance_service.create_subscription(
        db,
        UTC_USER,
        SubscriptionCreate(
            name="Streaming",
            amount=Decimal("12.99"),
            currency="USD",
            interval_unit="month",
            started_on=date(2026, 10, 22),
        ),
        today=TODAY,
    )

    assert (await only(db)).title == "Streaming renews in 2 days"


async def test_editing_the_amount_rewrites_the_reminder_in_place(db: AsyncSession) -> None:
    subscription_id = await add(db)
    await run(db)
    before = await only(db)
    await notifications.set_read(db, UTC_USER, before.id, read=True)

    await update(db, subscription_id, amount=Decimal("15.99"))

    reminder = await only(db)
    assert reminder.id == before.id
    assert reminder.body == "USD 15.99 will be charged on 22 Oct 2026."
    # The user should see what their edit did.
    assert reminder.read_at is None


async def test_an_edit_brings_a_snoozed_reminder_back(db: AsyncSession) -> None:
    subscription_id = await add(db)
    await run(db)
    await notifications.set_snoozed(db, UTC_USER, (await only(db)).id, snoozed=True)

    await update(db, subscription_id, name="Streaming Plus")

    reminder = await only(db)
    assert reminder.title == "Streaming Plus renews in 2 days"
    assert reminder.snoozed_at is None


async def test_moving_the_date_inside_the_window_replaces_the_reminder(db: AsyncSession) -> None:
    subscription_id = await add(db)
    await run(db)

    await update(db, subscription_id, started_on=date(2026, 9, 21))

    reminder = await only(db)
    assert reminder.due_on == date(2026, 10, 21)
    assert reminder.title == "Streaming renews tomorrow"


async def test_moving_the_date_out_of_the_window_removes_the_reminder(db: AsyncSession) -> None:
    subscription_id = await add(db)
    await run(db)

    await update(db, subscription_id, started_on=date(2026, 9, 30))

    assert await reminders(db) == []


async def test_an_edit_the_reminder_does_not_show_leaves_it_alone(db: AsyncSession) -> None:
    subscription_id = await add(db)
    await run(db)
    reminder = await only(db)
    await notifications.set_read(db, UTC_USER, reminder.id, read=True)

    await update(db, subscription_id, note="family plan")

    assert (await only(db)).read_at is not None


async def test_cancelling_before_the_charge_removes_the_reminder(db: AsyncSession) -> None:
    subscription_id = await add(db)
    await run(db)

    await update(db, subscription_id, cancelled_on=date(2026, 10, 21))

    assert await reminders(db) == []
    assert (await run(db)).created == 0


async def test_deleting_the_subscription_removes_the_reminder(db: AsyncSession) -> None:
    subscription_id = await add(db)
    await run(db)

    await finance_service.delete_subscription(db, UTC_USER, subscription_id)

    assert await reminders(db) == []
