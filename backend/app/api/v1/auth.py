"""auth API routes (v1) — current-user profile.

Exercises the full auth path: verify the Supabase JWT, then read/write the
profile in the database. Business logic lives in app/services/profile.py.
"""
import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user_id
from app.db.session import get_db
from app.schemas.profile import ProfileRead, ProfileUpdate
from app.services import profile as profile_service

router = APIRouter()


@router.get("/me", response_model=ProfileRead)
async def read_me(
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> ProfileRead:
    """Return the authenticated user's profile, creating it on first access."""
    profile = await profile_service.get_or_create_profile(db, user_id)
    return ProfileRead.model_validate(profile)


@router.patch("/me", response_model=ProfileRead)
async def update_me(
    payload: ProfileUpdate,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> ProfileRead:
    """Update the authenticated user's timezone."""
    profile = await profile_service.update_profile_timezone(
        db, user_id, payload.timezone
    )
    return ProfileRead.model_validate(profile)
