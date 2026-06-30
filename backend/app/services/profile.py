"""Profile business logic, keyed to the Supabase user id."""
import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.profile import Profile


async def get_or_create_profile(db: AsyncSession, user_id: uuid.UUID) -> Profile:
    """Return the user's profile, creating a default one on first access."""
    profile = await db.get(Profile, user_id)
    if profile is None:
        profile = Profile(id=user_id)
        db.add(profile)
        await db.commit()
        await db.refresh(profile)
    return profile


async def update_profile_timezone(
    db: AsyncSession, user_id: uuid.UUID, timezone: str
) -> Profile:
    """Update (creating first if needed) the user's timezone."""
    profile = await get_or_create_profile(db, user_id)
    profile.timezone = timezone
    await db.commit()
    await db.refresh(profile)
    return profile
