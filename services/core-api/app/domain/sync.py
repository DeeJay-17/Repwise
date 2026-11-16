"""Sync: last write wins per row, changes pulled in server order with a cursor.

Every accepted change takes the user's next sequence number. A device sends its cursor
(the highest number it has seen) and gets back everything after it. All of this runs in
one transaction with the user's counter row locked, so two devices syncing at once are
handled one after the other.
"""

import json

from sqlalchemy import Connection, and_, insert, select, update

from app.db.schema import sync_counters, sync_records
from app.models import Change, SyncRequest, SyncResponse

MAX_RECORD_BYTES = 16_384


class RecordTooLargeError(Exception):
    pass


def _lock_counter(conn: Connection, user_id: str) -> int:
    """Lock the user's counter row (creating it if needed) and return its value."""
    row = conn.execute(
        select(sync_counters.c.last_seq).where(sync_counters.c.user_id == user_id).with_for_update()
    ).first()
    if row is None:
        conn.execute(insert(sync_counters).values(user_id=user_id, last_seq=0))
        return 0
    return int(row.last_seq)


def _apply(conn: Connection, user_id: str, change: Change, seq: int) -> bool:
    """Store a change if it is newer than the server's copy. Returns whether it was kept."""
    if len(json.dumps(change.data)) > MAX_RECORD_BYTES:
        raise RecordTooLargeError(
            f"{change.entity}/{change.id} is larger than {MAX_RECORD_BYTES} bytes"
        )
    key = and_(
        sync_records.c.user_id == user_id,
        sync_records.c.entity == change.entity,
        sync_records.c.record_id == change.id,
    )
    existing = conn.execute(select(sync_records.c.updated_at).where(key)).first()
    values = {
        "data": change.data,
        "updated_at": change.updatedAt,
        "deleted_at": change.deletedAt,
        "seq": seq,
    }
    if existing is None:
        conn.execute(
            insert(sync_records).values(
                user_id=user_id, entity=change.entity, record_id=change.id, **values
            )
        )
        return True
    if change.updatedAt > existing.updated_at:
        conn.execute(update(sync_records).where(key).values(**values))
        return True
    return False


def sync(conn: Connection, user_id: str, request: SyncRequest, page_size: int) -> SyncResponse:
    last_seq = _lock_counter(conn, user_id)

    rows = conn.execute(
        select(sync_records)
        .where(sync_records.c.user_id == user_id, sync_records.c.seq > request.cursor)
        .order_by(sync_records.c.seq)
        .limit(page_size + 1)
    ).all()
    has_more = len(rows) > page_size
    rows = rows[:page_size]
    pulled = [
        Change(
            entity=r.entity,
            id=r.record_id,
            updatedAt=r.updated_at,
            deletedAt=r.deleted_at,
            data=r.data,
        )
        for r in rows
    ]

    accepted = 0
    for change in request.changes:
        if _apply(conn, user_id, change, last_seq + 1):
            last_seq += 1
            accepted += 1
    conn.execute(
        update(sync_counters).where(sync_counters.c.user_id == user_id).values(last_seq=last_seq)
    )

    # With everything pulled, the cursor can skip past this device's own pushes.
    cursor = last_seq if not has_more else rows[-1].seq
    return SyncResponse(cursor=cursor, changes=pulled, hasMore=has_more, accepted=accepted)
