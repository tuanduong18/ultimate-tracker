"""The range summary and the category and period breakdowns.

Full route -> service -> DB path against SQLite.
"""

from decimal import Decimal

import pytest
from httpx import AsyncClient
from tests.support.finance_api import (
    make_budget,
    make_category,
    make_expense,
)

from app.services import exchange_rates


async def test_summary_converts_mixed_currencies_into_one_total(
    finance_client: AsyncClient, stub_rates: None
) -> None:
    await make_expense(finance_client, amount="10.00", currency="USD", spent_on="2026-08-10")
    await make_expense(finance_client, amount="12.80", currency="SGD", spent_on="2026-08-11")

    resp = await finance_client.get(
        "/api/v1/finance/summary",
        params={"start_date": "2026-08-01", "end_date": "2026-08-31"},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    # SGD 12.80 / 1.28 = USD 10.00, so the total is USD 20.00 rather than 22.80.
    assert body["currency"] == "USD"
    assert Decimal(body["spent"]) == Decimal("20.00")


async def test_summary_counts_budgets_overlapping_the_window(
    finance_client: AsyncClient, stub_rates: None
) -> None:
    food = await make_category(finance_client)
    await make_budget(finance_client, [food["id"]])  # 500.00 USD, Aug 1-31
    await make_expense(finance_client, amount="30.00", currency="USD", spent_on="2026-08-10")

    resp = await finance_client.get(
        "/api/v1/finance/summary",
        params={"start_date": "2026-08-05", "end_date": "2026-08-15"},
    )
    body = resp.json()
    assert Decimal(body["budgeted"]) == Decimal("500.00")
    assert Decimal(body["remaining"]) == Decimal("470.00")


async def test_summary_remaining_goes_negative_when_overspent(
    finance_client: AsyncClient, stub_rates: None
) -> None:
    await make_expense(finance_client, amount="80.00", currency="USD", spent_on="2026-08-10")

    resp = await finance_client.get(
        "/api/v1/finance/summary",
        params={"start_date": "2026-08-01", "end_date": "2026-08-31"},
    )
    body = resp.json()
    # No budgets, so the overspend is the whole spend and must not clamp to zero.
    assert Decimal(body["remaining"]) == Decimal("-80.00")


async def test_summary_rejects_an_inverted_range(
    finance_client: AsyncClient, stub_rates: None
) -> None:
    resp = await finance_client.get(
        "/api/v1/finance/summary",
        params={"start_date": "2026-08-31", "end_date": "2026-08-01"},
    )
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "INVALID_DATE_RANGE"


async def test_summary_reports_a_missing_rate_as_our_outage(
    finance_client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """A rate we cannot fetch is 503, not a total that quietly omits money."""

    async def _partial() -> dict[str, Decimal]:
        return {"USD": Decimal("1")}

    monkeypatch.setattr(exchange_rates, "get_rates", _partial)
    await make_expense(finance_client, amount="50000", currency="VND", spent_on="2026-08-10")

    resp = await finance_client.get(
        "/api/v1/finance/summary",
        params={"start_date": "2026-08-01", "end_date": "2026-08-31"},
    )
    assert resp.status_code == 503
    assert resp.json()["error"]["code"] == "RATE_UNAVAILABLE"


async def test_category_breakdown_groups_and_converts(
    finance_client: AsyncClient, stub_rates: None
) -> None:
    food = await make_category(finance_client, name="Food")
    rent = await make_category(finance_client, name="Rent")
    await make_expense(
        finance_client,
        amount="10.00",
        currency="USD",
        category_id=food["id"],
        spent_on="2026-08-10",
    )
    # SGD 12.80 / 1.28 = USD 10.00, so Food totals 20.00 rather than 22.80.
    await make_expense(
        finance_client,
        amount="12.80",
        currency="SGD",
        category_id=food["id"],
        spent_on="2026-08-11",
    )
    await make_expense(
        finance_client,
        amount="5.00",
        currency="USD",
        category_id=rent["id"],
        spent_on="2026-08-12",
    )

    resp = await finance_client.get(
        "/api/v1/finance/summary/by-category",
        params={"start_date": "2026-08-01", "end_date": "2026-08-31"},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["currency"] == "USD"
    # Largest slice first.
    assert [c["name"] for c in body["categories"]] == ["Food", "Rent"]
    assert Decimal(body["categories"][0]["spent"]) == Decimal("20.00")
    assert body["categories"][0]["category_id"] == food["id"]


async def test_category_breakdown_omits_categories_with_no_spend(
    finance_client: AsyncClient, stub_rates: None
) -> None:
    food = await make_category(finance_client, name="Food")
    await make_category(finance_client, name="Rent")
    await make_expense(
        finance_client,
        amount="10.00",
        currency="USD",
        category_id=food["id"],
        spent_on="2026-08-10",
    )

    body = (
        await finance_client.get(
            "/api/v1/finance/summary/by-category",
            params={"start_date": "2026-08-01", "end_date": "2026-08-31"},
        )
    ).json()
    assert [c["name"] for c in body["categories"]] == ["Food"]


async def test_category_breakdown_keeps_deleted_category_spend_in_one_bucket(
    finance_client: AsyncClient, stub_rates: None
) -> None:
    """Deleting a category must not make its spend vanish from the chart."""
    food = await make_category(finance_client, name="Food")
    await make_expense(
        finance_client,
        amount="10.00",
        currency="USD",
        category_id=food["id"],
        spent_on="2026-08-10",
    )
    assert (
        await finance_client.delete(f"/api/v1/finance/categories/{food['id']}")
    ).status_code == 204

    body = (
        await finance_client.get(
            "/api/v1/finance/summary/by-category",
            params={"start_date": "2026-08-01", "end_date": "2026-08-31"},
        )
    ).json()
    assert len(body["categories"]) == 1
    assert body["categories"][0]["category_id"] is None
    assert Decimal(body["categories"][0]["spent"]) == Decimal("10.00")


async def test_category_breakdown_totals_match_the_summary(
    finance_client: AsyncClient, stub_rates: None
) -> None:
    """The slices have to add up to what the tiles above them claim."""
    food = await make_category(finance_client, name="Food")
    await make_expense(
        finance_client,
        amount="10.00",
        currency="USD",
        category_id=food["id"],
        spent_on="2026-08-10",
    )
    await make_expense(finance_client, amount="7.00", currency="USD", spent_on="2026-08-11")
    params = {"start_date": "2026-08-01", "end_date": "2026-08-31"}

    summary = (await finance_client.get("/api/v1/finance/summary", params=params)).json()
    breakdown = (
        await finance_client.get("/api/v1/finance/summary/by-category", params=params)
    ).json()

    sliced = sum(Decimal(c["spent"]) for c in breakdown["categories"])
    assert sliced == Decimal(summary["spent"]) == Decimal("17.00")


async def test_category_breakdown_rejects_an_inverted_range(
    finance_client: AsyncClient, stub_rates: None
) -> None:
    resp = await finance_client.get(
        "/api/v1/finance/summary/by-category",
        params={"start_date": "2026-08-31", "end_date": "2026-08-01"},
    )
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "INVALID_DATE_RANGE"


async def test_weekly_breakdown_clips_weeks_to_the_month(
    finance_client: AsyncClient, stub_rates: None
) -> None:
    """August 2026 starts on a Saturday, so the first bar is two days long."""
    body = (
        await finance_client.get(
            "/api/v1/finance/summary/by-period",
            params={"start_date": "2026-08-01", "end_date": "2026-08-31"},
        )
    ).json()

    assert body["granularity"] == "week"
    spans = [(w["starts_on"], w["ends_on"]) for w in body["buckets"]]
    assert spans == [
        ("2026-08-01", "2026-08-02"),
        ("2026-08-03", "2026-08-09"),
        ("2026-08-10", "2026-08-16"),
        ("2026-08-17", "2026-08-23"),
        ("2026-08-24", "2026-08-30"),
        ("2026-08-31", "2026-08-31"),
    ]


async def test_weekly_breakdown_buckets_and_keeps_quiet_weeks(
    finance_client: AsyncClient, stub_rates: None
) -> None:
    await make_expense(finance_client, amount="10.00", currency="USD", spent_on="2026-08-01")
    await make_expense(finance_client, amount="12.80", currency="SGD", spent_on="2026-08-02")
    await make_expense(finance_client, amount="5.00", currency="USD", spent_on="2026-08-12")

    body = (
        await finance_client.get(
            "/api/v1/finance/summary/by-period",
            params={"start_date": "2026-08-01", "end_date": "2026-08-31"},
        )
    ).json()

    spent = [Decimal(w["spent"]) for w in body["buckets"]]
    # Aug 1-2 holds both of the first two expenses, converted: 10 + 10 = 20.
    assert spent[0] == Decimal("20.00")
    # A week with nothing in it is a zero bar, not a missing one.
    assert spent[1] == Decimal("0")
    assert spent[2] == Decimal("5.00")
    assert sum(spent) == Decimal("25.00")


async def test_period_breakdown_rejects_an_inverted_range(
    finance_client: AsyncClient, stub_rates: None
) -> None:
    resp = await finance_client.get(
        "/api/v1/finance/summary/by-period",
        params={"start_date": "2026-08-31", "end_date": "2026-08-01"},
    )
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "INVALID_DATE_RANGE"


async def test_daily_breakdown_returns_one_bucket_per_day(
    finance_client: AsyncClient, stub_rates: None
) -> None:
    await make_expense(finance_client, amount="10.00", currency="USD", spent_on="2026-08-04")

    body = (
        await finance_client.get(
            "/api/v1/finance/summary/by-period",
            params={
                "start_date": "2026-08-03",
                "end_date": "2026-08-09",
                "granularity": "day",
            },
        )
    ).json()

    assert body["granularity"] == "day"
    assert len(body["buckets"]) == 7
    # Each day is its own start and end, so a bar labels one date.
    assert all(b["starts_on"] == b["ends_on"] for b in body["buckets"])
    assert Decimal(body["buckets"][1]["spent"]) == Decimal("10.00")
    assert Decimal(body["buckets"][0]["spent"]) == Decimal("0")


async def test_both_granularities_total_the_same_money(
    finance_client: AsyncClient, stub_rates: None
) -> None:
    """Changing the bar width must not change how much was spent."""
    await make_expense(finance_client, amount="10.00", currency="USD", spent_on="2026-08-04")
    await make_expense(finance_client, amount="12.80", currency="SGD", spent_on="2026-08-20")
    params = {"start_date": "2026-08-01", "end_date": "2026-08-31"}

    totals = []
    for granularity in ("day", "week"):
        body = (
            await finance_client.get(
                "/api/v1/finance/summary/by-period",
                params={**params, "granularity": granularity},
            )
        ).json()
        totals.append(sum(Decimal(b["spent"]) for b in body["buckets"]))

    summary = (await finance_client.get("/api/v1/finance/summary", params=params)).json()
    assert totals[0] == totals[1] == Decimal(summary["spent"]) == Decimal("20.00")


async def test_period_breakdown_rejects_an_unknown_granularity(
    finance_client: AsyncClient, stub_rates: None
) -> None:
    resp = await finance_client.get(
        "/api/v1/finance/summary/by-period",
        params={"start_date": "2026-08-01", "end_date": "2026-08-31", "granularity": "fortnight"},
    )
    # FastAPI rejects it against the Literal before the service ever sees it.
    assert resp.status_code == 422


async def test_category_breakdown_keeps_only_the_chosen_categories(
    finance_client: AsyncClient, stub_rates: None
) -> None:
    food = await make_category(finance_client, name="Food")
    rent = await make_category(finance_client, name="Rent")
    await make_expense(
        finance_client,
        amount="10.00",
        currency="USD",
        category_id=food["id"],
        spent_on="2026-08-10",
    )
    await make_expense(
        finance_client,
        amount="500.00",
        currency="USD",
        category_id=rent["id"],
        spent_on="2026-08-11",
    )

    body = (
        await finance_client.get(
            "/api/v1/finance/summary/by-category",
            params={
                "start_date": "2026-08-01",
                "end_date": "2026-08-31",
                "category_ids": [food["id"]],
            },
        )
    ).json()

    # Rent dwarfs everything else, which is the reason to be able to drop it.
    assert [c["name"] for c in body["categories"]] == ["Food"]


async def test_period_breakdown_totals_only_the_chosen_categories(
    finance_client: AsyncClient, stub_rates: None
) -> None:
    food = await make_category(finance_client, name="Food")
    rent = await make_category(finance_client, name="Rent")
    await make_expense(
        finance_client,
        amount="10.00",
        currency="USD",
        category_id=food["id"],
        spent_on="2026-08-10",
    )
    await make_expense(
        finance_client,
        amount="500.00",
        currency="USD",
        category_id=rent["id"],
        spent_on="2026-08-10",
    )

    body = (
        await finance_client.get(
            "/api/v1/finance/summary/by-period",
            params={
                "start_date": "2026-08-01",
                "end_date": "2026-08-31",
                "category_ids": [food["id"]],
            },
        )
    ).json()

    assert sum(Decimal(b["spent"]) for b in body["buckets"]) == Decimal("10.00")


async def test_uncategorized_spend_can_be_dropped_on_its_own(
    finance_client: AsyncClient, stub_rates: None
) -> None:
    """The bucket with no id still has to be switchable, or it cannot be hidden."""
    food = await make_category(finance_client, name="Food")
    await make_expense(
        finance_client,
        amount="10.00",
        currency="USD",
        category_id=food["id"],
        spent_on="2026-08-10",
    )
    await make_expense(finance_client, amount="99.00", currency="USD", spent_on="2026-08-11")
    params = {"start_date": "2026-08-01", "end_date": "2026-08-31"}

    with_bucket = (
        await finance_client.get("/api/v1/finance/summary/by-category", params=params)
    ).json()
    assert len(with_bucket["categories"]) == 2

    without = (
        await finance_client.get(
            "/api/v1/finance/summary/by-category",
            params={**params, "include_uncategorized": "false"},
        )
    ).json()
    # Every named category survives; only the nameless bucket goes.
    assert [c["name"] for c in without["categories"]] == ["Food"]


async def test_selecting_nothing_reports_nothing(
    finance_client: AsyncClient, stub_rates: None
) -> None:
    """An empty selection must not fall back to showing everything."""
    await make_expense(finance_client, amount="10.00", currency="USD", spent_on="2026-08-10")

    body = (
        await finance_client.get(
            "/api/v1/finance/summary/by-period",
            params={
                "start_date": "2026-08-01",
                "end_date": "2026-08-31",
                "category_ids": [],
                "include_uncategorized": "false",
            },
        )
    ).json()

    assert sum(Decimal(b["spent"]) for b in body["buckets"]) == Decimal("0")


async def test_no_filter_still_means_everything(
    finance_client: AsyncClient, stub_rates: None
) -> None:
    food = await make_category(finance_client, name="Food")
    await make_expense(
        finance_client,
        amount="10.00",
        currency="USD",
        category_id=food["id"],
        spent_on="2026-08-10",
    )
    await make_expense(finance_client, amount="7.00", currency="USD", spent_on="2026-08-11")

    body = (
        await finance_client.get(
            "/api/v1/finance/summary/by-period",
            params={"start_date": "2026-08-01", "end_date": "2026-08-31"},
        )
    ).json()

    assert sum(Decimal(b["spent"]) for b in body["buckets"]) == Decimal("17.00")
