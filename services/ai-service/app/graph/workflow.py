"""The plan generation workflow as a LangGraph state machine.

    shortlist -> plan -> validate -+-> finalize
                          ^        |
                          +-repair-+  (up to max_repairs times)
                                   +-> fallback -> finalize

Code decides what is allowed and checks the result; the model only proposes plans.
"""

import logging
import uuid
from collections.abc import Callable
from datetime import UTC, datetime
from typing import Literal, TypedDict

from langchain_core.exceptions import OutputParserException
from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage
from langgraph.graph import END, START, StateGraph
from pydantic import ValidationError

from app.catalogue import Exercise, shortlist
from app.graph.draft import PlanDraft
from app.graph.fallback import fallback_plan
from app.graph.validate import validate_draft
from app.models import (
    GenerateRequest,
    PlanDay,
    PlanDocument,
    PlannedExercise,
    RepTarget,
    TimeTarget,
)
from app.prompts.plan import SYSTEM, repair_prompt, user_prompt

logger = logging.getLogger("ai-service.workflow")

# A planner sends messages to a model and returns its structured draft.
Planner = Callable[[list[BaseMessage]], PlanDraft]


class InvalidOutputError(Exception):
    """The model replied, but not with a usable plan structure."""


class State(TypedDict, total=False):
    request: GenerateRequest
    allowed: list[Exercise]
    messages: list[BaseMessage]
    draft: PlanDraft | None
    errors: list[str]
    attempts: int
    source: Literal["ai", "fallback"]
    warnings: list[str]
    plan: PlanDocument


def build_workflow(planner: Planner, max_repairs: int = 2):  # type: ignore[no-untyped-def]
    """Compile the graph around a planner. Tests pass a fake planner."""

    def shortlist_node(state: State) -> State:
        request = state["request"]
        allowed = shortlist(request.profile.equipmentIds, request.profile.limitations)
        warnings = []
        available = {m for e in allowed for m in e.primaryMuscles}
        missing = [m for m in request.focusMuscles if m not in available]
        if missing:
            warnings.append(
                f"No exercises for {', '.join(missing)} with your equipment, "
                "so they could not be emphasised."
            )
        messages: list[BaseMessage] = [
            SystemMessage(SYSTEM),
            HumanMessage(user_prompt(request, allowed)),
        ]
        return {
            "allowed": allowed,
            "messages": messages,
            "warnings": warnings,
            "attempts": 0,
            "errors": [],
        }

    def call_model(state: State, extra: list[BaseMessage]) -> State:
        messages = [*state["messages"], *extra]
        attempts = state["attempts"] + 1
        try:
            draft = planner(messages)
        except (InvalidOutputError, ValidationError, OutputParserException) as exc:
            logger.info("model output unusable on attempt %s: %s", attempts, type(exc).__name__)
            return {
                "messages": messages,
                "draft": None,
                "attempts": attempts,
                "errors": ["The reply did not match the required plan structure."],
            }
        return {"messages": messages, "draft": draft, "attempts": attempts}

    def plan_node(state: State) -> State:
        return call_model(state, [])

    def validate_node(state: State) -> State:
        draft = state.get("draft")
        if draft is None:
            return {}
        return {"errors": validate_draft(draft, state["request"], state["allowed"])}

    def repair_node(state: State) -> State:
        draft = state.get("draft")
        previous = [AIMessage(draft.model_dump_json())] if draft else []
        return call_model(state, [*previous, HumanMessage(repair_prompt(state["errors"]))])

    def fallback_node(state: State) -> State:
        logger.info("using fallback plan after %s attempts", state["attempts"])
        return {
            "draft": fallback_plan(state["request"], state["allowed"]),
            "source": "fallback",
            "warnings": [
                *state["warnings"],
                "The AI plan did not pass our checks, so a standard plan was built instead. "
                "Try regenerating, or try a different model.",
            ],
        }

    def finalize_node(state: State) -> State:
        draft = state["draft"]
        if draft is None:  # unreachable: validate only routes here with a draft
            raise RuntimeError("finalize reached without a draft")
        return {"plan": to_document(draft, state["request"], state.get("source", "ai"))}

    def after_validate(state: State) -> str:
        if state.get("draft") is not None and not state["errors"]:
            return "finalize"
        return "repair" if state["attempts"] <= max_repairs else "fallback"

    graph = StateGraph(State)
    graph.add_node("shortlist", shortlist_node)
    graph.add_node("plan", plan_node)
    graph.add_node("validate", validate_node)
    graph.add_node("repair", repair_node)
    graph.add_node("fallback", fallback_node)
    graph.add_node("finalize", finalize_node)
    graph.add_edge(START, "shortlist")
    graph.add_edge("shortlist", "plan")
    graph.add_edge("plan", "validate")
    graph.add_conditional_edges("validate", after_validate, ["finalize", "repair", "fallback"])
    graph.add_edge("repair", "validate")
    graph.add_edge("fallback", "finalize")
    graph.add_edge("finalize", END)
    return graph.compile()


def generate_plan(
    request: GenerateRequest, planner: Planner, max_repairs: int = 2
) -> tuple[PlanDocument, list[str]]:
    result = build_workflow(planner, max_repairs).invoke({"request": request})
    return result["plan"], result["warnings"]


def to_document(
    draft: PlanDraft, request: GenerateRequest, source: Literal["ai", "fallback"]
) -> PlanDocument:
    days = []
    for i, day in enumerate(draft.days, start=1):
        exercises = []
        for j, e in enumerate(day.exercises, start=1):
            target: RepTarget | TimeTarget = (
                TimeTarget(seconds=e.seconds or 30)
                if e.target_kind == "time"
                else RepTarget(minReps=e.min_reps or 8, maxReps=e.max_reps or 12)
            )
            notes = e.notes[:200] if e.notes else None
            exercises.append(
                PlannedExercise(
                    exerciseId=e.exercise_id,
                    order=j,
                    sets=e.sets,
                    target=target,
                    restSeconds=e.rest_seconds,
                    notes=notes,
                )
            )
        days.append(PlanDay(dayIndex=i, name=day.name[:60] or f"Day {i}", exercises=exercises))
    return PlanDocument(
        id=str(uuid.uuid4()),
        name=(draft.name or "My plan")[:80],
        source=source,
        goal=request.profile.goal,
        daysPerWeek=request.profile.daysPerWeek,
        sessionMinutes=request.profile.sessionMinutes,
        focusMuscles=request.focusMuscles,
        days=days,
        notes=draft.notes[:1000] if draft.notes else None,
        createdAt=datetime.now(UTC),
    )


def model_planner(chat_model) -> Planner:  # type: ignore[no-untyped-def]
    """Wrap a LangChain chat model so it returns a PlanDraft."""
    structured = chat_model.with_structured_output(PlanDraft)

    def plan(messages: list[BaseMessage]) -> PlanDraft:
        result = structured.invoke(messages)
        if isinstance(result, PlanDraft):
            return result
        if isinstance(result, dict):
            return PlanDraft.model_validate(result)
        raise InvalidOutputError(type(result).__name__)

    return plan
