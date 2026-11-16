# 0009. Drizzle ORM on expo-sqlite for local data

- Status: accepted
- Date: 2026-11-16

## Context

Local data (ADR 0005) needs a typed schema, versioned migrations, and repository code that can be tested without a phone.

## Decision

Use Drizzle ORM over expo-sqlite. `drizzle-kit generate` writes SQL migrations to `apps/mobile/drizzle/`; the app applies them at startup with `useMigrations`. Repository functions in `src/db/repo/` take any synchronous Drizzle SQLite database, so Jest runs them against better-sqlite3 in memory using the same migrations. Screens read through `useDbQuery`, which re-runs a query after any write signalled by `notifyChange()`.

## Consequences

Type-safe queries and real SQL tests. Schema changes always go through a generated migration. The change signal re-runs every mounted query after each write, which is cheap for this data size but would need finer-grained invalidation if data grows large.
