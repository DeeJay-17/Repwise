from typing import Any

import pytest
from jsonschema import Draft202012Validator

from app.catalogue import shortlist
from app.graph.fallback import fallback_plan
from app.graph.validate import validate_draft
from app.graph.workflow import to_document

from .conftest import eval_profiles, request_for


@pytest.mark.parametrize("item", eval_profiles(), ids=lambda i: i["name"])
def test_fallback_plan_is_valid_for_every_profile(
    item: dict[str, Any], plan_schema_validator: Draft202012Validator
) -> None:
    request = request_for(item)
    allowed = shortlist(request.profile.equipmentIds, request.profile.limitations)
    draft = fallback_plan(request, allowed)

    assert validate_draft(draft, request, allowed) == []
    doc = to_document(draft, request, "fallback")
    errors = list(plan_schema_validator.iter_errors(doc.model_dump(mode="json", exclude_none=True)))
    assert errors == []
