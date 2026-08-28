"""Profile business logic, keyed to the Supabase user id."""

import uuid

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.profile import Profile
from app.services import finance as finance_service


async def get_or_create_profile(db: AsyncSession, user_id: uuid.UUID) -> Profile:
    """Return the user's profile, creating a default one on first access.

    Two requests can arrive for a brand-new user at the same time — React strict
    mode double-invokes effects in development, and a first paint can fan out
    several calls. Both would read no row and both would insert the same primary
    key, so the loser of that race re-reads the winner's row rather than turning
    a normal first login into a 500.

    A new profile is seeded with the default categories in the same commit, so
    the loser of the race does not double-seed either.
    """
    profile = await db.get(Profile, user_id)
    if profile is not None:
        return profile

    profile = Profile(id=user_id)
    db.add(profile)
    # Same transaction as the profile itself: a user who ends up with a profile
    # but no categories cannot create a budget, and nothing would ever retry the
    # seeding for them.
    db.add_all(finance_service.build_default_categories(user_id))
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        existing = await db.get(Profile, user_id)
        if existing is None:
            # Not the race — the insert failed for some other reason.
            raise
        return existing

    await db.refresh(profile)
    return profile


async def update_profile_timezone(db: AsyncSession, user_id: uuid.UUID, timezone: str) -> Profile:
    """Update (creating first if needed) the user's timezone."""
    profile = await get_or_create_profile(db, user_id)
    profile.timezone = timezone
    await db.commit()
    await db.refresh(profile)
    return profile
