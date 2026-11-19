"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { zodState, type FormState } from "@/lib/form";
import {
  LOGO_MAX_BYTES, LOGO_TYPES, onboardingSchema, sniffLogoType,
} from "@/lib/validation/business";

export async function createBusiness(_: FormState, formData: FormData): Promise<FormState> {
  const { supabase } = await requireUser();

  const raw = {
    name: String(formData.get("name") ?? ""),
    slug: String(formData.get("slug") ?? ""),
    staffName: String(formData.get("staffName") ?? ""),
  };
  const parsed = onboardingSchema.safeParse(raw);
  if (!parsed.success) return zodState(parsed.error, raw);

  // Optional logo: validate size and real file signature before creating anything.
  let logo: { bytes: Uint8Array; type: keyof typeof LOGO_TYPES } | null = null;
  const file = formData.get("logo");
  if (file instanceof File && file.size > 0) {
    if (file.size > LOGO_MAX_BYTES) {
      return { fieldErrors: { logo: ["Logo must be 2 MB or smaller"] }, values: raw };
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    const type = sniffLogoType(bytes);
    if (!type) return { fieldErrors: { logo: ["Use a PNG, JPEG or WebP image"] }, values: raw };
    logo = { bytes, type };
  }

  const { data: businessId, error } = await supabase.rpc("create_business", {
    p_name: parsed.data.name,
    p_slug: parsed.data.slug,
    p_staff_name: parsed.data.staffName,
  });
  if (error) {
    if (error.code === "23505") {
      return { fieldErrors: { slug: ["That web address is taken. Try another."] }, values: raw };
    }
    if (error.code === "P0001") redirect("/dashboard");
    return { error: "Something went wrong creating your business. Please try again.", values: raw };
  }

  let logoFailed = false;
  if (logo) {
    const path = `${businessId}/logo-${crypto.randomUUID()}.${LOGO_TYPES[logo.type]}`;
    const up = await supabase.storage.from("logos").upload(path, logo.bytes, {
      contentType: logo.type, cacheControl: "31536000",
    });
    if (up.error) {
      logoFailed = true;
    } else {
      const upd = await supabase.from("businesses").update({ logo_path: path }).eq("id", businessId);
      if (upd.error) logoFailed = true;
    }
  }
  redirect(logoFailed ? "/dashboard?logo=failed" : "/dashboard");
}
