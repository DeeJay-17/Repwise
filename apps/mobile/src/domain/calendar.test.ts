import {
  addDays,
  dateKey,
  dateKeyOf,
  groupByDate,
  mondayOf,
  monthGrid,
  weekDays,
  weeksMeetingTarget,
} from './calendar';

describe('calendar', () => {
  it('starts weeks on Monday', () => {
    const sunday = new Date(2026, 10, 22);
    expect(dateKey(mondayOf(sunday))).toBe('2026-11-16');
    expect(weekDays(new Date(2026, 10, 16)).map(dateKey)).toEqual([
      '2026-11-16',
      '2026-11-17',
      '2026-11-18',
      '2026-11-19',
      '2026-11-20',
      '2026-11-21',
      '2026-11-22',
    ]);
  });

  it('lays out a month as whole weeks', () => {
    const rows = monthGrid(2026, 10); // November 2026 starts on a Sunday
    expect(rows[0]![0]!.key).toBe('2026-10-26');
    expect(rows[0]![6]).toMatchObject({ key: '2026-11-01', inMonth: true });
    expect(rows.at(-1)!.at(-1)!.key).toBe('2026-12-06');
    expect(rows.flat().filter((d) => d.inMonth)).toHaveLength(30);
  });

  it('groups by local date and counts weeks that hit the target', () => {
    const at = (d: Date) => d.toISOString();
    const mon = new Date(2026, 10, 16, 18, 0);
    const times = [mon, addDays(mon, 1), addDays(mon, 3), addDays(mon, 7)].map(at);
    expect(groupByDate(times, (t) => t).get(dateKeyOf(times[0]!))).toHaveLength(1);
    expect(weeksMeetingTarget(times, 3)).toBe(1);
    expect(weeksMeetingTarget(times, 1)).toBe(2);
  });
});
