from collections.abc import Iterator

from langchain_core.messages import BaseMessage

from app.catalogue import shortlist
from app.graph.draft import DraftDay, DraftExercise, PlanDraft
from app.graph.fallback import fallback_plan
from app.graph.workflow import InvalidOutputError, generate_plan
from app.models import GenerateRequest, Profile

REQUEST = GenerateRequest(
    provider="openai",
    model="m",
    profile=Profile(goal="general_fitness", level="beginner", daysPerWeek=3, sessionMinutes=30),
)
GOOD = fallback_plan(REQUEST, shortlist([], []))
BAD = PlanDraft(
    name="Bad",
    days=[
        DraftDay(
            name="A",
            exercises=[
                DraftExercise(
                    exercise_id="made_up",
                    sets=3,
                    target_kind="reps",
                    min_reps=8,
                    max_reps=12,
                    rest_seconds=60,
                )
            ],
        )
    ],
)


def scripted(*replies: PlanDraft | Exception) -> tuple[list[list[BaseMessage]], object]:
    """A fake planner that returns the given replies in order and records its calls."""
    calls: list[list[BaseMessage]] = []
    queue: Iterator[PlanDraft | Exception] = iter(replies)

    def planner(messages: list[BaseMessage]) -> PlanDraft:
        calls.append(messages)
        reply = next(queue)
        if isinstance(reply, Exception):
            raise reply
        return reply

    return calls, planner


def test_valid_first_draft_is_used() -> None:
    calls, planner = scripted(GOOD)
    plan, warnings = generate_plan(REQUEST, planner)  # type: ignore[arg-type]
    assert plan.source == "ai" and warnings == [] and len(calls) == 1
    assert "push_up" in calls[0][1].content  # the allowed list is in the prompt


def test_invalid_draft_is_repaired_with_the_errors() -> None:
    calls, planner = scripted(BAD, GOOD)
    plan, _ = generate_plan(REQUEST, planner)  # type: ignore[arg-type]
    assert plan.source == "ai" and len(calls) == 2
    assert "made_up" in str(calls[1][-1].content)
    assert "exactly 3 days" in str(calls[1][-1].content)


def test_unusable_output_counts_as_a_failed_attempt() -> None:
    calls, planner = scripted(InvalidOutputError("text"), GOOD)
    plan, _ = generate_plan(REQUEST, planner)  # type: ignore[arg-type]
    assert plan.source == "ai" and len(calls) == 2


def test_falls_back_after_max_repairs() -> None:
    calls, planner = scripted(BAD, BAD, BAD)
    plan, warnings = generate_plan(REQUEST, planner, max_repairs=2)  # type: ignore[arg-type]
    assert plan.source == "fallback" and len(calls) == 3
    assert any("standard plan" in w for w in warnings)
    assert len(plan.days) == 3


def test_regeneration_prompt_includes_previous_plan_and_focus() -> None:
    first, _ = generate_plan(REQUEST, scripted(GOOD)[1])  # type: ignore[arg-type]
    again = REQUEST.model_copy(update={"previousPlan": first, "focusMuscles": ["glutes"]})
    calls, planner = scripted(fallback_plan(again, shortlist([], [])))
    plan, _ = generate_plan(again, planner)  # type: ignore[arg-type]
    prompt = str(calls[0][1].content)
    assert "regeneration" in prompt and "glutes" in prompt
    assert plan.focusMuscles == ["glutes"]
