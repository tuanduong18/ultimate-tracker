"""Builders for finance rows created through the API, asserting each succeeds."""

from typing import Any

from httpx import AsyncClient


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


async def make_budget(
    client: AsyncClient, category_ids: list[str], **overrides: Any
) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "name": "Essentials",
        "amount": "500.00",
        "currency": "USD",
        "starts_on": "2026-08-01",
        "ends_on": "2026-08-31",
        "category_ids": category_ids,
    }
    payload.update(overrides)
    resp = await client.post("/api/v1/finance/budgets", json=payload)
    assert resp.status_code == 201, resp.text
    return dict(resp.json())


# Far enough ahead that next_billing_on is the start date whatever today is.
FUTURE_START = "2099-01-31"


async def make_subscription(client: AsyncClient, **overrides: Any) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "name": "Streaming",
        "amount": "12.99",
        "currency": "USD",
        "interval_unit": "month",
        "started_on": FUTURE_START,
    }
    payload.update(overrides)
    resp = await client.post("/api/v1/finance/subscriptions", json=payload)
    assert resp.status_code == 201, resp.text
    return dict(resp.json())
