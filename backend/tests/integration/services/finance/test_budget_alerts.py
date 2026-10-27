"""Budget alerts against Postgres: when a budget warns, when it says it is
spent, and when an alert stops applying."""

import uuid
from collections.abc import AsyncGenerator
from datetime import UTC, date, datetime
from decimal import Decimal

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.models.exchange_rate import ExchangeRate
from app.models.finance import Budget, BudgetPeriod, Category, Expense
from app.models.notification import Notification, NotificationKind
from app.models.profile import Profile
from app.services.finance.budget_alerts import check_budgets

OWNER = uuid.UUID("00000000-0000-0000-0000-000000000011")
OTHER = uuid.UUID("00000000-0000-0000-0000-000000000012")
FOOD = uuid.UUID("00000000-0000-0000-0000-0000000000f0")
NOW = datetime(2026, 10, 24, 12, 0, tzinfo=UTC)


@pytest.fixture
async def db(db_factory: async_sessionmaker[AsyncSession]) -> AsyncGenerator[AsyncSession]:
    async with db_factory() as session:
        session.add_all(
            [
                Profile(id=OWNER, timezone="UTC"),
                Profile(id=OTHER, timezone="UTC"),
                ExchangeRate(currency="USD", rate_per_usd=Decimal("1")),
            ]
        )
        # Profiles first: no relationship orders the category's insert after them.
        await session.flush()
        session.add(Category(id=FOOD, user_id=OWNER, name="Food"))
        await session.commit()
        yield session


async def budget(db: AsyncSession, **overrides: object) -> Budget:
    """A monthly USD 400 Food budget running since August, warning at 80%."""
    food = await db.get(Category, FOOD)
    fields: dict[str, object] = {
        "user_id": OWNER,
        "name": "Food",
        "amount": Decimal("400.00"),
        "currency": "USD",
        "period": BudgetPeriod.MONTHLY,
        "starts_on": date(2026, 8, 1),
        "ends_on": None,
        "warn_at_percent": 80,
        "categories": [food],
    }
    fields.update(overrides)
    row = Budget(**fields)
    db.add(row)
    await db.commit()
    return row


async def spend(db: AsyncSession, amount: str, on: date = date(2026, 10, 5), **kw: object) -> None:
    db.add(
        Expense(
            user_id=OWNER,
            category_id=kw.get("category_id", FOOD),
            amount=Decimal(amount),
            currency=kw.get("currency", "USD"),
            spent_on=on,
        )
    )
    await db.commit()


async def alerts(db: AsyncSession) -> list[Notification]:
    return list(await db.scalars(select(Notification).order_by(Notification.created_at)))


def inbox(rows: list[Notification]) -> list[Notification]:
    return [n for n in rows if n.archived_at is None]


async def test_nothing_is_sent_below_the_warning(db: AsyncSession) -> None:
    await budget(db)
    await spend(db, "319.99")

    run = await check_budgets(db, now=NOW)

    assert (run.checked, run.alerted, run.cleared) == (1, 0, 0)
    assert await alerts(db) == []


async def test_reaching_the_warning_sends_one_warning(db: AsyncSession) -> None:
    row = await budget(db)
    await spend(db, "320.00")

    run = await check_budgets(db, now=NOW)

    assert run.alerted == 1
    [alert] = await alerts(db)
    assert alert.user_id == OWNER
    assert alert.kind == NotificationKind.BUDGET_WARNING
    assert alert.title == "Food is 80% spent"
    assert alert.body == "USD 320.00 of USD 400.00 spent in October 2026, USD 80.00 left."
    assert alert.dedupe_key == f"budget:{row.id}:2026-10-01:80:400USD"
    assert alert.read_at is None and alert.archived_at is None


async def test_running_again_sends_nothing_new(db: AsyncSession) -> None:
    await budget(db)
    await spend(db, "350.00")
    await check_budgets(db, now=NOW)

    run = await check_budgets(db, now=NOW)

    assert (run.alerted, run.cleared) == (0, 0)
    assert len(await alerts(db)) == 1


async def test_going_over_supersedes_the_warning(db: AsyncSession) -> None:
    await budget(db)
    await spend(db, "350.00")
    await check_budgets(db, now=NOW)
    await spend(db, "60.00")

    run = await check_budgets(db, now=NOW)

    assert (run.alerted, run.cleared) == (1, 1)
    warning, exceeded = await alerts(db)
    assert warning.kind == NotificationKind.BUDGET_WARNING
    assert warning.archived_at is not None and warning.read_at is not None
    assert exceeded.kind == NotificationKind.BUDGET_EXCEEDED
    assert exceeded.title == "Food is over budget"
    assert exceeded.body == "USD 410.00 of USD 400.00 spent in October 2026, USD 10.00 over."
    assert exceeded.archived_at is None


async def test_jumping_past_the_cap_sends_only_the_exceeded_alert(db: AsyncSession) -> None:
    await budget(db)
    await spend(db, "500.00")

    await check_budgets(db, now=NOW)

    assert [n.kind for n in await alerts(db)] == [NotificationKind.BUDGET_EXCEEDED]


