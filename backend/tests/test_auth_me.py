"""Tests for the /auth/me profile endpoint against an in-memory database.

Exercises the full route -> service -> DB path with auth dependency-overridden.
"""

import uuid
from collections.abc import AsyncGenerator

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from app.core.security import get_current_user_id
from app.db.base import Base
from app.db.session import get_db
from app.main import app

TEST_USER_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")


@pytest.fixture
async def me_client() -> AsyncGenerator[AsyncClient, None]:
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        poolclass=StaticPool,
        connect_args={"check_same_thread": False},
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    session_factory = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)

    async def override_get_db() -> AsyncGenerator[AsyncSession, None]:
        async with session_factory() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user_id] = lambda: TEST_USER_ID

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client

    app.dependency_overrides.clear()
    await engine.dispose()


async def test_me_creates_and_returns_profile(me_client: AsyncClient) -> None:
    resp = await me_client.get("/api/v1/auth/me")
    assert resp.status_code == 200
    body = resp.json()
    assert body["id"] == str(TEST_USER_ID)
    assert body["timezone"] == "UTC"


async def test_me_is_idempotent(me_client: AsyncClient) -> None:
    first = (await me_client.get("/api/v1/auth/me")).json()
    second = (await me_client.get("/api/v1/auth/me")).json()
    assert first["id"] == second["id"]


async def test_patch_me_updates_timezone(me_client: AsyncClient) -> None:
    resp = await me_client.patch("/api/v1/auth/me", json={"timezone": "Asia/Singapore"})
    assert resp.status_code == 200
    assert resp.json()["timezone"] == "Asia/Singapore"
