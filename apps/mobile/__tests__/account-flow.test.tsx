/**
 * End-to-end check of Phase 4 in the app: a user who trained on another phone signs in
 * with Google on a new phone, their data downloads, and they land on Today with their
 * plan. Then they sign out from Settings. Google and the core API are faked; the sync
 * rules match the server's.
 */
import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';

import type { SyncRequest } from '@/api/core';
import { addPlannedExercise, createPlan, defaultTarget, getPlanTree } from '@/db/repo/plans';
import { saveProfile } from '@/db/repo/profile';
import { createTestDb } from '@/db/testing';
import { syncOnce } from '@/sync/engine';
import { createFakeSyncServer } from '@/sync/fake-server';

jest.mock('@/db/client', () => {
  const { createTestDb: create } =
    jest.requireActual<typeof import('@/db/testing')>('@/db/testing');
  return { db: create() };
});
jest.mock('drizzle-orm/expo-sqlite/migrator', () => ({
  useMigrations: () => ({ success: true, error: undefined }),
}));
jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  return {
    getItemAsync: async (k: string) => store.get(k) ?? null,
    setItemAsync: async (k: string, v: string) => void store.set(k, v),
    deleteItemAsync: async (k: string) => void store.delete(k),
  };
});
jest.mock('@/features/account/google', () => ({
  isExpoGo: () => false,
  googleIdToken: async () => 'google-id-token-from-the-native-sdk',
  googleSignOut: async () => undefined,
}));

jest.setTimeout(30000);

const server = createFakeSyncServer();
const calls: string[] = [];

function json(body: unknown, status = 200) {
  return { ok: status < 400, status, json: async () => body } as unknown as Response;
}

beforeAll(async () => {
  // The user's other phone already synced a profile and a plan.
  const otherPhone = createTestDb();
  saveProfile(otherPhone, {
    goal: 'strength',
    level: 'intermediate',
    daysPerWeek: 3,
    sessionMinutes: 60,
    limitations: [],
    equipmentIds: ['barbell', 'squat_rack', 'flat_bench'],
    weightUnit: 'kg',
  });
  const planId = createPlan(otherPhone, {
    name: 'Big three',
    goal: 'strength',
    daysPerWeek: 3,
    sessionMinutes: 60,
  });
  addPlannedExercise(
    otherPhone,
    getPlanTree(otherPhone, planId)!.days[0]!.id,
    'back_squat',
    defaultTarget('reps', false),
  );
  await syncOnce(otherPhone, server.transport);

  global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
    const path = new URL(url).pathname;
    calls.push(path);
    if (path === '/v1/auth/google') {
      return json({
        accessToken: 'access-1',
        refreshToken: 'refresh-1',
        expiresIn: 3600,
        user: { id: 'u1', email: 'deejay@example.com', name: 'DeeJay', picture: null },
      });
    }
    if (path === '/v1/sync') {
      expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer access-1');
      return json(await server.transport.sync(JSON.parse(String(init?.body)) as SyncRequest));
    }
    if (path === '/v1/auth/logout') return json(null, 204);
    return json({ code: 'not_found', message: path }, 404);
  }) as unknown as typeof fetch;
});

it('restores a returning user on a new phone, then signs out', async () => {
  await renderRouter('./app', { initialUrl: '/' });
  await waitFor(() => expect(screen.getByText('Sign in with Google')).toBeOnTheScreen());
  await fireEvent.press(screen.getByText('Sign in with Google'));

  // Profile and plan came down with the first sync, so onboarding is skipped.
  await waitFor(() => expect(screen.getByText('Start Day 1')).toBeOnTheScreen());
  expect(screen.getByText('Barbell back squat')).toBeOnTheScreen();
  expect(calls).toEqual(['/v1/auth/google', '/v1/sync']);

  await fireEvent.press(screen.getByText('Settings'));
  await waitFor(() => expect(screen.getByText('deejay@example.com')).toBeOnTheScreen());
  expect(screen.getByText('Synced just now')).toBeOnTheScreen();

  await fireEvent.press(screen.getByText('Sign out'));
  await waitFor(() => expect(screen.getByText('Guest mode')).toBeOnTheScreen());
  expect(calls).toContain('/v1/auth/logout');
  // The data stays on this phone.
  expect(screen.getByText(/Get stronger/)).toBeOnTheScreen();
});
