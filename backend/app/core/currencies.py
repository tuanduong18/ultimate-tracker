"""Currency codes accepted for expenses and budgets.

The list is vendored rather than fetched. Which currencies a user may pick is a
validation rule, and a validation rule must not change because a third-party API
is unreachable — otherwise an expense that saved yesterday fails to save today.
Live rates are a separate, failure-tolerant concern: app.services.exchange_rates.

Snapshot of the codes quoted by open.er-api.com, minus CLF and XDR, which are
units of account rather than money anyone spends.
"""

from typing import Final

DEFAULT_CURRENCY: Final = "USD"

# fmt: off
CURRENCY_CODES: Final[tuple[str, ...]] = (
    "AED", "AFN", "ALL", "AMD", "ANG", "AOA", "ARS", "AUD", "AWG", "AZN",
    "BAM", "BBD", "BDT", "BGN", "BHD", "BIF", "BMD", "BND", "BOB", "BRL",
    "BSD", "BTN", "BWP", "BYN", "BZD", "CAD", "CDF", "CHF", "CLP", "CNH",
    "CNY", "COP", "CRC", "CUP", "CVE", "CZK", "DJF", "DKK", "DOP", "DZD",
    "EGP", "ERN", "ETB", "EUR", "FJD", "FKP", "FOK", "GBP", "GEL", "GGP",
    "GHS", "GIP", "GMD", "GNF", "GTQ", "GYD", "HKD", "HNL", "HRK", "HTG",
    "HUF", "IDR", "ILS", "IMP", "INR", "IQD", "IRR", "ISK", "JEP", "JMD",
    "JOD", "JPY", "KES", "KGS", "KHR", "KID", "KMF", "KRW", "KWD", "KYD",
    "KZT", "LAK", "LBP", "LKR", "LRD", "LSL", "LYD", "MAD", "MDL", "MGA",
    "MKD", "MMK", "MNT", "MOP", "MRU", "MUR", "MVR", "MWK", "MXN", "MYR",
    "MZN", "NAD", "NGN", "NIO", "NOK", "NPR", "NZD", "OMR", "PAB", "PEN",
    "PGK", "PHP", "PKR", "PLN", "PYG", "QAR", "RON", "RSD", "RUB", "RWF",
    "SAR", "SBD", "SCR", "SDG", "SEK", "SGD", "SHP", "SLE", "SLL", "SOS",
    "SRD", "SSP", "STN", "SYP", "SZL", "THB", "TJS", "TMT", "TND", "TOP",
    "TRY", "TTD", "TVD", "TWD", "TZS", "UAH", "UGX", "USD", "UYU", "UZS",
    "VES", "VND", "VUV", "WST", "XAF", "XCD", "XCG", "XOF", "XPF", "YER",
    "ZAR", "ZMW", "ZWG", "ZWL",
)

# ISO 4217 minor units. Only the exceptions are listed — every other code is 2.
_ZERO_DECIMAL: Final[frozenset[str]] = frozenset({
    "BIF", "CLP", "DJF", "GNF", "ISK", "JPY", "KMF", "KRW",
    "PYG", "RWF", "UGX", "VND", "VUV", "XAF", "XOF", "XPF",
})
_THREE_DECIMAL: Final[frozenset[str]] = frozenset({
    "BHD", "IQD", "JOD", "KWD", "LYD", "OMR", "TND",
})
# fmt: on

SUPPORTED_CURRENCIES: Final[frozenset[str]] = frozenset(CURRENCY_CODES)


def minor_units(code: str) -> int:
    """Decimal places a currency is written with — 0 for VND and JPY, 2 for USD."""
    if code in _ZERO_DECIMAL:
        return 0
    if code in _THREE_DECIMAL:
        return 3
    return 2


def normalize_currency(code: str) -> str:
    """Upper-case and validate a currency code.

    Case folding happens here rather than in a database constraint so that "usd"
    and "USD" can never end up as two rows that a SUM silently keeps apart.
    """
    normalized = code.strip().upper()
    if normalized not in SUPPORTED_CURRENCIES:
        raise ValueError(f"unsupported currency: {code!r}")
    return normalized
