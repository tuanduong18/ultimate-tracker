"""Helpers shared by the finance service modules."""

import uuid
from collections.abc import Sequence
from typing import Any, Protocol

from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.finance import check_amount_scale
from app.services import exchange_rates
from app.services.finance.errors import (
    InvalidAmountError,
    NotFoundError,
    UnsupportedCurrencyError,
)


class _Positioned(Protocol):
    id: uuid.UUID
    position: int | None


def _rearrange(rows: Sequence[_Positioned], ids: Sequence[uuid.UUID], resource: str) -> None:
    """Put the rows named by ``ids`` in that order, and number the whole list.

    ``rows`` is the user's whole list in its current order. ``ids`` may name
    only some of them: the Budgets tab arranges one month's budgets, and the
    ones it does not show must not move. So the named rows trade places among
    the slots they already hold — the first id takes the first of those slots,
    and so on — and every other row keeps its slot.

    Then every row is numbered from 0, so an arranged list has no nulls left
    and later additions (null, so first) cannot tie with anything.
    """
    by_id = {row.id: row for row in rows}
    if any(row_id not in by_id for row_id in ids):
        # Most likely deleted from another device since the list was loaded.
        raise NotFoundError(resource)
    named = set(ids)
    in_new_order = iter([by_id[row_id] for row_id in ids])
    arranged = [next(in_new_order) if row.id in named else row for row in rows]
    for position, row in enumerate(arranged):
        row.position = position


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
