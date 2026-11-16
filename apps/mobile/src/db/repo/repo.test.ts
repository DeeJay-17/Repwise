/**
 * @jest-environment node
 */
import { createTestDb } from '../testing';
import type { Db } from '../types';

import {
  addPlannedExercise,
  createPlan,
  defaultTarget,
  deletePlan,
  getActivePlan,
  getPlanTree,
  listDayExercises,
  movePlannedExercise,
  removePlannedExercise,
  setActivePlan,
} from './plans';
import { getProfile, saveProfile, updateProfile } from './profile';
import {
  addSet,
  discardSession,
  finishSession,
  getInProgressSession,
  getSessionDetail,
  lastPerformance,
  listFinishedSessions,
  nextPlanDay,
  startSession,
  updateSet,
} from './sessions';

const reps = defaultTarget('reps', false);

function planWithExercises(db: Db) {
  const planId = createPlan(db, {
    name: 'Full body',
    goal: 'general_fitness',
    daysPerWeek: 3,
    sessionMinutes: 45,
  });
  const days = getPlanTree(db, planId)!.days;
  addPlannedExercise(db, days[0]!.id, 'push_up', reps);
  addPlannedExercise(db, days[0]!.id, 'bodyweight_squat', reps);
  addPlannedExercise(db, days[1]!.id, 'plank', defaultTarget('time', false));
  addPlannedExercise(db, days[2]!.id, 'treadmill_walk', defaultTarget('time', true));
  return { planId, days };
}

describe('profile', () => {
  it('saves, reads and updates the single profile row', () => {
    const db = createTestDb();
    expect(getProfile(db)).toBeUndefined();
    saveProfile(db, {
      goal: 'fat_loss',
      level: 'beginner',
      daysPerWeek: 3,
      sessionMinutes: 30,
      limitations: ['knees'],
      equipmentIds: ['treadmill'],
      weightUnit: 'kg',
    });
    updateProfile(db, { weightUnit: 'lb' });
    const p = getProfile(db)!;
    expect(p.goal).toBe('fat_loss');
    expect(p.limitations).toEqual(['knees']);
    expect(p.equipmentIds).toEqual(['treadmill']);
    expect(p.weightUnit).toBe('lb');
  });
});

describe('plans', () => {
  it('creates numbered days and makes the new plan active', () => {
    const db = createTestDb();
    const first = createPlan(db, {
      name: 'A',
      goal: 'strength',
      daysPerWeek: 2,
      sessionMinutes: 60,
    });
    const second = createPlan(db, {
      name: 'B',
      goal: 'strength',
      daysPerWeek: 4,
      sessionMinutes: 60,
    });
    expect(getActivePlan(db)!.id).toBe(second);
    expect(getPlanTree(db, second)!.days.map((d) => d.name)).toEqual([
      'Day 1',
      'Day 2',
      'Day 3',
      'Day 4',
    ]);
    setActivePlan(db, first);
    expect(getActivePlan(db)!.id).toBe(first);
  });

  it('keeps positions contiguous when exercises are moved and removed', () => {
    const db = createTestDb();
    const { days } = planWithExercises(db);
    const dayId = days[0]!.id;
    const curl = addPlannedExercise(db, dayId, 'dumbbell_curl', reps);
    movePlannedExercise(db, curl, -1);
    expect(listDayExercises(db, dayId).map((e) => e.exerciseId)).toEqual([
      'push_up',
      'dumbbell_curl',
      'bodyweight_squat',
    ]);
    removePlannedExercise(db, curl);
    const remaining = listDayExercises(db, dayId);
    expect(remaining.map((e) => [e.exerciseId, e.position])).toEqual([
      ['push_up', 1],
      ['bodyweight_squat', 2],
    ]);
  });

  it('activates another plan when the active one is deleted', () => {
    const db = createTestDb();
    const older = createPlan(db, {
      name: 'Old',
      goal: 'strength',
      daysPerWeek: 2,
      sessionMinutes: 60,
    });
    const newer = createPlan(db, {
      name: 'New',
      goal: 'strength',
      daysPerWeek: 2,
      sessionMinutes: 60,
    });
    deletePlan(db, newer);
    expect(getActivePlan(db)!.id).toBe(older);
    expect(getPlanTree(db, newer)).toBeUndefined();
  });
});

describe('workouts', () => {
  it('copies planned sets into a new workout and resumes it instead of starting another', () => {
    const db = createTestDb();
    const { days } = planWithExercises(db);
    const id = startSession(db, days[0]!.id);
    expect(startSession(db, days[1]!.id)).toBe(id);
    const detail = getSessionDetail(db, id)!;
    expect(detail.session.name).toBe('Day 1');
    expect(detail.exercises.map((e) => [e.exerciseId, e.sets.length])).toEqual([
      ['push_up', 3],
      ['bodyweight_squat', 3],
    ]);
    expect(detail.exercises[0]!.sets[0]).toMatchObject({ targetMinReps: 8, targetMaxReps: 12 });
  });

  it('rotates through plan days in order and wraps around', () => {
    const db = createTestDb();
    const { planId, days } = planWithExercises(db);
    expect(nextPlanDay(db, planId)!.id).toBe(days[0]!.id);
    for (let i = 0; i < 3; i++) {
      const day = nextPlanDay(db, planId)!;
      const s = startSession(db, day.id, `2026-11-1${i}T10:00:00Z`);
      finishSession(db, s, `2026-11-1${i}T11:00:00Z`);
    }
    expect(nextPlanDay(db, planId)!.id).toBe(days[0]!.id);
  });

  it('logs sets, adds a set, and reports history and last performance', () => {
    const db = createTestDb();
    const { days } = planWithExercises(db);

    const first = startSession(db, days[0]!.id, '2026-11-10T10:00:00Z');
    const push = getSessionDetail(db, first)!.exercises[0]!;
    for (const set of push.sets) updateSet(db, set.id, { reps: 10, weightKg: 0, completed: true });
    const squat = getSessionDetail(db, first)!.exercises[1]!;
    updateSet(db, squat.sets[0]!.id, { reps: 12, weightKg: 20, completed: true });
    addSet(db, first, squat.position);
    finishSession(db, first, '2026-11-10T10:45:00Z');

    expect(getSessionDetail(db, first)!.exercises[1]!.sets).toHaveLength(4);
    const [summary] = listFinishedSessions(db);
    expect(summary).toMatchObject({ id: first, completedSets: 4, volumeKg: 240 });

    const second = startSession(db, days[0]!.id, '2026-11-12T10:00:00Z');
    expect(getInProgressSession(db)!.id).toBe(second);
    expect(lastPerformance(db, 'bodyweight_squat', second).map((s) => s.weightKg)).toEqual([20]);

    discardSession(db, second);
    expect(getInProgressSession(db)).toBeUndefined();
    expect(listFinishedSessions(db)).toHaveLength(1);
  });
});
