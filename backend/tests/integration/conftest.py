"""Fixtures for tests that touch a database or the ASGI app."""

from collections.abc import AsyncGenerator, Iterator
from typing import Any

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import event
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool
from tests.support.ids import TEST_USER_ID

from app.core.security import get_current_user_id
from app.db.base import Base
from app.db.session import get_db
from app.main import app
from app.services import exchange_rates


@pytest.fixture(autouse=True)
def clear_rate_cache() -> Iterator[None]:
    """Every test gets its own database, so none may see rates another cached —
    they decide which currencies a request accepts."""
    exchange_rates.reset_cache()
    yield
    exchange_rates.reset_cache()


@pytest.fixture
async def db_factory() -> AsyncGenerator[async_sessionmaker[AsyncSession]]:
    """A fresh, empty in-memory SQLite schema per test.

    Foreign keys are switched on, since SQLite ignores them by default, so
    ON DELETE behaviour (SET NULL on expenses, CASCADE on budget join rows) is
    exercised for real.
    """
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        poolclass=StaticPool,
        connect_args={"check_same_thread": False},
    )

    @event.listens_for(engine.sync_engine, "connect")
    def _enable_foreign_keys(dbapi_connection: Any, _record: Any) -> None:
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    await engine.dispose()


@pytest.fixture
async def client() -> AsyncGenerator[AsyncClient]:
    """The real app with no overrides: real auth, real database settings."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.fixture
async def authed_client(
    db_factory: async_sessionmaker[AsyncSession],
) -> AsyncGenerator[AsyncClient]:
    """The app on the test database, authenticated as TEST_USER_ID."""

    async def override_get_db() -> AsyncGenerator[AsyncSession]:
        async with db_factory() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user_id] = lambda: TEST_USER_ID

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()
