/**
 * @jest-environment node
 */
import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';

import schema from '../../../../packages/contracts/plan.schema.json';
import { addPlannedExercise, createPlan, defaultTarget, getPlanTree } from '../db/repo/plans';
import { createTestDb } from '../db/testing';

import { toPlanDocument } from './plan-document';
import { GOALS, MUSCLE_GROUPS } from './types';

const ajv = new Ajv2020({ allErrors: true });
addFormats(ajv);
const validate = ajv.compile(schema);

describe('plan document', () => {
  it('exports a stored plan that matches the shared contract', () => {
    const db = createTestDb();
    const planId = createPlan(db, {
      name: 'Treadmill and bodyweight',
      goal: 'fat_loss',
      daysPerWeek: 2,
      sessionMinutes: 40,
      focusMuscles: ['glutes'],
    });
    const [day1, day2] = getPlanTree(db, planId)!.days;
    addPlannedExercise(db, day1!.id, 'treadmill_incline_walk', defaultTarget('time', true));
    addPlannedExercise(db, day1!.id, 'push_up', defaultTarget('reps', false));
    addPlannedExercise(db, day2!.id, 'plank', defaultTarget('time', false));

    const doc = toPlanDocument(getPlanTree(db, planId)!);
    const valid = validate(doc);
    expect(validate.errors ?? []).toEqual([]);
    expect(valid).toBe(true);
    expect(doc.days[0]!.exercises[0]!.target).toEqual({ kind: 'time', seconds: 600 });
  });

  it('uses the same goal and muscle enums as the contract', () => {
    expect([...GOALS]).toEqual(schema.$defs.goal.enum);
    expect([...MUSCLE_GROUPS]).toEqual(schema.$defs.muscleGroup.enum);
  });
});
