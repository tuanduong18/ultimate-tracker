"""The currency reference list.

Full route -> service -> DB path against SQLite.
"""

from httpx import AsyncClient

from app.core.currencies import CURRENCY_CODES


async def test_currencies_endpoint_matches_the_validated_set(
    finance_client: AsyncClient,
) -> None:
    body = (await finance_client.get("/api/v1/finance/currencies")).json()
    assert "VND" in body and "USD" in body
    assert len(body) == len(CURRENCY_CODES)
