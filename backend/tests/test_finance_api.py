"""Route-level tests for the finance domain against an in-memory database.

Runs the full route -> service -> DB path with auth dependency-overridden.
Foreign keys are switched on in SQLite so ON DELETE behaviour (SET NULL on
expenses, CASCADE on budget join rows) is exercised for real.
"""

import uuid
from collections.abc import AsyncGenerator
from datetime import date
from decimal import Decimal
from typing import Any

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import event
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from app.core.currencies import CURRENCY_CODES
from app.core.security import get_current_user_id
from app.db.base import Base
from app.db.session import get_db
from app.main import app
from app.models.finance import Budget, Category
from app.models.profile import Profile
from app.services import exchange_rates

TEST_USER_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")
OTHER_USER_ID = uuid.UUID("00000000-0000-0000-0000-000000000002")


@pytest.fixture
async def db_factory() -> AsyncGenerator[async_sessionmaker[AsyncSession]]:
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        poolclass=StaticPool,
        connect_args={"check_same_thread": False},
    )

    @event.listens_for(engine.sync_engine, "connect")
    def _enable_foreign_keys(dbapi_connection: Any, _record: Any) -> None:
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    factory = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    async with factory() as session:
        session.add_all([Profile(id=TEST_USER_ID), Profile(id=OTHER_USER_ID)])
        await session.commit()

    yield factory
    await engine.dispose()


@pytest.fixture
async def finance_client(
    db_factory: async_sessionmaker[AsyncSession],
) -> AsyncGenerator[AsyncClient]:
    async def override_get_db() -> AsyncGenerator[AsyncSession]:
        async with db_factory() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user_id] = lambda: TEST_USER_ID

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client

    app.dependency_overrides.clear()


async def make_category(client: AsyncClient, name: str = "Food") -> dict[str, Any]:
    resp = await client.post("/api/v1/finance/categories", json={"name": name})
    assert resp.status_code == 201
    return dict(resp.json())


async def make_expense(client: AsyncClient, **overrides: Any) -> dict[str, Any]:
    payload: dict[str, Any] = {"amount": "12.50", "currency": "USD", "spent_on": "2026-08-19"}
    payload.update(overrides)
    resp = await client.post("/api/v1/finance/expenses", json=payload)
    assert resp.status_code == 201, resp.text
    return dict(resp.json())


# --- Categories ---------------------------------------------------------------


async def test_category_create_and_list(finance_client: AsyncClient) -> None:
    created = await make_category(finance_client, name="  Food  ")
    assert created["name"] == "Food"
    assert created["colour"] == "#94a3b8"

    listed = (await finance_client.get("/api/v1/finance/categories")).json()
    assert [c["name"] for c in listed] == ["Food"]


async def test_duplicate_category_name_is_a_409(finance_client: AsyncClient) -> None:
    await make_category(finance_client)
    resp = await finance_client.post("/api/v1/finance/categories", json={"name": "Food"})
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "CATEGORY_NAME_TAKEN"


async def test_rename_category_onto_taken_name_is_a_409(finance_client: AsyncClient) -> None:
    await make_category(finance_client, name="Food")
    rent = await make_category(finance_client, name="Rent")
    resp = await finance_client.patch(
        f"/api/v1/finance/categories/{rent['id']}", json={"name": "Food"}
    )
    assert resp.status_code == 409


async def test_someone_elses_category_is_invisible(
    finance_client: AsyncClient, db_factory: async_sessionmaker[AsyncSession]
) -> None:
    async with db_factory() as session:
        theirs = Category(user_id=OTHER_USER_ID, name="Theirs")
        session.add(theirs)
        await session.commit()

    resp = await finance_client.patch(
        f"/api/v1/finance/categories/{theirs.id}", json={"name": "Mine now"}
    )
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "NOT_FOUND"


async def test_deleting_a_category_uncategorizes_its_expenses(
    finance_client: AsyncClient,
) -> None:
    category = await make_category(finance_client)
    await make_expense(finance_client, category_id=category["id"])

    resp = await finance_client.delete(f"/api/v1/finance/categories/{category['id']}")
    assert resp.status_code == 204

    expenses = (await finance_client.get("/api/v1/finance/expenses")).json()
    assert len(expenses) == 1
    assert expenses[0]["category_id"] is None


