import type { Metadata } from "next";
import Link from "next/link";
import { requireOwner } from "@/lib/auth";
import { StaffForm } from "./staff-forms";

export const metadata: Metadata = { title: "Staff" };

export default async function StaffPage() {
  const { supabase, business } = await requireOwner();
  const { data: staff } = await supabase
    .from("staff").select("id, name, email, active").eq("business_id", business.id)
    .order("active", { ascending: false }).order("sort_order").order("name");

  return (
    <main className="space-y-10">
      <section aria-labelledby="staff-h">
        <h1 id="staff-h" className="mb-4 text-2xl font-semibold">Staff</h1>
        <ul className="divide-y divide-neutral-300 rounded-md border border-neutral-300 dark:divide-neutral-700 dark:border-neutral-700">
          {staff?.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-4 p-3">
              <div>
                <p className="font-medium">{s.name}{!s.active && <span className="ml-2 text-sm text-neutral-600 dark:text-neutral-400">(not taking bookings)</span>}</p>
                {s.email && <p className="text-sm text-neutral-600 dark:text-neutral-400">{s.email}</p>}
              </div>
              <Link href={`/dashboard/staff/${s.id}`} className="text-sm underline">Manage<span className="sr-only"> {s.name}</span></Link>
            </li>
          ))}
        </ul>
      </section>
      <section aria-labelledby="add-h">
        <h2 id="add-h" className="mb-4 text-xl font-semibold">Add a team member</h2>
        <StaffForm defaults={{ name: "", email: "", active: true }} />
      </section>
    </main>
  );
}
