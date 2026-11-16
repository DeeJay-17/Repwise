import type { PlanTree } from '@/db/repo/plans';
import type { ProfileRow } from '@/db/schema';
import type { AiSettings } from '@/features/ai/settings';
import type { GenerateRequest } from '@/api/ai';

import type { Goal, MuscleGroup, PlanSource } from './types';

type Target =
  { kind: 'reps'; minReps: number; maxReps: number } | { kind: 'time'; seconds: number };

/** A plan in the shared contract format (packages/contracts/plan.schema.json). */
export interface PlanDocument {
  schemaVersion: '1.0';
  id: string;
  name: string;
  source: PlanSource;
  goal: Goal;
  daysPerWeek: number;
  sessionMinutes: number;
  focusMuscles: MuscleGroup[];
  days: {
    dayIndex: number;
    name: string;
    exercises: {
      exerciseId: string;
      order: number;
      sets: number;
      target: Target;
      restSeconds: number;
      notes?: string;
    }[];
  }[];
  createdAt: string;
}

/** Convert a stored plan to the contract format. Days with no exercises are left out. */
export function toPlanDocument({ plan, days }: PlanTree): PlanDocument {
  return {
    schemaVersion: '1.0',
    id: plan.id,
    name: plan.name,
    source: plan.source,
    goal: plan.goal,
    daysPerWeek: plan.daysPerWeek,
    sessionMinutes: plan.sessionMinutes,
    focusMuscles: plan.focusMuscles,
    days: days
      .filter((d) => d.exercises.length > 0)
      .map((d) => ({
        dayIndex: d.dayIndex,
        name: d.name,
        exercises: d.exercises.map((e) => ({
          exerciseId: e.exerciseId,
          order: e.position,
          sets: e.sets,
          target:
            e.targetKind === 'time'
              ? { kind: 'time' as const, seconds: e.seconds ?? 30 }
              : { kind: 'reps' as const, minReps: e.minReps ?? 8, maxReps: e.maxReps ?? 12 },
          restSeconds: e.restSeconds,
          ...(e.notes ? { notes: e.notes } : {}),
        })),
      })),
    createdAt: plan.createdAt,
  };
}

/** Build the AI service request from the stored profile and the user's provider settings. */
export function buildGenerateRequest(
  profile: ProfileRow,
  ai: AiSettings,
  focusMuscles: MuscleGroup[],
  previousPlan?: PlanDocument,
): GenerateRequest {
  return {
    provider: ai.provider,
    model: ai.model,
    profile: {
      goal: profile.goal,
      level: profile.level,
      daysPerWeek: profile.daysPerWeek,
      sessionMinutes: profile.sessionMinutes,
      limitations: profile.limitations,
      equipmentIds: profile.equipmentIds,
    },
    focusMuscles,
    ...(previousPlan ? { previousPlan } : {}),
  };
}
