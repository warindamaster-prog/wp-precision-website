"use client";

import { useActionState } from "react";
import { login } from "./actions";
import { Field, FormError, SubmitButton } from "@/components/ui";
import type { FormState } from "@/lib/form";

export function LoginForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(login, {});
  return (
    <form action={action} className="space-y-4" noValidate>
      <FormError message={state.error} />
      <Field label="Email" name="email" type="email" autoComplete="email" required
        defaultValue={state.values?.email} errors={state.fieldErrors?.email} />
      <Field label="Password" name="password" type="password" autoComplete="current-password" required
        errors={state.fieldErrors?.password} />
      <SubmitButton pending={pending}>Log in</SubmitButton>
    </form>
  );
}
