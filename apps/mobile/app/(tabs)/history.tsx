import { router } from 'expo-router';

import { db } from '@/db/client';
import { useDbQuery } from '@/db/live';
import { getProfile } from '@/db/repo/profile';
import { listFinishedSessions } from '@/db/repo/sessions';
import { formatDay, minutesBetween } from '@/lib/time';
import { formatWeight } from '@/lib/units';
import { Card, EmptyState, Screen, T } from '@/ui/components';

export default function HistoryScreen() {
  const sessions = useDbQuery(() => listFinishedSessions(db));
  const unit = useDbQuery(() => getProfile(db)?.weightUnit ?? 'kg');

  if (sessions.length === 0) {
    return (
      <Screen>
        <EmptyState title="No workouts yet" body="Finished workouts show up here." />
      </Screen>
    );
  }

  return (
    <Screen>
      {sessions.map((s) => (
        <Card key={s.id} onPress={() => router.push(`/history/${s.id}`)}>
          <T variant="small">{formatDay(s.startedAt).toUpperCase()}</T>
          <T variant="heading">{s.name}</T>
          <T variant="muted">
            {s.completedSets} sets · {minutesBetween(s.startedAt, s.finishedAt!)} min
            {s.volumeKg > 0 ? ` · ${formatWeight(s.volumeKg, unit)} lifted` : ''}
          </T>
        </Card>
      ))}
    </Screen>
  );
}
