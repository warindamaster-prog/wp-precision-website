import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { OnboardingForm } from "./form";
import { Shell } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { publicEnv } from "@/lib/env";

export const metadata: Metadata = { title: "Set up your business" };

export default async function OnboardingPage() {
  const { supabase, user } = await requireUser();
  const { data: existing } = await supabase
    .from("business_members").select("business_id").eq("user_id", user.id).maybeSingle();
  if (existing) redirect("/dashboard");

  const siteHost = new URL(publicEnv().NEXT_PUBLIC_SITE_URL).host;
  return (
    <Shell title="Set up your business">
      <OnboardingForm siteHost={siteHost} />
    </Shell>
  );
}
