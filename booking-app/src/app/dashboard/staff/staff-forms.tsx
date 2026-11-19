"use client";

import { useActionState } from "react";
import { addTimeOff, saveHours, saveStaff, saveStaffServices } from "./actions";
import { Field, FormError, SubmitButton } from "@/components/ui";
import type { FormState } from "@/lib/form";
import { WEEKDAYS, RANGES_PER_DAY } from "@/lib/hours";

function Message({ text }: { text?: string }) {
  if (!text) return null;
  return <p role="status" className="rounded-md border border-green-700 p-3 text-sm text-green-800 dark:text-green-400">{text}</p>;
}

export function StaffForm({ defaults }: { defaults: { id?: string; name: string; email: string; active: boolean } }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveStaff, {});
  const v = state.values ?? {};
  return (
    <form action={action} className="space-y-4" noValidate>
      <FormError message={state.error} />
      <Message text={state.message} />
      {defaults.id && <input type="hidden" name="id" value={defaults.id} />}
      <Field label="Name" name="name" required maxLength={100} defaultValue={v.name ?? defaults.name} errors={state.fieldErrors?.name} />
      <Field label="Email (optional)" name="email" type="email" autoComplete="off" defaultValue={v.email ?? defaults.email}
        hint="Used for their own login later. Never shown to customers." errors={state.fieldErrors?.email} />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="active" defaultChecked={v.active !== undefined ? v.active === "on" : defaults.active} />
        Takes bookings
      </label>
      <SubmitButton pending={pending}>{defaults.id ? "Save changes" : "Add team member"}</SubmitButton>
    </form>
  );
}

export function ServicesForm({ staffId, services, selected }: {
  staffId: string; services: { id: string; name: string }[]; selected: string[];
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveStaffServices, {});
  if (!services.length) return <p>Add a service first, then choose which ones this person offers.</p>;
  return (
    <form action={action} className="space-y-4">
      <FormError message={state.error} />
      <Message text={state.message} />
      <input type="hidden" name="staffId" value={staffId} />
      <fieldset className="space-y-2">
        <legend className="sr-only">Services offered</legend>
        {services.map((s) => (
          <label key={s.id} className="flex items-center gap-2">
            <input type="checkbox" name="service" value={s.id} defaultChecked={selected.includes(s.id)} /> {s.name}
          </label>
        ))}
      </fieldset>
      <SubmitButton pending={pending}>Save services</SubmitButton>
    </form>
  );
}

export function HoursForm({ staffId, initial }: {
  staffId: string; initial: Record<string, string>; // keys like "h-1-0-start"
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveHours, {});
  return (
    <form action={action} className="space-y-4">
      <FormError message={state.error} />
      <Message text={state.message} />
      <input type="hidden" name="staffId" value={staffId} />
      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        Times are UK time. Leave a day blank if closed. Use the second row for a split day, such as after a lunch break.
      </p>
      {WEEKDAYS.map((day, i) => {
        const wd = i + 1;
        const err = state.fieldErrors?.[`day-${wd}`]?.[0];
        return (
          <fieldset key={day} className="rounded-md border border-neutral-300 p-3 dark:border-neutral-700">
            <legend className="px-1 text-sm font-medium">{day}</legend>
            {Array.from({ length: RANGES_PER_DAY }, (_, n) => (
              <div key={n} className="mb-2 flex items-center gap-2 last:mb-0">
                <label className="sr-only" htmlFor={`h-${wd}-${n}-start`}>{day} range {n + 1} start</label>
                <input id={`h-${wd}-${n}-start`} name={`h-${wd}-${n}-start`} type="time" defaultValue={initial[`h-${wd}-${n}-start`] ?? ""}
                  aria-invalid={err ? true : undefined} aria-describedby={err ? `day-${wd}-error` : undefined}
                  className="rounded-md border border-neutral-400 bg-transparent px-2 py-1" />
                <span aria-hidden="true">to</span>
                <label className="sr-only" htmlFor={`h-${wd}-${n}-end`}>{day} range {n + 1} end</label>
                <input id={`h-${wd}-${n}-end`} name={`h-${wd}-${n}-end`} type="time" defaultValue={initial[`h-${wd}-${n}-end`] ?? ""}
                  className="rounded-md border border-neutral-400 bg-transparent px-2 py-1" />
              </div>
            ))}
            {err && <p id={`day-${wd}-error`} className="mt-1 text-sm text-red-700 dark:text-red-400">{err}</p>}
          </fieldset>
        );
      })}
      <SubmitButton pending={pending}>Save working hours</SubmitButton>
    </form>
  );
}

export function TimeOffForm({ staffId }: { staffId: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(addTimeOff, {});
  const v = state.values ?? {};
  const e = state.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-4" noValidate>
      <FormError message={state.error} />
      <Message text={state.message} />
      <input type="hidden" name="staffId" value={staffId} />
      <div className="grid grid-cols-2 gap-4">
        <Field label="First day off" name="startDate" type="date" required defaultValue={v.startDate} errors={e.startDate} />
        <Field label="Last day off" name="endDate" type="date" required defaultValue={v.endDate} errors={e.endDate} />
      </div>
      <Field label="Reason (optional)" name="reason" maxLength={200} defaultValue={v.reason} errors={e.reason} />
      <SubmitButton pending={pending}>Add days off</SubmitButton>
    </form>
  );
}
