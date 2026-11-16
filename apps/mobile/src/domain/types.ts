/**
 * Core domain vocabulary. The enums mirror packages/contracts/plan.schema.json;
 * src/domain/plan-document.test.ts fails if they drift apart.
 */
export const GOALS = [
  'fat_loss',
  'muscle_gain',
  'strength',
  'general_fitness',
  'endurance',
] as const;
export type Goal = (typeof GOALS)[number];

export const LEVELS = ['beginner', 'intermediate', 'advanced'] as const;
export type Level = (typeof LEVELS)[number];

export const MUSCLE_GROUPS = [
  'chest',
  'back',
  'shoulders',
  'biceps',
  'triceps',
  'forearms',
  'core',
  'glutes',
  'quadriceps',
  'hamstrings',
  'calves',
  'full_body',
] as const;
export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

/** Body areas the user wants plans to go easy on. Used by AI generation in Phase 3. */
export const LIMITATIONS = ['knees', 'lower_back', 'shoulders', 'wrists', 'no_jumping'] as const;
export type Limitation = (typeof LIMITATIONS)[number];

export type PlanSource = 'ai' | 'fallback' | 'manual';
export type TargetKind = 'reps' | 'time';

export const GOAL_LABELS: Record<Goal, string> = {
  fat_loss: 'Lose fat',
  muscle_gain: 'Build muscle',
  strength: 'Get stronger',
  general_fitness: 'General fitness',
  endurance: 'Improve endurance',
};

export const LEVEL_LABELS: Record<Level, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
};

export const MUSCLE_LABELS: Record<MuscleGroup, string> = {
  chest: 'Chest',
  back: 'Back',
  shoulders: 'Shoulders',
  biceps: 'Biceps',
  triceps: 'Triceps',
  forearms: 'Forearms',
  core: 'Core',
  glutes: 'Glutes',
  quadriceps: 'Quads',
  hamstrings: 'Hamstrings',
  calves: 'Calves',
  full_body: 'Full body',
};

export const LIMITATION_LABELS: Record<Limitation, string> = {
  knees: 'Knees',
  lower_back: 'Lower back',
  shoulders: 'Shoulders',
  wrists: 'Wrists',
  no_jumping: 'No jumping',
};
