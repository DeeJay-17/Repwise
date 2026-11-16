import type { SetLogRow } from '@/db/schema';
import { lbToKg, type WeightUnit } from '@/lib/units';

/** Weight jump suggested when the user has outgrown the rep range, in their unit. */
const STEP: Record<WeightUnit, number> = { kg: 2.5, lb: 5 };

/**
 * If every set last time reached the top of the rep range with weight on the bar,
 * suggest the next weight (in kg). Otherwise undefined.
 */
export function suggestNextWeightKg(
  last: Pick<SetLogRow, 'reps' | 'weightKg'>[],
  plannedSets: number,
  targetMaxReps: number | null,
  unit: WeightUnit,
): number | undefined {
  if (!targetMaxReps || last.length < plannedSets) return undefined;
  if (!last.every((s) => (s.reps ?? 0) >= targetMaxReps && (s.weightKg ?? 0) > 0)) return undefined;
  const top = Math.max(...last.map((s) => s.weightKg ?? 0));
  return top + (unit === 'kg' ? STEP.kg : lbToKg(STEP.lb));
}

const PLATES_KG = [25, 20, 15, 10, 5, 2.5, 1.25] as const;
export const BAR_KG = 20;

export interface PlateLoad {
  /** Plates for one side of the bar, heaviest first. */
  perSide: number[];
  /** Weight that cannot be made with the plates, per side. */
  remainder: number;
}

/** Plates per side for a barbell weight in kg (20 kg bar). Undefined at or below the bar. */
export function platesFor(totalKg: number): PlateLoad | undefined {
  if (totalKg <= BAR_KG) return undefined;
  let side = (totalKg - BAR_KG) / 2;
  const perSide: number[] = [];
  for (const plate of PLATES_KG) {
    while (side >= plate - 1e-6) {
      perSide.push(plate);
      side -= plate;
    }
  }
  return { perSide, remainder: Math.round(side * 100) / 100 };
}
