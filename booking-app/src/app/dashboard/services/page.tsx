import type { Metadata } from "next";
import Link from "next/link";
import { requireOwner } from "@/lib/auth";
import { formatPence } from "@/lib/money";
import { EMPTY_SERVICE, ServiceForm } from "./service-form";

export const metadata: Metadata = { title: "Services" };

export default async function ServicesPage() {
  const { supabase, business } = await requireOwner();
  const { data: services } = await supabase
    .from("services")
    .select("id, name, duration_minutes, price_pence, deposit_pence, active")
    .eq("business_id", business.id)
    .order("active", { ascending: false })
    .order("name");

  return (
    <main className="space-y-10">
      <section aria-labelledby="services-h">
        <h1 id="services-h" className="mb-4 text-2xl font-semibold">Services</h1>
        {services?.length ? (
          <ul className="divide-y divide-neutral-300 rounded-md border border-neutral-300 dark:divide-neutral-700 dark:border-neutral-700">
            {services.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-4 p-3">
                <div>
                  <p className="font-medium">{s.name}{!s.active && <span className="ml-2 text-sm text-neutral-600 dark:text-neutral-400">(hidden)</span>}</p>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400">
                    {s.duration_minutes} min · {formatPence(s.price_pence)}
                    {s.deposit_pence > 0 && ` · ${formatPence(s.deposit_pence)} deposit`}
                  </p>
                </div>
                <Link href={`/dashboard/services/${s.id}`} className="text-sm underline">Edit<span className="sr-only"> {s.name}</span></Link>
              </li>
            ))}
          </ul>
        ) : (
          <p>You haven&apos;t added any services yet.</p>
        )}
      </section>
      <section aria-labelledby="add-h">
        <h2 id="add-h" className="mb-4 text-xl font-semibold">Add a service</h2>
        <ServiceForm defaults={EMPTY_SERVICE} />
      </section>
    </main>
  );
}
