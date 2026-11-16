from datetime import UTC, datetime, timedelta

import jwt
from fastapi.testclient import TestClient

from app.config import Settings

from .conftest import auth, google_token, sign_in


def test_first_sign_in_creates_the_account_and_later_ones_reuse_it(client: TestClient) -> None:
    first = sign_in(client)
    again = sign_in(client)
    assert first["user"]["id"] == again["user"]["id"]
    assert first["user"]["email"] == "deejay@example.com"
    assert client.get("/v1/me", headers=auth(first)).json()["id"] == first["user"]["id"]


def test_rejects_invalid_google_tokens(client: TestClient) -> None:
    response = client.post("/v1/auth/google", json={"idToken": "not-a-google-token-at-all"})
    assert response.status_code == 401
    assert response.json()["code"] == "invalid_google_token"


def test_protected_routes_need_a_valid_access_token(client: TestClient, settings: Settings) -> None:
    assert client.get("/v1/me").status_code == 401
    assert client.get("/v1/me", headers={"Authorization": "Bearer nonsense"}).status_code == 401
    expired = jwt.encode(
        {"sub": "x", "typ": "access", "exp": datetime.now(UTC) - timedelta(minutes=1)},
        settings.jwt_secret,
        algorithm="HS256",
    )
    response = client.get("/v1/me", headers={"Authorization": f"Bearer {expired}"})
    assert response.status_code == 401
    assert response.json()["code"] == "token_expired"


def test_refresh_rotates_and_detects_reuse(client: TestClient) -> None:
    tokens = sign_in(client)
    rotated = client.post("/v1/auth/refresh", json={"refreshToken": tokens["refreshToken"]})
    assert rotated.status_code == 200
    new = rotated.json()
    assert new["refreshToken"] != tokens["refreshToken"]
    assert client.get("/v1/me", headers=auth(new)).status_code == 200

    # Using the old token again looks like theft: it fails and ends every session.
    reuse = client.post("/v1/auth/refresh", json={"refreshToken": tokens["refreshToken"]})
    assert reuse.status_code == 401
    after = client.post("/v1/auth/refresh", json={"refreshToken": new["refreshToken"]})
    assert after.status_code == 401


def test_logout_revokes_the_refresh_token(client: TestClient) -> None:
    tokens = sign_in(client)
    assert (
        client.post("/v1/auth/logout", json={"refreshToken": tokens["refreshToken"]}).status_code
        == 204
    )
    response = client.post("/v1/auth/refresh", json={"refreshToken": tokens["refreshToken"]})
    assert response.status_code == 401


def test_delete_account(client: TestClient) -> None:
    tokens = sign_in(client)
    assert client.delete("/v1/me", headers=auth(tokens)).status_code == 204
    assert client.get("/v1/me", headers=auth(tokens)).status_code == 401
    fresh = client.post(
        "/v1/auth/google", json={"idToken": google_token("g-1", "deejay@example.com")}
    )
    assert fresh.json()["user"]["id"] != tokens["user"]["id"]
