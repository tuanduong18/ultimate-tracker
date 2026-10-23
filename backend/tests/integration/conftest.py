"""Fixtures for tests that touch a database or the ASGI app.

Integration tests run against Postgres, the database production runs on —
not SQLite, which drops ``FOR UPDATE SKIP LOCKED``, has no exact decimal
type and hands back naive datetimes, so the guarantees that matter most
(a renewal is charged once, money keeps its cents) went untested.

The database comes from TEST_DATABASE_URL, in the environment or in
backend/.env. Each run rebuilds its schema from the migrations, so the
database it names is wiped: it must be a throwaway one whose name contains
"test", which keeps a mistyped URL from pointing this at real data.
"""

import asyncio
from collections.abc import AsyncGenerator, Iterator
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from httpx import ASGITransport, AsyncClient
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy import text
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool
from tests.support.ids import TEST_USER_ID

from app.core.config import settings
from app.core.security import get_current_user_id
from app.db.base import Base
from app.db.session import get_db
from app.main import app
from app.services import exchange_rates

_BACKEND = Path(__file__).resolve().parents[2]


class _TestSettings(BaseSettings):
    """Read the way the app reads its settings, so backend/.env works here too."""

    model_config = SettingsConfigDict(env_file=_BACKEND / ".env", extra="ignore")

    test_database_url: str = ""


def _test_database_url() -> str:
    url = _TestSettings().test_database_url
    if not url:
        pytest.fail(
            "TEST_DATABASE_URL is not set. Point it at a throwaway Postgres database, e.g.\n"
            "  TEST_DATABASE_URL=postgresql+asyncpg://test:test@localhost:5432/test_db\n"
            "in backend/.env or the environment. Unit tests alone: pytest -m unit",
            pytrace=False,
        )
    database = make_url(url).database or ""
    if "test" not in database:
        pytest.fail(
            f"TEST_DATABASE_URL names database {database!r}. Each run wipes it, so its name "
            "must contain 'test'.",
            pytrace=False,
        )
    return url


async def _empty_schema(url: str) -> None:
    engine = create_async_engine(url, poolclass=NullPool)
    async with engine.begin() as conn:
        await conn.execute(text("DROP SCHEMA public CASCADE"))
        await conn.execute(text("CREATE SCHEMA public"))
    await engine.dispose()


@pytest.fixture(scope="session")
def migrated_database() -> Iterator[str]:
    """An empty schema built by `alembic upgrade head`, once per run.

    The migrations rather than ``create_all``, so the tests run on the schema
    production has — constraints, defaults and indexes as the migrations wrote
    them. alembic's env.py reads ``settings.database_url``, so it is pointed at
    the test database for the duration.
    """
    url = _test_database_url()
    asyncio.run(_empty_schema(url))

    config = Config()
    config.set_main_option("script_location", str(_BACKEND / "alembic"))
    real_url, settings.database_url = settings.database_url, url
    try:
        command.upgrade(config, "head")
    finally:
        settings.database_url = real_url
    yield url


# Every table the models define; alembic_version is not one, so it survives.
_TABLES = ", ".join(f'"{table.name}"' for table in Base.metadata.sorted_tables)


@pytest.fixture(autouse=True)
def clear_rate_cache() -> Iterator[None]:
    """Every test gets its own database, so none may see rates another cached —
    they decide which currencies a request accepts."""
    exchange_rates.reset_cache()
    yield
    exchange_rates.reset_cache()


@pytest.fixture
async def db_factory(migrated_database: str) -> AsyncGenerator[async_sessionmaker[AsyncSession]]:
    """The test database with every table emptied, per test.

    Emptied before the test rather than after, so one that crashed half-way
    cannot leak rows into the next. TRUNCATE rather than a rolled-back outer
    transaction: the services commit for real, the renewal job commits per
    subscription, and a test of two overlapping runs needs two connections —
    none of which survive being folded into one transaction.

    One engine per test, disposed at the end: pytest-asyncio gives each test its
    own event loop, and an asyncpg connection cannot cross from one loop to the
    next. Within the test the pool is kept, so its sessions share connections.
    """
    engine = create_async_engine(migrated_database)
    async with engine.begin() as conn:
        await conn.execute(text(f"TRUNCATE {_TABLES} RESTART IDENTITY CASCADE"))
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
