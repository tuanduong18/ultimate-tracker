"""Profile schemas — Update/Read split per the per-domain schema convention.

Profiles are created implicitly from the verified JWT (no client-supplied
Create payload), so only Read and Update are exposed.
"""

import uuid
import zoneinfo
from datetime import datetime
from typing import Annotated

from pydantic import AfterValidator, BaseModel, ConfigDict, StringConstraints

from app.core.currencies import normalize_currency
from app.models.notification import MutableCategory

CurrencyCode = Annotated[str, AfterValidator(normalize_currency)]
_TIMEZONES = zoneinfo.available_timezones()


def _blank_to_none(value: str | None) -> str | None:
    # An emptied name field means "no name", not a name made of nothing.
    return value or None


def _known_timezone(value: str | None) -> str | None:
    if value is None:
        return None
    if value not in _TIMEZONES:
        raise ValueError(f"{value!r} is not a known IANA timezone")
    return value


DisplayName = Annotated[
    Annotated[str, StringConstraints(strip_whitespace=True, max_length=80)] | None,
    AfterValidator(_blank_to_none),
]
TimeZone = Annotated[
    Annotated[str, StringConstraints(strip_whitespace=True, max_length=80)] | None,
    AfterValidator(_known_timezone),
]


def _as_set(value: list[MutableCategory] | None) -> list[MutableCategory] | None:
    # The list is a set: stored once each, in one order, however it was sent.
    return None if value is None else sorted(set(value))


MutedNotifications = Annotated[list[MutableCategory] | None, AfterValidator(_as_set)]


class ProfileRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    display_name: str | None
    timezone: str
    display_currency: str
    preferred_currency: str
    muted_notifications: list[MutableCategory]
    created_at: datetime


class ProfileUpdate(BaseModel):
    """All-optional: apply with model_dump(exclude_unset=True).

    Only display_name may be sent as null (or blank), which clears it.
    muted_notifications replaces the whole list; an empty list turns every
    category back on.
    """

    display_name: DisplayName = None
    timezone: TimeZone = None
    display_currency: CurrencyCode | None = None
    preferred_currency: CurrencyCode | None = None
    muted_notifications: MutedNotifications = None
