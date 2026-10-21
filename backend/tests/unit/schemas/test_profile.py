"""Profile schema validation."""

import pytest
from pydantic import ValidationError

from app.schemas.profile import ProfileUpdate


async def test_display_currency_is_normalised_and_validated() -> None:
    assert ProfileUpdate(display_currency="usd").display_currency == "USD"
    with pytest.raises(ValidationError):
        ProfileUpdate(display_currency="XYZ")


async def test_preferred_currency_is_normalised_and_validated() -> None:
    assert ProfileUpdate(preferred_currency="vnd").preferred_currency == "VND"
    with pytest.raises(ValidationError):
        ProfileUpdate(preferred_currency="XYZ")


@pytest.mark.parametrize(("sent", "stored"), [("  Tuan  ", "Tuan"), ("   ", None), (None, None)])
async def test_display_name_is_trimmed_and_blank_means_none(
    sent: str | None, stored: str | None
) -> None:
    assert ProfileUpdate(display_name=sent).display_name == stored


async def test_display_name_is_capped_at_the_column_width() -> None:
    with pytest.raises(ValidationError):
        ProfileUpdate(display_name="x" * 81)
