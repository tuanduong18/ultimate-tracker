"""Service-level tests for profile creation, including the first-login race."""

import uuid
from collections.abc import AsyncGenerator
from typing import Any

import pytest
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from app.db.base import Base
from app.models.profile import Profile
from app.services import profile as profile_service

TEST_USER_ID = uuid.UUID("00000000-0000-0000-0000-000000000002")


@pytest.fixture
async def session_factory() -> AsyncGenerator[async_sessionmaker[AsyncSession]]:
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        poolclass=StaticPool,
        connect_args={"check_same_thread": False},
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    await engine.dispose()


async def test_creates_profile_with_default_timezone(
    session_factory: async_sessionmaker[AsyncSession],
) -> None:
    async with session_factory() as db:
        profile = await profile_service.get_or_create_profile(db, TEST_USER_ID)
    assert profile.id == TEST_USER_ID
    assert profile.timezone == "UTC"


async def test_returns_the_existing_profile_on_later_calls(
    session_factory: async_sessionmaker[AsyncSession],
) -> None:
    async with session_factory() as db:
        await profile_service.get_or_create_profile(db, TEST_USER_ID)
        await profile_service.update_profile_timezone(db, TEST_USER_ID, "Asia/Singapore")
        again = await profile_service.get_or_create_profile(db, TEST_USER_ID)
    assert again.timezone == "Asia/Singapore"


async def test_losing_the_first_login_race_returns_the_winners_row(
    session_factory: async_sessionmaker[AsyncSession],
) -> None:
    """Concurrent first logins must not turn into a 500.

    The lookup is forced to miss once, which is exactly what happens when the
    other request commits between our SELECT and our INSERT: the INSERT then
    hits the primary key and we have to fall back to reading the winner's row.
    """
    async with session_factory() as winner:
        winner.add(Profile(id=TEST_USER_ID, timezone="Europe/Berlin"))
        await winner.commit()

    async with session_factory() as db:
        real_get = db.get
        missed = False

        async def get_missing_once(entity: Any, ident: Any, **kwargs: Any) -> Any:
            nonlocal missed
            if not missed:
                missed = True
                return None
            return await real_get(entity, ident, **kwargs)

        db.get = get_missing_once  # type: ignore[method-assign]
        profile = await profile_service.get_or_create_profile(db, TEST_USER_ID)

    assert missed
    assert profile.timezone == "Europe/Berlin"
