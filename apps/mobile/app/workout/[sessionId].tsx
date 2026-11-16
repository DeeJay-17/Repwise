import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';

import { getExercise } from '@/catalogue';
import { db } from '@/db/client';
import { useDbQuery } from '@/db/live';
import { getProfile } from '@/db/repo/profile';
import {
  addSet,
  discardSession,
  finishSession,
  getSessionDetail,
  lastPerformance,
  removeSet,
  updateSet,
  type SessionExercise,
} from '@/db/repo/sessions';
import type { SetLogRow } from '@/db/schema';
import { formatSet } from '@/domain/format';
import { formatSeconds } from '@/lib/time';
import { kgToLb, toKg, type WeightUnit } from '@/lib/units';
import { Button, Card, ExerciseThumb, Input, Screen, T } from '@/ui/components';
import { radius, space, useColors } from '@/ui/theme';

export default function WorkoutScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const detail = useDbQuery(() => getSessionDetail(db, sessionId), [sessionId]);
  const unit = useDbQuery(() => getProfile(db)?.weightUnit ?? 'kg');
  if (!detail) return null;

  const allSets = detail.exercises.flatMap((e) => e.sets);
  const done = allSets.filter((s) => s.completed).length;

  const finish = () => {
    const save = () => {
      finishSession(db, sessionId);
      router.replace(`/history/${sessionId}`);
    };
    if (done === 0) {
      Alert.alert('No sets completed', 'Tick off at least one set, or discard this workout.');
      return;
    }
    if (done < allSets.length) {
      Alert.alert('Finish workout?', `${allSets.length - done} sets are not ticked off.`, [
        { text: 'Keep going', style: 'cancel' },
        { text: 'Finish', onPress: save },
      ]);
      return;
    }
    save();
  };

  const discard = () =>
    Alert.alert('Discard this workout?', 'Nothing from it will be saved.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Discard',
        style: 'destructive',
        onPress: () => {
          discardSession(db, sessionId);
          router.back();
        },
      },
    ]);

  return (
    <Screen
      footer={
        <View style={{ gap: space.sm }}>
          <Button
            title={`Finish workout (${done}/${allSets.length})`}
            icon="checkmark"
            onPress={finish}
          />
          <Button title="Discard" variant="danger" onPress={discard} />
        </View>
      }
    >
      <Stack.Screen options={{ title: detail.session.name }} />
      {detail.exercises.map((e) => (
        <ExerciseCard
          key={`${e.position}-${e.exerciseId}`}
          item={e}
          sessionId={sessionId}
          unit={unit}
        />
      ))}
    </Screen>
  );
}

function ExerciseCard({
  item,
  sessionId,
  unit,
}: {
  item: SessionExercise;
  sessionId: string;
  unit: WeightUnit;
}) {
  const exercise = getExercise(item.exerciseId);
  const last = useDbQuery(
    () => lastPerformance(db, item.exerciseId, sessionId),
    [item.exerciseId, sessionId],
  );
  const first = item.sets[0];
  const target =
    first?.targetKind === 'time'
      ? `Target ${formatSeconds(first.targetSeconds ?? 0)} per set`
      : first
        ? `Target ${first.targetMinReps}-${first.targetMaxReps} reps`
        : '';

  return (
    <Card>
      <Pressable
        onPress={() => router.push(`/exercise/${item.exerciseId}`)}
        style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}
      >
        <ExerciseThumb exerciseId={item.exerciseId} size={48} />
        <View style={{ flex: 1 }}>
          <T variant="heading" numberOfLines={1}>
            {exercise?.name ?? item.exerciseId}
          </T>
          <T variant="small">{target}</T>
        </View>
      </Pressable>
      {last.length > 0 ? (
        <T variant="small">Last time: {last.map((s) => formatSet(s, unit)).join(', ')}</T>
      ) : null}
      {item.sets.map((s) => (
        <SetRow key={s.id} set={s} unit={unit} isCardio={exercise?.category === 'cardio'} />
      ))}
      <Button
        title="Add set"
        variant="ghost"
        icon="add"
        onPress={() => addSet(db, sessionId, item.position)}
      />
    </Card>
  );
}

/** Display a stored kg value in the user's unit, without trailing noise. */
function toDisplay(kg: number | null, unit: WeightUnit): string {
  if (kg == null) return '';
  const value = unit === 'kg' ? kg : kgToLb(kg);
  return String(Math.round(value * 10) / 10);
}

function parseNumber(text: string): number | null {
  const n = Number(text.replace(',', '.'));
  return text.trim() === '' || Number.isNaN(n) ? null : n;
}

function SetRow({ set, unit, isCardio }: { set: SetLogRow; unit: WeightUnit; isCardio: boolean }) {
  const c = useColors();
  const timed = set.targetKind === 'time';
  const [weight, setWeight] = useState(toDisplay(set.weightKg, unit));
  const [amount, setAmount] = useState(
    timed ? (set.seconds?.toString() ?? '') : (set.reps?.toString() ?? ''),
  );

  const saveFields = (completed = set.completed) => {
    const w = parseNumber(weight);
    const a = parseNumber(amount);
    updateSet(db, set.id, {
      weightKg: w == null ? null : toKg(w, unit),
      ...(timed
        ? { seconds: a == null ? null : Math.round(a) }
        : { reps: a == null ? null : Math.round(a) }),
      completed,
    });
  };

  const toggle = () => {
    // Ticking an empty set counts it as done at the target.
    if (!set.completed && amount.trim() === '') {
      const fill = timed ? set.targetSeconds : set.targetMaxReps;
      if (fill != null) {
        setAmount(String(fill));
        updateSet(
          db,
          set.id,
          timed ? { seconds: fill, completed: true } : { reps: fill, completed: true },
        );
        if (weight.trim() !== '') saveFields(true);
        return;
      }
    }
    saveFields(!set.completed);
  };

  const confirmRemove = () =>
    Alert.alert(`Remove set ${set.setNumber}?`, undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => removeSet(db, set.id) },
    ]);

  return (
    <Pressable
      onLongPress={confirmRemove}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.sm,
        padding: space.xs,
        borderRadius: radius.sm,
        backgroundColor: set.completed ? c.successSoft : 'transparent',
      }}
    >
      <T variant="muted" style={{ width: 28, textAlign: 'center' }}>
        {set.setNumber}
      </T>
      {!isCardio ? (
        <Input
          value={weight}
          onChangeText={setWeight}
          onEndEditing={() => saveFields()}
          placeholder={timed ? '—' : 'BW'}
          keyboardType="decimal-pad"
          accessibilityLabel={`Set ${set.setNumber} weight in ${unit}`}
          style={{ flex: 1, textAlign: 'center' }}
        />
      ) : null}
      {!isCardio ? <T variant="small">{unit}</T> : null}
      <Input
        value={amount}
        onChangeText={setAmount}
        onEndEditing={() => saveFields()}
        placeholder={timed ? String(set.targetSeconds ?? '') : String(set.targetMaxReps ?? '')}
        keyboardType="number-pad"
        accessibilityLabel={`Set ${set.setNumber} ${timed ? 'seconds' : 'reps'}`}
        style={{ flex: 1, textAlign: 'center' }}
      />
      <T variant="small">{timed ? 'sec' : 'reps'}</T>
      <Pressable
        onPress={toggle}
        hitSlop={8}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: set.completed }}
        accessibilityLabel={`Set ${set.setNumber} done`}
      >
        <Ionicons
          name={set.completed ? 'checkmark-circle' : 'ellipse-outline'}
          size={32}
          color={set.completed ? c.success : c.muted}
        />
      </Pressable>
    </Pressable>
  );
}
