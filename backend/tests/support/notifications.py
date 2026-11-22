"""Turning notification categories off for a user, as the profile stores it."""

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notification import NotificationCategory
from app.models.profile import Profile


async def mute(db: AsyncSession, user_id: uuid.UUID, *categories: NotificationCategory) -> None:
    """Set the user's muted categories to exactly these; none turns everything back on.

    Written straight to the profile, as a job would find it. Turning reminders off
    through the API also deletes the live ones (tests/integration/services/test_profile.py).
    """
    profile = await db.get(Profile, user_id)
    assert profile is not None
    profile.muted_notifications = list(categories)
    await db.commit()
