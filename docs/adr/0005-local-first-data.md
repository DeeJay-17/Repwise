# 0005. Local-first data on the phone

- Status: accepted
- Date: 2026-11-16

## Context

Guest users have no account, and workouts happen in gyms with poor signal.

## Decision

The phone's SQLite database is the source of truth in every mode. Signed-in users sync to PostgreSQL through core-api: each row has a UUID, an updated-at time and a deleted flag, and the newest change wins. The equipment and exercise catalogue ships inside the app.

## Consequences

The app works fully offline. Sync is simple and good enough for one person on a few devices; simultaneous edits to the same row on two devices keep only the later one.
