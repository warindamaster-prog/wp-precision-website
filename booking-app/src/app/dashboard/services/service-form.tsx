"use client";

import { useActionState } from "react";
import { saveService } from "./actions";
import { Field, FormError, SubmitButton } from "@/components/ui";
import type { FormState } from "@/lib/form";

export type ServiceDefaults = {
  id?: string; name: string; description: string; duration: string;
  bufferBefore: string; bufferAfter: string; price: string; deposit: string; active: boolean;
};

export const EMPTY_SERVICE: ServiceDefaults = {
  name: "", description: "", duration: "60", bufferBefore: "0", bufferAfter: "0", price: "", deposit: "", active: true,
};

export function ServiceForm({ defaults }: { defaults: ServiceDefaults }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveService, {});
  const v = state.values ?? {};
  const e = state.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-4" noValidate>
      <FormError message={state.error} />
      {defaults.id && <input type="hidden" name="id" value={defaults.id} />}
      <Field label="Service name" name="name" required maxLength={100} defaultValue={v.name ?? defaults.name} errors={e.name} />
      <div className="space-y-1">
        <label htmlFor="description" className="block text-sm font-medium">Description (optional)</label>
        <textarea id="description" name="description" rows={3} maxLength={500}
          defaultValue={v.description ?? defaults.description}
          aria-describedby={e.description ? "description-error" : undefined}
          className="block w-full rounded-md border border-neutral-400 bg-transparent px-3 py-2 text-base" />
        {e.description && <p id="description-error" className="text-sm text-red-700 dark:text-red-400">{e.description[0]}</p>}
      </div>
      <Field label="Duration (minutes)" name="duration" inputMode="numeric" required defaultValue={v.duration ?? defaults.duration} errors={e.duration} />
      <div className="grid grid-cols-2 gap-4">
        <Field label="Price (£)" name="price" inputMode="decimal" required defaultValue={v.price ?? defaults.price} errors={e.price} />
        <Field label="Deposit (£, optional)" name="deposit" inputMode="decimal" defaultValue={v.deposit ?? defaults.deposit}
          hint="Leave blank for no deposit." errors={e.deposit} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Buffer before (min)" name="bufferBefore" inputMode="numeric" defaultValue={v.bufferBefore ?? defaults.bufferBefore} errors={e.bufferBefore} />
        <Field label="Buffer after (min)" name="bufferAfter" inputMode="numeric" defaultValue={v.bufferAfter ?? defaults.bufferAfter} errors={e.bufferAfter} />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="active" defaultChecked={v.active !== undefined ? v.active === "on" : defaults.active} />
        Available to book
      </label>
      <SubmitButton pending={pending}>{defaults.id ? "Save changes" : "Add service"}</SubmitButton>
    </form>
  );
}
