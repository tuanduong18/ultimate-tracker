"""Profile business logic, keyed to the Supabase user id."""

import uuid

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.profile import Profile
from app.schemas.profile import ProfileUpdate


async def get_or_create_profile(db: AsyncSession, user_id: uuid.UUID) -> Profile:
    """Return the user's profile, creating a default one on first access.

    Two requests can arrive for a brand-new user at the same time — React strict
    mode double-invokes effects in development, and a first paint can fan out
    several calls. Both would read no row and both would insert the same primary
    key, so the loser of that race re-reads the winner's row rather than turning
    a normal first login into a 500.
    """
    profile = await db.get(Profile, user_id)
    if profile is not None:
        return profile

    profile = Profile(id=user_id)
    db.add(profile)
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


async def update_profile(db: AsyncSession, user_id: uuid.UUID, data: ProfileUpdate) -> Profile:
    """Apply the fields the caller actually sent, creating the profile if needed.

    ``exclude_unset`` matters: every field on ProfileUpdate is optional, so a
    PATCH carrying only a timezone must leave display_currency alone rather
    than resetting it to the field default.
    """
    profile = await get_or_create_profile(db, user_id)
    for field, value in data.model_dump(exclude_unset=True).items():
        if value is not None:
            setattr(profile, field, value)
    await db.commit()
    await db.refresh(profile)
    return profile
