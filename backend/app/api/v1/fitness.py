"""fitness API routes (v1) — training, movement, recovery and habits.

Absorbed the former steps and wellness routers when those domains merged; see
docs/features/fitness.md. Note that `health.py` is the operational liveness
check, not part of this domain.

Keep handlers thin — business logic lives in app/services/.
"""

from fastapi import APIRouter

router = APIRouter()

# Routes are registered here as features land.
