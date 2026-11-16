import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

import type { SessionSummary } from '@/db/repo/sessions';
import { dateKey, MONTHS, monthGrid, WEEKDAY_INITIALS } from '@/domain/calendar';
import { dayColor } from '@/domain/day-colors';
import { radius, space, useColors } from '@/ui/theme';

import { PlateDot } from './PlateDot';

/** A month of workouts: each day shows a plate per workout; tap a day to select it. */
export function MonthCalendar({
  year,
  month,
  byDate,
  selectedKey,
  onSelect,
  onChangeMonth,
}: {
  year: number;
  month: number;
  byDate: Map<string, SessionSummary[]>;
  selectedKey: string | null;
  onSelect: (key: string) => void;
  onChangeMonth: (delta: -1 | 1) => void;
}) {
  const c = useColors();
  const todayKey = dateKey(new Date());
  const now = new Date();
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();

  const arrow = (delta: -1 | 1, disabled = false) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={delta < 0 ? 'Previous month' : 'Next month'}
      disabled={disabled}
      hitSlop={10}
      onPress={() => onChangeMonth(delta)}
      style={{ opacity: disabled ? 0.3 : 1, padding: space.xs }}
    >
      <Ionicons name={delta < 0 ? 'chevron-back' : 'chevron-forward'} size={22} color={c.text} />
    </Pressable>
  );

  return (
    <View
      style={{
        backgroundColor: c.card,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: c.border,
        padding: space.md,
        gap: space.sm,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        {arrow(-1)}
        <Text style={{ color: c.text, fontSize: 17, fontWeight: '700' }}>
          {MONTHS[month]} {year}
        </Text>
        {arrow(1, isCurrentMonth)}
      </View>
      <View style={{ flexDirection: 'row' }}>
        {WEEKDAY_INITIALS.map((d, i) => (
          <Text
            key={i}
            style={{
              flex: 1,
              textAlign: 'center',
              color: c.muted,
              fontSize: 12,
              fontWeight: '600',
            }}
          >
            {d}
          </Text>
        ))}
      </View>
      {monthGrid(year, month).map((week) => (
        <View key={week[0]!.key} style={{ flexDirection: 'row' }}>
          {week.map((day) => {
            const list = byDate.get(day.key) ?? [];
            const selected = day.key === selectedKey;
            const isToday = day.key === todayKey;
            return (
              <Pressable
                key={day.key}
                accessibilityRole="button"
                accessibilityLabel={`${day.date.getDate()} ${MONTHS[day.date.getMonth()]}, ${list.length} workouts`}
                accessibilityState={{ selected }}
                onPress={() => onSelect(day.key)}
                style={{
                  flex: 1,
                  alignItems: 'center',
                  paddingVertical: 6,
                  gap: 3,
                  borderRadius: radius.sm,
                  backgroundColor: selected ? c.primarySoft : 'transparent',
                }}
              >
                <View
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: isToday ? 1.5 : 0,
                    borderColor: c.primary,
                  }}
                >
                  <Text
                    style={{
                      color: day.inMonth ? c.text : c.muted,
                      opacity: day.inMonth ? 1 : 0.45,
                      fontWeight: list.length ? '700' : '400',
                    }}
                  >
                    {day.date.getDate()}
                  </Text>
                </View>
                <View style={{ height: 10, flexDirection: 'row', gap: 2 }}>
                  {list.slice(0, 3).map((s) => (
                    <PlateDot key={s.id} color={dayColor(s.dayIndex)} size={9} />
                  ))}
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}
