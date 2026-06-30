"""Aggregate v1 router — mounts every domain router under /api/v1."""
from fastapi import APIRouter

from app.api.v1 import (
    auth,
    finance,
    fitness,
    health,
    insights,
    steps,
    time_tracking,
    wellness,
)

api_router = APIRouter()
api_router.include_router(health.router, tags=["health"])
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(finance.router, prefix="/finance", tags=["finance"])
api_router.include_router(steps.router, prefix="/steps", tags=["steps"])
api_router.include_router(fitness.router, prefix="/fitness", tags=["fitness"])
api_router.include_router(time_tracking.router, prefix="/time", tags=["time"])
api_router.include_router(wellness.router, prefix="/wellness", tags=["wellness"])
api_router.include_router(insights.router, prefix="/insights", tags=["insights"])
