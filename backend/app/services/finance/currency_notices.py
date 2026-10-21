"""Currency notices: tell users when a currency they use stops being supported.

Run by the exchange-rate job (see app.tasks) after each refresh, not by any user
request. It works from the table's state rather than from what this run
changed, so a run that delisted a currency and then failed to notify is caught
up by the next one; deliver_once keeps every re-run from repeating a notice.

A notice stays in the inbox until the user moves it to the history or it stops
applying — the user no longer uses the currency, or the provider quotes it
again — when each run moves it there, by the same rule that decides who is
notified. From the history the user deletes it.
"""

import uuid
from collections import defaultdict
from datetime import UTC, date, datetime

from sqlalchemy import or_, select, union
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.exchange_rate import ExchangeRate
from app.models.finance import Budget, Expense, Subscription
from app.models.notification import Notification, NotificationKind
from app.models.profile import Profile
from app.services import notifications


def _utc_day(moment: datetime) -> date:
    # SQLite hands back naive datetimes; every one we write is UTC.
    return (moment if moment.tzinfo else moment.replace(tzinfo=UTC)).astimezone(UTC).date()


def _render(user_id: uuid.UUID, code: str, rate: ExchangeRate, *, in_profile: bool) -> Notification:
    assert rate.delisted_at is not None
    quoted = _utc_day(rate.updated_at)
    body = (
        f"Exchange rates for {code} are no longer published, so new entries can't use it. "
        f"What you've already recorded in {code} is kept, and totals convert it at its last "
        f"rate, from {quoted.day} {quoted:%b %Y}, which will drift from the real one."
    )
    if in_profile:
        body += f" Your profile still uses {code}: pick another currency in your settings."
    return Notification(
        user_id=user_id,
        kind=NotificationKind.CURRENCY_DELISTED,
        title=f"{code} is no longer supported",
        body=body,
        # Keyed to the delisting, so a currency that returns and is dropped
        # again is announced again.
        dedupe_key=f"currency:{code}:delisted:{_utc_day(rate.delisted_at).isoformat()}",
    )


async def notify_delisted_currencies(db: AsyncSession) -> int:
    """Notify everyone who uses a delisted currency, once per delisting, and
    move the notices that no longer apply to the history.

    "Uses" means has an expense, budget or subscription recorded in it, or has
    it as their display or preferred currency. Returns how many notifications
    this run created.
    """
    candidates = await _candidates(db)

    # A notice in the inbox still belongs there exactly when this run would
    # send it again.
    current = {(n.user_id, n.dedupe_key) for n in candidates}
    stale = [
        notice
        for notice in await db.scalars(
            select(Notification).where(
                Notification.kind == NotificationKind.CURRENCY_DELISTED,
                Notification.archived_at.is_(None),
            )
        )
        if (notice.user_id, notice.dedupe_key) not in current
    ]
    if stale:
        now = datetime.now(UTC)
        for notice in stale:
            notice.archived_at = now
            notice.read_at = notice.read_at or now
        await db.commit()

    return await notifications.deliver_once(db, candidates)


async def _candidates(db: AsyncSession) -> list[Notification]:
    """The notice every current user of every delisted currency should have."""
    delisted = {
        rate.currency: rate
        for rate in await db.scalars(
            select(ExchangeRate).where(ExchangeRate.delisted_at.is_not(None))
        )
    }
    if not delisted:
        return []
    codes = list(delisted)

    holders = await db.execute(
        union(
            *(
                select(model.user_id, model.currency).where(model.currency.in_(codes))
                for model in (Expense, Budget, Subscription)
            ),
            select(Profile.id, Profile.display_currency).where(Profile.display_currency.in_(codes)),
            select(Profile.id, Profile.preferred_currency).where(
                Profile.preferred_currency.in_(codes)
            ),
        )
    )
    users: dict[str, set[uuid.UUID]] = defaultdict(set)
    for user_id, code in holders:
        users[code].add(user_id)

    in_profile = {
        (user_id, code)
        for user_id, display, preferred in await db.execute(
            select(Profile.id, Profile.display_currency, Profile.preferred_currency).where(
                or_(Profile.display_currency.in_(codes), Profile.preferred_currency.in_(codes))
            )
        )
        for code in (display, preferred)
    }

    candidates: list[Notification] = []
    for code, user_ids in users.items():
        candidates.extend(
            _render(user_id, code, delisted[code], in_profile=(user_id, code) in in_profile)
            for user_id in sorted(user_ids)
        )
    return candidates
