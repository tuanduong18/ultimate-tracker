"""Category routes.

Full route -> service -> DB path against Postgres.
"""

import pytest
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
    assert created["icon"] is None

    listed = (await finance_client.get("/api/v1/finance/categories")).json()
    assert [c["name"] for c in listed] == ["Food"]


async def test_a_category_keeps_the_symbol_it_was_created_with(
    finance_client: AsyncClient,
) -> None:
    created = await make_category(finance_client, name="Food", icon="food")
    assert created["icon"] == "food"

    listed = (await finance_client.get("/api/v1/finance/categories")).json()
    assert [(c["name"], c["icon"]) for c in listed] == [("Food", "food")]


@pytest.mark.parametrize(
    "icon",
    [
        "Food",  # capitals
        "has space",
        "-food",  # must start with a letter
        "1food",
        "café",  # ASCII only
        "a" * 33,  # one over the column's 32
        "",
    ],
)
async def test_a_badly_formed_symbol_is_a_422(finance_client: AsyncClient, icon: str) -> None:
    resp = await finance_client.post(
        "/api/v1/finance/categories", json={"name": "Food", "icon": icon}
    )
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "VALIDATION_ERROR"


async def test_a_well_formed_symbol_the_apps_dont_know_yet_is_accepted(
    finance_client: AsyncClient,
) -> None:
    # Only the shape is checked, so a symbol added to the apps' list needs no backend
    # deploy; an app that doesn't know it shows the category's initial instead.
    created = await make_category(finance_client, name="Car wash", icon="car-wash")
    assert created["icon"] == "car-wash"


async def test_renaming_a_category_keeps_its_symbol(finance_client: AsyncClient) -> None:
    food = await make_category(finance_client, name="Food", icon="food")
    resp = await finance_client.patch(
        f"/api/v1/finance/categories/{food['id']}", json={"name": "Meals"}
    )
    assert resp.status_code == 200
    assert resp.json()["name"] == "Meals"
    assert resp.json()["icon"] == "food"


async def test_patching_a_new_symbol_replaces_the_old_one(finance_client: AsyncClient) -> None:
    food = await make_category(finance_client, name="Food", icon="food")
    resp = await finance_client.patch(
        f"/api/v1/finance/categories/{food['id']}", json={"icon": "groceries"}
    )
    assert resp.status_code == 200
    assert resp.json()["icon"] == "groceries"


async def test_patching_the_symbol_to_null_clears_it(finance_client: AsyncClient) -> None:
    # The trap: update_category drops explicit nulls for every field not listed as
    # nullable, so without "icon" in that set this PATCH would change nothing.
    food = await make_category(finance_client, name="Food", icon="food")
    resp = await finance_client.patch(
        f"/api/v1/finance/categories/{food['id']}", json={"icon": None}
    )
    assert resp.status_code == 200
    assert resp.json()["icon"] is None

    listed = (await finance_client.get("/api/v1/finance/categories")).json()
    assert listed[0]["icon"] is None


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


async def test_arranged_categories_list_in_that_order(finance_client: AsyncClient) -> None:
    food = await make_category(finance_client, name="Food")
    rent = await make_category(finance_client, name="Rent")
    travel = await make_category(finance_client, name="Travel")

    resp = await finance_client.put(
        "/api/v1/finance/categories/order", json={"ids": [travel["id"], food["id"], rent["id"]]}
    )
    assert resp.status_code == 204, resp.text

    # A category added afterwards goes first, where its form was, until it is
    # arranged too.
    await make_category(finance_client, name="Books")
    listed = (await finance_client.get("/api/v1/finance/categories")).json()
    assert [c["name"] for c in listed] == ["Books", "Travel", "Food", "Rent"]


async def test_unarranged_categories_list_by_name(finance_client: AsyncClient) -> None:
    for name in ("Rent", "Food", "Travel"):
        await make_category(finance_client, name=name)

    listed = (await finance_client.get("/api/v1/finance/categories")).json()
    assert [c["name"] for c in listed] == ["Food", "Rent", "Travel"]


async def test_arranging_someone_elses_category_is_a_404(
    finance_client: AsyncClient, db_factory: async_sessionmaker[AsyncSession]
) -> None:
    mine = await make_category(finance_client, name="Mine")
    async with db_factory() as session:
        theirs = Category(user_id=OTHER_USER_ID, name="Theirs")
        session.add(theirs)
        await session.commit()

    resp = await finance_client.put(
        "/api/v1/finance/categories/order", json={"ids": [str(theirs.id), mine["id"]]}
    )
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "NOT_FOUND"


async def test_an_order_naming_a_category_twice_is_a_422(finance_client: AsyncClient) -> None:
    food = await make_category(finance_client, name="Food")

    resp = await finance_client.put(
        "/api/v1/finance/categories/order", json={"ids": [food["id"], food["id"]]}
    )
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "VALIDATION_ERROR"
