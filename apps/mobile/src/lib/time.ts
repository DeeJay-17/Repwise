/** Current time as an ISO 8601 UTC string, the format every timestamp column uses. */
export function nowIso(): string {
  return new Date().toISOString();
}

/** "Mon 16 Nov" style label for an ISO timestamp, in the device's time zone. */
export function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

/** 90 -> "1:30", 45 -> "0:45", 3600 -> "60:00". */
export function formatSeconds(total: number): string {
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/** Minutes between two ISO timestamps, rounded. */
export function minutesBetween(startIso: string, endIso: string): number {
  return Math.round((Date.parse(endIso) - Date.parse(startIso)) / 60000);
}
