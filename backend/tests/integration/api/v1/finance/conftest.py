"""Fixtures for the finance route tests."""

from decimal import Decimal

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
from tests.support.ids import OTHER_USER_ID, TEST_USER_ID

from app.models.profile import Profile
from app.services import exchange_rates


@pytest.fixture
async def db_factory(
    db_factory: async_sessionmaker[AsyncSession],
) -> async_sessionmaker[AsyncSession]:
    """The integration database, with both test users' profiles already in it.

    Overrides the fixture of the same name, so every finance test, and the
    authed_client built on it, starts with rows that foreign keys can point at.
    """
    async with db_factory() as session:
        session.add_all([Profile(id=TEST_USER_ID), Profile(id=OTHER_USER_ID)])
        await session.commit()
    return db_factory


@pytest.fixture
def finance_client(authed_client: AsyncClient) -> AsyncClient:
    return authed_client


@pytest.fixture
def stub_rates(monkeypatch: pytest.MonkeyPatch) -> None:
    """Fixed rates so totals are asserted against arithmetic, not the network."""

    async def _rates() -> dict[str, Decimal]:
        return {"USD": Decimal("1"), "SGD": Decimal("1.28"), "VND": Decimal("25000")}

    monkeypatch.setattr(exchange_rates, "get_rates", _rates)
