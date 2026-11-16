"""Creating and finding users."""

import uuid
from datetime import UTC, datetime

from sqlalchemy import Connection, delete, insert, select, update

from app.auth.google import GoogleIdentity
from app.db.schema import refresh_tokens, sync_counters, sync_records, users
from app.models import User


def upsert_google_user(conn: Connection, identity: GoogleIdentity) -> User:
    """Find the user for this Google account, creating them on first sign-in."""
    now = datetime.now(UTC)
    row = conn.execute(select(users).where(users.c.google_sub == identity.sub)).first()
    profile = {"email": identity.email, "name": identity.name, "picture": identity.picture}
    if row is None:
        user_id = str(uuid.uuid4())
        conn.execute(
            insert(users).values(
                id=user_id, google_sub=identity.sub, created_at=now, last_login_at=now, **profile
            )
        )
    else:
        user_id = row.id
        conn.execute(
            update(users).where(users.c.id == user_id).values(last_login_at=now, **profile)
        )
    return User(id=user_id, **profile)


def get_user(conn: Connection, user_id: str) -> User | None:
    row = conn.execute(select(users).where(users.c.id == user_id)).first()
    if row is None:
        return None
    return User(id=row.id, email=row.email, name=row.name, picture=row.picture)


def delete_user(conn: Connection, user_id: str) -> None:
    """Remove the account and everything synced to it."""
    for table in (sync_records, sync_counters, refresh_tokens):
        conn.execute(delete(table).where(table.c.user_id == user_id))
    conn.execute(delete(users).where(users.c.id == user_id))
