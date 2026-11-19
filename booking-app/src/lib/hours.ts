import { hhmmToMinutes } from "./time";

export const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;
export const RANGES_PER_DAY = 2; // e.g. morning + afternoon around a lunch break

export type HourRange = { weekday: number; start: number; end: number };
export type HoursResult =
  | { ok: true; hours: HourRange[] }
  | { ok: false; errors: Record<number, string> }; // keyed by ISO weekday 1-7

/** Reads fields named h-{weekday}-{n}-start / -end ("HH:MM"). Empty pair = closed. */
export function parseWeeklyHours(get: (name: string) => string): HoursResult {
  const hours: HourRange[] = [];
  const errors: Record<number, string> = {};

  for (let weekday = 1; weekday <= 7; weekday++) {
    const ranges: { start: number; end: number }[] = [];
    for (let n = 0; n < RANGES_PER_DAY; n++) {
      const s = get(`h-${weekday}-${n}-start`).trim();
      const e = get(`h-${weekday}-${n}-end`).trim();
      if (!s && !e) continue;
      const start = hhmmToMinutes(s);
      const end = hhmmToMinutes(e);
      if (start === null || end === null) { errors[weekday] = "Enter both a start and an end time"; break; }
      if (end <= start) { errors[weekday] = "End time must be after start time"; break; }
      ranges.push({ start, end });
    }
    if (errors[weekday]) continue;
    ranges.sort((a, b) => a.start - b.start);
    for (let i = 1; i < ranges.length; i++) {
      if (ranges[i].start < ranges[i - 1].end) { errors[weekday] = "Time ranges must not overlap"; break; }
    }
    if (!errors[weekday]) ranges.forEach((r) => hours.push({ weekday, ...r }));
  }
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, hours };
}
