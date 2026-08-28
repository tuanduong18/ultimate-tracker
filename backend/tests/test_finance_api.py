"""Route-level tests for the finance domain against an in-memory database.

Runs the full route -> service -> DB path with auth dependency-overridden.
Foreign keys are switched on in SQLite so ON DELETE behaviour (SET NULL on
expenses, CASCADE on budget join rows) is exercised for real.
"""

import uuid
from collections.abc import AsyncGenerator
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
from app.models.finance import Category
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
