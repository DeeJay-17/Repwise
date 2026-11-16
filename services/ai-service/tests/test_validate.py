from app.catalogue import shortlist
from app.graph.draft import DraftDay, DraftExercise, PlanDraft
from app.graph.fallback import fallback_plan
from app.graph.validate import validate_draft
from app.models import GenerateRequest, Profile


def request(**profile: object) -> GenerateRequest:
    base = {"goal": "muscle_gain", "level": "intermediate", "daysPerWeek": 3, "sessionMinutes": 45}
    return GenerateRequest(
        provider="openai", model="m", profile=Profile.model_validate(base | profile)
    )


def reps(exercise_id: str, sets: int = 3) -> DraftExercise:
    return DraftExercise(
        exercise_id=exercise_id,
        sets=sets,
        target_kind="reps",
        min_reps=8,
        max_reps=12,
        rest_seconds=90,
    )


def test_valid_fallback_has_no_errors() -> None:
    req = request()
    allowed = shortlist([], [])
    assert validate_draft(fallback_plan(req, allowed), req, allowed) == []


def test_catches_structural_mistakes() -> None:
    req = request(daysPerWeek=2, sessionMinutes=20)
    allowed = shortlist([], [])
    draft = PlanDraft(
        name="Bad",
        days=[
            DraftDay(
                name="A",
                exercises=[
                    reps("push_up"),
                    reps("push_up"),
                    reps("barbell_curl"),
                    DraftExercise(exercise_id="plank", sets=3, target_kind="time", rest_seconds=30),
                    DraftExercise(
                        exercise_id="crunch", sets=3, target_kind="reps", rest_seconds=30
                    ),
                ],
            )
        ],
    )
    errors = " | ".join(validate_draft(draft, req, allowed))
    assert "exactly 2 days" in errors
    assert "push_up more than once" in errors
    assert "'barbell_curl' is not in the allowed exercise list" in errors
    assert "plank needs seconds" in errors
    assert "crunch needs min_reps and max_reps" in errors


def test_catches_overlong_days_and_missing_areas() -> None:
    req = request(daysPerWeek=1, sessionMinutes=20)
    allowed = shortlist([], [])
    draft = PlanDraft(
        name="Long",
        days=[
            DraftDay(
                name="A",
                exercises=[
                    reps(e, 6)
                    for e in (
                        "push_up",
                        "wide_push_up",
                        "decline_push_up",
                        "close_grip_push_up",
                        "incline_push_up",
                    )
                ],
            )
        ],
    )
    errors = " | ".join(validate_draft(draft, req, allowed))
    assert "must fit in 20" in errors
    assert "no legs exercise" in errors
    assert "no core exercise" in errors


def test_focus_muscles_must_get_extra_volume() -> None:
    req = request()
    req = req.model_copy(update={"focusMuscles": ["calves"]})
    allowed = shortlist(["dumbbells"], [])
    plain = fallback_plan(request(), allowed)  # built without the focus
    errors = validate_draft(plain, req, allowed)
    assert any("Focus muscle 'calves'" in e for e in errors)
    assert validate_draft(fallback_plan(req, allowed), req, allowed) == []
