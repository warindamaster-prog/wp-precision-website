import type { Metadata } from "next";
import Link from "next/link";
import { SignupForm } from "./form";
import { Shell } from "@/components/ui";

export const metadata: Metadata = { title: "Create your account" };

export default function SignupPage() {
  return (
    <Shell title="Create your account">
      <SignupForm />
      <p className="mt-6 text-sm">
        Already registered? <Link className="underline" href="/login">Log in</Link>
      </p>
    </Shell>
  );
}
