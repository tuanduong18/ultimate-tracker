"""Helpers shared by the finance service modules."""

from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.finance import check_amount_scale
from app.services import exchange_rates
from app.services.finance.errors import InvalidAmountError, UnsupportedCurrencyError


def _applied_changes(payload: Any, nullable_fields: frozenset[str]) -> dict[str, Any]:
    """Fields the caller actually sent, minus nulls aimed at non-nullable columns.

    ``exclude_unset`` keeps "not sent" distinct from "sent as null"; the second
    filter stops an explicit ``"amount": null`` from reaching a NOT NULL column
    as a 500 while still letting ``"category_id": null`` mean "uncategorize".
    """
    return {
        field: value
        for field, value in payload.model_dump(exclude_unset=True).items()
        if value is not None or field in nullable_fields
    }


def _check_scale(amount: Any, currency: Any) -> None:
    try:
        check_amount_scale(amount, currency)
    except ValueError as exc:
        raise InvalidAmountError(str(exc)) from exc


async def _check_currency(
    db: AsyncSession, currency: str | None, current: str | None = None
) -> None:
    """Reject a currency new data may not use. ``None`` (not sent) and the
    already-stored ``current`` pass, so a row in a since-delisted currency can
    still be edited as long as its currency is left alone."""
    if currency is None:
        return
    try:
        await exchange_rates.require_supported(db, currency, current=current)
    except exchange_rates.UnsupportedCurrencyError as exc:
        raise UnsupportedCurrencyError(str(exc)) from exc
