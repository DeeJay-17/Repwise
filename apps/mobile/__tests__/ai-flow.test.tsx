/**
 * End-to-end check of Phase 3 in the app: set up an own API key, generate a plan with a
 * focus muscle, use it, and regenerate it. The AI service is replaced by a mocked fetch
 * that returns the contract's example plan.
 */
import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';

import examplePlan from '../../../packages/contracts/examples/plan.example.json';
import { db } from '@/db/client';
import { saveProfile } from '@/db/repo/profile';

jest.mock('@/db/client', () => {
  const { createTestDb } = jest.requireActual<typeof import('@/db/testing')>('@/db/testing');
  return { db: createTestDb() };
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

jest.setTimeout(30000);

const KEY = 'test-provider-key-123456';

it('generates, uses and regenerates a plan with the user own key', async () => {
  saveProfile(db, {
    goal: 'general_fitness',
    level: 'beginner',
    daysPerWeek: 3,
    sessionMinutes: 45,
    limitations: [],
    equipmentIds: ['treadmill'],
    weightUnit: 'kg',
  });
  const fetchMock = jest.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({ plan: examplePlan, warnings: [] }),
  }));
  global.fetch = fetchMock as unknown as typeof fetch;

  await renderRouter('./app', { initialUrl: '/plan' });
  await waitFor(() => expect(screen.getByText('Generate with AI')).toBeOnTheScreen());
  await fireEvent.press(screen.getByText('Generate with AI'));

  // No key yet: set one up
  await waitFor(() => expect(screen.getByText('Add your API key first')).toBeOnTheScreen());
  await fireEvent.press(screen.getByText('Set up AI'));
  await waitFor(() => expect(screen.getByLabelText('Model name')).toBeOnTheScreen());
  await fireEvent.press(screen.getByText('Anthropic'));
  await fireEvent.changeText(screen.getByLabelText('Model name'), 'some-model');
  await fireEvent.changeText(screen.getByLabelText('API key'), KEY);
  await fireEvent.press(screen.getByText('Save'));

  // Generate with a focus muscle
  await waitFor(() => expect(screen.getByText('Generate plan')).toBeOnTheScreen());
  await fireEvent.press(screen.getByText('Glutes'));
  await fireEvent.press(screen.getByText('Generate plan'));
  await waitFor(() => expect(screen.getByText('Use this plan')).toBeOnTheScreen());

  const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
  const sent = JSON.parse(init.body as string);
  expect((init.headers as Record<string, string>)['X-LLM-API-Key']).toBe(KEY);
  expect(sent).toMatchObject({
    provider: 'anthropic',
    model: 'some-model',
    focusMuscles: ['glutes'],
    profile: { goal: 'general_fitness', equipmentIds: ['treadmill'] },
  });
  expect(sent.previousPlan).toBeUndefined();
  expect(screen.getAllByText('Treadmill incline walk')).toHaveLength(2);

  await fireEvent.press(screen.getByText('Use this plan'));
  await waitFor(() => expect(screen.getByText('Full body A')).toBeOnTheScreen());
  expect(screen.getByDisplayValue(examplePlan.name)).toBeOnTheScreen();

  // Regenerate sends the current plan back as the previous plan
  await fireEvent.press(screen.getByText('Regenerate with AI'));
  await waitFor(() => expect(screen.getByText('Regenerate plan')).toBeOnTheScreen());
  await fireEvent.press(screen.getByText('Regenerate plan'));
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  const again = JSON.parse(
    (fetchMock.mock.calls[1] as unknown as [string, RequestInit])[1].body as string,
  );
  expect(again.previousPlan.days.map((d: { name: string }) => d.name)).toEqual([
    'Full body A',
    'Full body B',
    'Full body C',
  ]);
});
