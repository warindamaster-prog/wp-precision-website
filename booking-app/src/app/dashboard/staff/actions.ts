"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireBusiness, requireOwner } from "@/lib/auth";
import { zodState, type FormState } from "@/lib/form";
import { parseWeeklyHours } from "@/lib/hours";
import { addDaysYmd, localMidnightUtc } from "@/lib/time";
import { staffSchema, timeOffSchema, uuid } from "@/lib/validation/catalog";

const GENERIC = "Something went wrong. Please try again.";

export async function saveStaff(_: FormState, formData: FormData): Promise<FormState> {
  const { supabase, business } = await requireOwner();
  const raw = { name: String(formData.get("name") ?? ""), email: String(formData.get("email") ?? "") };
  const active = formData.get("active") === "on";
  const idRaw = String(formData.get("id") ?? "");
  const id = idRaw ? uuid.safeParse(idRaw) : null;
  if (id && !id.success) return { error: "That team member could not be found." };

  const parsed = staffSchema.safeParse({ ...raw, active });
  if (!parsed.success) return zodState(parsed.error, { ...raw, active: active ? "on" : "" });
  const row = { name: parsed.data.name, email: parsed.data.email, active: parsed.data.active };

  if (id?.success) {
    const { error } = await supabase.from("staff").update(row).eq("id", id.data).eq("business_id", business.id);
    if (error) return { error: GENERIC, values: { ...raw, active: active ? "on" : "" } };
    revalidatePath(`/dashboard/staff/${id.data}`);
    return { message: "Saved." , values: { ...raw, active: active ? "on" : "" } };
  }
  const { data, error } = await supabase.from("staff").insert({ ...row, business_id: business.id }).select("id").single();
  if (error || !data) return { error: GENERIC, values: { ...raw, active: active ? "on" : "" } };
  redirect(`/dashboard/staff/${data.id}`);
}

export async function saveStaffServices(_: FormState, formData: FormData): Promise<FormState> {
  const { supabase } = await requireOwner();
  const staffId = uuid.safeParse(String(formData.get("staffId") ?? ""));
  const ids = formData.getAll("service").map(String);
  const serviceIds = ids.map((s) => uuid.safeParse(s));
  if (!staffId.success || serviceIds.some((r) => !r.success)) return { error: GENERIC };

  const { error } = await supabase.rpc("set_staff_services", {
    p_staff_id: staffId.data,
    p_service_ids: serviceIds.map((r) => r.data as string),
  });
  if (error) return { error: GENERIC };
  revalidatePath(`/dashboard/staff/${staffId.data}`);
  return { message: "Saved." };
}

export async function saveHours(_: FormState, formData: FormData): Promise<FormState> {
  const { supabase } = await requireBusiness(); // RLS: owner, or the staff member themselves
  const staffId = uuid.safeParse(String(formData.get("staffId") ?? ""));
  if (!staffId.success) return { error: GENERIC };

  const result = parseWeeklyHours((k) => String(formData.get(k) ?? ""));
  if (!result.ok) {
    const fieldErrors: Record<string, string[]> = {};
    for (const [day, msg] of Object.entries(result.errors)) fieldErrors[`day-${day}`] = [msg];
    return { error: "Please fix the highlighted days.", fieldErrors };
  }

  const { error } = await supabase.rpc("set_working_hours", {
    p_staff_id: staffId.data,
    p_hours: result.hours.map((h) => ({ weekday: h.weekday, start: h.start, end: h.end })),
  });
  if (error) return { error: GENERIC };
  revalidatePath(`/dashboard/staff/${staffId.data}`);
  return { message: "Working hours saved." };
}

export async function addTimeOff(_: FormState, formData: FormData): Promise<FormState> {
  const { supabase } = await requireBusiness();
  const staffId = uuid.safeParse(String(formData.get("staffId") ?? ""));
  if (!staffId.success) return { error: GENERIC };

  const raw = {
    startDate: String(formData.get("startDate") ?? ""),
    endDate: String(formData.get("endDate") ?? ""),
    reason: String(formData.get("reason") ?? ""),
  };
  const parsed = timeOffSchema.safeParse(raw);
  if (!parsed.success) return zodState(parsed.error, raw);

  // The staff row is RLS-filtered, so this also proves the caller may see this member.
  const { data: staff } = await supabase.from("staff").select("id, business_id").eq("id", staffId.data).maybeSingle();
  if (!staff) return { error: GENERIC, values: raw };

  const { error } = await supabase.from("time_off").insert({
    business_id: staff.business_id,
    staff_id: staff.id,
    // Whole days in UK time: from local midnight to local midnight after the last day.
    starts_at: localMidnightUtc(parsed.data.startDate).toISOString(),
    ends_at: localMidnightUtc(addDaysYmd(parsed.data.endDate, 1)).toISOString(),
    reason: parsed.data.reason,
  });
  if (error) return { error: GENERIC, values: raw };
  revalidatePath(`/dashboard/staff/${staffId.data}`);
  return { message: "Days off added." };
}

export async function deleteTimeOff(formData: FormData): Promise<void> {
  const { supabase } = await requireBusiness();
  const id = uuid.safeParse(String(formData.get("id") ?? ""));
  const staffId = uuid.safeParse(String(formData.get("staffId") ?? ""));
  if (!id.success || !staffId.success) return;
  await supabase.from("time_off").delete().eq("id", id.data).eq("staff_id", staffId.data);
  revalidatePath(`/dashboard/staff/${staffId.data}`);
}
