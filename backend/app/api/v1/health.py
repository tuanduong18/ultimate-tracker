"""Health check — used by Render and uptime monitoring."""

from typing import Any

from fastapi import APIRouter
from sqlalchemy import text

from app.db.session import engine

router = APIRouter()


@router.get("/health")
async def health() -> dict[str, Any]:
    """Return service status and database connectivity."""
    db_status = "connected"
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
    except Exception:  # noqa: BLE001 — health must never raise, just report.
        db_status = "disconnected"
    return {"status": "ok", "db": db_status}
