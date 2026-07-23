"""Profile schemas — Update/Read split per the per-domain schema convention.

Profiles are created implicitly from the verified JWT (no client-supplied
Create payload), so only Read and Update are exposed.
"""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ProfileRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    timezone: str
    created_at: datetime


class ProfileUpdate(BaseModel):
    timezone: str
