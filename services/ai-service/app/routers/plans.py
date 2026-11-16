"""Plan generation endpoint."""

import logging
from collections.abc import Callable
from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException

from app.config import Settings, get_settings
from app.graph.workflow import Planner, generate_plan, model_planner
from app.models import ErrorResponse, GenerateRequest, GenerateResponse, Provider
from app.providers import ProviderError, classify_provider_error, make_chat_model
from app.ratelimit import rate_limit

logger = logging.getLogger("ai-service.plans")

router = APIRouter(prefix="/v1/plans", tags=["plans"])

PlannerFactory = Callable[[Provider, str, str, float], Planner]


def default_planner_factory(
    provider: Provider, model: str, api_key: str, timeout: float
) -> Planner:
    return model_planner(make_chat_model(provider, model, api_key, timeout))


def get_planner_factory() -> PlannerFactory:
    """Overridden in tests with a fake model."""
    return default_planner_factory


ERRORS: dict[int | str, dict[str, object]] = {
    status: {"model": ErrorResponse} for status in (400, 401, 429, 502, 504)
}


@router.post(
    "/generate",
    response_model=GenerateResponse,
    response_model_exclude_none=True,
    responses=ERRORS,
    dependencies=[Depends(rate_limit)],
    summary="Generate or regenerate a weekly plan with the caller's own model API key",
)
def generate(
    body: GenerateRequest,
    api_key: Annotated[
        str,
        Header(
            alias="X-LLM-API-Key",
            min_length=8,
            description=(
                "The user's own provider API key. Used for this request only; "
                "never stored or logged."
            ),
        ),
    ],
    settings: Annotated[Settings, Depends(get_settings)],
    planner_factory: Annotated[PlannerFactory, Depends(get_planner_factory)],
) -> GenerateResponse:
    planner = planner_factory(body.provider, body.model, api_key, settings.model_timeout_seconds)
    try:
        plan, warnings = generate_plan(body, planner, settings.max_repairs)
    except ProviderError as err:
        raise _http_error(err) from None
    except Exception as exc:
        classified = classify_provider_error(exc)
        # Log only the exception type: provider messages can contain parts of the key.
        logger.warning("provider call failed: %s -> %s", type(exc).__name__, classified.code)
        raise _http_error(classified) from None
    logger.info(
        "plan generated provider=%s source=%s days=%s", body.provider, plan.source, len(plan.days)
    )
    return GenerateResponse(plan=plan, warnings=warnings)


def _http_error(err: ProviderError) -> HTTPException:
    return HTTPException(status_code=err.status, detail={"code": err.code, "message": err.message})
