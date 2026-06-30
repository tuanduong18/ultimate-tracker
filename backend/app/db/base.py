"""Declarative base for all ORM models.

Alembic imports ``Base.metadata`` (and the ``app.models`` package) to discover
the schema for autogenerate.
"""
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass
