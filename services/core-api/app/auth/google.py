"""Verifying Google ID tokens sent by the app after native Google sign-in."""

from collections.abc import Callable
from dataclasses import dataclass
from typing import Annotated

from fastapi import Depends
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token

from app.config import Settings, get_settings

GOOGLE_ISSUERS = {"accounts.google.com", "https://accounts.google.com"}


@dataclass(frozen=True)
class GoogleIdentity:
    sub: str
    email: str
    name: str | None
    picture: str | None


class InvalidGoogleTokenError(Exception):
    pass


Verifier = Callable[[str], GoogleIdentity]


def make_verifier(client_ids: list[str]) -> Verifier:
    request = google_requests.Request()

    def verify(token: str) -> GoogleIdentity:
        if not client_ids:
            raise InvalidGoogleTokenError("Google sign-in is not configured on the server")
        try:
            claims = id_token.verify_oauth2_token(  # type: ignore[no-untyped-call]
                token, request, audience=client_ids
            )
        except ValueError as exc:  # bad signature, expired, wrong audience
            raise InvalidGoogleTokenError("invalid Google ID token") from exc
        if claims.get("iss") not in GOOGLE_ISSUERS or not claims.get("email_verified"):
            raise InvalidGoogleTokenError("unverified Google account")
        return GoogleIdentity(
            sub=str(claims["sub"]),
            email=str(claims["email"]),
            name=claims.get("name"),
            picture=claims.get("picture"),
        )

    return verify


def get_google_verifier(settings: Annotated[Settings, Depends(get_settings)]) -> Verifier:
    """Overridden in tests with a fake that needs no network."""
    return make_verifier(settings.google_client_ids)
