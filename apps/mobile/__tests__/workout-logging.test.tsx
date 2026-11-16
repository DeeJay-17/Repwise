/**
 * Logging behaviour carried over from the Recomp log: last session's numbers as
 * placeholders, ticking an empty set copies them, a heavier-weight hint once every set
 * hits the top of the range, and plates per side for barbell lifts.
 */
import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';

import { db } from '@/db/client';
import { addPlannedExercise, createPlan, getPlanTree } from '@/db/repo/plans';
import { saveProfile } from '@/db/repo/profile';
import { finishSession, getSessionDetail, startSession, updateSet } from '@/db/repo/sessions';

jest.mock('@/db/client', () => {
  const { createTestDb } = jest.requireActual<typeof import('@/db/testing')>('@/db/testing');
  return { db: createTestDb() };
});
jest.mock('drizzle-orm/expo-sqlite/migrator', () => ({
  useMigrations: () => ({ success: true, error: undefined }),
}));

jest.setTimeout(30000);

it('prefills from last time, suggests more weight and shows plates', async () => {
  saveProfile(db, {
    goal: 'strength',
    level: 'intermediate',
    daysPerWeek: 1,
    sessionMinutes: 60,
    limitations: [],
    equipmentIds: ['barbell', 'squat_rack'],
    weightUnit: 'kg',
  });
  const planId = createPlan(db, {
    name: 'Squat',
    goal: 'strength',
    daysPerWeek: 1,
    sessionMinutes: 60,
  });
  const dayId = getPlanTree(db, planId)!.days[0]!.id;
  addPlannedExercise(db, dayId, 'back_squat', {
    sets: 3,
    targetKind: 'reps',
    minReps: 5,
    maxReps: 5,
    seconds: null,
    restSeconds: 150,
  });

  // Last week: 3 x 5 at 100 kg, every set at the top of the range
  const last = startSession(db, dayId, '2026-11-09T10:00:00Z');
  for (const s of getSessionDetail(db, last)!.exercises[0]!.sets) {
    updateSet(db, s.id, { reps: 5, weightKg: 100, completed: true });
  }
  finishSession(db, last, '2026-11-09T11:00:00Z');

  const today = startSession(db, dayId);
  await renderRouter('./app', { initialUrl: `/workout/${today}` });
  await waitFor(() => expect(screen.getByText(/Try/)).toBeOnTheScreen());

  expect(screen.getByText(/5 x 100 kg, 5 x 100 kg, 5 x 100 kg/)).toBeOnTheScreen();
  expect(screen.getByText('Try 102.5 kg')).toBeOnTheScreen();
  expect(screen.getByText('25 + 15 kg per side')).toBeOnTheScreen();
  expect(screen.getByLabelText('Set 1 weight in kg').props.placeholder).toBe('100');

  await fireEvent.press(screen.getByLabelText('Set 1 done'));
  const first = getSessionDetail(db, today)!.exercises[0]!.sets[0]!;
  expect(first).toMatchObject({ completed: true, reps: 5, weightKg: 100 });
  expect(screen.getByText(/Rest · next: Barbell back squat, set 2/)).toBeOnTheScreen();
});
