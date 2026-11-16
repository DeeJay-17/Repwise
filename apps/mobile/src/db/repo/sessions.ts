import { and, asc, desc, eq, isNotNull, isNull, ne } from 'drizzle-orm';

import { newId } from '@/lib/id';
import { nowIso } from '@/lib/time';

import { notifyChange } from '../live';
import {
  planDays,
  setLogs,
  workoutSessions,
  type SetLogRow,
  type WorkoutSessionRow,
} from '../schema';
import type { Db } from '../types';

import { getPlanDay } from './plans';

export interface SessionExercise {
  exerciseId: string;
  position: number;
  sets: SetLogRow[];
}

export interface SessionDetail {
  session: WorkoutSessionRow;
  exercises: SessionExercise[];
}

export interface SessionSummary extends WorkoutSessionRow {
  completedSets: number;
  /** Sum of reps x weight over completed sets, in kg. */
  volumeKg: number;
}

/**
 * The plan day to train next: the day after the one most recently finished, wrapping
 * around to Day 1. With no finished workouts yet, Day 1.
 */
export function nextPlanDay(db: Db, planId: string) {
  const days = db
    .select()
    .from(planDays)
    .where(and(eq(planDays.planId, planId), isNull(planDays.deletedAt)))
    .orderBy(asc(planDays.dayIndex))
    .all();
  if (days.length === 0) return undefined;
  const last = db
    .select({ planDayId: workoutSessions.planDayId })
    .from(workoutSessions)
    .where(
      and(
        eq(workoutSessions.planId, planId),
        isNotNull(workoutSessions.finishedAt),
        isNull(workoutSessions.deletedAt),
      ),
    )
    .orderBy(desc(workoutSessions.finishedAt))
    .get();
  const lastIndex = days.findIndex((d) => d.id === last?.planDayId);
  return days[(lastIndex + 1) % days.length];
}

export function getInProgressSession(db: Db): WorkoutSessionRow | undefined {
  return db
    .select()
    .from(workoutSessions)
    .where(and(isNull(workoutSessions.finishedAt), isNull(workoutSessions.deletedAt)))
    .orderBy(desc(workoutSessions.startedAt))
    .get();
}

/**
 * Start a workout from a plan day, copying each planned exercise's targets into set rows.
 * Only one workout runs at a time: if one is already in progress, its id is returned.
 */
export function startSession(db: Db, planDayId: string, now = nowIso()): string {
  const running = getInProgressSession(db);
  if (running) return running.id;
  const day = getPlanDay(db, planDayId);
  if (!day) throw new Error(`Plan day ${planDayId} not found`);

  const sessionId = newId();
  db.transaction((tx) => {
    tx.insert(workoutSessions)
      .values({
        id: sessionId,
        planId: day.planId,
        planDayId: day.id,
        name: day.name,
        startedAt: now,
        createdAt: now,
        updatedAt: now,
      })
      .run();
    for (const pe of day.exercises) {
      for (let n = 1; n <= pe.sets; n++) {
        tx.insert(setLogs)
          .values({
            id: newId(),
            sessionId,
            exerciseId: pe.exerciseId,
            exercisePosition: pe.position,
            setNumber: n,
            targetKind: pe.targetKind,
            targetMinReps: pe.minReps,
            targetMaxReps: pe.maxReps,
            targetSeconds: pe.seconds,
            completed: false,
            createdAt: now,
            updatedAt: now,
          })
          .run();
      }
    }
  });
  notifyChange();
  return sessionId;
}

export function getSessionDetail(db: Db, sessionId: string): SessionDetail | undefined {
  const session = db
    .select()
    .from(workoutSessions)
    .where(and(eq(workoutSessions.id, sessionId), isNull(workoutSessions.deletedAt)))
    .get();
  if (!session) return undefined;
  const rows = db
    .select()
    .from(setLogs)
    .where(and(eq(setLogs.sessionId, sessionId), isNull(setLogs.deletedAt)))
    .orderBy(asc(setLogs.exercisePosition), asc(setLogs.setNumber))
    .all();
  const exercises: SessionExercise[] = [];
  for (const row of rows) {
    const current = exercises.at(-1);
    if (current && current.position === row.exercisePosition) current.sets.push(row);
    else
      exercises.push({ exerciseId: row.exerciseId, position: row.exercisePosition, sets: [row] });
  }
  return { session, exercises };
}

