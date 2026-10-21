"""Pure conversion arithmetic. Fetching and storing rates is in the integration tier."""

from decimal import Decimal

import pytest

from app.services.exchange_rates import convert

RATES = {"USD": Decimal("1"), "EUR": Decimal("0.8"), "VND": Decimal("20000")}


def test_convert_rounds_to_target_minor_units() -> None:
    # VND has no minor unit, so the result must carry no decimal places.
    assert convert(Decimal("10"), "USD", "VND", RATES) == Decimal("200000")
    # 10 EUR -> 12.50 USD -> 250000 VND, proving the cross-rate goes via USD.
    assert convert(Decimal("10"), "EUR", "VND", RATES) == Decimal("250000")
    assert convert(Decimal("10"), "VND", "USD", RATES) == Decimal("0.00")


def test_convert_same_currency_needs_no_rate() -> None:
    assert convert(Decimal("10.00"), "KZT", "KZT", {}) == Decimal("10.00")


def test_convert_unknown_currency_raises() -> None:
    with pytest.raises(ValueError, match="KZT"):
        convert(Decimal("10"), "USD", "KZT", RATES)
