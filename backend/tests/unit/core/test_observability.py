"""Logging format, as the ENVIRONMENT setting decides it."""

import json
from collections.abc import Iterator
from typing import Any

import pytest
import structlog

from app.core.config import Settings
from app.core.observability import configure_logging


def settings(**overrides: Any) -> Settings:
    # Explicit, so a developer's backend/.env cannot change what is tested.
    fields: dict[str, Any] = {"environment": "development"}
    fields.update(overrides)
    return Settings(**fields)


@pytest.fixture(autouse=True)
def restore_structlog() -> Iterator[None]:
    """Each test configures structlog globally; leave it as the app set it."""
    yield
    structlog.reset_defaults()
    configure_logging(settings())


def test_deployments_log_one_json_object_per_line(capsys: pytest.CaptureFixture[str]) -> None:
    configure_logging(settings(environment="production"))

    structlog.get_logger("test").warning("exchange_rates.stale", age_hours=50)

    record = json.loads(capsys.readouterr().out)
    assert record["event"] == "exchange_rates.stale"
    assert record["age_hours"] == 50
    assert record["level"] == "warning"
    assert record["timestamp"].endswith("Z")


def test_local_runs_log_readable_text(capsys: pytest.CaptureFixture[str]) -> None:
    configure_logging(settings(environment="development"))

    structlog.get_logger("test").warning("exchange_rates.stale", age_hours=50)

    out = capsys.readouterr().out
    assert "exchange_rates.stale" in out
    with pytest.raises(json.JSONDecodeError):
        json.loads(out)


def test_debug_lines_are_dropped(capsys: pytest.CaptureFixture[str]) -> None:
    configure_logging(settings(environment="production"))

    structlog.get_logger("test").debug("noisy")

    assert capsys.readouterr().out == ""


def test_exceptions_arrive_as_a_traceback_field(capsys: pytest.CaptureFixture[str]) -> None:
    configure_logging(settings(environment="production"))

    try:
        raise RuntimeError("boom")
    except RuntimeError:
        structlog.get_logger("test").exception("job.failed")

    record = json.loads(capsys.readouterr().out)
    assert record["event"] == "job.failed"
    assert "RuntimeError: boom" in record["exception"]
