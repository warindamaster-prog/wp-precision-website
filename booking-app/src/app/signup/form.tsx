"use client";

import { useActionState } from "react";
import { signup } from "./actions";
import { Field, FormError, SubmitButton } from "@/components/ui";
import type { FormState } from "@/lib/form";

export function SignupForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(signup, {});
  return (
    <form action={action} className="space-y-4" noValidate>
      <FormError message={state.error} />
      <Field label="Email" name="email" type="email" autoComplete="email" required
        defaultValue={state.values?.email} errors={state.fieldErrors?.email} />
      <Field label="Password" name="password" type="password" autoComplete="new-password" required
        hint="At least 10 characters." errors={state.fieldErrors?.password} />
      <SubmitButton pending={pending}>Create account</SubmitButton>
    </form>
  );
}
