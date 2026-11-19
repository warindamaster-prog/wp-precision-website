import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/** Verified user (hits the Auth server) or redirect to login. */
export async function requireUser() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) redirect("/login");
  return { supabase, user: data.user };
}

/** The signed-in user's business membership, or redirect to onboarding. */
export async function requireBusiness() {
  const { supabase, user } = await requireUser();
  const { data: member } = await supabase
    .from("business_members")
    .select("role, business_id, businesses(id, name, slug, logo_path)")
    .eq("user_id", user.id)
    .maybeSingle();
  const business = Array.isArray(member?.businesses) ? member?.businesses[0] : member?.businesses;
  if (!member || !business) redirect("/onboarding");
  return { supabase, user, role: member.role as "owner" | "staff", business };
}
