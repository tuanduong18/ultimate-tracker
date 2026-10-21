"""Results of the background jobs, as returned by their trigger endpoints."""

from pydantic import BaseModel


class ExchangeRateRefreshRead(BaseModel):
    # How many currencies the upstream quoted this run.
    currencies: int
    # Listing changes this run made; a re-run reports both empty.
    delisted: list[str]
    relisted: list[str]
    # Notices created for users of delisted currencies.
    notified: int


class SubscriptionJobRead(BaseModel):
    # Charges recorded as expenses this run.
    renewed: int
    # Reminder changes this run made; a second run in the same day reports 0s.
    reminders_created: int
    reminders_updated: int
    reminders_removed: int
