"""Results of the background jobs, as returned by their trigger endpoints."""

from pydantic import BaseModel


class ExchangeRateRefreshRead(BaseModel):
    # How many currencies the upstream quoted this run.
    currencies: int
    # Listing changes this run made; a re-run reports both empty.
    delisted: list[str]
    relisted: list[str]
