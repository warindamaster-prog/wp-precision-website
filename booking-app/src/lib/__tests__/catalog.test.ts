import { describe, expect, it } from "vitest";
import { formatPence, parsePounds, penceToInput } from "../money";
import {
  addDaysYmd, hhmmToMinutes, isValidYmd, localMidnightUtc, minutesToHhmm, todayYmd, tzOffsetMinutes, zonedToUtc,
} from "../time";
import { parseWeeklyHours } from "../hours";
import { serviceSchema, staffSchema, timeOffSchema } from "../validation/catalog";

describe("money", () => {
  it("parses pounds to pence without float errors", () => {
    expect(parsePounds("12.50")).toBe(1250);
    expect(parsePounds("12.5")).toBe(1250);
    expect(parsePounds("0.07")).toBe(7);
    expect(parsePounds("19.99")).toBe(1999);
    expect(parsePounds("25")).toBe(2500);
  });
  it.each(["", "-5", "1.234", "abc", "12,50", "10000", "£5"])("rejects %j", (s) => {
    expect(parsePounds(s)).toBeNull();
  });
  it("formats", () => {
    expect(formatPence(1250)).toBe("£12.50");
    expect(penceToInput(1250)).toBe("12.50");
  });
});

describe("time zone handling (Europe/London)", () => {
  it("offsets are +0 in winter and +60 in summer", () => {
    expect(tzOffsetMinutes(Date.UTC(2026, 0, 15, 12), "Europe/London")).toBe(0);
    expect(tzOffsetMinutes(Date.UTC(2026, 6, 15, 12), "Europe/London")).toBe(60);
  });
  it("converts local times to UTC across BST/GMT", () => {
    expect(zonedToUtc("2026-07-01", 600).toISOString()).toBe("2026-07-01T09:00:00.000Z");
    expect(zonedToUtc("2026-01-10", 600).toISOString()).toBe("2026-01-10T10:00:00.000Z");
  });
  it("spring-forward day is 23 hours, autumn-back day is 25 hours", () => {
    const hours = (a: string, b: string) => (localMidnightUtc(b).getTime() - localMidnightUtc(a).getTime()) / 3.6e6;
    expect(hours("2026-03-29", "2026-03-30")).toBe(23);
    expect(hours("2026-10-25", "2026-10-26")).toBe(25);
    expect(hours("2026-06-01", "2026-06-02")).toBe(24);
  });
  it("date helpers", () => {
    expect(addDaysYmd("2026-02-28", 1)).toBe("2026-03-01");
    expect(isValidYmd("2026-02-30")).toBe(false);
    expect(isValidYmd("2026-02-28")).toBe(true);
    expect(todayYmd("Europe/London", new Date("2026-06-30T23:30:00Z"))).toBe("2026-07-01");
    expect(hhmmToMinutes("09:30")).toBe(570);
    expect(hhmmToMinutes("24:00")).toBeNull();
    expect(minutesToHhmm(570)).toBe("09:30");
  });
});

describe("weekly hours parsing", () => {
  const form = (o: Record<string, string>) => (k: string) => o[k] ?? "";
  it("accepts split days and treats blank days as closed", () => {
    const r = parseWeeklyHours(form({
      "h-1-0-start": "09:00", "h-1-0-end": "12:00", "h-1-1-start": "13:00", "h-1-1-end": "17:30",
    }));
    expect(r).toEqual({ ok: true, hours: [
      { weekday: 1, start: 540, end: 720 }, { weekday: 1, start: 780, end: 1050 },
    ] });
  });
  it("rejects end before start, half-filled and overlapping ranges", () => {
    const r = parseWeeklyHours(form({
      "h-2-0-start": "17:00", "h-2-0-end": "09:00",
      "h-3-0-start": "09:00",
      "h-4-0-start": "09:00", "h-4-0-end": "13:00", "h-4-1-start": "12:00", "h-4-1-end": "17:00",
    }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(["2", "3", "4"]);
  });
});

describe("serviceSchema", () => {
  const base = { name: "Gel manicure", description: "", duration: "45", bufferBefore: "0", bufferAfter: "10", price: "30", deposit: "10", active: true };
  it("converts pounds to pence and numbers", () => {
    const v = serviceSchema.parse(base);
    expect(v).toMatchObject({ duration: 45, price: 3000, deposit: 1000, bufferAfter: 10, description: null });
  });
  it("treats an empty deposit as none", () => {
    expect(serviceSchema.parse({ ...base, deposit: "" }).deposit).toBe(0);
  });
  it("rejects deposit above price, bad duration and bad money", () => {
    expect(serviceSchema.safeParse({ ...base, deposit: "40" }).success).toBe(false);
    expect(serviceSchema.safeParse({ ...base, duration: "2" }).success).toBe(false);
    expect(serviceSchema.safeParse({ ...base, price: "abc" }).success).toBe(false);
  });
});

describe("staffSchema and timeOffSchema", () => {
  it("lowercases email and allows blank", () => {
    expect(staffSchema.parse({ name: "A", email: "A@B.com", active: true }).email).toBe("a@b.com");
    expect(staffSchema.parse({ name: "A", email: "", active: true }).email).toBeNull();
    expect(staffSchema.safeParse({ name: "A", email: "nope", active: true }).success).toBe(false);
  });
  it("validates date ranges", () => {
    const t = todayYmd();
    expect(timeOffSchema.safeParse({ startDate: t, endDate: addDaysYmd(t, 3), reason: "" }).success).toBe(true);
    expect(timeOffSchema.safeParse({ startDate: addDaysYmd(t, 3), endDate: t, reason: "" }).success).toBe(false);
    expect(timeOffSchema.safeParse({ startDate: "2020-01-01", endDate: "2020-01-02", reason: "" }).success).toBe(false);
  });
});
