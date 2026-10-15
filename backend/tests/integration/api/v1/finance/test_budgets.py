"""Budget routes, including progress against each cap.

Full route -> service -> DB path against SQLite.
"""

import uuid
from datetime import date
from decimal import Decimal

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
from tests.support.finance_api import (
    make_budget,
    make_category,
    make_expense,
)
from tests.support.ids import OTHER_USER_ID

from app.models.finance import Budget, Category
from app.services import exchange_rates


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
