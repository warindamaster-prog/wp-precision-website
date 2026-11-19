import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-md px-4 py-16">
      <h1 className="mb-3 text-3xl font-semibold">Online booking for UK salons</h1>
      <p className="mb-8">Flat monthly fee. No commission on bookings.</p>
      <div className="flex gap-3">
        <Link href="/signup" className="rounded-md bg-neutral-900 px-4 py-3 text-white dark:bg-white dark:text-neutral-900">Get started</Link>
        <Link href="/login" className="rounded-md border border-neutral-400 px-4 py-3">Log in</Link>
      </div>
    </main>
  );
}
