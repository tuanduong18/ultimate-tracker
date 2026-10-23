"""Expense routes.

Full route -> service -> DB path against SQLite.
"""

import uuid
from decimal import Decimal

from httpx import AsyncClient
from tests.support.finance_api import (
    make_category,
    make_expense,
)


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


async def test_pages_neither_repeat_nor_skip_rows_from_one_day(
    finance_client: AsyncClient,
) -> None:
    # The Transactions tab walks every page; same-day rows need a total order.
    made = [await make_expense(finance_client, description=f"row {i}") for i in range(5)]

    seen: list[str] = []
    for offset in (0, 2, 4):
        page = await finance_client.get(
            "/api/v1/finance/expenses", params={"limit": 2, "offset": offset}
        )
        seen += [e["id"] for e in page.json()]
    assert sorted(seen) == sorted(e["id"] for e in made)
