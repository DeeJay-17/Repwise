"""The signed-in user's account."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import Connection

from app.auth.tokens import current_user_id
from app.db import get_connection
from app.domain.users import delete_user, get_user
from app.models import ErrorResponse, User

router = APIRouter(prefix="/v1/me", tags=["account"])

Conn = Annotated[Connection, Depends(get_connection)]
UserId = Annotated[str, Depends(current_user_id)]


@router.get("", response_model=User, responses={401: {"model": ErrorResponse}})
def me(conn: Conn, user_id: UserId) -> User:
    user = get_user(conn, user_id)
    if user is None:
        raise HTTPException(401, {"code": "unauthenticated", "message": "Sign in first."})
    return user


@router.delete(
    "",
    status_code=204,
    responses={401: {"model": ErrorResponse}},
    summary="Delete the account and all synced data",
)
def delete_me(conn: Conn, user_id: UserId) -> Response:
    delete_user(conn, user_id)
    return Response(status_code=204)
