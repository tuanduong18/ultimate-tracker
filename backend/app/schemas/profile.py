"""Profile schemas — Update/Read split per the per-domain schema convention.

Profiles are created implicitly from the verified JWT (no client-supplied
Create payload), so only Read and Update are exposed.
"""

import uuid
from datetime import datetime
from typing import Annotated

from pydantic import AfterValidator, BaseModel, ConfigDict, StringConstraints

from app.core.currencies import normalize_currency

CurrencyCode = Annotated[str, AfterValidator(normalize_currency)]


def _blank_to_none(value: str | None) -> str | None:
    # An emptied name field means "no name", not a name made of nothing.
    return value or None


DisplayName = Annotated[
    Annotated[str, StringConstraints(strip_whitespace=True, max_length=80)] | None,
    AfterValidator(_blank_to_none),
]


class ProfileRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    display_name: str | None
    timezone: str
    display_currency: str
    preferred_currency: str
    created_at: datetime


class ProfileUpdate(BaseModel):
    """All-optional: apply with model_dump(exclude_unset=True).

    Only display_name may be sent as null (or blank), which clears it.
    """

    display_name: DisplayName = None
    timezone: str | None = None
    display_currency: CurrencyCode | None = None
    preferred_currency: CurrencyCode | None = None
