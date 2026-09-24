"""Aggregate v1 router — mounts every domain router under /api/v1."""

from fastapi import APIRouter

from app.api.v1 import (
    auth,
    finance,
    fitness,
    gaming,
    health,
    insights,
    time_tracking,
)

api_router = APIRouter()

# `health` is the operational liveness check polled by Render and the uptime
# monitor — it is not a tracking domain. The body-tracking domain is `fitness`.
api_router.include_router(health.router, tags=["health"])

api_router.include_router(auth.router, prefix="/auth", tags=["auth"])

# Domains, in the order they appear in the app. Gaming is last by design.
api_router.include_router(finance.router, prefix="/finance", tags=["finance"])
api_router.include_router(fitness.router, prefix="/fitness", tags=["fitness"])
api_router.include_router(time_tracking.router, prefix="/time", tags=["time"])
api_router.include_router(insights.router, prefix="/insights", tags=["insights"])
api_router.include_router(gaming.router, prefix="/gaming", tags=["gaming"])
