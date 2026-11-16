import { router } from 'expo-router';
import { View } from 'react-native';

import { getExercise } from '@/catalogue';
import { db } from '@/db/client';
import { useDbQuery } from '@/db/live';
import { getActivePlan, getPlanDay } from '@/db/repo/plans';
import {
  getInProgressSession,
  listFinishedSessions,
  nextPlanDay,
  startSession,
} from '@/db/repo/sessions';
import { formatTarget } from '@/domain/format';
import { Button, Card, EmptyState, ExerciseThumb, Screen, T } from '@/ui/components';
import { space } from '@/ui/theme';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export default function TodayScreen() {
  const running = useDbQuery(() => getInProgressSession(db));
  const plan = useDbQuery(() => getActivePlan(db));
  const next = useDbQuery(() => {
    if (!plan) return undefined;
    const day = nextPlanDay(db, plan.id);
    return day ? getPlanDay(db, day.id) : undefined;
  }, [plan?.id]);
  const thisWeek = useDbQuery(
    () =>
      listFinishedSessions(db).filter((s) => Date.now() - Date.parse(s.startedAt) < WEEK_MS).length,
  );

  if (running) {
    return (
      <Screen>
        <Card>
          <T variant="small">WORKOUT IN PROGRESS</T>
          <T variant="heading">{running.name}</T>
          <Button
            title="Resume"
            icon="play"
            onPress={() => router.push(`/workout/${running.id}`)}
          />
        </Card>
      </Screen>
    );
  }

  if (!plan) {
    return (
      <Screen>
        <EmptyState
          title="No plan yet"
          body="Build a plan from exercises that fit your equipment. AI plan generation arrives soon."
          action={<Button title="Build a plan" onPress={() => router.push('/plan/new')} />}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <T variant="muted">
        {thisWeek === 0
          ? `Plan: ${plan.name}`
          : `${thisWeek} workout${thisWeek === 1 ? '' : 's'} in the last 7 days`}
      </T>
      {next ? (
        <Card>
          <T variant="small">NEXT UP</T>
          <T variant="title">{next.name}</T>
          {next.exercises.length === 0 ? (
            <>
              <T variant="muted">This day has no exercises yet.</T>
              <Button
                title="Add exercises"
                variant="secondary"
                onPress={() => router.push(`/plan/day/${next.id}`)}
              />
            </>
          ) : (
            <>
              <View style={{ gap: space.sm, marginVertical: space.sm }}>
                {next.exercises.map((e) => (
                  <View
                    key={e.id}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}
                  >
                    <ExerciseThumb exerciseId={e.exerciseId} size={44} />
                    <View style={{ flex: 1 }}>
                      <T numberOfLines={1}>{getExercise(e.exerciseId)?.name ?? e.exerciseId}</T>
                      <T variant="small">{formatTarget(e)}</T>
                    </View>
                  </View>
                ))}
              </View>
              <Button
                title="Start workout"
                icon="play"
                onPress={() => router.push(`/workout/${startSession(db, next.id)}`)}
              />
            </>
          )}
        </Card>
      ) : (
        <EmptyState
          title="Your plan has no days"
          body="Create a new plan to get started."
          action={<Button title="New plan" onPress={() => router.push('/plan/new')} />}
        />
      )}
    </Screen>
  );
}
