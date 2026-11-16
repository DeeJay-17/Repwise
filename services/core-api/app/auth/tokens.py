"""Access tokens (short-lived JWTs) and refresh tokens (long-lived, single use, rotated).

A refresh token that is used twice means it was copied; every token of that user is then
revoked and they must sign in again.
"""

import hashlib
import secrets
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Annotated

import jwt
from fastapi import Depends, Header, HTTPException
from sqlalchemy import Connection, insert, select, update

from app.config import Settings, get_settings
from app.db.schema import refresh_tokens

ALGORITHM = "HS256"


@dataclass(frozen=True)
class TokenPair:
    access_token: str
    refresh_token: str
    expires_in: int


def _hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def issue_tokens(conn: Connection, user_id: str, settings: Settings) -> TokenPair:
    now = datetime.now(UTC)
    expires_in = settings.access_token_minutes * 60
    access = jwt.encode(
        {"sub": user_id, "typ": "access", "iat": now, "exp": now + timedelta(seconds=expires_in)},
        settings.jwt_secret,
        algorithm=ALGORITHM,
    )
    refresh = secrets.token_urlsafe(32)
    conn.execute(
        insert(refresh_tokens).values(
            id=str(uuid.uuid4()),
            user_id=user_id,
            token_hash=_hash(refresh),
            created_at=now,
            expires_at=now + timedelta(days=settings.refresh_token_days),
        )
    )
    return TokenPair(access, refresh, expires_in)


class InvalidRefreshTokenError(Exception):
    pass


def rotate_refresh_token(conn: Connection, token: str, settings: Settings) -> tuple[str, TokenPair]:
    """Spend a refresh token and issue a new pair. Returns (user_id, tokens)."""
    now = datetime.now(UTC)
    row = conn.execute(
        select(refresh_tokens).where(refresh_tokens.c.token_hash == _hash(token))
    ).first()
    if row is None:
        raise InvalidRefreshTokenError("unknown token")
    if row.revoked_at is not None:
        # Reuse of a spent token: assume it leaked and end every session of this user.
        revoke_all(conn, row.user_id)
        raise InvalidRefreshTokenError("token already used")
    if _aware(row.expires_at) <= now:
        raise InvalidRefreshTokenError("token expired")
    conn.execute(update(refresh_tokens).where(refresh_tokens.c.id == row.id).values(revoked_at=now))
    return row.user_id, issue_tokens(conn, row.user_id, settings)


def revoke(conn: Connection, token: str) -> None:
    conn.execute(
        update(refresh_tokens)
        .where(refresh_tokens.c.token_hash == _hash(token), refresh_tokens.c.revoked_at.is_(None))
        .values(revoked_at=datetime.now(UTC))
    )


def revoke_all(conn: Connection, user_id: str) -> None:
    conn.execute(
        update(refresh_tokens)
        .where(refresh_tokens.c.user_id == user_id, refresh_tokens.c.revoked_at.is_(None))
        .values(revoked_at=datetime.now(UTC))
    )


def _aware(value: datetime) -> datetime:
    """SQLite returns naive datetimes; treat them as UTC."""
    return value if value.tzinfo else value.replace(tzinfo=UTC)


def current_user_id(
    authorization: Annotated[str | None, Header()] = None,
    settings: Settings = Depends(get_settings),  # noqa: B008 - FastAPI dependency
) -> str:
    """The signed-in user's id from a `Authorization: Bearer <access token>` header."""
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(401, {"code": "unauthenticated", "message": "Sign in first."})
    try:
        claims = jwt.decode(authorization[7:], settings.jwt_secret, algorithms=[ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            401, {"code": "token_expired", "message": "Session expired. Refresh and retry."}
        ) from None
    except jwt.InvalidTokenError:
        raise HTTPException(401, {"code": "unauthenticated", "message": "Sign in first."}) from None
    if claims.get("typ") != "access":
        raise HTTPException(401, {"code": "unauthenticated", "message": "Sign in first."})
    return str(claims["sub"])
