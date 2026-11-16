import examplePlan from '../../../../packages/contracts/examples/plan.example.json';

import { MUSCLE_GROUPS } from '@/domain/types';

import {
  equipment,
  equipmentImage,
  equipmentPresets,
  exerciseImage,
  exercises,
  filterExercises,
  getExercise,
  isAvailable,
} from './index';

describe('catalogue integrity', () => {
  const equipmentIds = new Set(equipment.map((e) => e.id));

  it('has unique exercise ids', () => {
    expect(new Set(exercises.map((e) => e.id)).size).toBe(exercises.length);
  });

  it('only references known equipment', () => {
    for (const e of exercises) {
      for (const id of e.equipment) expect(equipmentIds).toContain(id);
    }
    for (const p of equipmentPresets) {
      for (const id of p.equipmentIds) expect(equipmentIds).toContain(id);
    }
  });

  it('only uses muscle groups from the plan contract', () => {
    for (const e of exercises) {
      for (const m of [...e.primaryMuscles, ...e.secondaryMuscles]) {
        expect(MUSCLE_GROUPS).toContain(m);
      }
    }
  });

  it('has an image for every exercise and equipment item', () => {
    for (const e of exercises) expect(exerciseImage(e.id)).toBeDefined();
    for (const e of equipment) expect(equipmentImage(e.id)).toBeDefined();
  });

  it('knows every exercise used in the contract example', () => {
    for (const day of examplePlan.days) {
      for (const pe of day.exercises) expect(getExercise(pe.exerciseId)).toBeDefined();
    }
  });
});

describe('availability', () => {
  it('offers bodyweight exercises with no equipment', () => {
    const list = filterExercises({ equipmentIds: [] });
    expect(list.length).toBeGreaterThan(15);
    expect(list.every((e) => e.equipment.length === 0)).toBe(true);
  });

  it('needs every listed item', () => {
    const bench = getExercise('dumbbell_bench_press')!;
    expect(isAvailable(bench, ['dumbbells'])).toBe(false);
    expect(isAvailable(bench, ['dumbbells', 'flat_bench'])).toBe(true);
  });

  it('gives treadmill-only users treadmill work plus bodyweight', () => {
    const ids = filterExercises({ equipmentIds: ['treadmill'] }).map((e) => e.id);
    expect(ids).toContain('treadmill_incline_walk');
    expect(ids).toContain('push_up');
    expect(ids).not.toContain('dumbbell_curl');
  });

  it('filters by muscle and search text', () => {
    const list = filterExercises({
      equipmentIds: ['dumbbells'],
      muscle: 'biceps',
      query: 'hammer',
    });
    expect(list.map((e) => e.id)).toEqual(['hammer_curl']);
  });

  it('gives every preset at least one exercise per major muscle group', () => {
    for (const preset of equipmentPresets) {
      const available = filterExercises({ equipmentIds: preset.equipmentIds });
      for (const m of ['chest', 'back', 'quadriceps', 'core'] as const) {
        const hit = available.some((e) => e.primaryMuscles.includes(m));
        if (!hit) throw new Error(`${preset.id} has no ${m} exercise`);
      }
    }
  });
});
