import * as SecureStore from 'expo-secure-store';
import { useSyncExternalStore } from 'react';

import { ApiError, coreApi, type AccountUser, type TokenResponse } from '@/api/core';

/**
 * The signed-in account, kept in secure storage. `undefined` until loaded from storage,
 * `null` for guests. Screens read it with useAccount().
 */
export interface AccountSession {
  user: AccountUser;
  accessToken: string;
  refreshToken: string;
  /** Epoch milliseconds. */
  accessExpiresAt: number;
}

const KEY = 'repwise.account.session';
let current: AccountSession | null | undefined;
const listeners = new Set<() => void>();

function set(next: AccountSession | null): void {
  current = next;
  listeners.forEach((l) => l());
}

export async function loadSession(): Promise<AccountSession | null> {
  if (current !== undefined) return current;
  const raw = await SecureStore.getItemAsync(KEY).catch(() => null);
  set(raw ? (JSON.parse(raw) as AccountSession) : null);
  return current ?? null;
}

export async function saveTokens(tokens: TokenResponse): Promise<AccountSession> {
  const session: AccountSession = {
    user: tokens.user,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    accessExpiresAt: Date.now() + tokens.expiresIn * 1000,
  };
  await SecureStore.setItemAsync(KEY, JSON.stringify(session));
  set(session);
  return session;
}

export async function clearSession(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY).catch(() => undefined);
  set(null);
}

/** A valid access token, refreshing it first if it expires within a minute. */
export async function accessToken(): Promise<string | null> {
  const session = await loadSession();
  if (!session) return null;
  if (session.accessExpiresAt - Date.now() > 60_000) return session.accessToken;
  try {
    return (await saveTokens(await coreApi.refresh(session.refreshToken))).accessToken;
  } catch (e) {
    // A rejected refresh token means the session is over; network errors keep it.
    if (e instanceof ApiError && e.status === 401) await clearSession();
    throw e;
  }
}

/** For tests: forget the in-memory copy so the next load reads storage again. */
export function resetSessionCache(): void {
  current = undefined;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useAccount(): AccountSession | null | undefined {
  return useSyncExternalStore(subscribe, () => current);
}
