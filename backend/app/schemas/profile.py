"""Profile schemas — Update/Read split per the per-domain schema convention.

Profiles are created implicitly from the verified JWT (no client-supplied
Create payload), so only Read and Update are exposed.
"""

import uuid
from datetime import datetime
from typing import Annotated

from pydantic import AfterValidator, BaseModel, ConfigDict

from app.core.currencies import normalize_currency

CurrencyCode = Annotated[str, AfterValidator(normalize_currency)]


class ProfileRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    timezone: str
    display_currency: str
    created_at: datetime


class ProfileUpdate(BaseModel):
    """All-optional: apply with model_dump(exclude_unset=True)."""

    timezone: str | None = None
    display_currency: CurrencyCode | None = None
