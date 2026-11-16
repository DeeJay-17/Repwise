"""Request and response models for the HTTP API.

`PlanDocument` mirrors packages/contracts/plan.schema.json; tests/test_contract.py checks
every generated plan against that schema.
"""

from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field

Goal = Literal["fat_loss", "muscle_gain", "strength", "general_fitness", "endurance"]
Level = Literal["beginner", "intermediate", "advanced"]
MuscleGroup = Literal[
    "chest",
    "back",
    "shoulders",
    "biceps",
    "triceps",
    "forearms",
    "core",
    "glutes",
    "quadriceps",
    "hamstrings",
    "calves",
    "full_body",
]
Limitation = Literal["knees", "lower_back", "shoulders", "wrists", "no_jumping"]
Provider = Literal["openai", "google", "anthropic"]


class Profile(BaseModel):
    goal: Goal
    level: Level
    daysPerWeek: Annotated[int, Field(ge=1, le=7)]  # noqa: N815 - JSON field names are camelCase
    sessionMinutes: Annotated[int, Field(ge=10, le=180)]  # noqa: N815
    limitations: list[Limitation] = []
    equipmentIds: list[str] = []  # noqa: N815


class RepTarget(BaseModel):
    model_config = ConfigDict(extra="forbid")
    kind: Literal["reps"] = "reps"
    minReps: Annotated[int, Field(ge=1, le=100)]  # noqa: N815
    maxReps: Annotated[int, Field(ge=1, le=100)]  # noqa: N815


class TimeTarget(BaseModel):
    model_config = ConfigDict(extra="forbid")
    kind: Literal["time"] = "time"
    seconds: Annotated[int, Field(ge=5, le=3600)]


class PlannedExercise(BaseModel):
    model_config = ConfigDict(extra="forbid")
    exerciseId: str  # noqa: N815
    order: Annotated[int, Field(ge=1)]
    sets: Annotated[int, Field(ge=1, le=10)]
    target: Annotated[RepTarget | TimeTarget, Field(discriminator="kind")]
    restSeconds: Annotated[int, Field(ge=0, le=600)]  # noqa: N815
    notes: str | None = None


class PlanDay(BaseModel):
    model_config = ConfigDict(extra="forbid")
    dayIndex: Annotated[int, Field(ge=1, le=7)]  # noqa: N815
    name: Annotated[str, Field(min_length=1, max_length=60)]
    exercises: Annotated[list[PlannedExercise], Field(min_length=1, max_length=15)]


class PlanDocument(BaseModel):
    """A weekly plan in the shared contract format."""

    model_config = ConfigDict(extra="forbid")
    schemaVersion: Literal["1.0"] = "1.0"  # noqa: N815
    id: str
    name: Annotated[str, Field(min_length=1, max_length=80)]
    source: Literal["ai", "fallback", "manual"]
    goal: Goal
    daysPerWeek: Annotated[int, Field(ge=1, le=7)]  # noqa: N815
    sessionMinutes: Annotated[int, Field(ge=10, le=180)]  # noqa: N815
    focusMuscles: list[MuscleGroup]  # noqa: N815
    days: Annotated[list[PlanDay], Field(min_length=1, max_length=7)]
    notes: Annotated[str, Field(max_length=1000)] | None = None
    createdAt: datetime  # noqa: N815


class GenerateRequest(BaseModel):
    """Generate a new plan, or regenerate one when `previousPlan` is given."""

    provider: Provider
    model: Annotated[str, Field(min_length=1, max_length=100)]
    profile: Profile
    focusMuscles: list[MuscleGroup] = []  # noqa: N815
    previousPlan: PlanDocument | None = None  # noqa: N815


class GenerateResponse(BaseModel):
    plan: PlanDocument
    # Things the user should know, e.g. that the rule-based fallback was used.
    warnings: list[str]


class ErrorResponse(BaseModel):
    code: str
    message: str
