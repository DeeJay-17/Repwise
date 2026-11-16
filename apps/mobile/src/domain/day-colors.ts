/**
 * Each plan day gets a colour, in competition bumper-plate order, used for its chip,
 * header and calendar dots.
 */
export type PlateColor = 'blue' | 'red' | 'yellow' | 'green' | 'white' | 'steel' | 'black';

const ORDER: PlateColor[] = ['blue', 'red', 'yellow', 'green', 'white', 'steel', 'black'];

export const PLATE_HEX: Record<PlateColor, { light: string; dark: string }> = {
  red: { light: '#D3352B', dark: '#E5524A' },
  blue: { light: '#1C58D2', dark: '#4E82EE' },
  yellow: { light: '#E3AE0E', dark: '#F2C230' },
  green: { light: '#2B8A4C', dark: '#45B06A' },
  white: { light: '#F3F3F0', dark: '#E9EAE6' },
  steel: { light: '#9AA3A8', dark: '#7F898F' },
  black: { light: '#2A2F34', dark: '#5A6168' },
};

/** Colour for a plan day (1-based). Workouts without a plan day are steel. */
export function dayColor(dayIndex: number | null | undefined): PlateColor {
  if (!dayIndex) return 'steel';
  return ORDER[(dayIndex - 1) % ORDER.length]!;
}
