import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireBusiness } from "@/lib/auth";
import { formatDate, minutesToHhmm } from "@/lib/time";
import { uuid } from "@/lib/validation/catalog";
import { deleteTimeOff } from "../actions";
import { HoursForm, ServicesForm, StaffForm, TimeOffForm } from "../staff-forms";

export const metadata: Metadata = { title: "Team member" };

export default async function StaffMemberPage({ params }: { params: Promise<{ id: string }> }) {
  const id = uuid.safeParse((await params).id);
  if (!id.success) notFound();
  const { supabase, business, role, user } = await requireBusiness();

  const { data: member } = await supabase.from("staff").select("id, name, email, active, user_id")
    .eq("id", id.data).eq("business_id", business.id).maybeSingle();
  if (!member) notFound();
  const isOwner = role === "owner";
  if (!isOwner && member.user_id !== user.id) notFound();

  const [hoursRes, offRes, servicesRes, assignedRes] = await Promise.all([
    supabase.from("working_hours").select("weekday, start_minute, end_minute").eq("staff_id", member.id)
      .order("weekday").order("start_minute"),
    supabase.from("time_off").select("id, starts_at, ends_at, reason").eq("staff_id", member.id)
      .gte("ends_at", new Date().toISOString()).order("starts_at"),
    isOwner ? supabase.from("services").select("id, name").eq("business_id", business.id).eq("active", true).order("name") : Promise.resolve({ data: [] }),
    isOwner ? supabase.from("staff_services").select("service_id").eq("staff_id", member.id) : Promise.resolve({ data: [] }),
  ]);

  const initial: Record<string, string> = {};
  const seen: Record<number, number> = {};
  for (const h of hoursRes.data ?? []) {
    const n = (seen[h.weekday] = (seen[h.weekday] ?? -1) + 1);
    initial[`h-${h.weekday}-${n}-start`] = minutesToHhmm(h.start_minute);
    initial[`h-${h.weekday}-${n}-end`] = minutesToHhmm(h.end_minute);
  }

  return (
    <main className="space-y-10">
      {isOwner && <p><Link href="/dashboard/staff" className="text-sm underline">← All staff</Link></p>}
      <h1 className="text-2xl font-semibold">{member.name}</h1>

      {isOwner && (
        <>
          <section aria-labelledby="details-h" className="space-y-4">
            <h2 id="details-h" className="text-xl font-semibold">Details</h2>
            <StaffForm defaults={{ id: member.id, name: member.name, email: member.email ?? "", active: member.active }} />
          </section>
          <section aria-labelledby="services-h" className="space-y-4">
            <h2 id="services-h" className="text-xl font-semibold">Services offered</h2>
            <ServicesForm staffId={member.id} services={servicesRes.data ?? []}
              selected={(assignedRes.data ?? []).map((r) => r.service_id)} />
          </section>
        </>
      )}

      <section aria-labelledby="hours-h" className="space-y-4">
        <h2 id="hours-h" className="text-xl font-semibold">Working hours</h2>
        <HoursForm staffId={member.id} initial={initial} />
      </section>

      <section aria-labelledby="off-h" className="space-y-4">
        <h2 id="off-h" className="text-xl font-semibold">Days off</h2>
        {offRes.data?.length ? (
          <ul className="divide-y divide-neutral-300 rounded-md border border-neutral-300 dark:divide-neutral-700 dark:border-neutral-700">
            {offRes.data.map((o) => {
              // ends_at is local midnight after the last day off; show the last day itself.
              const last = new Date(new Date(o.ends_at).getTime() - 12 * 3600 * 1000);
              const same = formatDate(o.starts_at) === formatDate(last);
              return (
                <li key={o.id} className="flex items-center justify-between gap-4 p-3">
                  <div>
                    <p>{same ? formatDate(o.starts_at) : `${formatDate(o.starts_at)} to ${formatDate(last)}`}</p>
                    {o.reason && <p className="text-sm text-neutral-600 dark:text-neutral-400">{o.reason}</p>}
                  </div>
                  <form action={deleteTimeOff}>
                    <input type="hidden" name="id" value={o.id} />
                    <input type="hidden" name="staffId" value={member.id} />
                    <button type="submit" className="text-sm underline">Remove<span className="sr-only"> days off</span></button>
                  </form>
                </li>
              );
            })}
          </ul>
        ) : <p>No upcoming days off.</p>}
        <TimeOffForm staffId={member.id} />
      </section>
    </main>
  );
}
