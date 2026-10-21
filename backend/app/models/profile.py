"""Profile — app-specific user fields, keyed to Supabase ``auth.users.id``.

We do not duplicate auth data; this table only references the user's UUID and
stores fields the app owns (e.g. timezone). The email address in particular is
not here: it belongs to the sign-in provider, and the frontend reads it from
the session.
"""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.currencies import DEFAULT_CURRENCY
from app.db.base import Base


class Profile(Base):
    __tablename__ = "profiles"

    # Mirrors auth.users.id — same UUID, no foreign key (auth lives in Supabase).
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True)
    # What the app calls the user. Null until they set one; the frontend then
    # falls back to the name their sign-in provider gave (Google supplies one)
    # and then to their email. Owned by the app rather than copied from the
    # provider, so editing it here does not fight a provider sync.
    display_name: Mapped[str | None] = mapped_column(String(80), nullable=True)
    timezone: Mapped[str] = mapped_column(String, default="UTC", nullable=False)
    # The currency totals are reported in. Expenses keep the currency they were
    # spent in; only the summary converts, so changing this rewrites no history.
    display_currency: Mapped[str] = mapped_column(
        String(3), default=DEFAULT_CURRENCY, server_default=DEFAULT_CURRENCY, nullable=False
    )
    # The currency new expenses, budgets and subscriptions start in. Separate
    # from display_currency because the two diverge exactly when it matters:
    # someone reporting in SGD while spending VND on a trip.
    preferred_currency: Mapped[str] = mapped_column(
        String(3), default=DEFAULT_CURRENCY, server_default=DEFAULT_CURRENCY, nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
