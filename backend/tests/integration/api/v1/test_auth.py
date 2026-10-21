"""Tests for the /auth/me profile endpoint against an in-memory database.

Exercises the full route -> service -> DB path with auth dependency-overridden,
plus the unauthenticated path with the real dependency in place.
"""

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
