import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';

import type * as schema from './schema';

/**
 * Any synchronous Drizzle SQLite database with our schema. The app uses expo-sqlite;
 * tests use better-sqlite3 in memory. Repository functions take this type so both work.
 */
export type Db = BaseSQLiteDatabase<'sync', any, typeof schema>;
