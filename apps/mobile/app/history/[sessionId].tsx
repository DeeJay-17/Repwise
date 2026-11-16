import { Stack, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { getExercise } from '@/catalogue';
import { db } from '@/db/client';
import { useDbQuery } from '@/db/live';
import { getProfile } from '@/db/repo/profile';
import { getSessionDetail } from '@/db/repo/sessions';
import { formatSet } from '@/domain/format';
import { formatDay, minutesBetween } from '@/lib/time';
import { Card, ExerciseThumb, Screen, T } from '@/ui/components';
import { space } from '@/ui/theme';

export default function SessionDetailScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const detail = useDbQuery(() => getSessionDetail(db, sessionId), [sessionId]);
  const unit = useDbQuery(() => getProfile(db)?.weightUnit ?? 'kg');
  if (!detail) return null;
  const { session } = detail;

  return (
    <Screen>
      <Stack.Screen options={{ title: session.name }} />
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
    </Screen>
  );
}
