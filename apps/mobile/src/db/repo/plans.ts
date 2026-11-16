import { and, asc, desc, eq, isNull, ne } from 'drizzle-orm';

import type { Goal, MuscleGroup, PlanSource, TargetKind } from '@/domain/types';
import { newId } from '@/lib/id';
import { nowIso } from '@/lib/time';

import { notifyChange } from '../live';
import {
  planDays,
  planExercises,
  plans,
  type PlanDayRow,
  type PlanExerciseRow,
  type PlanRow,
} from '../schema';
import type { Db } from '../types';

export interface PlanDayWithExercises extends PlanDayRow {
  exercises: PlanExerciseRow[];
}

export interface PlanTree {
  plan: PlanRow;
  days: PlanDayWithExercises[];
}

export interface NewPlanInput {
  name: string;
  goal: Goal;
  daysPerWeek: number;
  sessionMinutes: number;
  source?: PlanSource;
  focusMuscles?: MuscleGroup[];
}

/** Create a plan with empty days "Day 1" to "Day N" and make it the active plan. */
export function createPlan(db: Db, input: NewPlanInput): string {
  const now = nowIso();
  const planId = newId();
  db.transaction((tx) => {
    tx.update(plans).set({ isActive: false, updatedAt: now }).where(eq(plans.isActive, true)).run();
    tx.insert(plans)
      .values({
        id: planId,
        name: input.name.trim() || 'My plan',
        source: input.source ?? 'manual',
        goal: input.goal,
        daysPerWeek: input.daysPerWeek,
        sessionMinutes: input.sessionMinutes,
        focusMuscles: input.focusMuscles ?? [],
        isActive: true,
        createdAt: now,
        updatedAt: now,
      })
      .run();
    for (let i = 1; i <= input.daysPerWeek; i++) {
      tx.insert(planDays)
        .values({
          id: newId(),
          planId,
          dayIndex: i,
          name: `Day ${i}`,
          createdAt: now,
          updatedAt: now,
        })
        .run();
    }
  });
  notifyChange();
  return planId;
}

export function getActivePlan(db: Db): PlanRow | undefined {
  return db
    .select()
    .from(plans)
    .where(and(eq(plans.isActive, true), isNull(plans.deletedAt)))
    .get();
}

export function listPlans(db: Db): PlanRow[] {
  return db
    .select()
    .from(plans)
    .where(isNull(plans.deletedAt))
    .orderBy(desc(plans.createdAt))
    .all();
}

export function setActivePlan(db: Db, planId: string): void {
  const now = nowIso();
  db.transaction((tx) => {
    tx.update(plans).set({ isActive: false, updatedAt: now }).where(ne(plans.id, planId)).run();
    tx.update(plans).set({ isActive: true, updatedAt: now }).where(eq(plans.id, planId)).run();
  });
  notifyChange();
}

export function getPlanTree(db: Db, planId: string): PlanTree | undefined {
  const plan = db
    .select()
    .from(plans)
    .where(and(eq(plans.id, planId), isNull(plans.deletedAt)))
    .get();
  if (!plan) return undefined;
  const days = db
    .select()
    .from(planDays)
    .where(and(eq(planDays.planId, planId), isNull(planDays.deletedAt)))
    .orderBy(asc(planDays.dayIndex))
    .all();
  return {
    plan,
    days: days.map((day) => ({ ...day, exercises: listDayExercises(db, day.id) })),
  };
}

export function getPlanDay(db: Db, dayId: string): PlanDayWithExercises | undefined {
  const day = db
    .select()
    .from(planDays)
    .where(and(eq(planDays.id, dayId), isNull(planDays.deletedAt)))
    .get();
  return day ? { ...day, exercises: listDayExercises(db, day.id) } : undefined;
}

export function listDayExercises(db: Db, dayId: string): PlanExerciseRow[] {
  return db
    .select()
    .from(planExercises)
    .where(and(eq(planExercises.planDayId, dayId), isNull(planExercises.deletedAt)))
    .orderBy(asc(planExercises.position))
    .all();
}

export function getPlannedExercise(db: Db, id: string): PlanExerciseRow | undefined {
  return db
    .select()
    .from(planExercises)
    .where(and(eq(planExercises.id, id), isNull(planExercises.deletedAt)))
    .get();
}

