"""The structure the model must return. Kept small and flat so every provider's
structured-output mode handles it reliably."""

from typing import Annotated, Literal

from pydantic import BaseModel, Field


class DraftExercise(BaseModel):
    exercise_id: str = Field(description="An id copied exactly from the allowed exercise list.")
    sets: Annotated[int, Field(ge=1, le=10)]
    target_kind: Literal["reps", "time"] = Field(
        description="'reps' for a rep range, 'time' for holds and cardio."
    )
    min_reps: int | None = Field(None, description="Lowest reps per set; only for 'reps'.")
    max_reps: int | None = Field(None, description="Highest reps per set; only for 'reps'.")
    seconds: int | None = Field(None, description="Seconds per set; only for 'time'.")
    rest_seconds: Annotated[int, Field(ge=0, le=600)]
    notes: str | None = Field(
        None, description="Optional short coaching cue, under 100 characters."
    )


class DraftDay(BaseModel):
    name: str = Field(description="Short day name such as 'Upper body' or 'Full body A'.")
    exercises: list[DraftExercise]


class PlanDraft(BaseModel):
    name: str = Field(description="Short plan name, under 40 characters.")
    days: list[DraftDay]
    notes: str | None = Field(None, description="One or two sentences on how to progress.")
