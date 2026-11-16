import { eq } from 'drizzle-orm';

import type { Goal, Level, Limitation } from '@/domain/types';
import { nowIso } from '@/lib/time';
import type { WeightUnit } from '@/lib/units';

import { notifyChange } from '../live';
import { profile, type ProfileRow } from '../schema';
import type { Db } from '../types';

const PROFILE_ID = 'me';

export interface ProfileInput {
  goal: Goal;
  level: Level;
  daysPerWeek: number;
  sessionMinutes: number;
  limitations: Limitation[];
  equipmentIds: string[];
  weightUnit: WeightUnit;
}

export function getProfile(db: Db): ProfileRow | undefined {
  return db.select().from(profile).where(eq(profile.id, PROFILE_ID)).get();
}

/** Create the profile, or replace every field of the existing one. */
export function saveProfile(db: Db, input: ProfileInput): void {
  const now = nowIso();
  db.insert(profile)
    .values({ id: PROFILE_ID, ...input, createdAt: now, updatedAt: now })
    .onConflictDoUpdate({ target: profile.id, set: { ...input, updatedAt: now } })
    .run();
  notifyChange();
}

export function updateProfile(db: Db, patch: Partial<ProfileInput>): void {
  db.update(profile)
    .set({ ...patch, updatedAt: nowIso() })
    .where(eq(profile.id, PROFILE_ID))
    .run();
  notifyChange();
}
