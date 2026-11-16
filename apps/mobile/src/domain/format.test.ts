import { formatSet, formatTarget } from './format';

describe('format', () => {
  it('describes targets', () => {
    expect(
      formatTarget({ sets: 3, targetKind: 'reps', minReps: 8, maxReps: 12, seconds: null }),
    ).toBe('3 x 8-12');
    expect(
      formatTarget({ sets: 5, targetKind: 'reps', minReps: 5, maxReps: 5, seconds: null }),
    ).toBe('5 x 5');
    expect(
      formatTarget({ sets: 1, targetKind: 'time', minReps: null, maxReps: null, seconds: 600 }),
    ).toBe('1 x 10:00');
  });

  it('describes logged sets in the chosen unit', () => {
    expect(formatSet({ reps: 10, weightKg: 20, seconds: null }, 'kg')).toBe('10 x 20 kg');
    expect(formatSet({ reps: 10, weightKg: 20, seconds: null }, 'lb')).toBe('10 x 44 lb');
    expect(formatSet({ reps: 12, weightKg: null, seconds: null }, 'kg')).toBe('12 reps');
    expect(formatSet({ reps: null, weightKg: null, seconds: 45 }, 'kg')).toBe('0:45');
  });
});
