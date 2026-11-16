import logging
from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from jsonschema import Draft202012Validator
from langchain_core.messages import BaseMessage

from app import ratelimit
from app.catalogue import shortlist
from app.config import Settings, get_settings
from app.graph.draft import PlanDraft
from app.graph.fallback import fallback_plan
from app.main import app
from app.models import GenerateRequest, Profile
from app.routers.plans import get_planner_factory

KEY = "sk-test-secret-key-123456"
BODY = {
    "provider": "anthropic",
    "model": "some-model",
    "profile": {
        "goal": "fat_loss",
        "level": "beginner",
        "daysPerWeek": 3,
        "sessionMinutes": 45,
        "limitations": [],
        "equipmentIds": ["treadmill"],
    },
    "focusMuscles": ["glutes"],
}


class FakeAuthError(Exception):
    status_code = 401


def fake_factory(fail_with: Exception | None = None):  # type: ignore[no-untyped-def]
    seen: list[tuple[str, str, str]] = []

    def factory(provider: str, model: str, api_key: str, timeout: float):  # type: ignore[no-untyped-def]
        seen.append((provider, model, api_key))

        def planner(messages: list[BaseMessage]) -> PlanDraft:
            if fail_with:
                raise fail_with
            request = GenerateRequest.model_validate(BODY)
            return fallback_plan(request, shortlist(["treadmill"], []))

        return planner

    return factory, seen


@pytest.fixture
def client() -> Iterator[TestClient]:
    ratelimit.reset()
    yield TestClient(app)
    app.dependency_overrides.clear()


def test_generates_a_contract_valid_plan(
    client: TestClient, plan_schema_validator: Draft202012Validator
) -> None:
    factory, seen = fake_factory()
    app.dependency_overrides[get_planner_factory] = lambda: factory
    response = client.post("/v1/plans/generate", json=BODY, headers={"X-LLM-API-Key": KEY})
    assert response.status_code == 200, response.text
    plan = response.json()["plan"]
    assert list(plan_schema_validator.iter_errors(plan)) == []
    assert plan["focusMuscles"] == ["glutes"]
    assert seen == [("anthropic", "some-model", KEY)]


def test_requires_the_key_header(client: TestClient) -> None:
    assert client.post("/v1/plans/generate", json=BODY).status_code == 422


def test_provider_auth_failure_is_reported_without_leaking_the_key(
    client: TestClient, caplog: pytest.LogCaptureFixture
) -> None:
    factory, _ = fake_factory(FakeAuthError(f"Incorrect API key provided: {KEY}"))
    app.dependency_overrides[get_planner_factory] = lambda: factory
    with caplog.at_level(logging.DEBUG):
        response = client.post("/v1/plans/generate", json=BODY, headers={"X-LLM-API-Key": KEY})
    assert response.status_code == 401
    assert response.json()["code"] == "provider_auth"
    assert KEY not in response.text
    assert KEY not in caplog.text


def test_rate_limits_per_client(client: TestClient) -> None:
    factory, _ = fake_factory()
    app.dependency_overrides[get_planner_factory] = lambda: factory
    app.dependency_overrides[get_settings] = lambda: Settings(rate_limit_per_minute=2)
    codes = [
        client.post("/v1/plans/generate", json=BODY, headers={"X-LLM-API-Key": KEY}).status_code
        for _ in range(3)
    ]
    assert codes == [200, 200, 429]


def test_rejects_invalid_profiles(client: TestClient) -> None:
    bad = BODY | {"profile": BODY["profile"] | {"daysPerWeek": 9}}  # type: ignore[operator]
    response = client.post("/v1/plans/generate", json=bad, headers={"X-LLM-API-Key": KEY})
    assert response.status_code == 422
    _ = Profile  # imported for type reference
