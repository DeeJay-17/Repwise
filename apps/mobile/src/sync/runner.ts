import { useEffect, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

import { ApiError, coreApi } from '@/api/core';
import { db } from '@/db/client';
import { subscribe as subscribeToChanges } from '@/db/live';
import { accessToken, loadSession } from '@/features/account/session';

import { syncOnce, type SyncTransport } from './engine';

export interface SyncStatus {
  state: 'idle' | 'syncing' | 'error';
  message?: string;
}

let status: SyncStatus = { state: 'idle' };
const listeners = new Set<() => void>();
let running: Promise<void> | null = null;

function setStatus(next: SyncStatus): void {
  status = next;
  listeners.forEach((l) => l());
}

const transport: SyncTransport = {
  async sync(body) {
    const token = await accessToken();
    if (!token) throw new ApiError(401, 'unauthenticated', 'Sign in to sync.');
    return coreApi.sync(token, body);
  },
};

/** Sync now if signed in. Concurrent calls share one run. */
export function runSync(): Promise<void> {
  if (running) return running;
  running = (async () => {
    if (!(await loadSession())) return;
    setStatus({ state: 'syncing' });
    try {
      await syncOnce(db, transport);
      setStatus({ state: 'idle' });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Sync failed.';
      setStatus({ state: 'error', message });
    }
  })().finally(() => {
    running = null;
  });
  return running;
}

export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => status,
  );
}

const DEBOUNCE_MS = 5000;

/** Keep the account in sync: at start, when the app comes back, and soon after edits. */
export function useAutoSync(): void {
  useEffect(() => {
    void runSync();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = subscribeToChanges(() => {
      clearTimeout(timer);
      timer = setTimeout(() => void runSync(), DEBOUNCE_MS);
    });
    const appState = AppState.addEventListener('change', (next) => {
      if (next === 'active') void runSync();
    });
    return () => {
      clearTimeout(timer);
      unsubscribe();
      appState.remove();
    };
  }, []);
}
