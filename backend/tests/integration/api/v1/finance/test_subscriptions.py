"""Subscription routes.

Full route -> service -> DB path against SQLite.
"""

from datetime import date
from decimal import Decimal
from typing import Any

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
from tests.support.finance_api import (
    FUTURE_START,
    make_category,
    make_subscription,
)
from tests.support.ids import OTHER_USER_ID

from app.models.finance import Subscription


async def test_subscription_create_and_list(finance_client: AsyncClient) -> None:
    default = await make_category(finance_client, name="Subscriptions")
    created = await make_subscription(finance_client)

    assert created["category_id"] == default["id"]
    assert created["next_billing_on"] == FUTURE_START
    assert created["interval_unit"] == "month"
    assert created["interval_count"] == 1
    assert created["cancelled_on"] is None

    listed = (await finance_client.get("/api/v1/finance/subscriptions")).json()
    assert [s["id"] for s in listed] == [created["id"]]


async def test_subscription_without_a_default_category_is_uncategorized(
    finance_client: AsyncClient,
) -> None:
    created = await make_subscription(finance_client)
    assert created["category_id"] is None


async def test_trial_ends_on_drives_the_first_charge(finance_client: AsyncClient) -> None:
    created = await make_subscription(finance_client, trial_ends_on="2099-02-07")
    assert created["next_billing_on"] == "2099-02-07"


@pytest.mark.parametrize(
    "overrides",
    [
        {"trial_ends_on": FUTURE_START},
        {"interval_unit": "fortnight"},
        {"interval_count": 0},
        {"amount": "1.5", "currency": "VND"},
    ],
)
async def test_invalid_subscription_is_a_422(
    finance_client: AsyncClient, overrides: dict[str, Any]
) -> None:
    payload = {
        "name": "Streaming",
        "amount": "12.99",
        "currency": "USD",
        "interval_unit": "month",
        "started_on": FUTURE_START,
    } | overrides
    resp = await finance_client.post("/api/v1/finance/subscriptions", json=payload)
    assert resp.status_code == 422


async def test_cancel_and_resume_a_subscription(finance_client: AsyncClient) -> None:
    created = await make_subscription(finance_client)
    url = f"/api/v1/finance/subscriptions/{created['id']}"

    cancelled = await finance_client.patch(url, json={"cancelled_on": "2099-03-01"})
    assert cancelled.status_code == 200, cancelled.text
    assert cancelled.json()["cancelled_on"] == "2099-03-01"

    resumed = await finance_client.patch(url, json={"cancelled_on": None})
    assert resumed.status_code == 200, resumed.text
    assert resumed.json()["cancelled_on"] is None


async def test_patch_dates_clashing_with_stored_ones_is_a_422(
    finance_client: AsyncClient,
) -> None:
    created = await make_subscription(finance_client)

    resp = await finance_client.patch(
        f"/api/v1/finance/subscriptions/{created['id']}", json={"cancelled_on": "2099-01-30"}
    )
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "INVALID_DATE_RANGE"


async def test_delete_subscription(finance_client: AsyncClient) -> None:
    created = await make_subscription(finance_client)

    resp = await finance_client.delete(f"/api/v1/finance/subscriptions/{created['id']}")
    assert resp.status_code == 204
    assert (await finance_client.get("/api/v1/finance/subscriptions")).json() == []


async def test_someone_elses_subscription_is_invisible(
    finance_client: AsyncClient, db_factory: async_sessionmaker[AsyncSession]
) -> None:
    async with db_factory() as session:
        theirs = Subscription(
            user_id=OTHER_USER_ID,
            name="Not mine",
            amount=Decimal("9.99"),
            currency="USD",
            interval_unit="month",
            interval_count=1,
            started_on=date(2099, 1, 1),
            next_billing_on=date(2099, 1, 1),
        )
        session.add(theirs)
        await session.commit()

    url = f"/api/v1/finance/subscriptions/{theirs.id}"
    assert (await finance_client.get("/api/v1/finance/subscriptions")).json() == []
    assert (await finance_client.patch(url, json={"name": "Mine now"})).status_code == 404
    assert (await finance_client.delete(url)).status_code == 404
