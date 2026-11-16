import { coreApi } from '@/api/core';
import { db } from '@/db/client';
import { resetSyncState } from '@/sync/engine';
import { runSync } from '@/sync/runner';

import { googleIdToken, googleSignOut } from './google';
import { accessToken, clearSession, loadSession, saveTokens } from './session';

/**
 * Sign in with Google and upload this phone's data to the account (guest data included),
 * then download anything already in the account. Returns false if the user cancelled.
 */
export async function signIn(): Promise<boolean> {
  const idToken = await googleIdToken();
  if (!idToken) return false;
  await saveTokens(await coreApi.signInWithGoogle(idToken));
  await runSync();
  return true;
}

/** Sign out. Data stays on this phone; it uploads again to whichever account signs in next. */
export async function signOut(): Promise<void> {
  const session = await loadSession();
  if (session) await coreApi.logout(session.refreshToken).catch(() => undefined);
  await googleSignOut();
  await clearSession();
  resetSyncState(db);
}

/** Delete the account and everything synced to it. This phone keeps its copy. */
export async function deleteAccount(): Promise<void> {
  const token = await accessToken();
  if (token) await coreApi.deleteAccount(token);
  await signOut();
}
