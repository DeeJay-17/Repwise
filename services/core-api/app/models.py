"""Request and response models for the HTTP API."""

from typing import Annotated, Any, Literal

from pydantic import BaseModel, Field

# The app's tables that sync. Order matters when applying: parents before children.
Entity = Literal["profile", "plans", "plan_days", "plan_exercises", "workout_sessions", "set_logs"]
ENTITY_ORDER: tuple[Entity, ...] = (
    "profile",
    "plans",
    "plan_days",
    "plan_exercises",
    "workout_sessions",
    "set_logs",
)


class GoogleSignInRequest(BaseModel):
    idToken: Annotated[str, Field(min_length=20)]  # noqa: N815 - JSON field names are camelCase


class RefreshRequest(BaseModel):
    refreshToken: Annotated[str, Field(min_length=20)]  # noqa: N815


class User(BaseModel):
    id: str
    email: str
    name: str | None
    picture: str | None


class TokenResponse(BaseModel):
    accessToken: str  # noqa: N815
    refreshToken: str  # noqa: N815
    # Seconds until the access token expires.
    expiresIn: int  # noqa: N815
    user: User


class Change(BaseModel):
    """One row of one table, as the app stores it."""

    entity: Entity
    id: Annotated[str, Field(min_length=1, max_length=64)]
    # ISO 8601 UTC, e.g. 2026-11-16T10:00:00.000Z. The newest wins a conflict.
    updatedAt: Annotated[str, Field(min_length=20, max_length=32)]  # noqa: N815
    deletedAt: Annotated[str, Field(max_length=32)] | None = None  # noqa: N815
    data: dict[str, Any]


class SyncRequest(BaseModel):
    # The cursor from the previous sync; 0 the first time.
    cursor: Annotated[int, Field(ge=0)] = 0
    changes: Annotated[list[Change], Field(max_length=1000)] = []


class SyncResponse(BaseModel):
    cursor: int
    # Changes made on other devices since `cursor`, oldest first.
    changes: list[Change]
    # True when there are more changes to pull: call again with the new cursor.
    hasMore: bool  # noqa: N815
    # How many pushed changes were newer than the server's copy and were kept.
    accepted: int


class ErrorResponse(BaseModel):
    code: str
    message: str
