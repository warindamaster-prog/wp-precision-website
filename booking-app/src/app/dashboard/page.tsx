import type { Metadata } from "next";
import Link from "next/link";
import { requireBusiness } from "@/lib/auth";
import { publicEnv } from "@/lib/env";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage({
  searchParams,
}: { searchParams: Promise<{ logo?: string }> }) {
  const { business, role } = await requireBusiness();
  const { logo } = await searchParams;
  const publicUrl = `${publicEnv().NEXT_PUBLIC_SITE_URL}/b/${business.slug}`;

  return (
    <main className="space-y-4">
      {logo === "failed" && (
        <p role="status" className="rounded-md border border-amber-700 p-3 text-sm">
          Your business was created, but the logo couldn&apos;t be uploaded. You can add it later.
        </p>
      )}
      <p>Your booking page: <a className="underline" href={publicUrl}>{publicUrl}</a></p>
      {role === "owner" && (
        <p>
          Next: add your <Link className="underline" href="/dashboard/services">services</Link>, then
          set up your <Link className="underline" href="/dashboard/staff">staff</Link> and their working hours.
        </p>
      )}
    </main>
  );
}
