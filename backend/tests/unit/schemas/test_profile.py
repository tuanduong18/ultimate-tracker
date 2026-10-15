"""Profile schema validation."""

import pytest
from pydantic import ValidationError

from app.schemas.profile import ProfileUpdate


async def test_display_currency_is_normalised_and_validated() -> None:
    assert ProfileUpdate(display_currency="usd").display_currency == "USD"
    with pytest.raises(ValidationError):
        ProfileUpdate(display_currency="XYZ")
