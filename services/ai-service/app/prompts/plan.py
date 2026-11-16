"""Prompt text for plan generation."""

from app.catalogue import Exercise
from app.models import GenerateRequest

SYSTEM = """You are an experienced strength and conditioning coach writing a weekly training plan.

Rules:
- Use ONLY exercise ids from the allowed list, copied exactly. Never invent exercises.
- Return exactly the requested number of training days.
- Fit each day into the session length, counting sets, reps and rest.
  Assume about 3 seconds per rep.
- Rep ranges by goal: strength 3-6, muscle gain 6-12, fat loss and general fitness 8-15,
  endurance 12-20.
- Use 'time' targets for holds such as planks and for cardio machines.
- Train every major area (chest, back, legs, core) at least once a week when the list allows.
- Beginners: mostly compound, simple exercises and at most 3 sets per exercise.
- Spread muscle groups so the same muscles are not trained hard on consecutive days.
- When focus muscles are given, give them clearly more weekly sets than other muscle groups.
- For fat loss and endurance, add a cardio machine block when one is available.
- Never use the same exercise twice in one day."""


def _exercise_line(e: Exercise) -> str:
    muscles = ", ".join(e.primaryMuscles)
    return f"{e.id} | {e.name} | {muscles} | {e.category} | {e.defaultTarget}"


def user_prompt(request: GenerateRequest, exercises: list[Exercise]) -> str:
    p = request.profile
    lines = [
        f"Goal: {p.goal}",
        f"Level: {p.level}",
        f"Training days per week: {p.daysPerWeek}",
        f"Session length: {p.sessionMinutes} minutes",
        f"Avoid stressing: {', '.join(p.limitations) or 'nothing'}",
        f"Focus muscles: {', '.join(request.focusMuscles) or 'none, keep it balanced'}",
    ]
    if request.previousPlan:
        previous = "; ".join(
            f"{d.name}: {', '.join(x.exerciseId for x in d.exercises)}"
            for d in request.previousPlan.days
        )
        lines += [
            "",
            "This is a regeneration. The user's previous plan was:",
            previous,
            "Write a noticeably different plan that follows the focus muscles above.",
        ]
    lines += [
        "",
        "Allowed exercises (id | name | primary muscles | category | default target):",
        *(_exercise_line(e) for e in exercises),
    ]
    return "\n".join(lines)


def repair_prompt(errors: list[str]) -> str:
    bullet_list = "\n".join(f"- {e}" for e in errors)
    return (
        "Your plan broke these rules:\n"
        f"{bullet_list}\n\n"
        "Return the complete corrected plan. Keep the parts that were fine."
    )
