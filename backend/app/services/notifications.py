"""In-app notifications: the inbox and history reads, the user's actions on a
notification, and the write paths every job uses."""

import uuid
from collections.abc import Sequence
from datetime import UTC, datetime
from typing import Literal

import structlog
from sqlalchemy import or_, select, tuple_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notification import REMINDER_KINDS, Notification

logger = structlog.get_logger(__name__)

View = Literal["inbox", "history"]


class NotificationNotFoundError(Exception):
    pass


class WrongKindError(Exception):
    """The action does not apply to this kind: only reminders snooze, and
    reminders are never archived or deleted by hand — they go on their own."""


def is_reminder(notification: Notification) -> bool:
    return notification.kind in REMINDER_KINDS


async def list_notifications(
    db: AsyncSession, user_id: uuid.UUID, *, view: View, unread_only: bool, limit: int
) -> Sequence[Notification]:
    """``inbox``: neither snoozed nor archived. ``history``: snoozed or archived.
    Both newest first, by when each last asked for attention."""
    stmt = select(Notification).where(Notification.user_id == user_id)
    if view == "inbox":
        stmt = stmt.where(Notification.snoozed_at.is_(None), Notification.archived_at.is_(None))
    else:
        stmt = stmt.where(
            or_(Notification.snoozed_at.is_not(None), Notification.archived_at.is_not(None))
        )
    if unread_only:
        stmt = stmt.where(Notification.read_at.is_(None))
    # id breaks ties: rows from one job run share a timestamp to the microsecond.
    stmt = stmt.order_by(Notification.alerted_at.desc(), Notification.id).limit(limit)
    return (await db.scalars(stmt)).all()


async def _get_owned(
    db: AsyncSession, user_id: uuid.UUID, notification_id: uuid.UUID
) -> Notification:
    notification = await db.get(Notification, notification_id)
    if notification is None or notification.user_id != user_id:
        raise NotificationNotFoundError()
    return notification


async def _save(db: AsyncSession, notification: Notification) -> Notification:
    await db.commit()
    await db.refresh(notification)
    return notification


async def set_read(
    db: AsyncSession, user_id: uuid.UUID, notification_id: uuid.UUID, *, read: bool
) -> Notification:
    """Mark one notification read or unread. Re-marking keeps the first read_at."""
    notification = await _get_owned(db, user_id, notification_id)
    if not read:
        notification.read_at = None
    elif notification.read_at is None:
        notification.read_at = datetime.now(UTC)
    return await _save(db, notification)


async def set_snoozed(
    db: AsyncSession, user_id: uuid.UUID, notification_id: uuid.UUID, *, snoozed: bool
) -> Notification:
    """Mute a reminder until its charge — "I'm renewing anyway" — or undo that.

    A snoozed reminder still counts down, silently, in the history; the renewal
    notice for its charge then goes straight to the history too. Unsnoozing
    brings it back to the inbox as new.
    """
    notification = await _get_owned(db, user_id, notification_id)
    if not is_reminder(notification):
        raise WrongKindError()
    now = datetime.now(UTC)
    if snoozed and notification.snoozed_at is None:
        notification.snoozed_at = now
        notification.read_at = notification.read_at or now
    elif not snoozed and notification.snoozed_at is not None:
        notification.snoozed_at = None
        notification.read_at = None
        notification.alerted_at = now
    return await _save(db, notification)


async def archive(db: AsyncSession, user_id: uuid.UUID, notification_id: uuid.UUID) -> Notification:
    """Move a notice to the history. Archiving twice changes nothing."""
    notification = await _get_owned(db, user_id, notification_id)
    if is_reminder(notification):
        raise WrongKindError()
    if notification.archived_at is None:
        now = datetime.now(UTC)
        notification.archived_at = now
        notification.read_at = notification.read_at or now
    return await _save(db, notification)


async def delete(db: AsyncSession, user_id: uuid.UUID, notification_id: uuid.UUID) -> None:
    """Delete a notice for good. Reminders cannot be: they go on their own."""
    notification = await _get_owned(db, user_id, notification_id)
    if is_reminder(notification):
        raise WrongKindError()
    await db.delete(notification)
    await db.commit()


async def reminders_for(
    db: AsyncSession, user_id: uuid.UUID, subscription_id: uuid.UUID
) -> Sequence[Notification]:
    """A subscription's reminders, found by their dedupe key."""
    return (
        await db.scalars(
            select(Notification).where(
                Notification.user_id == user_id,
                Notification.kind.in_(REMINDER_KINDS),
                Notification.dedupe_key.startswith(
                    f"subscription:{subscription_id}:", autoescape=True
                ),
            )
        )
    ).all()


async def deliver_once(db: AsyncSession, candidates: Sequence[Notification]) -> int:
    """Insert the candidates nobody has been sent yet; return how many that was.

    The (user_id, dedupe_key) pair already sent is skipped, which is what makes
    every job that calls this safe to run twice. Two runs racing each other can
    still both pass the check — the unique constraint stops the second, and its
    whole batch is dropped, since the first run is delivering the same rows.
    """
    if not candidates:
        return 0

    keys = {(n.user_id, n.dedupe_key) for n in candidates}
    sent = await db.execute(
        select(Notification.user_id, Notification.dedupe_key).where(
            tuple_(Notification.user_id, Notification.dedupe_key).in_(keys)
        )
    )
    already = {(user_id, key) for user_id, key in sent}
    fresh = [n for n in candidates if (n.user_id, n.dedupe_key) not in already]
    if not fresh:
        return 0

    db.add_all(fresh)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        logger.info("notifications.concurrent_run", skipped=len(fresh))
        return 0
    return len(fresh)
