"""Test database and client.

Uses a fresh SQLite file per test session, built by running the real Alembic migrations.
Set TEST_DATABASE_URL to run the same tests against Postgres (CI does).
"""

import os
from collections.abc import Iterator
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.auth.google import GoogleIdentity, InvalidGoogleTokenError, get_google_verifier
from app.config import Settings, get_settings
from app.db import engine_for
from app.main import app

ROOT = Path(__file__).resolve().parents[1]
TABLES = ("sync_records", "sync_counters", "refresh_tokens", "users")


@pytest.fixture(scope="session")
def database_url(tmp_path_factory: pytest.TempPathFactory) -> str:
    url = (
        os.environ.get("TEST_DATABASE_URL") or f"sqlite:///{tmp_path_factory.mktemp('db')}/test.db"
    )
    cfg = Config(str(ROOT / "alembic.ini"))
    cfg.set_main_option("script_location", str(ROOT / "app" / "db" / "migrations"))
    cfg.set_main_option("sqlalchemy.url", url)
    command.downgrade(cfg, "base")
    command.upgrade(cfg, "head")
    return url


@pytest.fixture
def settings(database_url: str) -> Settings:
    return Settings(
        database_url=database_url,
        jwt_secret="test-secret-that-is-long-enough-for-hs256",  # noqa: S106
        google_client_ids=["test-client"],
        sync_page_size=500,
    )


def fake_verify(token: str) -> GoogleIdentity:
    """Accepts tokens shaped 'google:<sub>:<email>' padded to the minimum length."""
    if not token.startswith("google:"):
        raise InvalidGoogleTokenError("bad token")
    _, sub, email = token.rstrip(".").split(":")
    return GoogleIdentity(sub=sub, email=email, name=email.split("@")[0], picture=None)


def google_token(sub: str, email: str) -> str:
    return f"google:{sub}:{email}".ljust(24, ".")


@pytest.fixture
def client(settings: Settings) -> Iterator[TestClient]:
    with engine_for(settings.database_url).begin() as conn:
        for table in TABLES:
            conn.execute(text(f"DELETE FROM {table}"))  # noqa: S608 - fixed table names
    app.dependency_overrides[get_settings] = lambda: settings
    app.dependency_overrides[get_google_verifier] = lambda: fake_verify
    yield TestClient(app)
    app.dependency_overrides.clear()


def sign_in(client: TestClient, sub: str = "g-1", email: str = "deejay@example.com") -> dict:  # type: ignore[type-arg]
    response = client.post("/v1/auth/google", json={"idToken": google_token(sub, email)})
    assert response.status_code == 200, response.text
    return dict(response.json())


def auth(tokens: dict) -> dict[str, str]:  # type: ignore[type-arg]
    return {"Authorization": f"Bearer {tokens['accessToken']}"}
