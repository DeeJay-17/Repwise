import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync } from 'expo-sqlite';

import * as schema from './schema';
import type { Db } from './types';

const sqlite = openDatabaseSync('repwise.db');
sqlite.execSync('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');

/** The app's single database connection. */
export const db: Db = drizzle(sqlite, { schema });