export function renamePlan(db: Db, planId: string, name: string): void {
  db.update(plans)
    .set({ name: name.trim() || 'My plan', updatedAt: nowIso() })
    .where(eq(plans.id, planId))
    .run();
  notifyChange();
}

export function renameDay(db: Db, dayId: string, name: string): void {
  db.update(planDays)
    .set({ name: name.trim() || 'Workout', updatedAt: nowIso() })
    .where(eq(planDays.id, dayId))
    .run();
  notifyChange();
}

/** Soft-delete a plan. If it was active, the newest remaining plan becomes active. */
export function deletePlan(db: Db, planId: string): void {
  const now = nowIso();
  db.update(plans)
    .set({ deletedAt: now, isActive: false, updatedAt: now })
    .where(eq(plans.id, planId))
    .run();
  if (!getActivePlan(db)) {
    const next = listPlans(db)[0];
    if (next) setActivePlan(db, next.id);
  }
  notifyChange();
}

/** Starting targets for a newly added exercise, before the user edits them. */
export function defaultTarget(targetKind: TargetKind, isCardio: boolean) {
  if (isCardio) {
    return {
      sets: 1,
      targetKind: 'time' as const,
      minReps: null,
      maxReps: null,
      seconds: 600,
      restSeconds: 60,
    };
  }
  if (targetKind === 'time') {
    return {
      sets: 3,
      targetKind: 'time' as const,
      minReps: null,
      maxReps: null,
      seconds: 30,
      restSeconds: 45,
    };
  }
  return {
    sets: 3,
    targetKind: 'reps' as const,
    minReps: 8,
    maxReps: 12,
    seconds: null,
    restSeconds: 90,
  };
}

export function addPlannedExercise(
  db: Db,
  dayId: string,
  exerciseId: string,
  target: ReturnType<typeof defaultTarget>,
): string {
  const now = nowIso();
  const id = newId();
  const position = listDayExercises(db, dayId).length + 1;
  db.insert(planExercises)
    .values({
      id,
      planDayId: dayId,
      exerciseId,
      position,
      ...target,
      createdAt: now,
      updatedAt: now,
    })
    .run();
  notifyChange();
  return id;
}

export type PlannedExercisePatch = Partial<
  Pick<
    PlanExerciseRow,
    'sets' | 'targetKind' | 'minReps' | 'maxReps' | 'seconds' | 'restSeconds' | 'notes'
  >
>;

export function updatePlannedExercise(db: Db, id: string, patch: PlannedExercisePatch): void {
  db.update(planExercises)
    .set({ ...patch, updatedAt: nowIso() })
    .where(eq(planExercises.id, id))
    .run();
  notifyChange();
}

/** Soft-delete an exercise from its day and close the gap in positions. */
export function removePlannedExercise(db: Db, id: string): void {
  const row = getPlannedExercise(db, id);
  if (!row) return;
  const now = nowIso();
  db.transaction((tx) => {
    tx.update(planExercises)
      .set({ deletedAt: now, updatedAt: now })
      .where(eq(planExercises.id, id))
      .run();
    renumber(tx, row.planDayId, now);
  });
  notifyChange();
}

/** Swap an exercise with its neighbour: direction -1 moves it up, 1 moves it down. */
export function movePlannedExercise(db: Db, id: string, direction: -1 | 1): void {
  const row = getPlannedExercise(db, id);
  if (!row) return;
  const list = listDayExercises(db, row.planDayId);
  const index = list.findIndex((e) => e.id === id);
  const other = list[index + direction];
  if (!other) return;
  const now = nowIso();
  db.transaction((tx) => {
    tx.update(planExercises)
      .set({ position: other.position, updatedAt: now })
      .where(eq(planExercises.id, row.id))
      .run();
    tx.update(planExercises)
      .set({ position: row.position, updatedAt: now })
      .where(eq(planExercises.id, other.id))
      .run();
  });
  notifyChange();
}

function renumber(db: Db, dayId: string, now: string): void {
  listDayExercises(db, dayId).forEach((e, i) => {
    if (e.position !== i + 1) {
      db.update(planExercises)
        .set({ position: i + 1, updatedAt: now })
        .where(eq(planExercises.id, e.id))
        .run();
    }
  });
}
