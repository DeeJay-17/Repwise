import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { getExercise } from '@/catalogue';
import { db } from '@/db/client';
import { useDbQuery } from '@/db/live';
import { getActivePlan, getPlanTree } from '@/db/repo/plans';
import { getProfile } from '@/db/repo/profile';
import {
  getInProgressSession,
  getSessionDetail,
  lastPerformance,
  listFinishedSessions,
  nextPlanDay,
  startSession,
} from '@/db/repo/sessions';
import { dayColor } from '@/domain/day-colors';
import { formatSet, formatTarget } from '@/domain/format';
import { formatDay } from '@/lib/time';
import { formatWeight } from '@/lib/units';
import { PlateDot } from '@/features/tracking/PlateDot';
import { WeekStrip } from '@/features/tracking/WeekStrip';
import { Button, Card, EmptyState, ExerciseThumb, Screen, T } from '@/ui/components';
import { radius, space, useColors } from '@/ui/theme';

export default function TodayScreen() {
  const c = useColors();
  const { finished } = useLocalSearchParams<{ finished?: string }>();
  const unit = useDbQuery(() => getProfile(db)?.weightUnit ?? 'kg');
  const running = useDbQuery(() => getInProgressSession(db));
  const sessions = useDbQuery(() => listFinishedSessions(db));
  const plan = useDbQuery(() => {
    const active = getActivePlan(db);
    return active ? getPlanTree(db, active.id) : undefined;
  });
  const nextId = useDbQuery(
    () => (plan ? nextPlanDay(db, plan.plan.id)?.id : undefined),
    [plan?.plan.id],
  );
  const justFinished = useDbQuery(
    () => (finished ? getSessionDetail(db, finished) : undefined),
    [finished],
  );
  const [picked, setPicked] = useState<string | null>(null);

  const target = plan?.plan.daysPerWeek ?? 3;
  const day = plan?.days.find((d) => d.id === (picked ?? nextId)) ?? plan?.days[0];
  const next = plan?.days.find((d) => d.id === nextId);
  const summary = justFinished ? sessions.find((s) => s.id === justFinished.session.id) : undefined;

  return (
    <Screen>
      <WeekStrip sessions={sessions} target={target} />

      {summary ? (
        <View
          style={{
            flexDirection: 'row',
            gap: space.md,
            alignItems: 'center',
            backgroundColor: c.successSoft,
            borderRadius: radius.md,
            padding: space.md,
          }}
        >
          <PlateDot color={dayColor(summary.dayIndex)} size={18} />
          <T style={{ flex: 1 }}>
            <Text style={{ fontWeight: '700' }}>{summary.name} saved. </Text>
            {summary.completedSets} sets
            {summary.volumeKg > 0 ? `, ${formatWeight(summary.volumeKg, unit)} moved` : ''}.
            {next ? ` Next up is ${next.name}.` : ''}
          </T>
        </View>
      ) : null}

      {running ? (
        <Card>
          <T variant="small">WORKOUT IN PROGRESS</T>
          <T variant="heading">{running.name}</T>
          <Button
            title="Resume"
            icon="play"
            onPress={() => router.push(`/workout/${running.id}`)}
          />
        </Card>
      ) : null}

      {!plan ? (
        <EmptyState
          title="No plan yet"
          body="Let AI draft one for your goals and equipment, or build it yourself."
          action={
            <View style={{ gap: space.sm }}>
              <Button
                title="Generate with AI"
                icon="sparkles"
                onPress={() => router.push('/plan/generate')}
              />
              <Button
                title="Build it myself"
                variant="secondary"
                onPress={() => router.push('/plan/new')}
              />
            </View>
          }
        />
      ) : (
        <>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 6 }}
          >
            {plan.days.map((d) => {
              const selected = d.id === day?.id;
              return (
                <Pressable
                  key={d.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => setPicked(d.id)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 7,
                    paddingVertical: 7,
                    paddingLeft: 8,
                    paddingRight: 12,
                    borderRadius: radius.pill,
                    borderWidth: 1,
                    borderColor: selected ? c.text : c.border,
                    backgroundColor: selected ? c.text : c.card,
                  }}
                >
                  <PlateDot color={dayColor(d.dayIndex)} />
                  <Text style={{ color: selected ? c.background : c.text, fontWeight: '600' }}>
                    {d.name}
                  </Text>
                  {d.id === nextId ? (
                    <Text
                      style={{
                        color: selected ? c.background : c.primary,
                        opacity: selected ? 0.75 : 1,
                        fontSize: 10,
                        fontWeight: '700',
                        letterSpacing: 0.6,
                      }}
                    >
                      NEXT
                    </Text>
                  ) : null}
                </Pressable>
              );
            })}
          </ScrollView>

          {day ? (
            <View style={{ gap: space.md }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                <PlateDot color={dayColor(day.dayIndex)} size={22} />
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
                  {day.name}
                </Text>
              </View>
              {day.exercises.length === 0 ? (
                <EmptyState
                  title="No exercises yet"
                  body="Add exercises to this day before you start it."
                  action={
                    <Button
                      title="Edit day"
                      variant="secondary"
                      onPress={() => router.push(`/plan/day/${day.id}`)}
                    />
                  }
                />
              ) : (
                <>
                  {day.exercises.map((e) => (
                    <PreviewRow
                      key={e.id}
                      exerciseId={e.exerciseId}
                      target={formatTarget(e)}
                      unit={unit}
                    />
                  ))}
                  <Button
                    title={running ? 'Resume workout' : `Start ${day.name}`}
                    icon="play"
                    onPress={() => router.push(`/workout/${startSession(db, day.id)}`)}
                  />
                  <Button
                    title="Edit this day"
                    variant="ghost"
                    onPress={() => router.push(`/plan/day/${day.id}`)}
                  />
                </>
              )}
            </View>
          ) : null}
        </>
      )}
    </Screen>
  );
}

function PreviewRow({
  exerciseId,
  target,
  unit,
}: {
  exerciseId: string;
  target: string;
  unit: 'kg' | 'lb';
}) {
  const last = useDbQuery(() => lastPerformance(db, exerciseId), [exerciseId]);
  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <ExerciseThumb exerciseId={exerciseId} size={44} />
        <View style={{ flex: 1 }}>
          <T numberOfLines={1} style={{ fontWeight: '600' }}>
            {getExercise(exerciseId)?.name ?? exerciseId}
          </T>
          <T variant="small" numberOfLines={1}>
            {last
              ? `Last: ${last.sets.map((s) => formatSet(s, unit)).join(', ')} (${formatDay(last.startedAt)})`
              : 'First time'}
          </T>
        </View>
        <T style={{ fontWeight: '800', fontSize: 17 }}>{target}</T>
      </View>
    </Card>
  );
}
