"""Tables, defined with SQLAlchemy Core. Change them only together with a new Alembic
migration in app/db/migrations/versions."""

from sqlalchemy import (
    JSON,
    BigInteger,
    Column,
    DateTime,
    ForeignKey,
    Index,
    MetaData,
    String,
    Table,
)

metadata = MetaData()

users = Table(
    "users",
    metadata,
    Column("id", String(36), primary_key=True),
    Column("google_sub", String(255), nullable=False, unique=True),
    Column("email", String(320), nullable=False),
    Column("name", String(200)),
    Column("picture", String(1000)),
    Column("created_at", DateTime(timezone=True), nullable=False),
    Column("last_login_at", DateTime(timezone=True), nullable=False),
)

refresh_tokens = Table(
    "refresh_tokens",
    metadata,
    Column("id", String(36), primary_key=True),
    Column("user_id", String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
    # SHA-256 of the token; the token itself is never stored.
    Column("token_hash", String(64), nullable=False, unique=True),
    Column("created_at", DateTime(timezone=True), nullable=False),
    Column("expires_at", DateTime(timezone=True), nullable=False),
    Column("revoked_at", DateTime(timezone=True)),
    Index("refresh_tokens_user_idx", "user_id"),
)

# One counter per user; each accepted sync change takes the next number.
sync_counters = Table(
    "sync_counters",
    metadata,
    Column("user_id", String(36), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
    Column("last_seq", BigInteger, nullable=False),
)

# Every synced row from the app, stored as JSON. The phone owns the schema; the server
# only orders changes and resolves conflicts (newest updatedAt wins).
sync_records = Table(
    "sync_records",
    metadata,
    Column("user_id", String(36), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
    Column("entity", String(40), primary_key=True),
    Column("record_id", String(64), primary_key=True),
    Column("data", JSON, nullable=False),
    # ISO 8601 UTC strings from the device; compared as text, which orders them correctly.
    Column("updated_at", String(32), nullable=False),
    Column("deleted_at", String(32)),
    Column("seq", BigInteger, nullable=False),
    Index("sync_records_user_seq_idx", "user_id", "seq"),
)
