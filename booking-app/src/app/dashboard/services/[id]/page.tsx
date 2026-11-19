import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOwner } from "@/lib/auth";
import { penceToInput } from "@/lib/money";
import { uuid } from "@/lib/validation/catalog";
import { ServiceForm } from "../service-form";

export const metadata: Metadata = { title: "Edit service" };

export default async function EditServicePage({ params }: { params: Promise<{ id: string }> }) {
  const id = uuid.safeParse((await params).id);
  if (!id.success) notFound();
  const { supabase, business } = await requireOwner();
  const { data: s } = await supabase.from("services").select("*").eq("id", id.data).eq("business_id", business.id).maybeSingle();
  if (!s) notFound();

  return (
    <main className="space-y-6">
      <p><Link href="/dashboard/services" className="text-sm underline">← All services</Link></p>
      <h1 className="text-2xl font-semibold">Edit service</h1>
      <ServiceForm defaults={{
        id: s.id, name: s.name, description: s.description ?? "", duration: String(s.duration_minutes),
        bufferBefore: String(s.buffer_before_minutes), bufferAfter: String(s.buffer_after_minutes),
        price: penceToInput(s.price_pence), deposit: s.deposit_pence ? penceToInput(s.deposit_pence) : "", active: s.active,
      }} />
    </main>
  );
}
