"""Read-side aggregates: the range summary, the breakdowns, and budget progress.

Every figure is converted into a single currency here, so a missing exchange
rate surfaces as RateUnavailableError instead of a silently wrong total.
"""

import uuid
from collections import defaultdict
from collections.abc import Sequence
from datetime import date, timedelta
from decimal import Decimal
from typing import Any

from sqlalchemy import ColumnElement, false, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.finance import Budget, Expense
from app.services import exchange_rates
from app.services.finance.budgets import budget_window, list_budgets
from app.services.finance.categories import list_categories
from app.services.finance.errors import (
    InvalidDateRangeError,
    RateUnavailableError,
    UnknownGranularityError,
)


def _total_in(
    rows: Sequence[tuple[Decimal, str]], target: str, rates: dict[str, Decimal]
) -> Decimal:
    """Sum (amount, currency) pairs into one target-currency total.

    Converting per row rather than per currency group keeps this honest about
    rounding: each conversion is quantized to the target's minor units, so the
    total cannot claim precision the currency does not have.
    """
    total = Decimal(0)
    for amount, currency in rows:
        total += exchange_rates.convert(amount, currency, target, rates)
    return total


async def summarize(
    db: AsyncSession,
    user_id: uuid.UUID,
    *,
    start_date: date,
    end_date: date,
    display_currency: str,
) -> dict[str, Any]:
    """Spent, budgeted and remaining over a date range, in one currency."""
    if end_date < start_date:
        raise InvalidDateRangeError()

    spent_rows = (
        await db.execute(
            select(Expense.amount, Expense.currency).where(
                Expense.user_id == user_id,
                Expense.spent_on >= start_date,
                Expense.spent_on <= end_date,
            )
        )
    ).all()

    # A budget counts when its range overlaps the window at all, which is the
    # same rule the UI uses to call a budget "active" for a period.
    budget_rows = (
        await db.execute(
            select(Budget.amount, Budget.currency).where(
                Budget.user_id == user_id,
                Budget.starts_on <= end_date,
                # An ongoing monthly budget has no end, so it overlaps everything after its start.
                or_(Budget.ends_on.is_(None), Budget.ends_on >= start_date),
            )
        )
    ).all()

    rates = await exchange_rates.get_rates(db)
    try:
        spent = _total_in([(a, c) for a, c in spent_rows], display_currency, rates)
        budgeted = _total_in([(a, c) for a, c in budget_rows], display_currency, rates)
    except ValueError as exc:
        # No rate for one of the currencies involved — our problem, not the
        # caller's, and temporary. Answering 0 would be a lie about their money.
        raise RateUnavailableError(str(exc)) from exc

    return {
        "currency": display_currency,
        "starts_on": start_date,
        "ends_on": end_date,
        "spent": spent,
        "budgeted": budgeted,
        "remaining": budgeted - spent,
    }


def category_clause(
    category_ids: Sequence[uuid.UUID] | None,
    include_uncategorized: bool,
) -> ColumnElement[bool] | None:
    """Restrict expenses to a chosen set of categories, or None for no restriction.

    Four cases, and the one worth spelling out is the third: a caller that sends
    no list is asking for every category, including ones created after it last
    looked. Only the uncategorized bucket can be switched off on its own, which
    is what makes it possible to hide the spend left behind by a deleted
    category without naming every category that still exists.

    An empty list with the bucket off selects nothing, and says so, rather than
    quietly falling back to everything — a chart of all spending is a bad answer
    to "show me none of it".
    """
    if category_ids is None:
        return None if include_uncategorized else Expense.category_id.is_not(None)

    clauses: list[ColumnElement[bool]] = []
    if category_ids:
        clauses.append(Expense.category_id.in_(category_ids))
    if include_uncategorized:
        clauses.append(Expense.category_id.is_(None))
    if not clauses:
        return false()
    return or_(*clauses)


# The bucket expenses land in once their category is deleted. The colour is the
# one the expense list already falls back to for a null category, so a slice and
# a row for the same spend do not disagree about what colour "no category" is.
UNCATEGORIZED_NAME = "Uncategorised"
UNCATEGORIZED_COLOUR = "#e5e7eb"


