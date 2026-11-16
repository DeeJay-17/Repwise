/**
 * Local SQLite schema (Drizzle). The phone's database is the source of truth in every mode
 * (docs/adr/0005). Every syncable row has a UUID id, updatedAt and a soft-delete deletedAt,
 * which Phase 4 sync relies on. Timestamps are ISO 8601 strings in UTC.
 */
import { index, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

import type { Goal, Level, Limitation, MuscleGroup, PlanSource, TargetKind } from '@/domain/types';
import type { WeightUnit } from '@/lib/units';

const timestamps = {
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
};

const syncable = {
  ...timestamps,
  deletedAt: text('deleted_at'),
};

/** One row per device user (id is always "me"). */
export const profile = sqliteTable('profile', {
  id: text('id').primaryKey(),
  goal: text('goal').$type<Goal>().notNull(),
  level: text('level').$type<Level>().notNull(),
  daysPerWeek: integer('days_per_week').notNull(),
  sessionMinutes: integer('session_minutes').notNull(),
  limitations: text('limitations', { mode: 'json' }).$type<Limitation[]>().notNull(),
  equipmentIds: text('equipment_ids', { mode: 'json' }).$type<string[]>().notNull(),
  weightUnit: text('weight_unit').$type<WeightUnit>().notNull(),
  ...timestamps,
});

export const plans = sqliteTable('plans', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  source: text('source').$type<PlanSource>().notNull(),
  goal: text('goal').$type<Goal>().notNull(),
  daysPerWeek: integer('days_per_week').notNull(),
  sessionMinutes: integer('session_minutes').notNull(),
  focusMuscles: text('focus_muscles', { mode: 'json' }).$type<MuscleGroup[]>().notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).notNull(),
  ...syncable,
});

export const planDays = sqliteTable(
  'plan_days',
  {
    id: text('id').primaryKey(),
    planId: text('plan_id')
      .notNull()
      .references(() => plans.id),
    dayIndex: integer('day_index').notNull(),
    name: text('name').notNull(),
    ...syncable,
  },
  (t) => [index('plan_days_plan_idx').on(t.planId)],
);

export const planExercises = sqliteTable(
  'plan_exercises',
  {
    id: text('id').primaryKey(),
    planDayId: text('plan_day_id')
      .notNull()
      .references(() => planDays.id),
    exerciseId: text('exercise_id').notNull(),
    position: integer('position').notNull(),
    sets: integer('sets').notNull(),
    targetKind: text('target_kind').$type<TargetKind>().notNull(),
    minReps: integer('min_reps'),
    maxReps: integer('max_reps'),
    seconds: integer('seconds'),
    restSeconds: integer('rest_seconds').notNull(),
    notes: text('notes'),
    ...syncable,
  },
  (t) => [index('plan_exercises_day_idx').on(t.planDayId)],
);

export const workoutSessions = sqliteTable(
  'workout_sessions',
  {
    id: text('id').primaryKey(),
    planId: text('plan_id').references(() => plans.id),
    planDayId: text('plan_day_id').references(() => planDays.id),
    name: text('name').notNull(),
    startedAt: text('started_at').notNull(),
    finishedAt: text('finished_at'),
    notes: text('notes'),
    ...syncable,
  },
  (t) => [index('workout_sessions_started_idx').on(t.startedAt)],
);

export const setLogs = sqliteTable(
  'set_logs',
  {
    id: text('id').primaryKey(),
    sessionId: text('session_id')
      .notNull()
      .references(() => workoutSessions.id),
    exerciseId: text('exercise_id').notNull(),
    exercisePosition: integer('exercise_position').notNull(),
    setNumber: integer('set_number').notNull(),
    targetKind: text('target_kind').$type<TargetKind>().notNull(),
    targetMinReps: integer('target_min_reps'),
    targetMaxReps: integer('target_max_reps'),
    targetSeconds: integer('target_seconds'),
    /** Planned rest after each set, copied from the plan when the workout starts. */
    targetRestSeconds: integer('target_rest_seconds'),
    reps: integer('reps'),
    weightKg: real('weight_kg'),
    seconds: integer('seconds'),
    completed: integer('completed', { mode: 'boolean' }).notNull(),
    ...syncable,
  },
  (t) => [
    index('set_logs_session_idx').on(t.sessionId),
    index('set_logs_exercise_idx').on(t.exerciseId),
  ],
);

export type ProfileRow = typeof profile.$inferSelect;
export type PlanRow = typeof plans.$inferSelect;
export type PlanDayRow = typeof planDays.$inferSelect;
export type PlanExerciseRow = typeof planExercises.$inferSelect;
export type WorkoutSessionRow = typeof workoutSessions.$inferSelect;
export type SetLogRow = typeof setLogs.$inferSelect;
