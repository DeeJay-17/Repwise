import json
from pathlib import Path
from typing import Any

import pytest
from jsonschema import Draft202012Validator, FormatChecker

from app.models import GenerateRequest

REPO = Path(__file__).resolve().parents[3]
PROFILES = Path(__file__).resolve().parents[1] / "evals" / "profiles.json"


@pytest.fixture(scope="session")
def plan_schema_validator() -> Draft202012Validator:
    schema = json.loads((REPO / "packages" / "contracts" / "plan.schema.json").read_text())
    return Draft202012Validator(schema, format_checker=FormatChecker())


def eval_profiles() -> list[dict[str, Any]]:
    return list(json.loads(PROFILES.read_text())["profiles"])


def request_for(item: dict[str, Any]) -> GenerateRequest:
    return GenerateRequest(
        provider="openai",
        model="test-model",
        profile=item["profile"],
        focusMuscles=item["focusMuscles"],
    )
