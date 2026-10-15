"""Root pytest configuration: tags every test with its tier.

Fixtures do not live here. Database and app fixtures are in
integration/conftest.py so a unit test cannot reach them by accident; anything
a test imports (ids, builders, fakes) is in the ``support`` package.
"""

from pathlib import Path

import pytest

_TESTS_ROOT = Path(__file__).parent
_TIERS = ("unit", "integration")


def pytest_collection_modifyitems(items: list[pytest.Item]) -> None:
    """Mark each test by its top-level folder, so `-m "not integration"` works."""
    for item in items:
        tier = item.path.relative_to(_TESTS_ROOT).parts[0]
        if tier in _TIERS:
            item.add_marker(tier)
