"""The scheduler-facing trigger endpoints: the shared secret, and each job's result."""

from collections.abc import AsyncGenerator
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import Any

import httpx
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
from tests.support.ids import TEST_USER_ID

from app.core.config import settings
from app.models.finance import Subscription
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
    resp = await authed_client.post("/api/v1/tasks/subscriptions", headers=headers)

    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "INVALID_TASK_SECRET"


async def test_refresh_exchange_rates_reports_what_it_stored(
    authed_client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    payload = {"rates": {"USD": 1, "VND": 26000}}
    upstream(monkeypatch, httpx.Response(200, json=payload))

    resp = await authed_client.post("/api/v1/tasks/exchange-rates", headers=AUTH)

    assert resp.status_code == 200, resp.text
    assert resp.json() == {"currencies": 2, "delisted": [], "relisted": [], "notified": 0}


async def test_refresh_exchange_rates_notifies_users_of_a_dropped_currency(
    authed_client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    upstream(monkeypatch, httpx.Response(200, json={"rates": {"USD": 1, "AMD": 390}}))
    await authed_client.post("/api/v1/tasks/exchange-rates", headers=AUTH)
    await authed_client.patch("/api/v1/auth/me", json={"display_currency": "AMD"})
    upstream(monkeypatch, httpx.Response(200, json={"rates": {"USD": 1}}))

    resp = await authed_client.post("/api/v1/tasks/exchange-rates", headers=AUTH)

    assert resp.json() == {"currencies": 1, "delisted": ["AMD"], "relisted": [], "notified": 1}
    inbox = await authed_client.get("/api/v1/notifications")
    assert [n["title"] for n in inbox.json()] == ["AMD is no longer supported"]


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


async def test_subscriptions_job_renews_then_reminds(
    authed_client: AsyncClient, db_factory: async_sessionmaker[AsyncSession]
) -> None:
    today = datetime.now(UTC).date()
    async with db_factory() as session:
        for name, charge in (("Due today", today), ("Due soon", today + timedelta(days=2))):
            session.add(
                Subscription(
                    user_id=TEST_USER_ID,
                    name=name,
                    amount=Decimal("12.99"),
                    currency="USD",
                    interval_unit="month",
                    interval_count=1,
                    started_on=charge,
                    next_billing_on=charge,
                )
            )
        await session.commit()

    first = await authed_client.post("/api/v1/tasks/subscriptions", headers=AUTH)
    second = await authed_client.post("/api/v1/tasks/subscriptions", headers=AUTH)

    assert first.json() == {
        "renewed": 1,
        "reminders_created": 1,
        "reminders_updated": 0,
        "reminders_removed": 0,
    }
    assert second.json() == {
        "renewed": 0,
        "reminders_created": 0,
        "reminders_updated": 0,
        "reminders_removed": 0,
    }
    inbox = await authed_client.get("/api/v1/notifications")
    assert sorted(n["title"] for n in inbox.json()) == [
        "Due soon renews in 2 days",
        f"Due today auto-renewed on {today.day} {today:%b}",
    ]
