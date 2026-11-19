import type { Metadata } from "next";
import { Shell } from "@/components/ui";

export const metadata: Metadata = { title: "Check your email" };

export default function CheckEmailPage() {
  return (
    <Shell title="Check your email">
      <p>We&apos;ve sent you a confirmation link. Open it to finish setting up your business.</p>
    </Shell>
  );
}
