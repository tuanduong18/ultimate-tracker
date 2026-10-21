"""In-app notifications — the one delivery record every alerting feature shares.

Subscription reminders and renewal notices are the first writers; budget breach
alerts and the weekly digest are meant to write here too rather than each
growing their own table. Email, when it arrives, is a second channel for the
same row.

A notification is in one of three places:

- the **inbox** (the bell): neither snoozed nor archived;
- **snoozed**: a reminder the user muted until its date; shown in history and
  can be unsnoozed;
- the **history**: archived — moved there by the user, or created there.

Reminders are live: the scheduled job rewrites their countdown each day ("renews
in 2 days") and an edit to the subscription rewrites them at once. They are
deleted on their charge day, when the renewal job replaces them with a renewal
notice. Renewal and currency notices are fixed once sent and stay in history
until the user deletes them.
"""

import uuid
from datetime import date, datetime
from enum import StrEnum

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class NotificationKind(StrEnum):
    # Reminders: live, one per subscription per charge date.
    SUBSCRIPTION_RENEWAL = "subscription_renewal"
    TRIAL_ENDING = "trial_ending"
    # Notices: fixed once sent.
    SUBSCRIPTION_RENEWED = "subscription_renewed"
    CURRENCY_DELISTED = "currency_delisted"


REMINDER_KINDS = frozenset({NotificationKind.SUBSCRIPTION_RENEWAL, NotificationKind.TRIAL_ENDING})

# A CHECKed string rather than a Postgres enum, as with subscriptions'
# interval_unit: a new kind is then a constraint swap, not an ALTER TYPE.
_KIND_LEN = 32
_KIND_CHECK = "kind IN ({})".format(", ".join(f"'{kind.value}'" for kind in NotificationKind))


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False
    )
    kind: Mapped[str] = mapped_column(String(_KIND_LEN), nullable=False)
    title: Mapped[str] = mapped_column(String(160), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    # The day the thing being announced happens — a charge, a trial ending.
    due_on: Mapped[date | None] = mapped_column(Date, nullable=True)
    # What makes a job safe to re-run: one notification per (user, key).
    # Reminders use "subscription:<id>:<charge date>", renewal notices
    # "renewed:<subscription id>:<charge date>", currency notices
    # "currency:<code>:delisted:<date>".
    dedupe_key: Mapped[str] = mapped_column(String(120), nullable=False)
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # A reminder the user muted until its date. Unsnoozing, or editing the
    # subscription, clears it.
    snoozed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # In the history rather than the inbox.
    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # When it last asked for attention: creation, or a reminder's daily update.
    # The inbox is ordered by it, so an updated reminder comes back to the top.
    alerted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    __table_args__ = (
        CheckConstraint(_KIND_CHECK, name="ck_notifications_kind"),
        UniqueConstraint("user_id", "dedupe_key", name="uq_notifications_user_dedupe_key"),
        # Serves the inbox and the history: one user's notifications, newest first.
        Index("ix_notifications_user_alerted_at", "user_id", "alerted_at"),
    )
