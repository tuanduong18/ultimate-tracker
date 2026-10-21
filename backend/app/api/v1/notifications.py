"""notifications API routes (v1) — the signed-in user's in-app inbox and history.

Notifications are written by background jobs (app.tasks) and by subscription
edits; this router reads them and applies the user's actions: mark read,
snooze a reminder, move a notice to the history, delete it from there.
"""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user_id
from app.db.session import get_db
from app.schemas.notification import NotificationRead, NotificationUpdate
from app.services import notifications as notification_service

router = APIRouter()


def _not_found() -> HTTPException:
    # Someone else's notification is a 404 too, so ids cannot be probed.
    return HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail={"code": "NOT_FOUND", "message": "Notification not found."},
    )


def _wrong_kind(message: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        detail={"code": "WRONG_NOTIFICATION_KIND", "message": message},
    )


@router.get("", response_model=list[NotificationRead])
async def list_notifications(
    view: notification_service.View = "inbox",
    unread_only: bool = False,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> list[NotificationRead]:
    """``view=inbox`` (default): the bell. ``view=history``: snoozed reminders
    and archived notices. Newest first."""
    rows = await notification_service.list_notifications(
        db, user_id, view=view, unread_only=unread_only, limit=limit
    )
    return [NotificationRead.model_validate(n) for n in rows]


@router.patch("/{notification_id}", response_model=NotificationRead)
async def update_notification(
    notification_id: uuid.UUID,
    payload: NotificationUpdate,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> NotificationRead:
    try:
        if payload.read is not None:
            notification = await notification_service.set_read(
                db, user_id, notification_id, read=payload.read
            )
        elif payload.snoozed is not None:
            notification = await notification_service.set_snoozed(
                db, user_id, notification_id, snoozed=payload.snoozed
            )
        else:
            notification = await notification_service.archive(db, user_id, notification_id)
    except notification_service.NotificationNotFoundError as exc:
        raise _not_found() from exc
    except notification_service.WrongKindError as exc:
        message = (
            "Only subscription reminders can be snoozed."
            if payload.snoozed is not None
            else "Reminders leave on their own and cannot be moved to the history."
        )
        raise _wrong_kind(message) from exc
    return NotificationRead.model_validate(notification)


@router.delete("/{notification_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_notification(
    notification_id: uuid.UUID,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> Response:
    try:
        await notification_service.delete(db, user_id, notification_id)
    except notification_service.NotificationNotFoundError as exc:
        raise _not_found() from exc
    except notification_service.WrongKindError as exc:
        raise _wrong_kind("Reminders leave on their own and cannot be deleted.") from exc
    return Response(status_code=status.HTTP_204_NO_CONTENT)