export type SetPatch = Partial<Pick<SetLogRow, 'reps' | 'weightKg' | 'seconds' | 'completed'>>;

export function updateSet(db: Db, setId: string, patch: SetPatch): void {
  db.update(setLogs)
    .set({ ...patch, updatedAt: nowIso() })
    .where(eq(setLogs.id, setId))
    .run();
  notifyChange();
}

/** Add one more set to an exercise in a workout, copying the targets of its last set. */
export function addSet(db: Db, sessionId: string, exercisePosition: number): string | undefined {
  const last = db
    .select()
    .from(setLogs)
    .where(
      and(
        eq(setLogs.sessionId, sessionId),
        eq(setLogs.exercisePosition, exercisePosition),
        isNull(setLogs.deletedAt),
      ),
    )
    .orderBy(desc(setLogs.setNumber))
    .get();
  if (!last) return undefined;
  const now = nowIso();
  const id = newId();
  db.insert(setLogs)
    .values({
      ...last,
      id,
      setNumber: last.setNumber + 1,
      reps: null,
      seconds: null,
      completed: false,
      createdAt: now,
      updatedAt: now,
    })
    .run();
  notifyChange();
  return id;
}

export function removeSet(db: Db, setId: string): void {
  const now = nowIso();
  db.update(setLogs).set({ deletedAt: now, updatedAt: now }).where(eq(setLogs.id, setId)).run();
  notifyChange();
}

export function finishSession(db: Db, sessionId: string, now = nowIso()): void {
  db.update(workoutSessions)
    .set({ finishedAt: now, updatedAt: now })
    .where(eq(workoutSessions.id, sessionId))
    .run();
  notifyChange();
}

/** Throw away an unfinished workout. */
export function discardSession(db: Db, sessionId: string): void {
  const now = nowIso();
  db.update(workoutSessions)
    .set({ deletedAt: now, updatedAt: now })
    .where(eq(workoutSessions.id, sessionId))
    .run();
  notifyChange();
}

/** Finished workouts, newest first, with completed-set counts and volume. */
export function listFinishedSessions(db: Db): SessionSummary[] {
  const sessions = db
    .select()
    .from(workoutSessions)
    .where(and(isNotNull(workoutSessions.finishedAt), isNull(workoutSessions.deletedAt)))
    .orderBy(desc(workoutSessions.startedAt))
    .all();
  return sessions.map((s) => {
    const done = db
      .select({ reps: setLogs.reps, weightKg: setLogs.weightKg })
      .from(setLogs)
      .where(
        and(eq(setLogs.sessionId, s.id), eq(setLogs.completed, true), isNull(setLogs.deletedAt)),
      )
      .all();
    const volumeKg = done.reduce((sum, r) => sum + (r.reps ?? 0) * (r.weightKg ?? 0), 0);
    return { ...s, completedSets: done.length, volumeKg };
  });
}

/**
 * Completed sets of this exercise from the most recent other finished workout, so the
 * logging screen can show "last time: 3 x 10 @ 20 kg".
 */
export function lastPerformance(
  db: Db,
  exerciseId: string,
  excludeSessionId?: string,
): SetLogRow[] {
  const latest = db
    .select({ sessionId: setLogs.sessionId })
    .from(setLogs)
    .innerJoin(workoutSessions, eq(setLogs.sessionId, workoutSessions.id))
    .where(
      and(
        eq(setLogs.exerciseId, exerciseId),
        eq(setLogs.completed, true),
        isNull(setLogs.deletedAt),
        isNotNull(workoutSessions.finishedAt),
        isNull(workoutSessions.deletedAt),
        excludeSessionId ? ne(workoutSessions.id, excludeSessionId) : undefined,
      ),
    )
    .orderBy(desc(workoutSessions.finishedAt))
    .get();
  if (!latest) return [];
  return db
    .select()
    .from(setLogs)
    .where(
      and(
        eq(setLogs.sessionId, latest.sessionId),
        eq(setLogs.exerciseId, exerciseId),
        eq(setLogs.completed, true),
        isNull(setLogs.deletedAt),
      ),
    )
    .orderBy(asc(setLogs.setNumber))
    .all();
}
