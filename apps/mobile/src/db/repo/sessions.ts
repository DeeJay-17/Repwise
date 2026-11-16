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
  /** Position of the plan day this workout came from, for its colour. */
  dayIndex: number | null;
  exercises: SessionExercise[];
}

export interface SessionSummary extends WorkoutSessionRow {
  dayIndex: number | null;
  completedSets: number;
  /** Sum of reps x weight over completed sets, in kg. */
  volumeKg: number;
}

export interface LastPerformance {
  startedAt: string;
  sets: SetLogRow[];
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
            targetRestSeconds: pe.restSeconds,
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
  const row = db
    .select({ session: workoutSessions, dayIndex: planDays.dayIndex })
    .from(workoutSessions)
    .leftJoin(planDays, eq(workoutSessions.planDayId, planDays.id))
    .where(and(eq(workoutSessions.id, sessionId), isNull(workoutSessions.deletedAt)))
    .get();
  if (!row) return undefined;
  const rows = db
    .select()
    .from(setLogs)
    .where(and(eq(setLogs.sessionId, sessionId), isNull(setLogs.deletedAt)))
    .orderBy(asc(setLogs.exercisePosition), asc(setLogs.setNumber))
    .all();
  const exercises: SessionExercise[] = [];
  for (const set of rows) {
    const current = exercises.at(-1);
    if (current && current.position === set.exercisePosition) current.sets.push(set);
    else
      exercises.push({ exerciseId: set.exerciseId, position: set.exercisePosition, sets: [set] });
  }
  return { session: row.session, dayIndex: row.dayIndex, exercises };
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
      weightKg: null,
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

/** Delete a workout, finished or not. Soft delete, so sync can pass it on later. */
export function discardSession(db: Db, sessionId: string): void {
  const now = nowIso();
  db.update(workoutSessions)
    .set({ deletedAt: now, updatedAt: now })
    .where(eq(workoutSessions.id, sessionId))
    .run();
  notifyChange();
}

/** Finished workouts, newest first, with their day colour, completed sets and volume. */
export function listFinishedSessions(db: Db): SessionSummary[] {
  const sessions = db
    .select({ session: workoutSessions, dayIndex: planDays.dayIndex })
    .from(workoutSessions)
    .leftJoin(planDays, eq(workoutSessions.planDayId, planDays.id))
    .where(and(isNotNull(workoutSessions.finishedAt), isNull(workoutSessions.deletedAt)))
    .orderBy(desc(workoutSessions.startedAt))
    .all();
  return sessions.map(({ session, dayIndex }) => {
    const done = db
      .select({ reps: setLogs.reps, weightKg: setLogs.weightKg })
      .from(setLogs)
      .where(
        and(
          eq(setLogs.sessionId, session.id),
          eq(setLogs.completed, true),
          isNull(setLogs.deletedAt),
        ),
      )
      .all();
    const volumeKg = done.reduce((sum, r) => sum + (r.reps ?? 0) * (r.weightKg ?? 0), 0);
    return { ...session, dayIndex, completedSets: done.length, volumeKg };
  });
}

/**
 * Completed sets of this exercise from the most recent other finished workout, so the
 * logging screen can show "Last: 20x10, 20x10 (Mon 9 Nov)" and prefill the next sets.
 */
export function lastPerformance(
  db: Db,
  exerciseId: string,
  excludeSessionId?: string,
): LastPerformance | undefined {
  const latest = db
    .select({ sessionId: setLogs.sessionId, startedAt: workoutSessions.startedAt })
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
  if (!latest) return undefined;
  const sets = db
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
  return { startedAt: latest.startedAt, sets };
}

/** Move a workout to another day, keeping its time of day and duration. */
export function setSessionDate(db: Db, sessionId: string, day: Date): void {
  const session = db.select().from(workoutSessions).where(eq(workoutSessions.id, sessionId)).get();
  if (!session) return;
  const started = new Date(session.startedAt);
  const moved = new Date(
    day.getFullYear(),
    day.getMonth(),
    day.getDate(),
    started.getHours(),
    started.getMinutes(),
    started.getSeconds(),
  );
  const shift = moved.getTime() - started.getTime();
  const finishedAt = session.finishedAt
    ? new Date(Date.parse(session.finishedAt) + shift).toISOString()
    : null;
  db.update(workoutSessions)
    .set({ startedAt: moved.toISOString(), finishedAt, updatedAt: nowIso() })
    .where(eq(workoutSessions.id, sessionId))
    .run();
  notifyChange();
}