async def test_spending_exactly_the_cap_says_it_is_fully_spent(db: AsyncSession) -> None:
    await budget(db)
    await spend(db, "400.00")

    await check_budgets(db, now=NOW)

    [alert] = await alerts(db)
    assert alert.title == "Food is fully spent"
    assert alert.body == "USD 400.00 of USD 400.00 spent in October 2026, nothing left."


async def test_with_the_warning_off_only_the_cap_is_announced(db: AsyncSession) -> None:
    await budget(db, warn_at_percent=None)
    await spend(db, "399.00")
    assert (await check_budgets(db, now=NOW)).alerted == 0

    await spend(db, "1.00")
    await check_budgets(db, now=NOW)

    assert [n.kind for n in await alerts(db)] == [NotificationKind.BUDGET_EXCEEDED]


async def test_raising_the_cap_clears_the_alert_and_can_warn_again(db: AsyncSession) -> None:
    row = await budget(db)
    await spend(db, "340.00")
    await check_budgets(db, now=NOW)

    row.amount = Decimal("1000.00")
    await db.commit()
    run = await check_budgets(db, now=NOW)
    assert (run.alerted, run.cleared) == (0, 1)

    await spend(db, "500.00")
    await check_budgets(db, now=NOW)
    [_, again] = await alerts(db)
    assert again.title == "Food is 84% spent"
    assert again.dedupe_key.endswith(":80:1000USD")
    assert again.archived_at is None


async def test_deleting_the_budget_clears_its_alert(db: AsyncSession) -> None:
    row = await budget(db)
    await spend(db, "390.00")
    await check_budgets(db, now=NOW)

    await db.delete(row)
    await db.commit()
    run = await check_budgets(db, now=NOW)

    assert run.cleared == 1
    assert inbox(await alerts(db)) == []


async def test_a_monthly_budget_starts_each_month_with_a_clean_slate(db: AsyncSession) -> None:
    await budget(db)
    await spend(db, "450.00", on=date(2026, 10, 5))
    await check_budgets(db, now=NOW)

    # November has nothing spent yet: October's alert has ended with its month.
    november = datetime(2026, 11, 2, 12, 0, tzinfo=UTC)
    run = await check_budgets(db, now=november)
    assert (run.alerted, run.cleared) == (0, 1)

    await spend(db, "420.00", on=date(2026, 11, 2))
    await check_budgets(db, now=november)
    current = inbox(await alerts(db))
    assert [n.dedupe_key.split(":")[2] for n in current] == ["2026-11-01"]
    assert current[0].body.endswith("spent in November 2026, USD 20.00 over.")


async def test_last_months_overspend_is_not_news(db: AsyncSession) -> None:
    await budget(db)
    await spend(db, "900.00", on=date(2026, 9, 20))

    run = await check_budgets(db, now=NOW)

    assert (run.checked, run.alerted) == (1, 0)


async def test_a_custom_budget_alerts_only_while_it_runs(db: AsyncSession) -> None:
    await budget(
        db,
        name="Trip",
        period=BudgetPeriod.CUSTOM,
        starts_on=date(2026, 10, 1),
        ends_on=date(2026, 10, 10),
    )
    await spend(db, "500.00", on=date(2026, 10, 5))

    assert (await check_budgets(db, now=NOW)).checked == 0

    during = datetime(2026, 10, 8, 12, 0, tzinfo=UTC)
    await check_budgets(db, now=during)
    [alert] = await alerts(db)
    assert alert.body == (
        "USD 500.00 of USD 400.00 spent from 1 Oct to 10 Oct 2026, USD 100.00 over."
    )


async def test_today_is_the_users_today(db: AsyncSession) -> None:
    profile = await db.get(Profile, OWNER)
    assert profile is not None
    profile.timezone = "Asia/Singapore"
    await budget(db)
    await spend(db, "450.00", on=date(2026, 11, 1))

    # 17:00 UTC on 31 October is already 1 November in Singapore.
    await check_budgets(db, now=datetime(2026, 10, 31, 17, 0, tzinfo=UTC))

    [alert] = await alerts(db)
    assert "November 2026" in alert.body


async def test_a_missing_rate_skips_the_user_and_keeps_their_alerts(db: AsyncSession) -> None:
    await budget(db)
    await spend(db, "390.00")
    await check_budgets(db, now=NOW)
    # No SGD rate is stored, so this budget has no honest figure.
    await spend(db, "10.00", currency="SGD")

    run = await check_budgets(db, now=NOW)

    assert (run.checked, run.alerted, run.cleared) == (0, 0, 0)
    assert len(inbox(await alerts(db))) == 1


async def test_only_the_budgets_owner_is_told(db: AsyncSession) -> None:
    await budget(db)
    await spend(db, "400.00")

    await check_budgets(db, now=NOW)

    assert {n.user_id for n in await alerts(db)} == {OWNER}