# --- Expenses -----------------------------------------------------------------


async def test_expense_create_normalises_currency_and_keeps_cents(
    finance_client: AsyncClient,
) -> None:
    created = await make_expense(finance_client, currency="usd")
    assert created["currency"] == "USD"
    assert Decimal(created["amount"]) == Decimal("12.50")


async def test_expense_with_unknown_category_is_a_422(finance_client: AsyncClient) -> None:
    resp = await finance_client.post(
        "/api/v1/finance/expenses",
        json={
            "amount": "5.00",
            "currency": "USD",
            "spent_on": "2026-08-19",
            "category_id": str(uuid.uuid4()),
        },
    )
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "UNKNOWN_CATEGORY"


async def test_patch_amount_alone_is_checked_against_stored_currency(
    finance_client: AsyncClient,
) -> None:
    expense = await make_expense(finance_client, amount="50000", currency="VND")

    bad = await finance_client.patch(
        f"/api/v1/finance/expenses/{expense['id']}", json={"amount": "1000.50"}
    )
    assert bad.status_code == 422
    assert bad.json()["error"]["code"] == "INVALID_AMOUNT"

    good = await finance_client.patch(
        f"/api/v1/finance/expenses/{expense['id']}", json={"amount": "2000"}
    )
    assert good.status_code == 200
    assert Decimal(good.json()["amount"]) == Decimal("2000")


async def test_patch_with_explicit_null_clears_the_category(
    finance_client: AsyncClient,
) -> None:
    category = await make_category(finance_client)
    expense = await make_expense(finance_client, category_id=category["id"])

    resp = await finance_client.patch(
        f"/api/v1/finance/expenses/{expense['id']}", json={"category_id": None}
    )
    assert resp.status_code == 200
    assert resp.json()["category_id"] is None


async def test_expense_list_filters_by_date_range(finance_client: AsyncClient) -> None:
    await make_expense(finance_client, spent_on="2026-08-01")
    await make_expense(finance_client, spent_on="2026-08-15")
    await make_expense(finance_client, spent_on="2026-08-30")

    resp = await finance_client.get(
        "/api/v1/finance/expenses",
        params={"start_date": "2026-08-10", "end_date": "2026-08-20"},
    )
    body = resp.json()
    assert [e["spent_on"] for e in body] == ["2026-08-15"]


async def test_expense_list_is_newest_first(finance_client: AsyncClient) -> None:
    await make_expense(finance_client, spent_on="2026-08-01")
    await make_expense(finance_client, spent_on="2026-08-30")
    body = (await finance_client.get("/api/v1/finance/expenses")).json()
    assert [e["spent_on"] for e in body] == ["2026-08-30", "2026-08-01"]


async def test_delete_expense(finance_client: AsyncClient) -> None:
    expense = await make_expense(finance_client)
    assert (
        await finance_client.delete(f"/api/v1/finance/expenses/{expense['id']}")
    ).status_code == 204
    assert (await finance_client.get("/api/v1/finance/expenses")).json() == []


# --- Budgets ------------------------------------------------------------------


async def make_budget(client: AsyncClient, category_ids: list[str]) -> dict[str, Any]:
    resp = await client.post(
        "/api/v1/finance/budgets",
        json={
            "name": "Essentials",
            "amount": "500.00",
            "currency": "USD",
            "starts_on": "2026-08-01",
            "ends_on": "2026-08-31",
            "category_ids": category_ids,
        },
    )
    assert resp.status_code == 201, resp.text
    return dict(resp.json())


async def test_budget_create_embeds_its_categories(finance_client: AsyncClient) -> None:
    food = await make_category(finance_client, name="Food")
    rent = await make_category(finance_client, name="Rent")

    budget = await make_budget(finance_client, [food["id"], rent["id"]])
    assert Decimal(budget["amount"]) == Decimal("500.00")
    assert {c["name"] for c in budget["categories"]} == {"Food", "Rent"}


