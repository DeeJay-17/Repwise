import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';

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
  setSessionDate,
  updateSet,
  type LastPerformance,
  type SessionExercise,
} from '@/db/repo/sessions';
import type { SetLogRow } from '@/db/schema';
import { addDays, dateKey, dateKeyOf } from '@/domain/calendar';
import { dayColor } from '@/domain/day-colors';
import { formatSet } from '@/domain/format';
import { platesFor, suggestNextWeightKg } from '@/domain/progression';
import { formatDay, formatSeconds } from '@/lib/time';
import { formatWeight, kgToLb, toKg, type WeightUnit } from '@/lib/units';
import { PlateDot } from '@/features/tracking/PlateDot';
import { RestTimerBar, useRestTimer } from '@/features/tracking/RestTimer';
import { Button, Card, ExerciseThumb, Input, Screen, T } from '@/ui/components';
import { radius, space, useColors } from '@/ui/theme';

export default function WorkoutScreen() {
  const c = useColors();
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const detail = useDbQuery(() => getSessionDetail(db, sessionId), [sessionId]);
  const unit = useDbQuery(() => getProfile(db)?.weightUnit ?? 'kg');
  const timer = useRestTimer();
  if (!detail) return null;

  const { session } = detail;
  const allSets = detail.exercises.flatMap((e) => e.sets);
  const done = allSets.filter((s) => s.completed).length;
  const started = new Date(session.startedAt);
  const isToday = dateKeyOf(session.startedAt) === dateKey(new Date());

  const finish = () => {
    const save = () => {
      timer.stop();
      finishSession(db, sessionId);
      router.replace({ pathname: '/today', params: { finished: sessionId } });
    };
    if (done === 0) {
      Alert.alert(
        'No sets ticked',
        'Tick at least one set before finishing, or discard this workout.',
      );
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
          timer.stop();
          discardSession(db, sessionId);
          router.back();
        },
      },
    ]);

  const labelAfter = (exerciseIndex: number, item: SessionExercise, setId: string) => {
    const remaining = item.sets.filter((s) => !s.completed && s.id !== setId);
    if (remaining.length)
      return `${getExercise(item.exerciseId)?.name ?? ''}, set ${remaining[0]!.setNumber}`;
    const nextEx = detail.exercises[exerciseIndex + 1];
    return nextEx ? (getExercise(nextEx.exerciseId)?.name ?? 'next exercise') : 'finish up';
  };

  return (
    <Screen
      footer={
        timer.rest ? (
          <RestTimerBar rest={timer.rest} onAdd={() => timer.add(15)} onSkip={timer.stop} />
        ) : undefined
      }
    >
      <Stack.Screen options={{ title: 'Workout' }} />
      <View style={{ gap: space.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <PlateDot color={dayColor(detail.dayIndex)} size={22} />
          <Text
            style={{
              color: c.text,
              fontSize: 34,
              fontWeight: '800',
              textTransform: 'uppercase',
              flex: 1,
            }}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {session.name}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <Pressable
            accessibilityLabel="Previous day"
            hitSlop={8}
            onPress={() => setSessionDate(db, sessionId, addDays(started, -1))}
          >
            <Ionicons name="chevron-back" size={20} color={c.muted} />
          </Pressable>
          <T variant="muted" style={{ fontWeight: '600' }}>
            {isToday ? 'Today' : formatDay(session.startedAt)}
          </T>
          <Pressable
            accessibilityLabel="Next day"
            hitSlop={8}
            disabled={isToday}
            onPress={() => setSessionDate(db, sessionId, addDays(started, 1))}
            style={{ opacity: isToday ? 0.3 : 1 }}
          >
            <Ionicons name="chevron-forward" size={20} color={c.muted} />
          </Pressable>
          <T variant="muted" style={{ marginLeft: 'auto' }}>
            {done} of {allSets.length} sets
          </T>
        </View>
        <View style={{ height: 6, backgroundColor: c.border, borderRadius: 3, overflow: 'hidden' }}>
          <View
            style={{
              height: 6,
              width: `${allSets.length ? (done / allSets.length) * 100 : 0}%`,
              backgroundColor: c.success,
            }}
          />
        </View>
      </View>

      {detail.exercises.map((e, i) => (
        <ExerciseCard
          key={`${e.position}-${e.exerciseId}`}
          item={e}
          sessionId={sessionId}
          unit={unit}
          onTicked={(set) =>
            timer.start(
              set.targetRestSeconds ?? (set.targetKind === 'time' ? 45 : 90),
              labelAfter(i, e, set.id),
            )
          }
        />
      ))}

      <T variant="small">
        Tap ✓ on an empty set to copy last session&apos;s numbers. Ticking a set starts the rest
        timer.
      </T>
      <Button title={`Finish ${session.name}`} icon="checkmark" onPress={finish} />
      <Button title="Discard this workout" variant="danger" onPress={discard} />
    </Screen>
  );
}

function ExerciseCard({
  item,
  sessionId,
  unit,
  onTicked,
}: {
  item: SessionExercise;
  sessionId: string;
  unit: WeightUnit;
  onTicked: (set: SetLogRow) => void;
}) {
  const c = useColors();
  const exercise = getExercise(item.exerciseId);
  const last = useDbQuery(
    () => lastPerformance(db, item.exerciseId, sessionId),
    [item.exerciseId, sessionId],
  );
  const first = item.sets[0];
  const timed = first?.targetKind === 'time';
  const isCardio = exercise?.category === 'cardio';
  const usesBarbell = exercise?.equipment.includes('barbell') ?? false;
  const target = !first
    ? ''
    : timed
      ? `${item.sets.length} × ${formatSeconds(first.targetSeconds ?? 0)}`
      : `${item.sets.length} × ${first.targetMinReps === first.targetMaxReps ? first.targetMinReps : `${first.targetMinReps}–${first.targetMaxReps}`}`;
  const suggestion =
    !timed && last
      ? suggestNextWeightKg(last.sets, item.sets.length, first?.targetMaxReps ?? null, unit)
      : undefined;
  const barKg =
    item.sets.map((s) => s.weightKg).findLast((w): w is number => w != null) ??
    last?.sets[0]?.weightKg ??
    null;
  const plates = usesBarbell && unit === 'kg' && barKg ? platesFor(barKg) : undefined;

  return (
    <Card>
      <Pressable
        onPress={() => router.push(`/exercise/${item.exerciseId}`)}
        style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}
      >
        <ExerciseThumb exerciseId={item.exerciseId} size={44} />
        <T variant="heading" style={{ flex: 1 }} numberOfLines={2}>
          {exercise?.name ?? item.exerciseId}
        </T>
        <Text style={{ color: c.text, fontSize: 19, fontWeight: '800' }}>{target}</Text>
      </Pressable>
      {last ? (
        <T variant="small">
          Last ·{' '}
          <Text style={{ color: c.text, fontWeight: '600' }}>
            {last.sets.map((s) => formatSet(s, unit)).join(', ')}
          </Text>{' '}
          ({formatDay(last.startedAt)})
        </T>
      ) : null}
      {suggestion ? (
        <View
          style={{ backgroundColor: c.primarySoft, borderRadius: radius.sm, padding: space.sm }}
        >
          <T variant="small" style={{ color: c.text }}>
            You hit {first?.targetMaxReps} reps on every set last time.{' '}
            <Text style={{ color: c.primary, fontWeight: '700' }}>
              Try {formatWeight(suggestion, unit)}
            </Text>{' '}
            today.
          </T>
        </View>
      ) : null}

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.sm,
          paddingHorizontal: space.xs,
        }}
      >
        <Text style={headerStyle(c.muted, 28)}>SET</Text>
        {!isCardio ? <Text style={headerStyle(c.muted)}>{unit.toUpperCase()}</Text> : null}
        <Text style={headerStyle(c.muted)}>{timed ? 'SEC' : 'REPS'}</Text>
        <View style={{ width: 44 }} />
      </View>
      {item.sets.map((s, i) => (
        <SetRow
          key={s.id}
          set={s}
          previous={last?.sets[i] ?? last?.sets.at(-1)}
          unit={unit}
          isCardio={isCardio}
          canRemove={item.sets.length > 1}
          onTicked={onTicked}
        />
      ))}

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        {plates ? (
          <T variant="small">
            {plates.perSide.join(' + ')}
            {plates.remainder ? ` (+${plates.remainder})` : ''} kg per side
          </T>
        ) : usesBarbell && unit === 'kg' && barKg && barKg <= 20 ? (
          <T variant="small">Empty bar is 20 kg</T>
        ) : (
          <View />
        )}
        <Button
          title="Add set"
          variant="ghost"
          icon="add"
          onPress={() => addSet(db, sessionId, item.position)}
        />
      </View>
    </Card>
  );
}

