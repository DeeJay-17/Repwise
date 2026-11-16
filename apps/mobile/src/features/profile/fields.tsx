import { View } from 'react-native';

import {
  GOALS,
  GOAL_LABELS,
  LEVELS,
  LEVEL_LABELS,
  LIMITATIONS,
  LIMITATION_LABELS,
  type Goal,
  type Level,
  type Limitation,
} from '@/domain/types';
import { Card, ChipGroup, Field, Stepper, T } from '@/ui/components';
import { space, useColors } from '@/ui/theme';

const GOAL_HINTS: Record<Goal, string> = {
  fat_loss: 'Burn more, keep muscle',
  muscle_gain: 'Grow size with more volume',
  strength: 'Lift heavier on the big moves',
  general_fitness: 'A bit of everything',
  endurance: 'Go longer, recover faster',
};

export const SESSION_MINUTES = [20, 30, 45, 60, 75, 90] as const;

export function GoalPicker({
  value,
  onChange,
}: {
  value: Goal | null;
  onChange: (g: Goal) => void;
}) {
  const c = useColors();
  return (
    <View style={{ gap: space.sm }}>
      {GOALS.map((g) => (
        <Card
          key={g}
          onPress={() => onChange(g)}
          style={value === g ? { borderWidth: 2, borderColor: c.primary } : undefined}
        >
          <T variant="heading">{GOAL_LABELS[g]}</T>
          <T variant="muted">{GOAL_HINTS[g]}</T>
        </Card>
      ))}
    </View>
  );
}

export function ScheduleFields({
  level,
  daysPerWeek,
  sessionMinutes,
  onChange,
}: {
  level: Level;
  daysPerWeek: number;
  sessionMinutes: number;
  onChange: (patch: { level?: Level; daysPerWeek?: number; sessionMinutes?: number }) => void;
}) {
  return (
    <View style={{ gap: space.xl }}>
      <View style={{ gap: space.sm }}>
        <T variant="heading">Experience</T>
        <ChipGroup
          options={LEVELS.map((l) => ({ value: l, label: LEVEL_LABELS[l] }))}
          isSelected={(l) => l === level}
          onToggle={(l) => onChange({ level: l })}
        />
      </View>
      <Field label="Days per week">
        <Stepper
          value={daysPerWeek}
          min={1}
          max={7}
          onChange={(d) => onChange({ daysPerWeek: d })}
        />
      </Field>
      <View style={{ gap: space.sm }}>
        <T variant="heading">Time per workout</T>
        <ChipGroup
          options={SESSION_MINUTES.map((m) => ({ value: m, label: `${m} min` }))}
          isSelected={(m) => m === sessionMinutes}
          onToggle={(m) => onChange({ sessionMinutes: m })}
        />
      </View>
    </View>
  );
}

export function LimitationsPicker({
  value,
  onChange,
}: {
  value: Limitation[];
  onChange: (next: Limitation[]) => void;
}) {
  return (
    <ChipGroup
      options={LIMITATIONS.map((l) => ({ value: l, label: LIMITATION_LABELS[l] }))}
      isSelected={(l) => value.includes(l)}
      onToggle={(l) => onChange(value.includes(l) ? value.filter((x) => x !== l) : [...value, l])}
    />
  );
}
