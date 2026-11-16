import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Alert, Text, View } from 'react-native';

import { getExercise } from '@/catalogue';
import { db } from '@/db/client';
import { useDbQuery } from '@/db/live';
import { getProfile } from '@/db/repo/profile';
import { discardSession, getSessionDetail } from '@/db/repo/sessions';
import { dayColor } from '@/domain/day-colors';
import { formatSet } from '@/domain/format';
import { formatDay, minutesBetween } from '@/lib/time';
import { PlateDot } from '@/features/tracking/PlateDot';
import { Button, Card, ExerciseThumb, Screen, T } from '@/ui/components';
import { space, useColors } from '@/ui/theme';

export default function SessionDetailScreen() {
  const c = useColors();
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const detail = useDbQuery(() => getSessionDetail(db, sessionId), [sessionId]);
  const unit = useDbQuery(() => getProfile(db)?.weightUnit ?? 'kg');
  if (!detail) return null;
  const { session } = detail;

  const remove = () =>
    Alert.alert('Delete this workout?', 'It will be removed from your history and calendar.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          discardSession(db, sessionId);
          router.back();
        },
      },
    ]);

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Workout' }} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <PlateDot color={dayColor(detail.dayIndex)} size={22} />
        <Text
          style={{
            color: c.text,
            fontSize: 28,
            fontWeight: '800',
            textTransform: 'uppercase',
            flex: 1,
          }}
        >
          {session.name}
        </Text>
      </View>
      <T variant="muted">
        {formatDay(session.startedAt)}
        {session.finishedAt
          ? ` · ${minutesBetween(session.startedAt, session.finishedAt)} min`
          : ''}
      </T>
      {detail.exercises.map((e) => {
        const done = e.sets.filter((s) => s.completed);
        return (
          <Card key={`${e.position}-${e.exerciseId}`}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
              <ExerciseThumb exerciseId={e.exerciseId} size={44} />
              <T variant="heading" style={{ flex: 1 }} numberOfLines={1}>
                {getExercise(e.exerciseId)?.name ?? e.exerciseId}
              </T>
            </View>
            <T variant="muted">
              {done.length === 0 ? 'Skipped' : done.map((s) => formatSet(s, unit)).join(', ')}
            </T>
          </Card>
        );
      })}
      <Button title="Delete workout" variant="danger" onPress={remove} />
    </Screen>
  );
}
