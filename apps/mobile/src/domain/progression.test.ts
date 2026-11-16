import { platesFor, suggestNextWeightKg } from './progression';

describe('progression', () => {
  const sets = (reps: number, kg: number, n = 3) =>
    Array.from({ length: n }, () => ({ reps, weightKg: kg }));

  it('suggests more weight only when every set hit the top of the range', () => {
    expect(suggestNextWeightKg(sets(12, 20), 3, 12, 'kg')).toBe(22.5);
    expect(
      suggestNextWeightKg([...sets(12, 20, 2), { reps: 10, weightKg: 20 }], 3, 12, 'kg'),
    ).toBeUndefined();
    expect(suggestNextWeightKg(sets(12, 20, 2), 3, 12, 'kg')).toBeUndefined();
    expect(suggestNextWeightKg(sets(12, 0), 3, 12, 'kg')).toBeUndefined();
    expect(suggestNextWeightKg(sets(12, 20), 3, 12, 'lb')).toBeCloseTo(22.27, 2);
  });

  it('works out plates per side', () => {
    expect(platesFor(20)).toBeUndefined();
    expect(platesFor(100)).toEqual({ perSide: [25, 15], remainder: 0 });
    expect(platesFor(62.5)).toEqual({ perSide: [20, 1.25], remainder: 0 });
    expect(platesFor(61)).toEqual({ perSide: [20], remainder: 0.5 });
  });
});
