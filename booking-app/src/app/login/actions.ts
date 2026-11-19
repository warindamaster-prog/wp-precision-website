"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loginSchema } from "@/lib/validation/auth";
import { zodState, type FormState } from "@/lib/form";

export async function login(_: FormState, formData: FormData): Promise<FormState> {
  const raw = { email: String(formData.get("email") ?? ""), password: String(formData.get("password") ?? "") };
  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) return zodState(parsed.error, { email: raw.email });

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: "Incorrect email or password.", values: { email: raw.email } };
  redirect("/dashboard");
}
