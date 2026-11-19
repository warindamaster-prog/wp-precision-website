import type { ZodError } from "zod";
import { z } from "zod";

export type FormState = {
  error?: string;
  message?: string; // success feedback
  fieldErrors?: Record<string, string[] | undefined>;
  values?: Record<string, string>;
};

export function zodState(err: ZodError, values: Record<string, string>): FormState {
  return { fieldErrors: z.flattenError(err).fieldErrors as FormState["fieldErrors"], values };
}
