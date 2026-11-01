"""Arranging a list: the named rows trade the slots they hold, the rest stay put."""

import uuid
from dataclasses import dataclass, field

import pytest

from app.services.finance._common import _rearrange
from app.services.finance.errors import NotFoundError


@dataclass
class Row:
    name: str
    position: int | None = None
    id: uuid.UUID = field(default_factory=uuid.uuid4)


def _sorted(rows: list[Row]) -> list[str]:
    return [row.name for row in sorted(rows, key=lambda row: row.position or 0)]


def test_the_whole_list_takes_the_new_order() -> None:
    a, b, c = Row("a"), Row("b"), Row("c")

    _rearrange([a, b, c], [c.id, a.id, b.id], "Budget")

    assert (c.position, a.position, b.position) == (0, 1, 2)


def test_rows_left_out_keep_their_slots() -> None:
    # The Budgets tab shows one month: b and d. Swapping them must not move
    # a, c or e, which belong to other months.
    a, b, c, d, e = (Row(name) for name in "abcde")

    _rearrange([a, b, c, d, e], [d.id, b.id], "Budget")

    assert _sorted([a, b, c, d, e]) == ["a", "d", "c", "b", "e"]


def test_every_row_is_numbered_so_none_stay_null() -> None:
    rows = [Row("a"), Row("b"), Row("c")]

    _rearrange(rows, [rows[1].id], "Category")

    assert [row.position for row in rows] == [0, 1, 2]


def test_an_id_not_in_the_list_is_not_found() -> None:
    rows = [Row("a"), Row("b")]

    with pytest.raises(NotFoundError):
        _rearrange(rows, [rows[1].id, uuid.uuid4()], "Budget")
    # Checked before anything is written.
    assert [row.position for row in rows] == [None, None]
