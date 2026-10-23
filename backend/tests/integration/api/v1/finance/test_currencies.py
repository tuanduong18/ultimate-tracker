"""Which currencies new data may use: the ones the rate provider still quotes.

Full route -> service -> DB path against Postgres.
"""

from collections.abc import Awaitable, Callable
from decimal import Decimal

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
from tests.support.finance_api import make_category, make_expense

from app.services import exchange_rates

Quote = Callable[..., Awaitable[None]]


@pytest.fixture
def quote(db_factory: async_sessionmaker[AsyncSession]) -> Quote:
    """Apply one provider response, as the refresh job would."""

    async def _quote(*codes: str) -> None:
        async with db_factory() as session:
            await exchange_rates.store_rates(session, {code: Decimal("1") for code in codes})

    return _quote


async def test_before_the_first_refresh_the_fallback_currencies_are_offered(
    finance_client: AsyncClient,
) -> None:
    body = (await finance_client.get("/api/v1/finance/currencies")).json()

    assert body == sorted(exchange_rates._FALLBACK_RATES)


async def test_the_list_is_what_the_provider_still_quotes(
    finance_client: AsyncClient, quote: Quote
) -> None:
    await quote("VND", "USD", "AMD")
    await quote("VND", "USD")

    body = (await finance_client.get("/api/v1/finance/currencies")).json()

    assert body == ["USD", "VND"]


@pytest.mark.parametrize(("currency", "message"), [("AMD", "no longer"), ("XYZ", "not a")])
async def test_new_expense_in_an_unsupported_currency_is_a_422(
    finance_client: AsyncClient, quote: Quote, currency: str, message: str
) -> None:
    await quote("USD", "AMD")
    await quote("USD")

    resp = await finance_client.post(
        "/api/v1/finance/expenses",
        json={"amount": "5.00", "currency": currency, "spent_on": "2026-08-19"},
    )

    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "UNSUPPORTED_CURRENCY"
    assert message in resp.json()["error"]["message"]


async def test_a_row_in_a_since_delisted_currency_stays_editable(
    finance_client: AsyncClient, quote: Quote
) -> None:
    await quote("USD", "AMD")
    expense = await make_expense(finance_client, amount="1000.00", currency="AMD")
    await quote("USD")

    resp = await finance_client.patch(
        f"/api/v1/finance/expenses/{expense['id']}", json={"amount": "1200.00", "currency": "AMD"}
    )

    assert resp.status_code == 200, resp.text
    assert resp.json()["currency"] == "AMD"


async def test_switching_a_row_to_a_delisted_currency_is_a_422(
    finance_client: AsyncClient, quote: Quote
) -> None:
    await quote("USD", "AMD")
    expense = await make_expense(finance_client)
    await quote("USD")

    resp = await finance_client.patch(
        f"/api/v1/finance/expenses/{expense['id']}", json={"currency": "AMD"}
    )

    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "UNSUPPORTED_CURRENCY"


@pytest.mark.parametrize("path", ["/api/v1/finance/budgets", "/api/v1/finance/subscriptions"])
async def test_budgets_and_subscriptions_follow_the_same_rule(
    finance_client: AsyncClient, quote: Quote, path: str
) -> None:
    await quote("USD")
    category = await make_category(finance_client)
    payload = {
        "name": "x",
        "amount": "10.00",
        "currency": "EUR",
        "starts_on": "2026-08-01",
        "ends_on": "2026-08-31",
        "category_ids": [category["id"]],
        "interval_unit": "month",
        "started_on": "2099-01-31",
    }

    resp = await finance_client.post(path, json=payload)

    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "UNSUPPORTED_CURRENCY"


async def test_profile_currencies_follow_the_same_rule(
    finance_client: AsyncClient, quote: Quote
) -> None:
    await quote("USD", "AMD")
    assert (
        await finance_client.patch("/api/v1/auth/me", json={"preferred_currency": "AMD"})
    ).status_code == 200
    await quote("USD")

    switch = await finance_client.patch("/api/v1/auth/me", json={"display_currency": "AMD"})
    # The one already set may stay, so saving the settings form still works.
    keep = await finance_client.patch(
        "/api/v1/auth/me", json={"preferred_currency": "AMD", "display_currency": "USD"}
    )

    assert switch.status_code == 422
    assert switch.json()["error"]["code"] == "UNSUPPORTED_CURRENCY"
    assert keep.status_code == 200, keep.text
