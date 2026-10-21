"""Currency notices against SQLite: who is told a currency was dropped, and only once."""

import uuid
from collections.abc import AsyncGenerator
from datetime import UTC, date, datetime
from decimal import Decimal

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.models.exchange_rate import ExchangeRate
from app.models.finance import Expense
from app.models.notification import Notification, NotificationKind
from app.models.profile import Profile
from app.services.finance.currency_notices import notify_delisted_currencies

SPENDER = uuid.UUID("00000000-0000-0000-0000-000000000007")
REPORTER = uuid.UUID("00000000-0000-0000-0000-000000000008")
BYSTANDER = uuid.UUID("00000000-0000-0000-0000-000000000009")
LAST_QUOTED = datetime(2026, 10, 18, 1, 0, tzinfo=UTC)
DROPPED = datetime(2026, 10, 21, 1, 0, tzinfo=UTC)


@pytest.fixture
async def db(db_factory: async_sessionmaker[AsyncSession]) -> AsyncGenerator[AsyncSession]:
    async with db_factory() as session:
        session.add_all(
            [
                Profile(id=SPENDER),
                Profile(id=REPORTER, display_currency="AMD"),
                Profile(id=BYSTANDER),
                ExchangeRate(currency="USD", rate_per_usd=Decimal("1")),
                ExchangeRate(
                    currency="AMD",
                    rate_per_usd=Decimal("390"),
                    updated_at=LAST_QUOTED,
                    delisted_at=DROPPED,
                ),
            ]
        )
        await session.flush()
        session.add(
            Expense(
                user_id=SPENDER, amount=Decimal("1000"), currency="AMD", spent_on=date(2026, 9, 1)
            )
        )
        await session.commit()
        yield session


async def sent(db: AsyncSession) -> dict[uuid.UUID, Notification]:
    return {n.user_id: n for n in await db.scalars(select(Notification))}


async def test_everyone_using_the_currency_is_told(db: AsyncSession) -> None:
    assert await notify_delisted_currencies(db) == 2

    notices = await sent(db)
    assert set(notices) == {SPENDER, REPORTER}
    spender = notices[SPENDER]
    assert spender.kind == NotificationKind.CURRENCY_DELISTED
    assert spender.title == "AMD is no longer supported"
    # The rate totals keep using is the one last quoted, not the day it vanished.
    assert "last rate, from 18 Oct 2026" in spender.body
    assert spender.dedupe_key == "currency:AMD:delisted:2026-10-21"


async def test_a_profile_using_it_is_pointed_at_the_settings(db: AsyncSession) -> None:
    await notify_delisted_currencies(db)

    notices = await sent(db)
    assert "Your profile still uses AMD" in notices[REPORTER].body
    assert "Your profile" not in notices[SPENDER].body


async def test_running_again_sends_nothing_new(db: AsyncSession) -> None:
    await notify_delisted_currencies(db)

    assert await notify_delisted_currencies(db) == 0
    assert len(await sent(db)) == 2


async def test_nothing_delisted_means_no_notices(db: AsyncSession) -> None:
    amd = await db.get(ExchangeRate, "AMD")
    assert amd is not None
    amd.delisted_at = None
    await db.commit()

    assert await notify_delisted_currencies(db) == 0


async def test_a_notice_moves_to_history_once_the_user_stops_using_the_currency(
    db: AsyncSession,
) -> None:
    await notify_delisted_currencies(db)
    reporter = await db.get(Profile, REPORTER)
    assert reporter is not None
    reporter.display_currency = "USD"
    await db.commit()

    await notify_delisted_currencies(db)

    db.expire_all()
    notices = await sent(db)
    # Moved to the history, where the user can still read and delete it.
    assert notices[REPORTER].archived_at is not None
    assert notices[SPENDER].archived_at is None


async def test_a_notice_moves_to_history_when_the_currency_is_quoted_again(
    db: AsyncSession,
) -> None:
    await notify_delisted_currencies(db)
    amd = await db.get(ExchangeRate, "AMD")
    assert amd is not None
    amd.delisted_at = None
    await db.commit()

    await notify_delisted_currencies(db)

    db.expire_all()
    assert all(n.archived_at is not None for n in (await sent(db)).values())
