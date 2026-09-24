"""gaming API routes (v1). Keep handlers thin — business logic lives in app/services/.

Scheduled after every other domain by design — see docs/features/gaming.md.
"""

from fastapi import APIRouter

router = APIRouter()

# Routes are registered here as features land.
