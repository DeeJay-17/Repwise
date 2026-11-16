import type { PlanExerciseRow, SetLogRow } from '@/db/schema';
import { formatSeconds } from '@/lib/time';
import { formatWeight, type WeightUnit } from '@/lib/units';

/** "3 x 8-12" or "3 x 0:30", plus rest: "rest 1:30". */
export function formatTarget(
  e: Pick<PlanExerciseRow, 'sets' | 'targetKind' | 'minReps' | 'maxReps' | 'seconds'>,
): string {
  if (e.targetKind === 'time') return `${e.sets} x ${formatSeconds(e.seconds ?? 0)}`;
  const reps = e.minReps === e.maxReps ? `${e.minReps}` : `${e.minReps}-${e.maxReps}`;
  return `${e.sets} x ${reps}`;
}

/** One logged set: "10 x 20 kg", "12 reps", "0:45". */
export function formatSet(
  s: Pick<SetLogRow, 'reps' | 'weightKg' | 'seconds'>,
  unit: WeightUnit,
): string {
  if (s.seconds != null) return formatSeconds(s.seconds);
  const reps = s.reps ?? 0;
  return s.weightKg ? `${reps} x ${formatWeight(s.weightKg, unit)}` : `${reps} reps`;
}
