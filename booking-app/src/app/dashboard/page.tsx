import type { Metadata } from "next";
import { requireBusiness } from "@/lib/auth";
import { publicEnv } from "@/lib/env";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage({
  searchParams,
}: { searchParams: Promise<{ logo?: string }> }) {
  const { supabase, business } = await requireBusiness();
  const { logo } = await searchParams;
  const logoUrl = business.logo_path
    ? supabase.storage.from("logos").getPublicUrl(business.logo_path).data.publicUrl
    : null;
  const publicUrl = `${publicEnv().NEXT_PUBLIC_SITE_URL}/b/${business.slug}`;

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <header className="mb-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {logoUrl && <img src={logoUrl} alt="" width={48} height={48} className="h-12 w-12 rounded-md object-cover" />}
          <h1 className="text-2xl font-semibold">{business.name}</h1>
        </div>
        <form action="/auth/signout" method="post">
          <button type="submit" className="text-sm underline">Log out</button>
        </form>
      </header>
      {logo === "failed" && (
        <p role="status" className="mb-4 rounded-md border border-amber-700 p-3 text-sm">
          Your business was created, but the logo couldn&apos;t be uploaded. You can add it later.
        </p>
      )}
      <p>Your booking page: <a className="underline" href={publicUrl}>{publicUrl}</a></p>
    </main>
  );
}
