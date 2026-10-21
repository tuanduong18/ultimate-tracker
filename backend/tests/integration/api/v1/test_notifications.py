"""The notification inbox and history: listing, the user's actions, and ownership."""

import uuid
from collections.abc import AsyncGenerator
from datetime import UTC, date, datetime, timedelta
from typing import Any

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
from tests.support.ids import OTHER_USER_ID, TEST_USER_ID

from app.models.notification import Notification, NotificationKind
from app.models.profile import Profile

URL = "/api/v1/notifications"
REMINDER = NotificationKind.SUBSCRIPTION_RENEWAL
RENEWED = NotificationKind.SUBSCRIPTION_RENEWED


@pytest.fixture
async def db_factory(
    db_factory: async_sessionmaker[AsyncSession],
) -> AsyncGenerator[async_sessionmaker[AsyncSession]]:
    async with db_factory() as session:
        session.add_all([Profile(id=TEST_USER_ID), Profile(id=OTHER_USER_ID)])
        await session.commit()
    yield db_factory


async def notify(
    db_factory: async_sessionmaker[AsyncSession],
    *,
    kind: NotificationKind = REMINDER,
    user_id: uuid.UUID = TEST_USER_ID,
    title: str = "Streaming renews in 2 days",
    age: timedelta = timedelta(0),
    read: bool = False,
    snoozed: bool = False,
    archived: bool = False,
) -> uuid.UUID:
    now = datetime.now(UTC)
    notification_id = uuid.uuid4()
    async with db_factory() as session:
        session.add(
            Notification(
                id=notification_id,
                user_id=user_id,
                kind=kind,
                title=title,
                body="USD 12.99 will be charged on 22 Oct 2026.",
                due_on=date(2026, 10, 22),
                dedupe_key=f"test:{notification_id}",
                alerted_at=now - age,
                read_at=now if read else None,
                snoozed_at=now if snoozed else None,
                archived_at=now if archived else None,
            )
        )
        await session.commit()
    return notification_id


async def titles(client: AsyncClient, **params: Any) -> list[str]:
    return [n["title"] for n in (await client.get(URL, params=params)).json()]


async def patch(client: AsyncClient, notification_id: uuid.UUID, **body: Any) -> Any:
    return await client.patch(f"{URL}/{notification_id}", json=body)


# --- Listing --------------------------------------------------------------------


async def test_the_inbox_lists_mine_newest_first(
    authed_client: AsyncClient, db_factory: async_sessionmaker[AsyncSession]
) -> None:
    await notify(db_factory, title="Older", age=timedelta(days=1))
    await notify(db_factory, title="Newer")
    await notify(db_factory, user_id=OTHER_USER_ID, title="Not mine")

    resp = await authed_client.get(URL)

    assert resp.status_code == 200, resp.text
    assert [n["title"] for n in resp.json()] == ["Newer", "Older"]


async def test_snoozed_and_archived_ones_are_in_the_history(
    authed_client: AsyncClient, db_factory: async_sessionmaker[AsyncSession]
) -> None:
    await notify(db_factory, title="Read, still in the inbox", read=True)
    await notify(db_factory, title="Snoozed", snoozed=True, age=timedelta(hours=1))
    await notify(db_factory, kind=RENEWED, title="Archived", archived=True, age=timedelta(hours=2))

    assert await titles(authed_client) == ["Read, still in the inbox"]
    assert await titles(authed_client, view="history") == ["Snoozed", "Archived"]


async def test_unread_only_hides_read_ones(
    authed_client: AsyncClient, db_factory: async_sessionmaker[AsyncSession]
) -> None:
    await notify(db_factory, title="Read", read=True)
    await notify(db_factory, title="Unread")

    assert await titles(authed_client, unread_only=True) == ["Unread"]


# --- Read -----------------------------------------------------------------------


async def test_mark_read_and_back_to_unread(
    authed_client: AsyncClient, db_factory: async_sessionmaker[AsyncSession]
) -> None:
    notification_id = await notify(db_factory)

    read = await patch(authed_client, notification_id, read=True)
    assert read.status_code == 200, read.text
    assert read.json()["read_at"] is not None

    unread = await patch(authed_client, notification_id, read=False)
    assert unread.json()["read_at"] is None


