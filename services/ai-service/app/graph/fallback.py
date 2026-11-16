"""A rule-based plan, used when the model cannot produce a valid one.

Deterministic and simple: pick a split by days per week, fill each day's muscle slots
from the allowed exercises, size the day to the session length.
"""

from app.catalogue import Exercise
from app.graph.draft import DraftDay, DraftExercise, PlanDraft
from app.graph.validate import WARM_UP_SECONDS, estimate_seconds
from app.models import GenerateRequest, Goal, Level, MuscleGroup

# Muscle slots per day type, most important first. Core sits early so short days keep it.
FULL_BODY: list[MuscleGroup] = [
    "quadriceps", "chest", "back", "core", "hamstrings", "shoulders", "glutes",
]  # fmt: skip
UPPER: list[MuscleGroup] = ["chest", "back", "core", "shoulders", "back", "biceps", "triceps"]
LOWER: list[MuscleGroup] = ["quadriceps", "hamstrings", "core", "glutes", "calves", "quadriceps"]
PUSH: list[MuscleGroup] = ["chest", "shoulders", "core", "chest", "triceps", "shoulders"]
PULL: list[MuscleGroup] = ["back", "core", "back", "biceps", "shoulders", "forearms"]
LEGS: list[MuscleGroup] = ["quadriceps", "hamstrings", "core", "glutes", "calves", "quadriceps"]

LEVEL_RANK = {"beginner": 0, "intermediate": 1, "advanced": 2, "expert": 2}

# Sets, lowest reps, highest reps and rest seconds per goal.
TARGETS: dict[Goal, tuple[int, int, int, int]] = {
    "strength": (4, 4, 6, 150),
    "muscle_gain": (3, 8, 12, 90),
    "fat_loss": (3, 10, 15, 60),
    "general_fitness": (3, 8, 12, 75),
    "endurance": (3, 15, 20, 45),
}
CARDIO_SECONDS: dict[Goal, int] = {"fat_loss": 900, "endurance": 1200}


def split_for(days: int) -> list[tuple[str, list[MuscleGroup]]]:
    """Day names and slot lists for a week."""
    if days <= 3:
        # Rotate the slot order so short sessions still cover every area across the week.
        return [
            (f"Full body {'ABC'[i]}", FULL_BODY[2 * i :] + FULL_BODY[: 2 * i]) for i in range(days)
        ]
    if days == 4:
        return [("Upper A", UPPER), ("Lower A", LOWER), ("Upper B", UPPER), ("Lower B", LOWER)]
    cycle = [("Push", PUSH), ("Pull", PULL), ("Legs", LEGS)]
    return [(f"{cycle[i % 3][0]} {'ABC'[i // 3]}", cycle[i % 3][1]) for i in range(days)]


def _pick(
    muscle: MuscleGroup, pool: list[Exercise], used: set[str], rotation: int, level: Level
) -> Exercise | None:
    candidates = [e for e in pool if muscle in e.primaryMuscles and e.id not in used]
    # Prefer exercises at or below the user's level, but never leave a muscle untrained.
    suitable = [e for e in candidates if LEVEL_RANK.get(e.level, 1) <= LEVEL_RANK[level]]
    choices = suitable or candidates
    if not choices:
        return None
    # Compound movements first, then a stable order; rotate so days differ.
    choices.sort(key=lambda e: (e.mechanic != "compound", e.id))
    return choices[rotation % len(choices)]


def _prescribe(e: Exercise, request: GenerateRequest) -> DraftExercise:
    sets, low, high, rest = TARGETS[request.profile.goal]
    if request.profile.level == "beginner":
        sets = min(sets, 3)
    if e.defaultTarget == "time":
        return DraftExercise(
            exercise_id=e.id, sets=sets, target_kind="time", seconds=40, rest_seconds=45
        )
    return DraftExercise(
        exercise_id=e.id,
        sets=sets,
        target_kind="reps",
        min_reps=low,
        max_reps=high,
        rest_seconds=rest,
    )


def _cardio_block(cardio: Exercise, seconds: int) -> DraftExercise:
    return DraftExercise(
        exercise_id=cardio.id, sets=1, target_kind="time", seconds=seconds, rest_seconds=60
    )


def fallback_plan(request: GenerateRequest, allowed: list[Exercise]) -> PlanDraft:
    profile = request.profile
    strength_pool = [e for e in allowed if e.category != "cardio"]
    cardio_pool = [e for e in allowed if e.category == "cardio"]
    cardio_seconds = CARDIO_SECONDS.get(profile.goal, 0)
    budget = profile.sessionMinutes * 60 - WARM_UP_SECONDS

    days = []
    for index, (name, slots) in enumerate(split_for(profile.daysPerWeek)):
        exercises: list[DraftExercise] = []
        used: set[str] = set()
        spent = 0
        cardio: DraftExercise | None = None
        if cardio_pool and cardio_seconds and budget > cardio_seconds + 600:
            cardio = _cardio_block(cardio_pool[index % len(cardio_pool)], cardio_seconds)
            spent += estimate_seconds(cardio) + cardio.rest_seconds

        # Focus muscles first, then the day's slots twice, then anything to fill the time.
        focus = list(request.focusMuscles)
        for muscle in [*focus, *slots, *focus, *slots, *FULL_BODY, *FULL_BODY]:
            picked = _pick(muscle, strength_pool, used, index, profile.level)
            if not picked:
                continue
            prescription = _prescribe(picked, request)
            cost = estimate_seconds(prescription) + prescription.rest_seconds
            if spent + cost > budget and exercises:
                break
            exercises.append(prescription)
            used.add(picked.id)
            spent += cost

        if cardio:
            exercises.append(cardio)
        if not exercises and cardio_pool:
            exercises.append(_cardio_block(cardio_pool[0], max(600, budget - 120)))
        days.append(DraftDay(name=name, exercises=exercises))

    return PlanDraft(
        name=f"{profile.daysPerWeek}-day {profile.goal.replace('_', ' ')} plan",
        days=days,
        notes="Add a little weight or a rep when you hit the top of the rep range on every set.",
    )
