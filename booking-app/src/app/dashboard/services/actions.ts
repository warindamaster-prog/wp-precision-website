"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/auth";
import { zodState, type FormState } from "@/lib/form";
import { serviceSchema, uuid } from "@/lib/validation/catalog";

export async function saveService(_: FormState, formData: FormData): Promise<FormState> {
  const { supabase, business } = await requireOwner();

  const raw: Record<string, string> = {};
  for (const k of ["name", "description", "duration", "bufferBefore", "bufferAfter", "price", "deposit"]) {
    raw[k] = String(formData.get(k) ?? "");
  }
  const idRaw = String(formData.get("id") ?? "");
  const id = idRaw ? uuid.safeParse(idRaw) : null;
  if (id && !id.success) return { error: "That service could not be found." };

  const parsed = serviceSchema.safeParse({ ...raw, active: formData.get("active") === "on" });
  if (!parsed.success) return zodState(parsed.error, { ...raw, active: formData.get("active") === "on" ? "on" : "" });

  const v = parsed.data;
  const row = {
    name: v.name, description: v.description, duration_minutes: v.duration,
    buffer_before_minutes: v.bufferBefore, buffer_after_minutes: v.bufferAfter,
    price_pence: v.price, deposit_pence: v.deposit, active: v.active,
  };

  const { error } = id?.success
    ? await supabase.from("services").update(row).eq("id", id.data).eq("business_id", business.id)
    : await supabase.from("services").insert({ ...row, business_id: business.id });
  if (error) return { error: "We couldn't save that service. Please try again.", values: { ...raw, active: v.active ? "on" : "" } };

  revalidatePath("/dashboard/services");
  redirect("/dashboard/services");
}
