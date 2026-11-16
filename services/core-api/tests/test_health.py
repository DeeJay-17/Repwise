from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_returns_ok() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "core-api"}


def test_request_id_is_echoed() -> None:
    response = client.get("/health", headers={"X-Request-ID": "abc123"})
    assert response.headers["X-Request-ID"] == "abc123"


def test_request_id_is_generated_when_missing() -> None:
    response = client.get("/health")
    assert len(response.headers["X-Request-ID"]) == 32
