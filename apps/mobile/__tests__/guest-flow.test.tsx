/**
 * End-to-end check of the Phase 2 goal: a guest with no network sets up a profile,
 * builds a plan, logs a workout and sees it in history. Runs the real screens and
 * repositories against an in-memory SQLite database.
 */
import { fireEvent, renderRouter, screen, testRouter, waitFor } from 'expo-router/testing-library';

jest.mock('@/db/client', () => {
  const { createTestDb } = jest.requireActual<typeof import('@/db/testing')>('@/db/testing');
  return { db: createTestDb() };
});
jest.mock('drizzle-orm/expo-sqlite/migrator', () => ({
  useMigrations: () => ({ success: true, error: undefined }),
}));

jest.setTimeout(30000);

it('takes a guest from onboarding to a logged workout', async () => {
  const router = await renderRouter('./app', { initialUrl: '/' });
  await waitFor(() => expect(screen).toHavePathname('/onboarding'));

  // Onboarding
  await fireEvent.press(screen.getByText('Build muscle'));
  await fireEvent.press(screen.getByText('Continue'));
  await waitFor(() => expect(screen).toHavePathname('/onboarding/schedule'));
  await fireEvent.press(screen.getByText('Continue'));
  await waitFor(() => expect(screen).toHavePathname('/onboarding/limitations'));
  await fireEvent.press(screen.getByText('Skip'));
  await waitFor(() => expect(screen).toHavePathname('/onboarding/equipment'));
  await fireEvent.press(screen.getByText('Home gym'));
  await fireEvent.press(screen.getByText('Finish'));
  await waitFor(() => expect(screen).toHavePathname('/today'));

  // Build a plan with two exercises on day 1
  await fireEvent.press(screen.getByText('Build it myself'));
  await waitFor(() => expect(screen).toHavePathname('/plan/new'));
  await fireEvent.press(screen.getByText('Create plan'));
  await waitFor(() => expect(screen).toHavePathname('/plan'));
  await fireEvent.press(screen.getByText('Day 1'));
  await waitFor(() => expect(screen.getByText('Add exercise')).toBeOnTheScreen());
  await fireEvent.press(screen.getByText('Add exercise'));
  await waitFor(() => expect(screen.getByLabelText('Search')).toBeOnTheScreen());
  await fireEvent.changeText(screen.getByLabelText('Search'), 'dumbbell curl');
  await fireEvent.press(screen.getByLabelText('Add Dumbbell curl'));
  await fireEvent.changeText(screen.getByLabelText('Search'), 'push-up');
  await fireEvent.press(screen.getByLabelText('Add Push-up'));
  await fireEvent.press(screen.getByText('Done (2 added)'));
  await waitFor(() => expect(screen.getByText('Push-up')).toBeOnTheScreen());

  // Log the workout: tick every set, which fills in the target reps
  await testRouter.navigate('/today');
  await waitFor(() => expect(screen.getByText('Start Day 1')).toBeOnTheScreen());
  expect(screen.getByText(/0 \/ 3 sessions/)).toBeOnTheScreen();
  await fireEvent.press(screen.getByText('Start Day 1'));
  await waitFor(() => expect(screen.getAllByLabelText(/Set \d done/)).toHaveLength(6));
  expect(screen.getByText('0 of 6 sets')).toBeOnTheScreen();
  for (const box of screen.getAllByLabelText(/Set \d done/)) await fireEvent.press(box);
  expect(screen.getByText('6 of 6 sets')).toBeOnTheScreen();
  expect(screen.getByText(/Rest · next/)).toBeOnTheScreen(); // rest timer started
  await fireEvent.press(screen.getByText('Finish Day 1'));

  // Back on Today: a summary, the week strip counts it, and Day 2 is next
  await waitFor(() => expect(router.getPathname()).toBe('/today'));
  expect(screen.getByText(/Next up is Day 2/)).toBeOnTheScreen();
  expect(screen.getByText(/1 \/ 3 sessions/)).toBeOnTheScreen();

  // History: calendar, today's workout, and its detail
  await testRouter.navigate('/history');
  await waitFor(() => expect(screen.getByText('All workouts')).toBeOnTheScreen());
  expect(screen.getByLabelText(/, 1 workouts$/)).toBeOnTheScreen();
  const cards = screen.getAllByText('Day 1');
  expect(cards).toHaveLength(2); // the selected day and the full list
  await fireEvent.press(cards[0]!);
  await waitFor(() => expect(screen.getByText('Delete workout')).toBeOnTheScreen());
  expect(screen.getByText('Dumbbell curl')).toBeOnTheScreen();
  expect(screen.getAllByText('12 reps, 12 reps, 12 reps')).toHaveLength(2);
});
