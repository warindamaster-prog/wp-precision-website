"use client";

import { useActionState, useState } from "react";
import { createBusiness } from "./actions";
import { Field, FormError, SubmitButton } from "@/components/ui";
import type { FormState } from "@/lib/form";
import { slugify } from "@/lib/slug";

export function OnboardingForm({ siteHost }: { siteHost: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(createBusiness, {});
  const [slug, setSlug] = useState<string | null>(null); // null = follow the business name
  const [name, setName] = useState("");
  const shownSlug = slug ?? state.values?.slug ?? slugify(name);

  return (
    <form action={action} className="space-y-4" noValidate>
      <FormError message={state.error} />
      <Field label="Business name" name="name" required maxLength={100} autoComplete="organization"
        defaultValue={state.values?.name} errors={state.fieldErrors?.name}
        onChange={(e) => setName(e.target.value)} />
      <Field label="Web address" name="slug" required value={shownSlug}
        onChange={(e) => setSlug(e.target.value.toLowerCase())}
        hint={`Your booking page: ${siteHost}/b/${shownSlug || "your-name"}`}
        errors={state.fieldErrors?.slug} autoCapitalize="none" spellCheck={false} />
      <Field label="Your name" name="staffName" required maxLength={100} autoComplete="name"
        hint="Shown to customers if you take bookings yourself."
        defaultValue={state.values?.staffName} errors={state.fieldErrors?.staffName} />
      <div className="space-y-1">
        <span className="block text-sm font-medium">Time zone</span>
        <p className="rounded-md border border-neutral-400 px-3 py-2">Europe/London (UK time)</p>
      </div>
      <Field label="Logo (optional)" name="logo" type="file" accept="image/png,image/jpeg,image/webp"
        hint="PNG, JPEG or WebP, up to 2 MB." errors={state.fieldErrors?.logo} />
      <SubmitButton pending={pending}>Create my business</SubmitButton>
    </form>
  );
}