async def test_marking_read_twice_keeps_the_first_read_time(
    authed_client: AsyncClient, db_factory: async_sessionmaker[AsyncSession]
) -> None:
    notification_id = await notify(db_factory)

    first = (await patch(authed_client, notification_id, read=True)).json()
    second = (await patch(authed_client, notification_id, read=True)).json()

    assert second["read_at"] == first["read_at"]


# --- Snooze ---------------------------------------------------------------------


async def test_snoozing_a_reminder_moves_it_to_the_history(
    authed_client: AsyncClient, db_factory: async_sessionmaker[AsyncSession]
) -> None:
    notification_id = await notify(db_factory)

    resp = await patch(authed_client, notification_id, snoozed=True)

    assert resp.status_code == 200, resp.text
    assert resp.json()["snoozed_at"] is not None
    assert await titles(authed_client) == []
    assert await titles(authed_client, view="history") == ["Streaming renews in 2 days"]


async def test_unsnoozing_brings_it_back_as_new(
    authed_client: AsyncClient, db_factory: async_sessionmaker[AsyncSession]
) -> None:
    notification_id = await notify(db_factory, snoozed=True, read=True)

    resp = await patch(authed_client, notification_id, snoozed=False)

    assert resp.json()["snoozed_at"] is None
    assert resp.json()["read_at"] is None
    assert await titles(authed_client) == ["Streaming renews in 2 days"]


async def test_only_reminders_snooze(
    authed_client: AsyncClient, db_factory: async_sessionmaker[AsyncSession]
) -> None:
    notification_id = await notify(db_factory, kind=RENEWED)

    resp = await patch(authed_client, notification_id, snoozed=True)

    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "WRONG_NOTIFICATION_KIND"


# --- Archive and delete ---------------------------------------------------------


async def test_a_notice_moves_to_the_history(
    authed_client: AsyncClient, db_factory: async_sessionmaker[AsyncSession]
) -> None:
    notification_id = await notify(db_factory, kind=RENEWED, title="Streaming auto-renewed")

    resp = await patch(authed_client, notification_id, archived=True)

    assert resp.status_code == 200, resp.text
    assert resp.json()["archived_at"] is not None
    assert resp.json()["read_at"] is not None
    assert await titles(authed_client, view="history") == ["Streaming auto-renewed"]


async def test_a_notice_can_be_deleted(
    authed_client: AsyncClient, db_factory: async_sessionmaker[AsyncSession]
) -> None:
    notification_id = await notify(db_factory, kind=RENEWED, archived=True)

    resp = await authed_client.delete(f"{URL}/{notification_id}")

    assert resp.status_code == 204
    assert await titles(authed_client, view="history") == []


async def test_reminders_cannot_be_archived_or_deleted(
    authed_client: AsyncClient, db_factory: async_sessionmaker[AsyncSession]
) -> None:
    notification_id = await notify(db_factory)

    archived = await patch(authed_client, notification_id, archived=True)
    deleted = await authed_client.delete(f"{URL}/{notification_id}")

    assert archived.status_code == deleted.status_code == 422
    assert await titles(authed_client) == ["Streaming renews in 2 days"]


@pytest.mark.parametrize("payload", [{}, {"read": True, "snoozed": True}])
async def test_exactly_one_action_per_request(
    authed_client: AsyncClient,
    db_factory: async_sessionmaker[AsyncSession],
    payload: dict[str, Any],
) -> None:
    notification_id = await notify(db_factory)

    resp = await authed_client.patch(f"{URL}/{notification_id}", json=payload)

    assert resp.status_code == 422


# --- Ownership ------------------------------------------------------------------


async def test_someone_elses_notification_is_not_found(
    authed_client: AsyncClient, db_factory: async_sessionmaker[AsyncSession]
) -> None:
    theirs = await notify(db_factory, kind=RENEWED, user_id=OTHER_USER_ID)

    patched = await patch(authed_client, theirs, read=True)
    deleted = await authed_client.delete(f"{URL}/{theirs}")

    assert patched.status_code == deleted.status_code == 404
    assert patched.json()["error"]["code"] == "NOT_FOUND"


async def test_requires_a_token(client: AsyncClient) -> None:
    resp = await client.get(URL)

    assert resp.status_code == 401
