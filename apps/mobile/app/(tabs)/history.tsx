import { router } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { db } from '@/db/client';
import { useDbQuery } from '@/db/live';
import { getActivePlan } from '@/db/repo/plans';
import { getProfile } from '@/db/repo/profile';
import { listFinishedSessions, type SessionSummary } from '@/db/repo/sessions';
import { dateKey, groupByDate, parseKey, weeksMeetingTarget } from '@/domain/calendar';
import { dayColor } from '@/domain/day-colors';
import { formatDay, minutesBetween } from '@/lib/time';
import { formatWeight, type WeightUnit } from '@/lib/units';
import { MonthCalendar } from '@/features/tracking/MonthCalendar';
import { PlateDot } from '@/features/tracking/PlateDot';
import { Card, EmptyState, Screen, T } from '@/ui/components';
import { space, useColors } from '@/ui/theme';

export default function HistoryScreen() {
  const c = useColors();
  const sessions = useDbQuery(() => listFinishedSessions(db));
  const unit = useDbQuery(() => getProfile(db)?.weightUnit ?? 'kg');
  const target = useDbQuery(
    () => getActivePlan(db)?.daysPerWeek ?? getProfile(db)?.daysPerWeek ?? 3,
  );
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [selected, setSelected] = useState<string | null>(() => dateKey(new Date()));

  if (sessions.length === 0) {
    return (
      <Screen>
        <EmptyState
          title="No workouts logged yet"
          body="Finish a workout and it will show up here, on the calendar, with every set you did."
        />
      </Screen>
    );
  }

  const byDate = groupByDate(sessions, (s) => s.startedAt);
  const totalKg = sessions.reduce((sum, s) => sum + s.volumeKg, 0);
  const onDay = selected ? (byDate.get(selected) ?? []) : [];
  const changeMonth = (delta: -1 | 1) =>
    setMonth(({ year, month: m }) => {
      const d = new Date(year, m + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });

  const stat = (value: string, label: string) => (
    <View style={{ flex: 1, gap: 2 }}>
      <Text style={{ color: c.text, fontSize: 26, fontWeight: '800' }}>{value}</Text>
      <T variant="small">{label}</T>
    </View>
  );

  return (
    <Screen>
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        {stat(String(sessions.length), 'workouts')}
        {stat(formatWeight(totalKg, unit).replace(/ (kg|lb)$/, ''), `${unit} lifted`)}
        {stat(
          String(
            weeksMeetingTarget(
              sessions.map((s) => s.startedAt),
              target,
            ),
          ),
          `weeks with ${target}+`,
        )}
      </View>

      <MonthCalendar
        year={month.year}
        month={month.month}
        byDate={byDate}
        selectedKey={selected}
        onSelect={setSelected}
        onChangeMonth={changeMonth}
      />

      {selected ? (
        <View style={{ gap: space.sm }}>
          <T variant="heading">{formatDay(parseKey(selected).toISOString())}</T>
          {onDay.length === 0 ? (
            <T variant="muted">Rest day. No workouts logged.</T>
          ) : (
            onDay.map((s) => <SessionCard key={s.id} session={s} unit={unit} />)
          )}
        </View>
      ) : null}

      <View style={{ gap: space.sm }}>
        <T variant="heading">All workouts</T>
        {sessions.map((s) => (
          <SessionCard key={s.id} session={s} unit={unit} showDate />
        ))}
      </View>
    </Screen>
  );
}

function SessionCard({
  session,
  unit,
  showDate,
}: {
  session: SessionSummary;
  unit: WeightUnit;
  showDate?: boolean;
}) {
  const c = useColors();
  return (
    <Card onPress={() => router.push(`/history/${session.id}`)}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <PlateDot color={dayColor(session.dayIndex)} size={18} />
        <View style={{ flex: 1 }}>
          <T style={{ fontWeight: '700' }}>{session.name}</T>
          <T variant="small">
            {showDate ? `${formatDay(session.startedAt)} · ` : ''}
            {session.completedSets} sets · {minutesBetween(session.startedAt, session.finishedAt!)}{' '}
            min
          </T>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ color: c.text, fontSize: 18, fontWeight: '800' }}>
            {session.volumeKg ? formatWeight(session.volumeKg, unit).replace(/ (kg|lb)$/, '') : '–'}
          </Text>
          {session.volumeKg ? <T variant="small">{unit} volume</T> : null}
        </View>
      </View>
    </Card>
  );
}
