"""Tests for the /auth/me profile endpoint against an in-memory database.

Exercises the full route -> service -> DB path with auth dependency-overridden,
plus the unauthenticated path with the real dependency in place.
"""

import pytest
from httpx import AsyncClient
from tests.support.ids import TEST_USER_ID


async def test_me_creates_and_returns_profile(authed_client: AsyncClient) -> None:
    resp = await authed_client.get("/api/v1/auth/me")
    assert resp.status_code == 200
    body = resp.json()
    assert body["id"] == str(TEST_USER_ID)
    assert body["timezone"] == "UTC"


async def test_me_is_idempotent(authed_client: AsyncClient) -> None:
    first = (await authed_client.get("/api/v1/auth/me")).json()
    second = (await authed_client.get("/api/v1/auth/me")).json()
    assert first["id"] == second["id"]


async def test_patch_me_updates_timezone(authed_client: AsyncClient) -> None:
    resp = await authed_client.patch("/api/v1/auth/me", json={"timezone": "Asia/Singapore"})
    assert resp.status_code == 200
    assert resp.json()["timezone"] == "Asia/Singapore"


async def test_patch_me_refuses_an_unknown_timezone_and_keeps_the_stored_one(
    authed_client: AsyncClient,
) -> None:
    await authed_client.patch("/api/v1/auth/me", json={"timezone": "Asia/Singapore"})

    resp = await authed_client.patch("/api/v1/auth/me", json={"timezone": "Mars/Base"})

    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "VALIDATION_ERROR"
    assert (await authed_client.get("/api/v1/auth/me")).json()["timezone"] == "Asia/Singapore"


async def test_new_profile_has_no_name_and_usd_currencies(authed_client: AsyncClient) -> None:
    body = (await authed_client.get("/api/v1/auth/me")).json()
    assert body["display_name"] is None
    assert body["preferred_currency"] == "USD"


async def test_patch_me_sets_name_and_preferred_currency_independently(
    authed_client: AsyncClient,
) -> None:
    await authed_client.patch("/api/v1/auth/me", json={"display_currency": "SGD"})

    resp = await authed_client.patch(
        "/api/v1/auth/me", json={"display_name": "Tuan", "preferred_currency": "vnd"}
    )

    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["display_name"] == "Tuan"
    assert body["preferred_currency"] == "VND"
    # Picking an entry default must not move the reporting currency.
    assert body["display_currency"] == "SGD"


async def test_patch_me_with_a_null_name_clears_it(authed_client: AsyncClient) -> None:
    await authed_client.patch("/api/v1/auth/me", json={"display_name": "Tuan"})

    resp = await authed_client.patch("/api/v1/auth/me", json={"display_name": None})

    assert resp.json()["display_name"] is None


async def test_patch_me_with_a_null_currency_leaves_it_alone(authed_client: AsyncClient) -> None:
    """Only the name is nullable; a null elsewhere is "not sent", not a 500."""
    await authed_client.patch("/api/v1/auth/me", json={"preferred_currency": "SGD"})

    resp = await authed_client.patch("/api/v1/auth/me", json={"preferred_currency": None})

    assert resp.status_code == 200
    assert resp.json()["preferred_currency"] == "SGD"


async def test_me_without_a_token_is_401(client: AsyncClient) -> None:
    """Unauthenticated callers get 401 in the standard envelope, not FastAPI's 403."""
    resp = await client.get("/api/v1/auth/me")
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "MISSING_TOKEN"
    assert resp.headers["www-authenticate"] == "Bearer"


async def test_me_with_a_non_bearer_scheme_is_401(client: AsyncClient) -> None:
    resp = await client.get("/api/v1/auth/me", headers={"Authorization": "Basic dXNlcjpwdw=="})
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "MISSING_TOKEN"


# --- Notification switches ------------------------------------------------------


async def muted(client: AsyncClient) -> list[str]:
    body: list[str] = (await client.get("/api/v1/auth/me")).json()["muted_notifications"]
    return body


async def test_a_new_profile_has_every_notification_on(authed_client: AsyncClient) -> None:
    assert await muted(authed_client) == []


async def test_patch_me_mutes_each_category_once_and_an_empty_list_unmutes(
    authed_client: AsyncClient,
) -> None:
    sent = ["budget_alerts", "subscription_reminders", "budget_alerts"]

    resp = await authed_client.patch("/api/v1/auth/me", json={"muted_notifications": sent})

    assert resp.status_code == 200
    assert resp.json()["muted_notifications"] == ["budget_alerts", "subscription_reminders"]
    assert await muted(authed_client) == ["budget_alerts", "subscription_reminders"]

    await authed_client.patch("/api/v1/auth/me", json={"muted_notifications": []})
    assert await muted(authed_client) == []


@pytest.mark.parametrize("category", ["currency_notices", "budget_alert"])
async def test_patch_me_refuses_what_cannot_be_muted_and_keeps_the_stored_list(
    authed_client: AsyncClient, category: str
) -> None:
    await authed_client.patch("/api/v1/auth/me", json={"muted_notifications": ["budget_alerts"]})

    resp = await authed_client.patch(
        "/api/v1/auth/me", json={"muted_notifications": ["subscription_renewals", category]}
    )

    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "VALIDATION_ERROR"
    assert await muted(authed_client) == ["budget_alerts"]


async def test_patch_me_with_null_or_no_muted_notifications_leaves_them_alone(
    authed_client: AsyncClient,
) -> None:
    patch = {"muted_notifications": ["subscription_renewals"]}
    await authed_client.patch("/api/v1/auth/me", json=patch)

    await authed_client.patch("/api/v1/auth/me", json={"muted_notifications": None})
    await authed_client.patch("/api/v1/auth/me", json={"timezone": "Asia/Singapore"})

    assert await muted(authed_client) == ["subscription_renewals"]
