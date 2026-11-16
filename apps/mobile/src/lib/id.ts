import { randomUUID } from 'expo-crypto';

/** New UUID v4 for any database row. */
export function newId(): string {
  return randomUUID();
}
