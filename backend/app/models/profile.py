"""Profile — app-specific user fields, keyed to Supabase ``auth.users.id``.

We do not duplicate auth data; this table only references the user's UUID and
stores fields the app owns (e.g. timezone).
"""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Profile(Base):
    __tablename__ = "profiles"

    # Mirrors auth.users.id — same UUID, no foreign key (auth lives in Supabase).
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True)
    timezone: Mapped[str] = mapped_column(String, default="UTC", nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
