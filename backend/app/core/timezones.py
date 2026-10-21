"""The user's "today", which is what every date-based rule in the app means."""

from datetime import UTC, date, datetime, tzinfo
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError


def resolve(timezone: str) -> tzinfo:
    """The named zone, or UTC for a name this machine cannot resolve.

    The profile stores the timezone unvalidated, and a wrong-by-hours "today"
    beats a 500.
    """
    try:
        return ZoneInfo(timezone)
    except ZoneInfoNotFoundError, ValueError:
        return UTC


def today_in(timezone: str, now: datetime | None = None) -> date:
    """The current date where the user is. ``now`` must be timezone-aware."""
    return (now or datetime.now(UTC)).astimezone(resolve(timezone)).date()
