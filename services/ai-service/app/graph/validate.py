"""Checks a model's draft plan with plain code. Every message is phrased so it can be
sent back to the model as an instruction to fix."""

from collections import Counter

from app.catalogue import Exercise
from app.graph.draft import DraftExercise, PlanDraft
from app.models import GenerateRequest, MuscleGroup

MAJOR_AREAS: dict[str, set[MuscleGroup]] = {
    "chest": {"chest"},
    "back": {"back"},
    "legs": {"quadriceps", "hamstrings", "glutes"},
    "core": {"core"},
}
WARM_UP_SECONDS = 300
SECONDS_PER_REP = 3


def estimate_seconds(e: DraftExercise) -> int:
    """Rough time for one exercise: work plus rest between sets."""
    reps_work = (e.max_reps or 10) * SECONDS_PER_REP
    work = (e.seconds or 0) if e.target_kind == "time" else reps_work
    return e.sets * work + max(e.sets - 1, 0) * e.rest_seconds


def weekly_sets(draft: PlanDraft, catalogue: dict[str, Exercise]) -> Counter[MuscleGroup]:
    """Sets per primary muscle group across the week."""
    counts: Counter[MuscleGroup] = Counter()
    for day in draft.days:
        for e in day.exercises:
            ex = catalogue.get(e.exercise_id)
            if ex and ex.category != "cardio":
                for m in ex.primaryMuscles:
                    counts[m] += e.sets
    return counts


def validate_draft(
    draft: PlanDraft, request: GenerateRequest, allowed: list[Exercise]
) -> list[str]:
    errors: list[str] = []
    profile = request.profile
    catalogue = {e.id: e for e in allowed}

    if len(draft.days) != profile.daysPerWeek:
        errors.append(
            f"The plan must have exactly {profile.daysPerWeek} days, not {len(draft.days)}."
        )

    budget = profile.sessionMinutes * 60
    for i, day in enumerate(draft.days, start=1):
        label = f"Day {i} ({day.name})"
        if not day.exercises:
            errors.append(f"{label} has no exercises.")
            continue
        if len(day.exercises) > 12:
            errors.append(f"{label} has {len(day.exercises)} exercises; use at most 12.")
        ids = [e.exercise_id for e in day.exercises]
        for dup in {x for x in ids if ids.count(x) > 1}:
            errors.append(f"{label} uses {dup} more than once.")
        for e in day.exercises:
            errors.extend(_check_exercise(label, e, catalogue))
        if profile.level == "beginner":
            heavy = [e.exercise_id for e in day.exercises if e.sets > 4]
            if heavy:
                errors.append(f"{label}: beginners should do at most 4 sets of {', '.join(heavy)}.")
        total = WARM_UP_SECONDS + sum(estimate_seconds(e) for e in day.exercises)
        if total > budget * 1.35:
            errors.append(
                f"{label} takes about {total // 60} minutes; "
                f"it must fit in {profile.sessionMinutes}."
            )
        elif total < budget * 0.5:
            errors.append(
                f"{label} only fills about {total // 60} of {profile.sessionMinutes} minutes; "
                "add work."
            )

    errors.extend(_check_balance(draft, request, allowed, catalogue))
    return errors


def _check_exercise(label: str, e: DraftExercise, catalogue: dict[str, Exercise]) -> list[str]:
    if e.exercise_id not in catalogue:
        return [f"{label}: '{e.exercise_id}' is not in the allowed exercise list."]
    errors = []
    if e.target_kind == "reps":
        if e.min_reps is None or e.max_reps is None:
            errors.append(f"{label}: {e.exercise_id} needs min_reps and max_reps.")
        elif not 1 <= e.min_reps <= e.max_reps <= 50:
            errors.append(f"{label}: {e.exercise_id} needs 1 <= min_reps <= max_reps <= 50.")
    elif e.seconds is None or not 5 <= e.seconds <= 3600:
        errors.append(f"{label}: {e.exercise_id} needs seconds between 5 and 3600.")
    if e.rest_seconds > 300:
        errors.append(f"{label}: {e.exercise_id} rest must be 300 seconds or less.")
    return errors


def _check_balance(
    draft: PlanDraft,
    request: GenerateRequest,
    allowed: list[Exercise],
    catalogue: dict[str, Exercise],
) -> list[str]:
    errors = []
    sets = weekly_sets(draft, catalogue)
    available = {m for e in allowed if e.category != "cardio" for m in e.primaryMuscles}

    if request.profile.goal != "endurance":
        for area, muscles in MAJOR_AREAS.items():
            if muscles & available and not any(sets[m] for m in muscles):
                errors.append(f"The week has no {area} exercise; add one.")

    trained = [n for n in sets.values() if n > 0]
    average = sum(trained) / len(trained) if trained else 0
    for m in request.focusMuscles:
        if m in available and sets[m] < average:
            errors.append(
                f"Focus muscle '{m}' gets {sets[m]} weekly sets, below the average of "
                f"{average:.0f}; give it more."
            )
    return errors
