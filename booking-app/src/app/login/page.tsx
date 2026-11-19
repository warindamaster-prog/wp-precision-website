import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "./form";
import { Shell } from "@/components/ui";

export const metadata: Metadata = { title: "Log in" };

export default function LoginPage() {
  return (
    <Shell title="Log in">
      <LoginForm />
      <p className="mt-6 text-sm">
        New here? <Link className="underline" href="/signup">Create an account</Link>
      </p>
    </Shell>
  );
}