async def summarize_by_category(
    db: AsyncSession,
    user_id: uuid.UUID,
    *,
    start_date: date,
    end_date: date,
    display_currency: str,
    category_ids: Sequence[uuid.UUID] | None = None,
    include_uncategorized: bool = True,
) -> dict[str, Any]:
    """Spend per category over a range, converted into one currency.

    Categories with nothing spent against them are omitted rather than returned
    as zeros: a pie of mostly-empty slices says less than one showing only the
    few that moved. Expenses whose category was deleted are gathered into a
    single uncategorized bucket rather than dropped, so these slices still add
    up to the ``spent`` figure /finance/summary reports for the same range.
    """
    if end_date < start_date:
        raise InvalidDateRangeError()

    chosen = category_clause(category_ids, include_uncategorized)
    stmt = select(Expense.amount, Expense.currency, Expense.category_id).where(
        Expense.user_id == user_id,
        Expense.spent_on >= start_date,
        Expense.spent_on <= end_date,
    )
    if chosen is not None:
        stmt = stmt.where(chosen)
    rows = (await db.execute(stmt)).all()

    grouped: dict[uuid.UUID | None, list[tuple[Decimal, str]]] = defaultdict(list)
    for amount, currency, category_id in rows:
        grouped[category_id].append((amount, currency))

    known = {category.id: category for category in await list_categories(db, user_id)}
    rates = await exchange_rates.get_rates(db)

    buckets: list[dict[str, Any]] = []
    try:
        for category_id, spends in grouped.items():
            category = known.get(category_id) if category_id is not None else None
            buckets.append(
                {
                    "category_id": category.id if category is not None else None,
                    "name": category.name if category is not None else UNCATEGORIZED_NAME,
                    "colour": category.colour if category is not None else UNCATEGORIZED_COLOUR,
                    "spent": _total_in(spends, display_currency, rates),
                }
            )
    except ValueError as exc:
        raise RateUnavailableError(str(exc)) from exc

    # Biggest slice first; name breaks ties so equal totals do not reshuffle
    # between requests and make the chart colours look unstable.
    buckets.sort(key=lambda bucket: (-bucket["spent"], bucket["name"]))

    return {
        "currency": display_currency,
        "starts_on": start_date,
        "ends_on": end_date,
        "categories": buckets,
    }


def day_buckets(start_date: date, end_date: date) -> list[tuple[date, date]]:
    """One bucket per day, each starting and ending on itself."""
    span = (end_date - start_date).days
    return [
        (start_date + timedelta(days=offset), start_date + timedelta(days=offset))
        for offset in range(span + 1)
    ]


def week_buckets(start_date: date, end_date: date) -> list[tuple[date, date]]:
    """Monday-anchored calendar weeks covering a range, clipped to its ends.

    Clipped rather than whole so the bars over one month cover only days in that
    month and still total what the month summary says. That leaves the first and
    last bar short, which is why both ends of each bucket are returned: a two-day
    bar labelled with its two days reads as a short week rather than a quiet one.
    """
    buckets: list[tuple[date, date]] = []
    cursor = start_date
    while cursor <= end_date:
        monday = cursor - timedelta(days=cursor.weekday())
        sunday = monday + timedelta(days=6)
        buckets.append((max(monday, start_date), min(sunday, end_date)))
        cursor = sunday + timedelta(days=1)
    return buckets


BUCKETERS = {"day": day_buckets, "week": week_buckets}


