"""Notification schemas. Notifications are created only by jobs, so there is no Create."""

import uuid
from datetime import date, datetime
from typing import Literal, Self

from pydantic import BaseModel, ConfigDict, model_validator

from app.models.notification import NotificationKind


class NotificationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    kind: NotificationKind
    title: str
    body: str
    # The day the announced thing happens, e.g. the charge date.
    due_on: date | None
    read_at: datetime | None
    snoozed_at: datetime | None
    archived_at: datetime | None
    # When it last asked for attention: sent, or a reminder's daily update.
    alerted_at: datetime
    created_at: datetime


class NotificationUpdate(BaseModel):
    """Exactly one action: mark read or unread, snooze or unsnooze a reminder,
    or move a notice to the history."""

    read: bool | None = None
    snoozed: bool | None = None
    archived: Literal[True] | None = None

    @model_validator(mode="after")
    def _one_action(self) -> Self:
        sent = [name for name in ("read", "snoozed", "archived") if getattr(self, name) is not None]
        if len(sent) != 1:
            raise ValueError("send exactly one of read, snoozed or archived")
        return self
