/**
 * Weight units. Everything is stored in kilograms; pounds are only for display and input.
 */
export type WeightUnit = 'kg' | 'lb';

export const DEFAULT_WEIGHT_UNIT: WeightUnit = 'kg';

const KG_PER_LB = 0.45359237;

export function kgToLb(kg: number): number {
  return kg / KG_PER_LB;
}

export function lbToKg(lb: number): number {
  return lb * KG_PER_LB;
}

/** Convert a value the user typed in their chosen unit into kilograms for storage. */
export function toKg(value: number, unit: WeightUnit): number {
  return unit === 'kg' ? value : lbToKg(value);
}

/** Format a stored kilogram value for display, rounded to the nearest 0.5 in the chosen unit. */
export function formatWeight(kg: number, unit: WeightUnit): string {
  const value = unit === 'kg' ? kg : kgToLb(kg);
  const rounded = Math.round(value * 2) / 2;
  return `${rounded} ${unit}`;
}
