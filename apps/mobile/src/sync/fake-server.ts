/**
 * An in-memory stand-in for the core API's /v1/sync, with the same rules (newest
 * updatedAt wins, per-user sequence, paging). Only for tests.
 */
import type { SyncChange, SyncRequest, SyncResponse } from '@/api/core';

import type { SyncTransport } from './engine';

export function createFakeSyncServer(pageSize = 500) {
  let lastSeq = 0;
  const records = new Map<string, SyncChange & { seq: number }>();

  function sync(body: SyncRequest): Promise<SyncResponse> {
    const after = [...records.values()]
      .filter((r) => r.seq > (body.cursor ?? 0))
      .sort((a, b) => a.seq - b.seq);
    const page = after.slice(0, pageSize);
    const hasMore = after.length > pageSize;
    let accepted = 0;
    for (const c of body.changes ?? []) {
      const key = `${c.entity}/${c.id}`;
      const existing = records.get(key);
      if (!existing || c.updatedAt > existing.updatedAt) {
        records.set(key, { ...c, seq: ++lastSeq });
        accepted += 1;
      }
    }
    const changes = page.map(({ seq: _seq, ...c }) => c);
    return Promise.resolve({
      cursor: hasMore ? page.at(-1)!.seq : lastSeq,
      changes,
      hasMore,
      accepted,
    });
  }

  return { transport: { sync } satisfies SyncTransport, records };
}
