"""Database access: SQLAlchemy Core tables (schema.py), an engine per URL, and a
per-request connection with a transaction."""

from collections.abc import Iterator
from functools import lru_cache
from typing import Annotated

from fastapi import Depends
from sqlalchemy import Connection, Engine, create_engine, event

from app.config import Settings, get_settings


@lru_cache
def engine_for(url: str) -> Engine:
    engine = create_engine(url, pool_pre_ping=True)
    if url.startswith("sqlite"):

        @event.listens_for(engine, "connect")
        def _sqlite_foreign_keys(dbapi_connection, _record):  # type: ignore[no-untyped-def]
            dbapi_connection.execute("PRAGMA foreign_keys = ON")

    return engine


def get_connection(settings: Annotated[Settings, Depends(get_settings)]) -> Iterator[Connection]:
    """One connection and transaction per request; committed if the handler succeeds."""
    with engine_for(settings.database_url).begin() as connection:
        yield connection