async def test_budget_with_unknown_category_is_a_422(finance_client: AsyncClient) -> None:
    resp = await finance_client.post(
        "/api/v1/finance/budgets",
        json={
            "name": "Essentials",
            "amount": "500.00",
            "currency": "USD",
            "starts_on": "2026-08-01",
            "ends_on": "2026-08-31",
            "category_ids": [str(uuid.uuid4())],
        },
    )
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "UNKNOWN_CATEGORY"


async def test_patch_moving_one_end_is_checked_against_the_stored_other(
    finance_client: AsyncClient,
) -> None:
    food = await make_category(finance_client)
    budget = await make_budget(finance_client, [food["id"]])

    resp = await finance_client.patch(
        f"/api/v1/finance/budgets/{budget['id']}", json={"ends_on": "2026-07-01"}
    )
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "INVALID_DATE_RANGE"


async def test_patch_category_ids_replaces_the_covered_set(
    finance_client: AsyncClient,
) -> None:
    food = await make_category(finance_client, name="Food")
    rent = await make_category(finance_client, name="Rent")
    budget = await make_budget(finance_client, [food["id"]])

    resp = await finance_client.patch(
        f"/api/v1/finance/budgets/{budget['id']}", json={"category_ids": [rent["id"]]}
    )
    assert resp.status_code == 200
    assert [c["name"] for c in resp.json()["categories"]] == ["Rent"]


async def test_delete_budget_leaves_categories_alone(finance_client: AsyncClient) -> None:
    food = await make_category(finance_client)
    budget = await make_budget(finance_client, [food["id"]])

    assert (
        await finance_client.delete(f"/api/v1/finance/budgets/{budget['id']}")
    ).status_code == 204
    assert (await finance_client.get("/api/v1/finance/budgets")).json() == []
    categories = (await finance_client.get("/api/v1/finance/categories")).json()
    assert [c["name"] for c in categories] == ["Food"]


# --- Summary ------------------------------------------------------------------


@pytest.fixture
def stub_rates(monkeypatch: pytest.MonkeyPatch) -> None:
    """Fixed rates so totals are asserted against arithmetic, not the network."""

    async def _rates() -> dict[str, Decimal]:
        return {"USD": Decimal("1"), "SGD": Decimal("1.28"), "VND": Decimal("25000")}

    monkeypatch.setattr(exchange_rates, "get_rates", _rates)


async def test_summary_converts_mixed_currencies_into_one_total(
    finance_client: AsyncClient, stub_rates: None
) -> None:
    await make_expense(finance_client, amount="10.00", currency="USD", spent_on="2026-08-10")
    await make_expense(finance_client, amount="12.80", currency="SGD", spent_on="2026-08-11")

    resp = await finance_client.get(
        "/api/v1/finance/summary",
        params={"start_date": "2026-08-01", "end_date": "2026-08-31"},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    # SGD 12.80 / 1.28 = USD 10.00, so the total is USD 20.00 rather than 22.80.
    assert body["currency"] == "USD"
    assert Decimal(body["spent"]) == Decimal("20.00")


async def test_summary_counts_budgets_overlapping_the_window(
    finance_client: AsyncClient, stub_rates: None
) -> None:
    food = await make_category(finance_client)
    await make_budget(finance_client, [food["id"]])  # 500.00 USD, Aug 1-31
    await make_expense(finance_client, amount="30.00", currency="USD", spent_on="2026-08-10")

    resp = await finance_client.get(
        "/api/v1/finance/summary",
        params={"start_date": "2026-08-05", "end_date": "2026-08-15"},
    )
    body = resp.json()
    assert Decimal(body["budgeted"]) == Decimal("500.00")
    assert Decimal(body["remaining"]) == Decimal("470.00")


async def test_summary_remaining_goes_negative_when_overspent(
    finance_client: AsyncClient, stub_rates: None
) -> None:
    await make_expense(finance_client, amount="80.00", currency="USD", spent_on="2026-08-10")

    resp = await finance_client.get(
        "/api/v1/finance/summary",
        params={"start_date": "2026-08-01", "end_date": "2026-08-31"},
    )
    body = resp.json()
    # No budgets, so the overspend is the whole spend and must not clamp to zero.
    assert Decimal(body["remaining"]) == Decimal("-80.00")


async def test_summary_rejects_an_inverted_range(
    finance_client: AsyncClient, stub_rates: None
) -> None:
    resp = await finance_client.get(
        "/api/v1/finance/summary",
        params={"start_date": "2026-08-31", "end_date": "2026-08-01"},
    )
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "INVALID_DATE_RANGE"


async def test_summary_reports_a_missing_rate_as_our_outage(
    finance_client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """A rate we cannot fetch is 503, not a total that quietly omits money."""

    async def _partial() -> dict[str, Decimal]:
        return {"USD": Decimal("1")}

    monkeypatch.setattr(exchange_rates, "get_rates", _partial)
    await make_expense(finance_client, amount="50000", currency="VND", spent_on="2026-08-10")

    resp = await finance_client.get(
        "/api/v1/finance/summary",
        params={"start_date": "2026-08-01", "end_date": "2026-08-31"},
    )
    assert resp.status_code == 503
    assert resp.json()["error"]["code"] == "RATE_UNAVAILABLE"


async def test_currencies_endpoint_matches_the_validated_set(
    finance_client: AsyncClient,
) -> None:
    body = (await finance_client.get("/api/v1/finance/currencies")).json()
    assert "VND" in body and "USD" in body
    assert len(body) == len(CURRENCY_CODES)


# --- Breakdowns ---------------------------------------------------------------


async def test_category_breakdown_groups_and_converts(
    finance_client: AsyncClient, stub_rates: None
) -> None:
    food = await make_category(finance_client, name="Food")
    rent = await make_category(finance_client, name="Rent")
    await make_expense(
        finance_client,
        amount="10.00",
        currency="USD",
        category_id=food["id"],
        spent_on="2026-08-10",
    )
    # SGD 12.80 / 1.28 = USD 10.00, so Food totals 20.00 rather than 22.80.
    await make_expense(
        finance_client,
        amount="12.80",
        currency="SGD",
        category_id=food["id"],
        spent_on="2026-08-11",
    )
    await make_expense(
        finance_client,
        amount="5.00",
        currency="USD",
        category_id=rent["id"],
        spent_on="2026-08-12",
    )

    resp = await finance_client.get(
        "/api/v1/finance/summary/by-category",
        params={"start_date": "2026-08-01", "end_date": "2026-08-31"},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["currency"] == "USD"
    # Largest slice first.
    assert [c["name"] for c in body["categories"]] == ["Food", "Rent"]
    assert Decimal(body["categories"][0]["spent"]) == Decimal("20.00")
    assert body["categories"][0]["category_id"] == food["id"]


async def test_category_breakdown_omits_categories_with_no_spend(
    finance_client: AsyncClient, stub_rates: None
) -> None:
    food = await make_category(finance_client, name="Food")
    await make_category(finance_client, name="Rent")
    await make_expense(
        finance_client,
        amount="10.00",
        currency="USD",
        category_id=food["id"],
        spent_on="2026-08-10",
    )

    body = (
        await finance_client.get(
            "/api/v1/finance/summary/by-category",
            params={"start_date": "2026-08-01", "end_date": "2026-08-31"},
        )
    ).json()
    assert [c["name"] for c in body["categories"]] == ["Food"]


async def test_category_breakdown_keeps_deleted_category_spend_in_one_bucket(
    finance_client: AsyncClient, stub_rates: None
) -> None:
    """Deleting a category must not make its spend vanish from the chart."""
    food = await make_category(finance_client, name="Food")
    await make_expense(
        finance_client,
        amount="10.00",
        currency="USD",
        category_id=food["id"],
        spent_on="2026-08-10",
    )
    assert (
        await finance_client.delete(f"/api/v1/finance/categories/{food['id']}")
    ).status_code == 204

    body = (
        await finance_client.get(
            "/api/v1/finance/summary/by-category",
            params={"start_date": "2026-08-01", "end_date": "2026-08-31"},
        )
    ).json()
    assert len(body["categories"]) == 1
    assert body["categories"][0]["category_id"] is None
    assert Decimal(body["categories"][0]["spent"]) == Decimal("10.00")


async def test_category_breakdown_totals_match_the_summary(
    finance_client: AsyncClient, stub_rates: None
) -> None:
    """The slices have to add up to what the tiles above them claim."""
    food = await make_category(finance_client, name="Food")
    await make_expense(
        finance_client,
        amount="10.00",
        currency="USD",
        category_id=food["id"],
        spent_on="2026-08-10",
    )
    await make_expense(finance_client, amount="7.00", currency="USD", spent_on="2026-08-11")
    params = {"start_date": "2026-08-01", "end_date": "2026-08-31"}

    summary = (await finance_client.get("/api/v1/finance/summary", params=params)).json()
    breakdown = (
        await finance_client.get("/api/v1/finance/summary/by-category", params=params)
    ).json()

    sliced = sum(Decimal(c["spent"]) for c in breakdown["categories"])
    assert sliced == Decimal(summary["spent"]) == Decimal("17.00")


async def test_category_breakdown_rejects_an_inverted_range(
    finance_client: AsyncClient, stub_rates: None
) -> None:
    resp = await finance_client.get(
        "/api/v1/finance/summary/by-category",
        params={"start_date": "2026-08-31", "end_date": "2026-08-01"},
    )
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "INVALID_DATE_RANGE"


async def test_weekly_breakdown_clips_weeks_to_the_month(
    finance_client: AsyncClient, stub_rates: None
) -> None:
    """August 2026 starts on a Saturday, so the first bar is two days long."""
    body = (
        await finance_client.get(
            "/api/v1/finance/summary/by-week",
            params={"start_date": "2026-08-01", "end_date": "2026-08-31"},
        )
    ).json()

    spans = [(w["starts_on"], w["ends_on"]) for w in body["weeks"]]
    assert spans == [
        ("2026-08-01", "2026-08-02"),
        ("2026-08-03", "2026-08-09"),
        ("2026-08-10", "2026-08-16"),
        ("2026-08-17", "2026-08-23"),
        ("2026-08-24", "2026-08-30"),
        ("2026-08-31", "2026-08-31"),
    ]


async def test_weekly_breakdown_buckets_and_keeps_quiet_weeks(
    finance_client: AsyncClient, stub_rates: None
) -> None:
    await make_expense(finance_client, amount="10.00", currency="USD", spent_on="2026-08-01")
    await make_expense(finance_client, amount="12.80", currency="SGD", spent_on="2026-08-02")
    await make_expense(finance_client, amount="5.00", currency="USD", spent_on="2026-08-12")

    body = (
        await finance_client.get(
            "/api/v1/finance/summary/by-week",
            params={"start_date": "2026-08-01", "end_date": "2026-08-31"},
        )
    ).json()

    spent = [Decimal(w["spent"]) for w in body["weeks"]]
    # Aug 1-2 holds both of the first two expenses, converted: 10 + 10 = 20.
    assert spent[0] == Decimal("20.00")
    # A week with nothing in it is a zero bar, not a missing one.
    assert spent[1] == Decimal("0")
    assert spent[2] == Decimal("5.00")
    assert sum(spent) == Decimal("25.00")


async def test_weekly_breakdown_rejects_an_inverted_range(
    finance_client: AsyncClient, stub_rates: None
) -> None:
    resp = await finance_client.get(
        "/api/v1/finance/summary/by-week",
        params={"start_date": "2026-08-31", "end_date": "2026-08-01"},
    )
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "INVALID_DATE_RANGE"


async def test_budget_progress_counts_only_covered_categories(
    finance_client: AsyncClient, stub_rates: None
) -> None:
    food = await make_category(finance_client, name="Food")
    fun = await make_category(finance_client, name="Fun")
    await make_budget(finance_client, [food["id"]])  # 500.00 USD, Aug 1-31

    await make_expense(
        finance_client,
        amount="30.00",
        currency="USD",
        category_id=food["id"],
        spent_on="2026-08-10",
    )
    # Outside the budget: right window, wrong category.
    await make_expense(
        finance_client,
        amount="99.00",
        currency="USD",
        category_id=fun["id"],
        spent_on="2026-08-10",
    )
    # Outside the budget: right category, wrong window.
    await make_expense(
        finance_client,
        amount="77.00",
        currency="USD",
        category_id=food["id"],
        spent_on="2026-09-10",
    )
    # Uncategorised spend counts towards no budget at all.
    await make_expense(finance_client, amount="55.00", currency="USD", spent_on="2026-08-10")

    resp = await finance_client.get("/api/v1/finance/budgets/progress")
    assert resp.status_code == 200, resp.text
    [progress] = resp.json()
    assert Decimal(progress["spent"]) == Decimal("30.00")
    assert Decimal(progress["remaining"]) == Decimal("470.00")
    assert progress["currency"] == "USD"
    assert [c["name"] for c in progress["categories"]] == ["Food"]


async def test_budget_progress_converts_spend_into_the_budget_currency(
    finance_client: AsyncClient, stub_rates: None
) -> None:
    food = await make_category(finance_client, name="Food")
    resp = await finance_client.post(
        "/api/v1/finance/budgets",
        json={
            "name": "Groceries",
            "amount": "128.00",
            "currency": "SGD",
            "starts_on": "2026-08-01",
            "ends_on": "2026-08-31",
            "category_ids": [food["id"]],
        },
    )
    assert resp.status_code == 201, resp.text
    await make_expense(
        finance_client,
        amount="10.00",
        currency="USD",
        category_id=food["id"],
        spent_on="2026-08-10",
    )

    [progress] = (await finance_client.get("/api/v1/finance/budgets/progress")).json()
    # USD 10.00 * 1.28 = SGD 12.80, measured against the SGD cap, not a USD one.
    assert progress["currency"] == "SGD"
    assert Decimal(progress["spent"]) == Decimal("12.80")
    assert Decimal(progress["remaining"]) == Decimal("115.20")


async def test_budget_progress_reports_an_overspend_as_negative(
    finance_client: AsyncClient, stub_rates: None
) -> None:
    food = await make_category(finance_client, name="Food")
    await make_budget(finance_client, [food["id"]])  # 500.00 USD
    await make_expense(
        finance_client,
        amount="600.00",
        currency="USD",
        category_id=food["id"],
        spent_on="2026-08-10",
    )

    [progress] = (await finance_client.get("/api/v1/finance/budgets/progress")).json()
    assert Decimal(progress["remaining"]) == Decimal("-100.00")


async def test_budget_progress_is_empty_without_budgets(
    finance_client: AsyncClient, stub_rates: None
) -> None:
    """No budgets means no rate lookup either — nothing to convert."""
    assert (await finance_client.get("/api/v1/finance/budgets/progress")).json() == []


async def test_budget_progress_reports_a_missing_rate_as_our_outage(
    finance_client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def _partial() -> dict[str, Decimal]:
        return {"USD": Decimal("1")}

    monkeypatch.setattr(exchange_rates, "get_rates", _partial)
    food = await make_category(finance_client, name="Food")
    await make_budget(finance_client, [food["id"]])
    await make_expense(
        finance_client,
        amount="50000",
        currency="VND",
        category_id=food["id"],
        spent_on="2026-08-10",
    )

    resp = await finance_client.get("/api/v1/finance/budgets/progress")
    assert resp.status_code == 503
    assert resp.json()["error"]["code"] == "RATE_UNAVAILABLE"


async def test_someone_elses_budget_is_not_in_my_progress(
    finance_client: AsyncClient,
    db_factory: async_sessionmaker[AsyncSession],
    stub_rates: None,
) -> None:
    async with db_factory() as session:
        theirs = Category(user_id=OTHER_USER_ID, name="Theirs")
        session.add(theirs)
        await session.flush()
        session.add(
            Budget(
                user_id=OTHER_USER_ID,
                name="Not mine",
                amount=Decimal("100.00"),
                currency="USD",
                starts_on=date(2026, 8, 1),
                ends_on=date(2026, 8, 31),
                categories=[theirs],
            )
        )
        await session.commit()

    assert (await finance_client.get("/api/v1/finance/budgets/progress")).json() == []
