import type { InputHTMLAttributes, ReactNode } from "react";

export function Field({
  label, name, errors, hint, ...props
}: { label: string; name: string; errors?: string[]; hint?: string } & InputHTMLAttributes<HTMLInputElement>) {
  const hintId = hint ? `${name}-hint` : undefined;
  const errId = errors?.length ? `${name}-error` : undefined;
  return (
    <div className="space-y-1">
      <label htmlFor={name} className="block text-sm font-medium">{label}</label>
      <input
        id={name}
        name={name}
        aria-invalid={errId ? true : undefined}
        aria-describedby={[hintId, errId].filter(Boolean).join(" ") || undefined}
        className="block w-full rounded-md border border-neutral-400 bg-transparent px-3 py-2 text-base"
        {...props}
      />
      {hint && <p id={hintId} className="text-sm text-neutral-600 dark:text-neutral-400">{hint}</p>}
      {errId && <p id={errId} className="text-sm text-red-700 dark:text-red-400">{errors![0]}</p>}
    </div>
  );
}

export function SubmitButton({ children, pending }: { children: ReactNode; pending?: boolean }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-md bg-neutral-900 px-4 py-3 text-base font-medium text-white disabled:opacity-60 dark:bg-white dark:text-neutral-900"
    >
      {pending ? "Please wait…" : children}
    </button>
  );
}

export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return <p role="alert" className="rounded-md border border-red-700 p-3 text-sm text-red-700 dark:text-red-400">{message}</p>;
}

export function Shell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-md px-4 py-10">
      <h1 className="mb-6 text-2xl font-semibold">{title}</h1>
      {children}
    </main>
  );
}
