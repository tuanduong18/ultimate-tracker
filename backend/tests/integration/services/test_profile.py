"""Service-level tests for profile creation, including the first-login race."""

import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.models.finance import Category
from app.models.profile import Profile
from app.schemas.profile import ProfileUpdate
from app.services import finance as finance_service
from app.services import profile as profile_service

TEST_USER_ID = uuid.UUID("00000000-0000-0000-0000-000000000002")


async def test_creates_profile_with_default_timezone(
    db_factory: async_sessionmaker[AsyncSession],
) -> None:
    async with db_factory() as db:
        profile = await profile_service.get_or_create_profile(db, TEST_USER_ID)
    assert profile.id == TEST_USER_ID
    assert profile.timezone == "UTC"


async def test_returns_the_existing_profile_on_later_calls(
    db_factory: async_sessionmaker[AsyncSession],
) -> None:
    async with db_factory() as db:
        await profile_service.get_or_create_profile(db, TEST_USER_ID)
        await profile_service.update_profile(
            db, TEST_USER_ID, ProfileUpdate(timezone="Asia/Singapore")
        )
        again = await profile_service.get_or_create_profile(db, TEST_USER_ID)
    assert again.timezone == "Asia/Singapore"


async def test_losing_the_first_login_race_returns_the_winners_row(
    db_factory: async_sessionmaker[AsyncSession],
) -> None:
    """Concurrent first logins must not turn into a 500.

    The lookup is forced to miss once, which is exactly what happens when the
    other request commits between our SELECT and our INSERT: the INSERT then
    hits the primary key and we have to fall back to reading the winner's row.
    """
    async with db_factory() as winner:
        winner.add(Profile(id=TEST_USER_ID, timezone="Europe/Berlin"))
        await winner.commit()

    async with db_factory() as db:
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


async def test_partial_update_leaves_untouched_preferences_alone(
    db_factory: async_sessionmaker[AsyncSession],
) -> None:
    """A PATCH carrying only a timezone must not reset the display currency."""
    async with db_factory() as db:
        await profile_service.update_profile(
            db, TEST_USER_ID, ProfileUpdate(display_currency="vnd")
        )
        profile = await profile_service.update_profile(
            db, TEST_USER_ID, ProfileUpdate(timezone="Asia/Singapore")
        )

    assert profile.timezone == "Asia/Singapore"
    assert profile.display_currency == "VND"


async def _category_names(
    db_factory: async_sessionmaker[AsyncSession], user_id: uuid.UUID
) -> list[str]:
    async with db_factory() as db:
        rows = await db.scalars(
            select(Category).where(Category.user_id == user_id).order_by(Category.name)
        )
        return [c.name for c in rows.all()]


async def test_a_new_profile_is_seeded_with_the_default_categories(
    db_factory: async_sessionmaker[AsyncSession],
) -> None:
    async with db_factory() as db:
        await profile_service.get_or_create_profile(db, TEST_USER_ID)

    assert await _category_names(db_factory, TEST_USER_ID) == [
        "Education",
        "Entertainment",
        "Food",
        "Other",
        "Rent",
        "Subscriptions",
    ]


async def test_seeded_categories_carry_distinct_colours(
    db_factory: async_sessionmaker[AsyncSession],
) -> None:
    async with db_factory() as db:
        await profile_service.get_or_create_profile(db, TEST_USER_ID)
        rows = (await db.scalars(select(Category).where(Category.user_id == TEST_USER_ID))).all()

    colours = [c.colour for c in rows]
    assert len(set(colours)) == len(colours), "a shared colour makes the first chart unreadable"
    assert all(c.startswith("#") for c in colours)


async def test_seeding_happens_once_not_on_every_access(
    db_factory: async_sessionmaker[AsyncSession],
) -> None:
    async with db_factory() as db:
        await profile_service.get_or_create_profile(db, TEST_USER_ID)
        await profile_service.get_or_create_profile(db, TEST_USER_ID)
        await profile_service.get_or_create_profile(db, TEST_USER_ID)

    assert len(await _category_names(db_factory, TEST_USER_ID)) == len(
        finance_service.DEFAULT_CATEGORIES
    )


async def test_losing_the_race_does_not_double_seed(
    db_factory: async_sessionmaker[AsyncSession],
) -> None:
    """The loser rolls back its own seed rather than duplicating the winner's."""
    async with db_factory() as winner:
        winner.add(Profile(id=TEST_USER_ID))
        await winner.flush()  # profile before categories, as the service does
        winner.add_all(finance_service.build_default_categories(TEST_USER_ID))
        await winner.commit()

    async with db_factory() as db:
        real_get = db.get
        missed = False

        async def get_missing_once(entity: Any, ident: Any, **kwargs: Any) -> Any:
            nonlocal missed
            if not missed:
                missed = True
                return None
            return await real_get(entity, ident, **kwargs)

        db.get = get_missing_once  # type: ignore[method-assign]
        await profile_service.get_or_create_profile(db, TEST_USER_ID)

    assert len(await _category_names(db_factory, TEST_USER_ID)) == len(
        finance_service.DEFAULT_CATEGORIES
    )
