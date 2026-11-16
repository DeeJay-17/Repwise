"""Google sign-in, token refresh and sign-out."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import Connection

from app.auth.google import InvalidGoogleTokenError, Verifier, get_google_verifier
from app.auth.tokens import InvalidRefreshTokenError, issue_tokens, revoke, rotate_refresh_token
from app.config import Settings, get_settings
from app.db import get_connection
from app.domain.users import get_user, upsert_google_user
from app.models import ErrorResponse, GoogleSignInRequest, RefreshRequest, TokenResponse

router = APIRouter(prefix="/v1/auth", tags=["auth"])

Conn = Annotated[Connection, Depends(get_connection)]
Config = Annotated[Settings, Depends(get_settings)]


@router.post(
    "/google",
    response_model=TokenResponse,
    responses={401: {"model": ErrorResponse}},
    summary="Exchange a Google ID token for Repwise tokens, creating the account if new",
)
def sign_in_with_google(
    body: GoogleSignInRequest,
    conn: Conn,
    settings: Config,
    verify: Annotated[Verifier, Depends(get_google_verifier)],
) -> TokenResponse:
    try:
        identity = verify(body.idToken)
    except InvalidGoogleTokenError:
        raise HTTPException(
            401,
            {"code": "invalid_google_token", "message": "Google sign-in could not be verified."},
        ) from None
    user = upsert_google_user(conn, identity)
    tokens = issue_tokens(conn, user.id, settings)
    return TokenResponse(
        accessToken=tokens.access_token,
        refreshToken=tokens.refresh_token,
        expiresIn=tokens.expires_in,
        user=user,
    )


@router.post(
    "/refresh",
    response_model=TokenResponse,
    responses={401: {"model": ErrorResponse}},
    summary="Spend a refresh token for a new access and refresh token",
)
def refresh(body: RefreshRequest, conn: Conn, settings: Config) -> TokenResponse:
    try:
        user_id, tokens = rotate_refresh_token(conn, body.refreshToken, settings)
    except InvalidRefreshTokenError:
        # Commit the revocation done on reuse before failing the request.
        conn.commit()
        raise HTTPException(
            401, {"code": "invalid_refresh_token", "message": "Please sign in again."}
        ) from None
    user = get_user(conn, user_id)
    if user is None:
        raise HTTPException(
            401, {"code": "invalid_refresh_token", "message": "Please sign in again."}
        )
    return TokenResponse(
        accessToken=tokens.access_token,
        refreshToken=tokens.refresh_token,
        expiresIn=tokens.expires_in,
        user=user,
    )


@router.post("/logout", status_code=204, summary="Revoke a refresh token")
def logout(body: RefreshRequest, conn: Conn) -> Response:
    revoke(conn, body.refreshToken)
    return Response(status_code=204)
