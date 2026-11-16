/**
 * Calendar helpers. All dates are the device's local dates; a workout belongs to the
 * local day it started on. Weeks start on Monday.
 */

const pad = (n: number) => n.toString().padStart(2, '0');

/** "2026-11-16" for a Date in local time. */
export function dateKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Local date key of an ISO timestamp. */
export function dateKeyOf(iso: string): string {
  return dateKey(new Date(iso));
}

export function parseKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y!, m! - 1, d!);
}

export function addDays(d: Date, days: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

/** Monday 00:00 of the week containing d. */
export function mondayOf(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return addDays(x, -((x.getDay() + 6) % 7));
}

/** The 7 days of the week containing d, Monday first. */
export function weekDays(d: Date): Date[] {
  const m = mondayOf(d);
  return Array.from({ length: 7 }, (_, i) => addDays(m, i));
}

export interface CalendarDay {
  date: Date;
  key: string;
  inMonth: boolean;
}

/** A month as full Monday-to-Sunday weeks (4 to 6 rows of 7), padded with nearby days. */
export function monthGrid(year: number, month: number): CalendarDay[][] {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const rows: CalendarDay[][] = [];
  let day = mondayOf(first);
  while (day <= last || rows.length === 0) {
    const row = Array.from({ length: 7 }, (_, i) => {
      const date = addDays(day, i);
      return { date, key: dateKey(date), inMonth: date.getMonth() === month };
    });
    rows.push(row);
    day = addDays(day, 7);
  }
  return rows;
}

/** Group items by the local date of a timestamp field. */
export function groupByDate<T>(items: T[], at: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const key = dateKeyOf(at(item));
    map.set(key, [...(map.get(key) ?? []), item]);
  }
  return map;
}

/** Number of weeks in which at least `target` workouts started. */
export function weeksMeetingTarget(startTimes: string[], target: number): number {
  const perWeek = new Map<string, number>();
  for (const iso of startTimes) {
    const week = dateKey(mondayOf(new Date(iso)));
    perWeek.set(week, (perWeek.get(week) ?? 0) + 1);
  }
  return [...perWeek.values()].filter((n) => n >= target).length;
}

export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const; // prettier-ignore
export const WEEKDAY_INITIALS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const;
