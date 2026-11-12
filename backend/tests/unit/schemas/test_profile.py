"""Profile schema validation."""

import pytest
from pydantic import ValidationError

from app.schemas.profile import ProfileUpdate


async def test_display_currency_is_normalised_and_shape_checked() -> None:
    assert ProfileUpdate(display_currency="usd").display_currency == "USD"
    with pytest.raises(ValidationError):
        ProfileUpdate(display_currency="US")


async def test_preferred_currency_is_normalised_and_shape_checked() -> None:
    assert ProfileUpdate(preferred_currency="vnd").preferred_currency == "VND"
    with pytest.raises(ValidationError):
        ProfileUpdate(preferred_currency="XDR")


@pytest.mark.parametrize(("sent", "stored"), [("  Tuan  ", "Tuan"), ("   ", None), (None, None)])
async def test_display_name_is_trimmed_and_blank_means_none(
    sent: str | None, stored: str | None
) -> None:
    assert ProfileUpdate(display_name=sent).display_name == stored


async def test_display_name_is_capped_at_the_column_width() -> None:
    with pytest.raises(ValidationError):
        ProfileUpdate(display_name="x" * 81)


@pytest.mark.parametrize(
    "zone",
    [
        "Asia/Singapore",
        # The column's default, which every new profile starts with.
        "UTC",
        # The longest name in the IANA database: the length cap must not cut a real one.
        "America/Argentina/ComodRivadavia",
        # An old alias a browser or phone may still report; it is in the database too.
        "Asia/Saigon",
    ],
)
async def test_timezone_accepts_a_known_iana_name(zone: str) -> None:
    assert ProfileUpdate(timezone=zone).timezone == zone


async def test_timezone_is_trimmed_before_it_is_checked() -> None:
    assert ProfileUpdate(timezone="  Asia/Singapore ").timezone == "Asia/Singapore"


@pytest.mark.parametrize(
    "zone",
    [
        "Mars/Base",
        "Asia/Singapor",
        # Names are case-sensitive, as on the Linux server.
        "asia/singapore",
        # The column is NOT NULL, so blank cannot mean "clear it" the way a blank name does.
        "",
        "   ",
        "../../etc/passwd",
        "Asia/Singapore\x00",
        # Long enough that ZoneInfo raised OSError on Windows, which stopped every
        # scheduled job's run for every user. This is the value the check exists for.
        "A" * 300,
    ],
)
async def test_timezone_refuses_anything_that_is_not_a_known_zone(zone: str) -> None:
    with pytest.raises(ValidationError):
        ProfileUpdate(timezone=zone)


async def test_a_null_timezone_means_not_sent() -> None:
    """Null leaves the stored timezone alone, as for the currencies."""
    assert ProfileUpdate(timezone=None).timezone is None
