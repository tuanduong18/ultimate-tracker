"""Notification categories: what a person turns off, and which kinds each one covers.

The ids are written out as strings on purpose. They are stored on profiles
(``muted_notifications``) and reused as the Android app's channel ids, so a
rename is a data migration and a phone-side change, never a refactor.
"""

import pytest

from app.models.notification import (
    BUDGET_ALERT_KINDS,
    CATEGORY_OF,
    MUTABLE_CATEGORIES,
    REMINDER_KINDS,
    NotificationCategory,
    NotificationKind,
)

# docs/features/platform.md § Notification categories, row by row.
SPEC = {
    "subscription_renewal": "subscription_reminders",
    "trial_ending": "subscription_reminders",
    "subscription_renewed": "subscription_renewals",
    "budget_warning": "budget_alerts",
    "budget_exceeded": "budget_alerts",
    "currency_delisted": "currency_notices",
}


async def test_every_kind_has_a_category() -> None:
    # Fails the moment a kind is added without its line in CATEGORY_OF.
    assert set(CATEGORY_OF) == set(NotificationKind)


async def test_every_category_covers_at_least_one_kind() -> None:
    assert set(CATEGORY_OF.values()) == set(NotificationCategory)


async def test_category_ids_are_the_specs() -> None:
    assert {category.value for category in NotificationCategory} == set(SPEC.values())


@pytest.mark.parametrize(("kind", "category"), sorted(SPEC.items()))
async def test_each_kind_is_in_its_specified_category(kind: str, category: str) -> None:
    assert CATEGORY_OF[NotificationKind(kind)] is NotificationCategory(category)


async def test_currency_notices_are_the_one_category_that_cannot_be_turned_off() -> None:
    # A delisted currency leaves totals unconvertible until the person acts.
    assert MUTABLE_CATEGORIES == set(NotificationCategory) - {
        NotificationCategory("currency_notices")
    }


async def test_reminders_are_one_switch() -> None:
    assert {CATEGORY_OF[kind] for kind in REMINDER_KINDS} == {
        NotificationCategory("subscription_reminders")
    }


async def test_budget_alerts_are_one_switch() -> None:
    assert {CATEGORY_OF[kind] for kind in BUDGET_ALERT_KINDS} == {
        NotificationCategory("budget_alerts")
    }
