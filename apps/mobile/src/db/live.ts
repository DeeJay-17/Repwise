import { useMemo, useSyncExternalStore } from 'react';

/**
 * A tiny change signal for local data. Repository writes call notifyChange(); screens read
 * through useDbQuery(), which re-runs its query after any write. Queries are synchronous
 * SQLite reads, so re-running them is cheap.
 */
let version = 0;
const listeners = new Set<() => void>();

export function notifyChange(): void {
  version += 1;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getVersion(): number {
  return version;
}

type Key = string | number | boolean | null | undefined;

/**
 * Run a synchronous query and re-run it after any local write, or when one of `keys`
 * (such as a route id) changes.
 */
export function useDbQuery<T>(query: () => T, keys: readonly Key[] = []): T {
  const current = useSyncExternalStore(subscribe, getVersion);
  const keyString = JSON.stringify(keys);
  // The query closure only depends on `keys`, which keyString captures.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => query(), [current, keyString]);
}
