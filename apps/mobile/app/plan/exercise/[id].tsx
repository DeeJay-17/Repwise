import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';

import { getExercise } from '@/catalogue';
import { db } from '@/db/client';
import { useDbQuery } from '@/db/live';
import { getPlannedExercise, removePlannedExercise, updatePlannedExercise } from '@/db/repo/plans';
import type { TargetKind } from '@/domain/types';
import { formatSeconds } from '@/lib/time';
import {
  Button,
  Card,
  ExerciseThumb,
  Field,
  Input,
  Screen,
  Segmented,
  Stepper,
  T,
} from '@/ui/components';
import { space } from '@/ui/theme';

const KINDS = [
  { value: 'reps', label: 'Reps' },
  { value: 'time', label: 'Time' },
] as const satisfies readonly { value: TargetKind; label: string }[];

export default function EditPlannedExerciseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const row = useDbQuery(() => getPlannedExercise(db, id), [id]);
  if (!row) return null;
  const exercise = getExercise(row.exerciseId);
  const isCardio = exercise?.category === 'cardio';
  const set = (patch: Parameters<typeof updatePlannedExercise>[2]) =>
    updatePlannedExercise(db, row.id, patch);

  const remove = () =>
    Alert.alert('Remove this exercise?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          removePlannedExercise(db, row.id);
          router.back();
        },
      },
    ]);

  return (
    <Screen>
      <Stack.Screen options={{ title: exercise?.name ?? 'Exercise' }} />
      <Card onPress={() => router.push(`/exercise/${row.exerciseId}`)}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <ExerciseThumb exerciseId={row.exerciseId} size={72} />
          <View style={{ flex: 1 }}>
            <T variant="heading">{exercise?.name ?? row.exerciseId}</T>
            <T variant="small">Tap for how-to</T>
          </View>
        </View>
      </Card>

      <Card style={{ gap: space.lg }}>
        <Field label="Sets">
          <Stepper value={row.sets} min={1} max={10} onChange={(sets) => set({ sets })} />
        </Field>
        <Field label="Target">
          <Segmented
            options={KINDS}
            value={row.targetKind}
            onChange={(targetKind) =>
              set(
                targetKind === 'time'
                  ? { targetKind, seconds: row.seconds ?? 30 }
                  : { targetKind, minReps: row.minReps ?? 8, maxReps: row.maxReps ?? 12 },
              )
            }
          />
        </Field>
        {row.targetKind === 'reps' ? (
          <>
            <Field label="Min reps">
              <Stepper
                value={row.minReps ?? 8}
                min={1}
                max={row.maxReps ?? 100}
                onChange={(minReps) => set({ minReps })}
              />
            </Field>
            <Field label="Max reps">
              <Stepper
                value={row.maxReps ?? 12}
                min={row.minReps ?? 1}
                max={100}
                onChange={(maxReps) => set({ maxReps })}
              />
            </Field>
          </>
        ) : (
          <Field label="Duration">
            <Stepper
              value={row.seconds ?? 30}
              min={isCardio ? 60 : 5}
              max={3600}
              step={isCardio ? 60 : 15}
              format={formatSeconds}
              onChange={(seconds) => set({ seconds })}
            />
          </Field>
        )}
        <Field label="Rest">
          <Stepper
            value={row.restSeconds}
            min={0}
            max={600}
            step={15}
            format={formatSeconds}
            onChange={(restSeconds) => set({ restSeconds })}
          />
        </Field>
      </Card>

      <Notes key={row.id} id={row.id} notes={row.notes ?? ''} />
      <Button title="Remove from day" variant="danger" onPress={remove} />
    </Screen>
  );
}

function Notes({ id, notes }: { id: string; notes: string }) {
  const [value, setValue] = useState(notes);
  return (
    <View style={{ gap: space.sm }}>
      <T variant="heading">Notes</T>
      <Input
        value={value}
        onChangeText={setValue}
        onEndEditing={() => updatePlannedExercise(db, id, { notes: value.trim() || null })}
        placeholder="e.g. Pause at the bottom"
        accessibilityLabel="Notes"
      />
    </View>
  );
}
