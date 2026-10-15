"""Pure helpers in the finance router."""


def test_unresolvable_timezone_falls_back_to_utc() -> None:
    from datetime import UTC, datetime

    from app.api.v1.finance import _today_in

    assert _today_in("Not/AZone") == datetime.now(UTC).date()
    assert _today_in("") == datetime.now(UTC).date()
