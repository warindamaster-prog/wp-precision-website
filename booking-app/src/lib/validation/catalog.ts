import { z } from "zod";
import { parsePounds } from "../money";
import { addDaysYmd, isValidYmd, todayYmd } from "../time";

const intField = (label: string, min: number, max: number) =>
  z.string().trim().regex(/^\d+$/, `${label} must be a whole number`)
    .transform(Number)
    .refine((n) => n >= min && n <= max, `${label} must be between ${min} and ${max}`);

const pounds = (label: string) =>
  z.string().trim().transform((s) => (s === "" ? "0" : s))
    .transform((s, ctx) => {
      const p = parsePounds(s);
      if (p === null) { ctx.addIssue({ code: "custom", message: `${label} must be an amount like 25 or 25.50` }); return z.NEVER; }
      return p;
    });

export const serviceSchema = z.object({
  name: z.string().trim().min(1, "Enter a service name").max(100),
  description: z.string().trim().max(500, "Keep it under 500 characters").transform((s) => s || null),
  duration: intField("Duration", 5, 720),
  bufferBefore: intField("Buffer before", 0, 120),
  bufferAfter: intField("Buffer after", 0, 120),
  price: pounds("Price"),
  deposit: pounds("Deposit"),
  active: z.boolean(),
}).refine((v) => v.deposit <= v.price, { path: ["deposit"], message: "Deposit can't be more than the price" });

export const staffSchema = z.object({
  name: z.string().trim().min(1, "Enter a name").max(100),
  email: z.union([z.literal(""), z.email("Enter a valid email address").max(254)])
    .transform((s) => (s ? s.toLowerCase() : null)),
  active: z.boolean(),
});

export const uuid = z.uuid();

export const timeOffSchema = z.object({
  startDate: z.string().refine(isValidYmd, "Choose a start date"),
  endDate: z.string().refine(isValidYmd, "Choose an end date"),
  reason: z.string().trim().max(200).transform((s) => s || null),
}).superRefine((v, ctx) => {
  if (!isValidYmd(v.startDate) || !isValidYmd(v.endDate)) return;
  if (v.endDate < v.startDate) ctx.addIssue({ code: "custom", path: ["endDate"], message: "End date can't be before the start date" });
  else if (v.endDate < todayYmd()) ctx.addIssue({ code: "custom", path: ["endDate"], message: "Choose dates that aren't in the past" });
  else if (addDaysYmd(v.startDate, 365) < v.endDate) ctx.addIssue({ code: "custom", path: ["endDate"], message: "Keep days off to a year or less" });
});
