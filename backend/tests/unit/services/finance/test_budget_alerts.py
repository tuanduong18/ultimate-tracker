"""Budget alert rules that need no database: thresholds, keys and wording."""

import uuid
from datetime import UTC, date, datetime
from decimal import Decimal
from typing import Any

import pytest

from app.models.finance import BudgetPeriod
from app.models.notification import NotificationKind
from app.services.finance.budget_alerts import CAP, alert_key, alert_threshold, render

BUDGET = uuid.UUID("00000000-0000-0000-0000-0000000000b1")
USER = uuid.UUID("00000000-0000-0000-0000-0000000000a1")
NOW = datetime(2026, 10, 24, tzinfo=UTC)


def progress(spent: str, amount: str = "400.000", **overrides: Any) -> dict[str, Any]:
    fields: dict[str, Any] = {
        "id": BUDGET,
        "name": "Food",
        "currency": "USD",
        "amount": Decimal(amount),
        "spent": Decimal(spent),
        "period": BudgetPeriod.MONTHLY,
        "window_starts_on": date(2026, 10, 1),
        "window_ends_on": date(2026, 10, 31),
    }
    fields.update(overrides)
    return fields


@pytest.mark.parametrize(
    ("spent", "warn_at", "expected"),
    [
        ("319.99", 80, None),
        ("320.00", 80, 80),
        ("399.99", 80, 80),
        ("400.00", 80, CAP),
        ("1000.00", 80, CAP),
        ("399.99", None, None),
        ("400.00", None, CAP),
        ("4.00", 1, 1),
    ],
)
def test_the_threshold_is_reached_exactly(spent: str, warn_at: int | None, expected: int) -> None:
    assert alert_threshold(Decimal(spent), Decimal("400.00"), warn_at) == expected


def test_the_key_names_the_window_threshold_and_cap() -> None:
    # Trailing zeros from Numeric(20, 3) don't make a second key for the same cap.
    assert alert_key(progress("0"), 80) == f"budget:{BUDGET}:2026-10-01:80:400USD"
    assert (
        alert_key(progress("0", amount="12.500"), CAP) == f"budget:{BUDGET}:2026-10-01:100:12.5USD"
    )


def test_a_warning_rounds_its_percentage_down() -> None:
    # 87.4999% has not reached 88%.
    alert = render(USER, progress("349.99"), 80, NOW)

    assert alert.kind == NotificationKind.BUDGET_WARNING
    assert alert.title == "Food is 87% spent"
    assert alert.body == "USD 349.99 of USD 400.00 spent in October 2026, USD 50.01 left."


def test_amounts_are_written_in_the_currencys_own_decimals() -> None:
    alert = render(
        USER,
        progress("4500000", amount="4000000", currency="VND", name="Ăn uống"),
        CAP,
        NOW,
    )

    assert alert.title == "Ăn uống is over budget"
    assert alert.body == ("VND 4,500,000 of VND 4,000,000 spent in October 2026, VND 500,000 over.")


def test_a_custom_budget_names_its_dates() -> None:
    trip = progress(
        "200.00",
        period=BudgetPeriod.CUSTOM,
        window_starts_on=date(2026, 9, 25),
        window_ends_on=date(2026, 10, 8),
    )

    assert render(USER, trip, 50, NOW).body == (
        "USD 200.00 of USD 400.00 spent from 25 Sep to 8 Oct 2026, USD 200.00 left."
    )
