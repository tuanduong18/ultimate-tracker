"""Health endpoint: always answers, and says whether the database is reachable.

The endpoint opens a connection on the app's own engine rather than through
get_db, so these tests swap that engine out. Left alone, it is whatever
DATABASE_URL names — on a developer machine the real Supabase database.
"""

from httpx import AsyncClient
from pytest import MonkeyPatch
from sqlalchemy.ext.asyncio import create_async_engine

from app.api.v1 import health


async def test_health_reports_a_reachable_database(
    client: AsyncClient, migrated_database: str, monkeypatch: MonkeyPatch
) -> None:
    engine = create_async_engine(migrated_database)
    monkeypatch.setattr(health, "engine", engine)

    resp = await client.get("/api/v1/health")
    await engine.dispose()

    assert resp.status_code == 200
    assert resp.json() == {"status": "ok", "db": "connected"}


class _UnreachableEngine:
    def connect(self) -> None:
        raise OSError("connection refused")


async def test_health_still_answers_200_when_the_database_is_down(
    client: AsyncClient, monkeypatch: MonkeyPatch
) -> None:
    # A stub rather than a dead address: refused connections on Windows take
    # seconds to fail, and the point is only what the endpoint does then.
    monkeypatch.setattr(health, "engine", _UnreachableEngine())

    resp = await client.get("/api/v1/health")

    assert resp.status_code == 200
    assert resp.json() == {"status": "ok", "db": "disconnected"}
