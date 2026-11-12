"""The user's "today", which is what every date-based rule in the app means."""

from datetime import UTC, date, datetime, tzinfo
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError


def resolve(timezone: str) -> tzinfo:
    """The named zone, or UTC for a name this machine cannot resolve.

    A profile's timezone is checked against the IANA names when it is saved,
    but rows saved before that check may hold anything, and every scheduled
    job reads them; a wrong-by-hours "today" beats a failed run. OSError is
    what Windows raises for a name too long to be a file path.
    """
    try:
        return ZoneInfo(timezone)
    except ZoneInfoNotFoundError, ValueError, OSError:
        return UTC


def today_in(timezone: str, now: datetime | None = None) -> date:
    """The current date where the user is. ``now`` must be timezone-aware."""
    return (now or datetime.now(UTC)).astimezone(resolve(timezone)).date()
