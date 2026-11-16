"""Two-way sync of the app's local data."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import Connection

from app.auth.tokens import current_user_id
from app.config import Settings, get_settings
from app.db import get_connection
from app.domain.sync import RecordTooLargeError, sync
from app.models import ErrorResponse, SyncRequest, SyncResponse

router = APIRouter(prefix="/v1", tags=["sync"])


@router.post(
    "/sync",
    response_model=SyncResponse,
    responses={401: {"model": ErrorResponse}, 413: {"model": ErrorResponse}},
    summary="Push local changes and pull changes from other devices in one call",
)
def sync_endpoint(
    body: SyncRequest,
    conn: Annotated[Connection, Depends(get_connection)],
    user_id: Annotated[str, Depends(current_user_id)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> SyncResponse:
    try:
        return sync(conn, user_id, body, settings.sync_page_size)
    except RecordTooLargeError as exc:
        raise HTTPException(413, {"code": "record_too_large", "message": str(exc)}) from None
