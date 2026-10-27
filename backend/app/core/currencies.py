"""Currency code rules that do not depend on any provider.

Which currencies the app supports is *not* decided here: it is whatever the
exchange-rate provider still quotes, as recorded in the exchange_rates table by
the refresh job (see app.services.exchange_rates). A currency the provider stops
quoting stays in the table with its last rate and is marked delisted, so what was
recorded in it keeps converting while new entries move elsewhere.

What stays here is fixed by ISO 4217 rather than by a provider: the shape of a
code, how many decimals each currency is written with, and which quoted codes
are units of account rather than money.
"""

import re
from decimal import Decimal
from typing import Final

DEFAULT_CURRENCY: Final = "USD"

_CODE: Final = re.compile(r"[A-Z]{3}")

# fmt: off
# Quoted by rate providers but not money anyone spends: the IMF's special
# drawing right and Chile's inflation-indexed accounting unit.
UNITS_OF_ACCOUNT: Final[frozenset[str]] = frozenset({"CLF", "XDR"})

# ISO 4217 minor units. Only the exceptions are listed — every other code is 2.
_ZERO_DECIMAL: Final[frozenset[str]] = frozenset({
    "BIF", "CLP", "DJF", "GNF", "ISK", "JPY", "KMF", "KRW",
    "PYG", "RWF", "UGX", "VND", "VUV", "XAF", "XOF", "XPF",
})
_THREE_DECIMAL: Final[frozenset[str]] = frozenset({
    "BHD", "IQD", "JOD", "KWD", "LYD", "OMR", "TND",
})
# fmt: on


def minor_units(code: str) -> int:
    """Decimal places a currency is written with — 0 for VND and JPY, 2 for USD."""
    if code in _ZERO_DECIMAL:
        return 0
    if code in _THREE_DECIMAL:
        return 3
    return 2


def format_money(amount: Decimal, code: str) -> str:
    """ "USD 12.99", "VND 260,000": an amount in its currency's own minor units.

    The code rather than a symbol, for text the server writes (notifications):
    "$" is several currencies, and the browser that would pick a locale's
    symbol is not the one writing it.
    """
    return f"{code} {amount:,.{minor_units(code)}f}"


def is_currency_code(code: str) -> bool:
    """Three upper-case letters, and money rather than a unit of account."""
    return _CODE.fullmatch(code) is not None and code not in UNITS_OF_ACCOUNT


def normalize_currency(code: str) -> str:
    """Upper-case a currency code and check its shape.

    Case folding happens here rather than in a database constraint so that "usd"
    and "USD" can never end up as two rows that a SUM silently keeps apart.
    Whether the code is *supported* needs the rates table, so the service layer
    checks that (exchange_rates.require_supported).
    """
    normalized = code.strip().upper()
    if not is_currency_code(normalized):
        raise ValueError(f"not a currency code: {code!r}")
    return normalized