function headerStyle(color: string, width?: number) {
  return {
    color,
    fontSize: 11,
    fontWeight: '700' as const,
    letterSpacing: 0.8,
    textAlign: 'center' as const,
    ...(width ? { width } : { flex: 1 }),
  };
}

/** Display a stored kg value in the user's unit, without trailing noise. */
function toDisplay(kg: number | null | undefined, unit: WeightUnit): string {
  if (kg == null) return '';
  const value = unit === 'kg' ? kg : kgToLb(kg);
  return String(Math.round(value * 10) / 10);
}

function parseNumber(text: string): number | null {
  const n = Number(text.replace(',', '.'));
  return text.trim() === '' || Number.isNaN(n) ? null : n;
}

function SetRow({
  set,
  previous,
  unit,
  isCardio,
  canRemove,
  onTicked,
}: {
  set: SetLogRow;
  previous: LastPerformance['sets'][number] | undefined;
  unit: WeightUnit;
  isCardio: boolean;
  canRemove: boolean;
  onTicked: (set: SetLogRow) => void;
}) {
  const c = useColors();
  const timed = set.targetKind === 'time';
  const [weight, setWeight] = useState(toDisplay(set.weightKg, unit));
  const [amount, setAmount] = useState(
    timed ? (set.seconds?.toString() ?? '') : (set.reps?.toString() ?? ''),
  );

  const targetText = timed
    ? String(set.targetSeconds ?? '')
    : set.targetMinReps === set.targetMaxReps
      ? String(set.targetMinReps ?? '')
      : `${set.targetMinReps}–${set.targetMaxReps}`;
  const weightHint = toDisplay(previous?.weightKg, unit);
  const amountHint = (timed ? previous?.seconds : previous?.reps)?.toString() ?? targetText;

  const save = (w: string, a: string, completed: boolean) => {
    const kg = parseNumber(w);
    const n = parseNumber(a);
    updateSet(db, set.id, {
      weightKg: kg == null ? null : toKg(kg, unit),
      ...(timed
        ? { seconds: n == null ? null : Math.round(n) }
        : { reps: n == null ? null : Math.round(n) }),
      completed,
    });
  };

  const toggle = () => {
    if (set.completed) {
      save(weight, amount, false);
      return;
    }
    // Empty fields take last session's numbers, or the top of the target.
    const w = weight.trim() || (isCardio ? '' : weightHint);
    const fallback = timed ? set.targetSeconds : set.targetMaxReps;
    const a =
      amount.trim() ||
      (timed ? previous?.seconds : previous?.reps)?.toString() ||
      (fallback?.toString() ?? '');
    setWeight(w);
    setAmount(a);
    save(w, a, true);
    onTicked(set);
  };

  const confirmRemove = () =>
    Alert.alert(`Remove set ${set.setNumber}?`, undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => removeSet(db, set.id) },
    ]);

  return (
    <Pressable
      onLongPress={canRemove ? confirmRemove : undefined}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.sm,
        padding: space.xs,
        borderRadius: radius.sm,
        backgroundColor: set.completed ? c.successSoft : 'transparent',
      }}
    >
      <Text
        style={{
          width: 28,
          textAlign: 'center',
          fontSize: 18,
          fontWeight: '800',
          color: set.completed ? c.success : c.muted,
        }}
      >
        {set.setNumber}
      </Text>
      {!isCardio ? (
        <Input
          value={weight}
          onChangeText={setWeight}
          onEndEditing={() => save(weight, amount, set.completed)}
          placeholder={weightHint || (timed ? '—' : 'BW')}
          keyboardType="decimal-pad"
          accessibilityLabel={`Set ${set.setNumber} weight in ${unit}`}
          style={{ flex: 1, textAlign: 'center', fontWeight: '600' }}
        />
      ) : null}
      <Input
        value={amount}
        onChangeText={setAmount}
        onEndEditing={() => save(weight, amount, set.completed)}
        placeholder={amountHint}
        keyboardType="number-pad"
        accessibilityLabel={`Set ${set.setNumber} ${timed ? 'seconds' : 'reps'}`}
        style={{ flex: 1, textAlign: 'center', fontWeight: '600' }}
      />
      <Pressable
        onPress={toggle}
        hitSlop={6}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: set.completed }}
        accessibilityLabel={`Set ${set.setNumber} done`}
        style={{
          width: 44,
          height: 40,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: set.completed ? c.success : c.border,
          backgroundColor: set.completed ? c.success : c.card,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons name="checkmark" size={22} color={set.completed ? c.onPrimary : c.muted} />
      </Pressable>
    </Pressable>
  );
}
