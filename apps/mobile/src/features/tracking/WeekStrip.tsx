import { Text, View } from 'react-native';

import type { SessionSummary } from '@/db/repo/sessions';
import { dateKey, dateKeyOf, WEEKDAY_INITIALS, weekDays } from '@/domain/calendar';
import { dayColor } from '@/domain/day-colors';
import { T } from '@/ui/components';
import { radius, space, useColors } from '@/ui/theme';

import { PlateDot } from './PlateDot';

/** This week, Monday to Sunday, with a coloured plate for each finished workout. */
export function WeekStrip({ sessions, target }: { sessions: SessionSummary[]; target: number }) {
  const c = useColors();
  const today = new Date();
  const todayKey = dateKey(today);
  const days = weekDays(today);
  const byDay = new Map<string, SessionSummary[]>();
  for (const s of sessions) {
    const k = dateKeyOf(s.startedAt);
    byDay.set(k, [...(byDay.get(k) ?? []), s]);
  }
  const count = days.reduce((n, d) => n + (byDay.get(dateKey(d))?.length ?? 0), 0);

  return (
    <View
      style={{ gap: space.sm }}
      accessibilityLabel={`This week: ${count} of ${target} workouts`}
    >
      <View
        style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}
      >
        <T variant="small" style={{ fontWeight: '700', letterSpacing: 1 }}>
          THIS WEEK
        </T>
        <Text style={{ color: c.text, fontSize: 20, fontWeight: '800' }}>
          {count}
          <Text style={{ color: c.muted, fontWeight: '600' }}> / {target} sessions</Text>
        </Text>
      </View>
      <View style={{ flexDirection: 'row', gap: 4 }}>
        {days.map((d, i) => {
          const key = dateKey(d);
          const list = byDay.get(key) ?? [];
          const isToday = key === todayKey;
          return (
            <View
              key={key}
              style={{
                flex: 1,
                alignItems: 'center',
                gap: 4,
                paddingVertical: 6,
                borderRadius: radius.sm,
                backgroundColor: isToday ? c.card : 'transparent',
                borderWidth: isToday ? 1 : 0,
                borderColor: c.border,
              }}
            >
              <Text style={{ color: c.muted, fontSize: 12 }}>{WEEKDAY_INITIALS[i]}</Text>
              <Text style={{ color: c.text, fontSize: 14, fontWeight: '600' }}>{d.getDate()}</Text>
              <View style={{ height: 12, flexDirection: 'row', gap: 2 }}>
                {list.slice(0, 2).map((s) => (
                  <PlateDot key={s.id} color={dayColor(s.dayIndex)} />
                ))}
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}
