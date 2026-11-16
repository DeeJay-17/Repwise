import { DEFAULT_WEIGHT_UNIT, formatWeight, kgToLb, lbToKg, toKg } from './units';

describe('units', () => {
  it('defaults to metric', () => {
    expect(DEFAULT_WEIGHT_UNIT).toBe('kg');
  });

  it('converts between kg and lb', () => {
    expect(kgToLb(100)).toBeCloseTo(220.462, 3);
    expect(lbToKg(45)).toBeCloseTo(20.412, 3);
  });

  it('stores input in kg whatever the display unit', () => {
    expect(toKg(60, 'kg')).toBe(60);
    expect(toKg(135, 'lb')).toBeCloseTo(61.235, 3);
  });

  it('formats to the nearest half unit', () => {
    expect(formatWeight(61.2, 'kg')).toBe('61 kg');
    expect(formatWeight(61.235, 'lb')).toBe('135 lb');
  });
});
