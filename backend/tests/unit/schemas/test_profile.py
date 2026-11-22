"""Profile schema validation."""

import uuid
from datetime import UTC, datetime

import pytest
from pydantic import ValidationError

from app.schemas.profile import MAX_CHART_HIDDEN_CATEGORIES, ProfileRead, ProfileUpdate


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


async def test_muted_notifications_accepts_the_three_switchable_categories() -> None:
    sent = ["subscription_reminders", "subscription_renewals", "budget_alerts"]
    assert set(ProfileUpdate(muted_notifications=sent).muted_notifications or []) == set(sent)


@pytest.mark.parametrize("category", ["currency_notices", "budget_alert", "", "BUDGET_ALERTS"])
async def test_muted_notifications_refuses_anything_else(category: str) -> None:
    # Currency notices can't be turned off; the rest are not category ids at all.
    with pytest.raises(ValidationError):
        ProfileUpdate(muted_notifications=[category])


async def test_muted_notifications_is_stored_once_each_in_one_order() -> None:
    sent = ["budget_alerts", "subscription_reminders", "budget_alerts"]
    assert ProfileUpdate(muted_notifications=sent).muted_notifications == [
        "budget_alerts",
        "subscription_reminders",
    ]


async def test_an_empty_list_turns_everything_on() -> None:
    assert ProfileUpdate(muted_notifications=[]).muted_notifications == []


async def test_null_or_absent_muted_notifications_leaves_them_alone() -> None:
    # As for the profile's other fields: the service skips a None.
    assert ProfileUpdate(muted_notifications=None).muted_notifications is None
    assert "muted_notifications" not in ProfileUpdate().model_dump(exclude_unset=True)


async def test_read_carries_the_muted_and_chart_hidden_categories() -> None:
    hidden = uuid.uuid4()
    read = ProfileRead(
        id=uuid.uuid4(),
        display_name=None,
        timezone="UTC",
        display_currency="USD",
        preferred_currency="USD",
        muted_notifications=["subscription_renewals"],
        chart_hidden_categories=[hidden],
        created_at=datetime.now(UTC),
    )
    assert read.muted_notifications == ["subscription_renewals"]
    assert read.chart_hidden_categories == [hidden]


# --- The categories the charts start without --------------------------------------


async def test_chart_hidden_categories_are_stored_once_each_in_one_order() -> None:
    a, b = sorted([uuid.uuid4(), uuid.uuid4()])
    assert ProfileUpdate(chart_hidden_categories=[b, a, b]).chart_hidden_categories == [a, b]


async def test_an_empty_chart_hidden_list_shows_every_category() -> None:
    assert ProfileUpdate(chart_hidden_categories=[]).chart_hidden_categories == []


async def test_null_or_absent_chart_hidden_categories_leaves_them_alone() -> None:
    assert ProfileUpdate(chart_hidden_categories=None).chart_hidden_categories is None
    assert "chart_hidden_categories" not in ProfileUpdate().model_dump(exclude_unset=True)


@pytest.mark.parametrize("sent", [["food"], [""], [1]])
async def test_chart_hidden_categories_must_be_ids(sent: list[object]) -> None:
    with pytest.raises(ValidationError):
        ProfileUpdate.model_validate({"chart_hidden_categories": sent})


async def test_chart_hidden_categories_are_capped() -> None:
    too_many = [uuid.uuid4() for _ in range(MAX_CHART_HIDDEN_CATEGORIES + 1)]
    with pytest.raises(ValidationError):
        ProfileUpdate(chart_hidden_categories=too_many)
