"""The scheduler-facing trigger endpoint: the shared secret, and the job's result."""

from collections.abc import AsyncGenerator
from typing import Any

import httpx
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
from tests.support.ids import TEST_USER_ID

from app.core.config import settings
from app.models.profile import Profile
from app.services import exchange_rates

SECRET = "test-task-secret"
AUTH = {"X-Task-Secret": SECRET}
_REAL_CLIENT = httpx.AsyncClient


@pytest.fixture(autouse=True)
def task_secret(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "task_secret", SECRET)


@pytest.fixture
async def db_factory(
    db_factory: async_sessionmaker[AsyncSession],
) -> AsyncGenerator[async_sessionmaker[AsyncSession]]:
    async with db_factory() as session:
        session.add(Profile(id=TEST_USER_ID, timezone="UTC"))
        await session.commit()
    yield db_factory


def upstream(monkeypatch: pytest.MonkeyPatch, response: httpx.Response) -> None:
    def factory(**kwargs: Any) -> httpx.AsyncClient:
        transport = httpx.MockTransport(lambda _request: response)
        return _REAL_CLIENT(**kwargs, transport=transport)

    monkeypatch.setattr(exchange_rates.httpx, "AsyncClient", factory)


async def test_disabled_until_a_secret_is_configured(
    authed_client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "task_secret", "")

    resp = await authed_client.post("/api/v1/tasks/exchange-rates", headers=AUTH)

    assert resp.status_code == 503
    assert resp.json()["error"]["code"] == "TASKS_DISABLED"


@pytest.mark.parametrize("headers", [{}, {"X-Task-Secret": "wrong"}])
async def test_rejects_a_missing_or_wrong_secret(
    authed_client: AsyncClient, headers: dict[str, str]
) -> None:
    resp = await authed_client.post("/api/v1/tasks/exchange-rates", headers=headers)

    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "INVALID_TASK_SECRET"


async def test_refresh_exchange_rates_reports_what_it_stored(
    authed_client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    payload = {"rates": {"USD": 1, "VND": 26000}}
    upstream(monkeypatch, httpx.Response(200, json=payload))

    resp = await authed_client.post("/api/v1/tasks/exchange-rates", headers=AUTH)

    assert resp.status_code == 200, resp.text
    assert resp.json() == {"currencies": 2, "delisted": [], "relisted": []}


async def test_refresh_dropping_too_many_currencies_is_a_502(
    authed_client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    many = {f"A{a}{b}": 1 for a in "BCD" for b in "BCD"}
    upstream(monkeypatch, httpx.Response(200, json={"rates": {"USD": 1, **many}}))
    await authed_client.post("/api/v1/tasks/exchange-rates", headers=AUTH)
    upstream(monkeypatch, httpx.Response(200, json={"rates": {"USD": 1}}))

    resp = await authed_client.post("/api/v1/tasks/exchange-rates", headers=AUTH)

    assert resp.status_code == 502
    assert resp.json()["error"]["code"] == "UPSTREAM_UNAVAILABLE"


async def test_refresh_exchange_rates_upstream_failure_is_a_502(
    authed_client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    upstream(monkeypatch, httpx.Response(500))

    resp = await authed_client.post("/api/v1/tasks/exchange-rates", headers=AUTH)

    assert resp.status_code == 502
    assert resp.json()["error"]["code"] == "UPSTREAM_UNAVAILABLE"
