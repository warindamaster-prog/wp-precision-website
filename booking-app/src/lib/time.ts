// All stored instants are UTC. Business-local wall-clock time is converted with
// Intl (no date library), which keeps BST/GMT correct.

export const BUSINESS_TZ = "Europe/London";

/** Offset of `tz` from UTC in minutes at the UTC instant `utcMs` (BST = +60). */
export function tzOffsetMinutes(utcMs: number, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz, hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(new Date(utcMs));
  const g = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  const asUtc = Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute"), g("second"));
  return Math.round((asUtc - Math.floor(utcMs / 1000) * 1000) / 60000);
}

/** Local date "YYYY-MM-DD" + minutes after local midnight -> UTC Date. */
export function zonedToUtc(ymd: string, minutes: number, tz: string = BUSINESS_TZ): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  const naive = Date.UTC(y, m - 1, d, 0, minutes);
  const guess = naive - tzOffsetMinutes(naive, tz) * 60000;
  return new Date(naive - tzOffsetMinutes(guess, tz) * 60000);
}

export const localMidnightUtc = (ymd: string, tz: string = BUSINESS_TZ) => zonedToUtc(ymd, 0, tz);

export function addDaysYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

export function todayYmd(tz: string = BUSINESS_TZ, now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function isValidYmd(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s)) && addDaysYmd(s, 0) === s;
}

export function hhmmToMinutes(s: string): number | null {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(s);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

export function minutesToHhmm(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

/** Display an instant in the business time zone, e.g. "Sat 4 Apr 2026". */
export function formatDate(d: Date | string, tz: string = BUSINESS_TZ): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: tz, weekday: "short", day: "numeric", month: "short", year: "numeric" }).format(new Date(d));
}
