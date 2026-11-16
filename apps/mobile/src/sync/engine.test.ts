/**
 * @jest-environment node
 */
import {
  addPlannedExercise,
  createPlan,
  defaultTarget,
  getActivePlan,
  getPlanTree,
  removePlannedExercise,
  renamePlan,
} from '@/db/repo/plans';
import { getProfile, saveProfile } from '@/db/repo/profile';
import {
  finishSession,
  getSessionDetail,
  listFinishedSessions,
  startSession,
  updateSet,
} from '@/db/repo/sessions';
import { createTestDb } from '@/db/testing';
import type { Db } from '@/db/types';

import { collectChanges, resetSyncState, syncOnce } from './engine';
import { createFakeSyncServer } from './fake-server';

jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
let clock = Date.parse('2026-11-16T08:00:00Z');
const tick = () => jest.setSystemTime((clock += 1000));

function guestDevice(): Db {
  const db = createTestDb();
  tick();
  saveProfile(db, {
    goal: 'muscle_gain',
    level: 'beginner',
    daysPerWeek: 2,
    sessionMinutes: 45,
    limitations: [],
    equipmentIds: ['dumbbells'],
    weightUnit: 'kg',
  });
  const planId = createPlan(db, {
    name: 'Upper/Lower',
    goal: 'muscle_gain',
    daysPerWeek: 2,
    sessionMinutes: 45,
  });
  const day = getPlanTree(db, planId)!.days[0]!;
  addPlannedExercise(db, day.id, 'dumbbell_curl', defaultTarget('reps', false));
  addPlannedExercise(db, day.id, 'push_up', defaultTarget('reps', false));
  const s = startSession(db, day.id);
  for (const set of getSessionDetail(db, s)!.exercises[0]!.sets) {
    updateSet(db, set.id, { reps: 10, weightKg: 12, completed: true });
  }
  tick();
  finishSession(db, s);
  return db;
}

describe('sync', () => {
  beforeEach(tick);

  it('uploads guest data and restores it on a new phone', async () => {
    const server = createFakeSyncServer();
    const phone = guestDevice();
    const first = await syncOnce(phone, server.transport);
    expect(first.pushed).toBeGreaterThan(10);

    const newPhone = createTestDb();
    const restored = await syncOnce(newPhone, server.transport);
    expect(restored.pulled).toBe(first.pushed);
    expect(getProfile(newPhone)?.equipmentIds).toEqual(['dumbbells']);
    const tree = getPlanTree(newPhone, getActivePlan(newPhone)!.id)!;
    expect(tree.days[0]!.exercises.map((e) => e.exerciseId)).toEqual(['dumbbell_curl', 'push_up']);
    expect(listFinishedSessions(newPhone)[0]).toMatchObject({ completedSets: 3, volumeKg: 360 });

    // Nothing left to send either way
    expect(await syncOnce(newPhone, server.transport)).toEqual({ pushed: 0, pulled: 0 });
  });

  it('carries edits and deletes between devices', async () => {
    const server = createFakeSyncServer();
    const a = guestDevice();
    await syncOnce(a, server.transport);
    const b = createTestDb();
    await syncOnce(b, server.transport);

    tick();
    const planId = getActivePlan(b)!.id;
    renamePlan(b, planId, 'Renamed on tablet');
    removePlannedExercise(b, getPlanTree(b, planId)!.days[0]!.exercises[0]!.id);
    await syncOnce(b, server.transport);
    await syncOnce(a, server.transport);

    const tree = getPlanTree(a, planId)!;
    expect(tree.plan.name).toBe('Renamed on tablet');
    expect(tree.days[0]!.exercises.map((e) => [e.exerciseId, e.position])).toEqual([
      ['push_up', 1],
    ]);
  });

  it('keeps the newest edit when two devices change the same row', async () => {
    const server = createFakeSyncServer();
    const a = guestDevice();
    await syncOnce(a, server.transport);
    const b = createTestDb();
    await syncOnce(b, server.transport);
    const sessionId = listFinishedSessions(a)[0]!.id;
    const setId = getSessionDetail(a, sessionId)!.exercises[0]!.sets[0]!.id;

    tick();
    updateSet(a, setId, { reps: 11 });
    tick();
    updateSet(b, setId, { reps: 12 }); // later
    await syncOnce(b, server.transport);
    await syncOnce(a, server.transport);
    await syncOnce(b, server.transport);

    const reps = (db: Db) => getSessionDetail(db, sessionId)!.exercises[0]!.sets[0]!.reps;
    expect([reps(a), reps(b)]).toEqual([12, 12]);
  });

  it('restores correctly when a parent was edited after its children', async () => {
    // Small pages, and the workout (parent) has a newer sequence than its sets.
    const server = createFakeSyncServer(2);
    const a = guestDevice();
    await syncOnce(a, server.transport);
    tick();
    const sessionId = listFinishedSessions(a)[0]!.id;
    finishSession(a, sessionId);
    await syncOnce(a, server.transport);

    const b = createTestDb();
    await syncOnce(b, server.transport);
    expect(getSessionDetail(b, sessionId)!.exercises[0]!.sets).toHaveLength(3);
  });

  it('re-uploads everything after a reset (signing out, then into another account)', async () => {
    const a = guestDevice();
    await syncOnce(a, createFakeSyncServer().transport);
    expect(collectChanges(a, new Date().toISOString())).toEqual([]);
    resetSyncState(a);
    const other = createFakeSyncServer();
    const result = await syncOnce(a, other.transport);
    expect(result.pushed).toBe(other.records.size);
  });
});
