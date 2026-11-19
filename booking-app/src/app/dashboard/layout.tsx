import Link from "next/link";
import { requireBusiness } from "@/lib/auth";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { supabase, business, role, user } = await requireBusiness();
  const logoUrl = business.logo_path
    ? supabase.storage.from("logos").getPublicUrl(business.logo_path).data.publicUrl
    : null;

  let myStaffId: string | null = null;
  if (role === "staff") {
    const { data } = await supabase.from("staff").select("id").eq("business_id", business.id).eq("user_id", user.id).maybeSingle();
    myStaffId = data?.id ?? null;
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6">
      <header className="mb-6 flex items-center justify-between gap-4">
        <Link href="/dashboard" className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {logoUrl && <img src={logoUrl} alt="" width={40} height={40} className="h-10 w-10 rounded-md object-cover" />}
          <span className="text-xl font-semibold">{business.name}</span>
        </Link>
        <form action="/auth/signout" method="post">
          <button type="submit" className="text-sm underline">Log out</button>
        </form>
      </header>
      <nav aria-label="Dashboard" className="mb-8 flex gap-4 border-b border-neutral-300 pb-3 text-sm dark:border-neutral-700">
        <Link href="/dashboard" className="underline-offset-4 hover:underline">Overview</Link>
        {role === "owner" ? (
          <>
            <Link href="/dashboard/services" className="underline-offset-4 hover:underline">Services</Link>
            <Link href="/dashboard/staff" className="underline-offset-4 hover:underline">Staff</Link>
          </>
        ) : myStaffId ? (
          <Link href={`/dashboard/staff/${myStaffId}`} className="underline-offset-4 hover:underline">My hours</Link>
        ) : null}
      </nav>
      {children}
    </div>
  );
}
