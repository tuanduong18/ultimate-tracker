"""Exchange rates — one row per currency, kept current by the daily refresh job.

The table is also the list of supported currencies: a currency is supported
while the provider quotes it. The scheduled job (app.tasks) is the only writer
and the only caller of the upstream API; requests just read this table.
"""

from datetime import datetime
from decimal import Decimal

from sqlalchemy import CheckConstraint, DateTime, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class ExchangeRate(Base):
    __tablename__ = "exchange_rates"

    currency: Mapped[str] = mapped_column(String(3), primary_key=True)
    # Units of `currency` per 1 USD: EUR ~0.88, VND ~26000. Six decimal places
    # is plenty for display totals; twelve integer digits covers the weakest
    # currencies.
    rate_per_usd: Mapped[Decimal] = mapped_column(Numeric(18, 6), nullable=False)
    # When the provider last quoted this rate. Every currency in a refresh
    # shares it, so the newest one says how fresh the table is.
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    # Set when a refresh no longer finds this currency upstream; cleared if it
    # comes back. A delisted row keeps its last rate, so entries already
    # recorded in it still convert, but new entries may not use it.
    delisted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    __table_args__ = (CheckConstraint("rate_per_usd > 0", name="ck_exchange_rates_positive"),)
