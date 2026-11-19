"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { publicEnv } from "@/lib/env";
import { signupSchema } from "@/lib/validation/auth";
import { zodState, type FormState } from "@/lib/form";

export async function signup(_: FormState, formData: FormData): Promise<FormState> {
  const raw = { email: String(formData.get("email") ?? ""), password: String(formData.get("password") ?? "") };
  const parsed = signupSchema.safeParse(raw);
  if (!parsed.success) return zodState(parsed.error, { email: raw.email });

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { emailRedirectTo: `${publicEnv().NEXT_PUBLIC_SITE_URL}/auth/callback?next=/onboarding` },
  });
  if (error) return { error: "We couldn't create that account. Try a different email or password.", values: { email: raw.email } };

  if (data.session) redirect("/onboarding");
  redirect("/signup/check-email");
}
