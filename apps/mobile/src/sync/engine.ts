/**
 * Two-way sync with the core API (docs/adr/0011).
 *
 * Push: every row changed since the last successful sync (by updatedAt).
 * Pull: everything other devices sent since our cursor; a pulled row replaces the local
 * one if it is at least as new. Deletes are soft (deletedAt), so they sync like edits.
 */
import { eq, gt, sql } from 'drizzle-orm';

import type { SyncChange, SyncRequest, SyncResponse } from '@/api/core';
import { notifyChange } from '@/db/live';
import {
  planDays,
  planExercises,
  plans,
  profile,
  setLogs,
  syncState,
  workoutSessions,
} from '@/db/schema';
import type { Db } from '@/db/types';
import { nowIso } from '@/lib/time';

/** Synced tables, parents before children. */
export const ENTITIES = {
  profile,
  plans,
  plan_days: planDays,
  plan_exercises: planExercises,
  workout_sessions: workoutSessions,
  set_logs: setLogs,
} as const;
export type EntityName = keyof typeof ENTITIES;
const ORDER = Object.keys(ENTITIES) as EntityName[];

const EPOCH = '1970-01-01T00:00:00.000Z';
const PUSH_BATCH = 500;

export interface SyncTransport {
  sync(body: SyncRequest): Promise<SyncResponse>;
}

function getState(db: Db, key: string): string | undefined {
  return db.select().from(syncState).where(eq(syncState.key, key)).get()?.value;
}

function setState(db: Db, key: string, value: string): void {
  db.insert(syncState)
    .values({ key, value })
    .onConflictDoUpdate({ target: syncState.key, set: { value } })
    .run();
}

/** Forget sync progress, so the next sync uploads everything (e.g. after signing out). */
export function resetSyncState(db: Db): void {
  db.delete(syncState).run();
}

export function lastSyncedAt(db: Db): string | undefined {
  return getState(db, 'lastSyncedAt');
}

/** Local rows changed after `since`, as sync changes. */
export function collectChanges(db: Db, since: string): SyncChange[] {
  const out: SyncChange[] = [];
  for (const entity of ORDER) {
    const table = ENTITIES[entity];
    const rows = db.select().from(table).where(gt(table.updatedAt, since)).all() as Record<
      string,
      unknown
    >[];
    for (const row of rows) {
      out.push({
        entity,
        id: String(row.id),
        updatedAt: String(row.updatedAt),
        deletedAt: (row.deletedAt as string | null | undefined) ?? null,
        data: row,
      });
    }
  }
  return out;
}

/** Write pulled changes that are at least as new as the local rows. Returns rows written. */
export function applyChanges(db: Db, changes: SyncChange[]): number {
  const sorted = [...changes].sort(
    (a, b) => ORDER.indexOf(a.entity as EntityName) - ORDER.indexOf(b.entity as EntityName),
  );
  let written = 0;
  db.transaction((tx) => {
    // Children may arrive in a page before their parent; check foreign keys at commit.
    tx.run(sql`PRAGMA defer_foreign_keys = ON`);
    for (const change of sorted) {
      const table = ENTITIES[change.entity as EntityName];
      if (!table) continue;
      const local = tx
        .select({ updatedAt: table.updatedAt })
        .from(table)
        .where(eq(table.id, change.id))
        .get();
      if (local && local.updatedAt > change.updatedAt) continue;
      const row = { ...change.data, id: change.id } as typeof table.$inferInsert;
      tx.insert(table).values(row).onConflictDoUpdate({ target: table.id, set: row }).run();
      written += 1;
    }
  });
  if (written) notifyChange();
  return written;
}

/**
 * Push local changes and pull remote ones until the server has nothing more. Pulled pages
 * are applied together at the end, in one transaction, so a child row never lands before
 * a parent that arrives in a later page.
 */
export async function syncOnce(
  db: Db,
  transport: SyncTransport,
): Promise<{ pushed: number; pulled: number }> {
  const startedAt = nowIso();
  const since = getState(db, 'lastPushedAt') ?? EPOCH;
  let cursor = Number(getState(db, 'cursor') ?? 0);
  const pending = collectChanges(db, since);
  const incoming = new Map<string, SyncChange>();
  const keep = (changes: SyncChange[]) => {
    for (const c of changes) incoming.set(`${c.entity}/${c.id}`, c);
  };

  for (let i = 0; i === 0 || i < pending.length; i += PUSH_BATCH) {
    const batch = pending.slice(i, i + PUSH_BATCH);
    let response = await transport.sync({ cursor, changes: batch });
    keep(response.changes);
    cursor = response.cursor;
    while (response.hasMore) {
      response = await transport.sync({ cursor, changes: [] });
      keep(response.changes);
      cursor = response.cursor;
    }
  }

  const pulled = applyChanges(db, [...incoming.values()]);
  setState(db, 'cursor', String(cursor));
  // Rows edited while this sync ran have updatedAt > startedAt and go next time.
  setState(db, 'lastPushedAt', startedAt);
  setState(db, 'lastSyncedAt', nowIso());
  return { pushed: pending.length, pulled };
}
