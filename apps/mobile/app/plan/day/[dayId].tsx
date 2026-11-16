import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { getExercise } from '@/catalogue';
import { db } from '@/db/client';
import { useDbQuery } from '@/db/live';
import { getPlanDay, movePlannedExercise, renameDay } from '@/db/repo/plans';
import { formatTarget } from '@/domain/format';
import { formatSeconds } from '@/lib/time';
import { Button, Card, ExerciseThumb, Input, Screen, T } from '@/ui/components';
import { space, useColors } from '@/ui/theme';

export default function DayEditorScreen() {
  const c = useColors();
  const { dayId } = useLocalSearchParams<{ dayId: string }>();
  const day = useDbQuery(() => getPlanDay(db, dayId), [dayId]);
  if (!day) return null;

  return (
    <Screen
      footer={
        <Button
          title="Add exercise"
          icon="add"
          onPress={() => router.push(`/plan/pick/${day.id}`)}
        />
      }
    >
      <Stack.Screen options={{ title: day.name }} />
      <DayName key={day.id} dayId={day.id} name={day.name} />

      {day.exercises.length === 0 ? (
        <T variant="muted">No exercises yet. Add some from the library.</T>
      ) : null}

      {day.exercises.map((e, i) => (
        <Card key={e.id} onPress={() => router.push(`/plan/exercise/${e.id}`)}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
            <ExerciseThumb exerciseId={e.exerciseId} />
            <View style={{ flex: 1 }}>
              <T variant="heading" numberOfLines={1}>
                {getExercise(e.exerciseId)?.name ?? e.exerciseId}
              </T>
              <T variant="muted">
                {formatTarget(e)} · rest {formatSeconds(e.restSeconds)}
              </T>
            </View>
            <View>
              <Pressable
                accessibilityLabel="Move up"
                disabled={i === 0}
                hitSlop={8}
                onPress={() => movePlannedExercise(db, e.id, -1)}
              >
                <Ionicons name="chevron-up" size={22} color={i === 0 ? c.border : c.muted} />
              </Pressable>
              <Pressable
                accessibilityLabel="Move down"
                disabled={i === day.exercises.length - 1}
                hitSlop={8}
                onPress={() => movePlannedExercise(db, e.id, 1)}
              >
                <Ionicons
                  name="chevron-down"
                  size={22}
                  color={i === day.exercises.length - 1 ? c.border : c.muted}
                />
              </Pressable>
            </View>
          </View>
        </Card>
      ))}
    </Screen>
  );
}

function DayName({ dayId, name }: { dayId: string; name: string }) {
  const [value, setValue] = useState(name);
  return (
    <Input
      accessibilityLabel="Day name"
      value={value}
      onChangeText={setValue}
      onEndEditing={() => renameDay(db, dayId, value)}
      placeholder="e.g. Upper body"
    />
  );
}
