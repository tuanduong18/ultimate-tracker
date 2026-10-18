"""Category routes.

Full route -> service -> DB path against SQLite.
"""

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
from tests.support.finance_api import (
    make_category,
    make_expense,
)
from tests.support.ids import OTHER_USER_ID

from app.models.finance import Category


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