async def summarize_by_period(
    db: AsyncSession,
    user_id: uuid.UUID,
    *,
    start_date: date,
    end_date: date,
    granularity: str,
    display_currency: str,
    category_ids: Sequence[uuid.UUID] | None = None,
    include_uncategorized: bool = True,
) -> dict[str, Any]:
    """Spend per day or per week over a range, converted into one currency.

    Two granularities rather than one because the caller picks the range now: a
    week of daily bars and a quarter of weekly ones are both readable, and a
    quarter of daily ones is 90 bars nobody can read.

    Empty buckets come back as zero, unlike the category breakdown. A missing
    bar in a time series reads as "no data" and a flat one as "spent nothing",
    and only the second is true.
    """
    if end_date < start_date:
        raise InvalidDateRangeError()
    bucketer = BUCKETERS.get(granularity)
    if bucketer is None:
        raise UnknownGranularityError(granularity)

    chosen = category_clause(category_ids, include_uncategorized)
    stmt = select(Expense.amount, Expense.currency, Expense.spent_on).where(
        Expense.user_id == user_id,
        Expense.spent_on >= start_date,
        Expense.spent_on <= end_date,
    )
    if chosen is not None:
        stmt = stmt.where(chosen)
    rows = (await db.execute(stmt)).all()
    rates = await exchange_rates.get_rates(db)

    buckets: list[dict[str, Any]] = []
    try:
        for bucket_start, bucket_end in bucketer(start_date, end_date):
            spends = [
                (amount, currency)
                for amount, currency, spent_on in rows
                if bucket_start <= spent_on <= bucket_end
            ]
            buckets.append(
                {
                    "starts_on": bucket_start,
                    "ends_on": bucket_end,
                    "spent": _total_in(spends, display_currency, rates),
                }
            )
    except ValueError as exc:
        raise RateUnavailableError(str(exc)) from exc

    return {
        "currency": display_currency,
        "starts_on": start_date,
        "ends_on": end_date,
        "granularity": granularity,
        "buckets": buckets,
    }


async def budget_progress(
    db: AsyncSession, user_id: uuid.UUID, *, month: date
) -> list[dict[str, Any]]:
    """The budgets that apply to ``month``, each with what has been spent against it.

    Which days count depends on the budget's period — see budget_window. A
    monthly budget is measured over the chosen month alone, so it starts from
    zero every month without anything being written when the month turns. A
    custom budget is measured over its whole range, and appears in every month
    that range touches. Budgets with nothing to say about the month are left out.

    Each budget is measured in the currency it was written in, not the profile
    display currency. The bar compares spend against *this* budget cap, and
    converting both into some third currency would let the percentage drift as
    rates move without anyone having spent anything.

    Only expenses in the covered categories and inside the window count.
    Uncategorized spend counts towards no budget at all — which is what deleting
    a category silently does to these figures, and worth knowing when a bar
    drops for no apparent reason.
    """
    windowed = [
        (budget, window)
        for budget in await list_budgets(db, user_id)
        if (window := budget_window(budget, month)) is not None
    ]
    if not windowed:
        return []

    # One query across the union of every window rather than one per budget;
    # filtering the rows afterwards is cheap next to a round trip each, and the
    # budgets on one page are few.
    earliest = min(start for _, (start, _end) in windowed)
    latest = max(end for _, (_start, end) in windowed)
    rows = (
        await db.execute(
            select(Expense.amount, Expense.currency, Expense.category_id, Expense.spent_on).where(
                Expense.user_id == user_id,
                Expense.category_id.is_not(None),
                Expense.spent_on >= earliest,
                Expense.spent_on <= latest,
            )
        )
    ).all()
    rates = await exchange_rates.get_rates(db)

    progress: list[dict[str, Any]] = []
    for budget, (window_start, window_end) in windowed:
        covered = {category.id for category in budget.categories}
        spends = [
            (amount, currency)
            for amount, currency, category_id, spent_on in rows
            if category_id in covered and window_start <= spent_on <= window_end
        ]
        try:
            spent = _total_in(spends, budget.currency, rates)
        except ValueError as exc:
            raise RateUnavailableError(str(exc)) from exc
        progress.append(
            {
                "id": budget.id,
                "name": budget.name,
                "currency": budget.currency,
                "amount": budget.amount,
                "spent": spent,
                # Negative is the overspend, and the bar should say so rather
                # than clamp — the same rule as SummaryRead.remaining.
                "remaining": budget.amount - spent,
                "period": budget.period,
                "starts_on": budget.starts_on,
                "ends_on": budget.ends_on,
                "window_starts_on": window_start,
                "window_ends_on": window_end,
                "categories": budget.categories,
                "created_at": budget.created_at,
            }
        )
    return progress
