# Booking app (MVP)

Online booking for UK hair, nails and massage businesses. Flat monthly fee, no per-booking commission.

Stack: Next.js (App Router) + Tailwind, Supabase (Postgres, Auth, RLS, Storage), Stripe, Resend, Vercel.

## Setup

1. `cd booking-app && npm install`
2. Create a Supabase project. Apply `supabase/migrations/*.sql` in order (SQL editor, or `supabase db push`).
3. In Supabase Auth settings, add `http://localhost:3000/auth/callback` (and your production URL) to the redirect URLs.
4. `cp .env.example .env.local` and fill in the values (see `.env.example`).
5. `npm run dev` and open http://localhost:3000

## Tests

- `npm test` runs unit tests and the database tests. The database tests apply the real migrations in an in-process Postgres (PGlite) and check the double-booking constraint and RLS isolation. No Supabase project is needed.
- `npm run typecheck`, `npm run lint`

## Deploying to Vercel

This app lives in the `booking-app/` subfolder of the repo. Create a separate Vercel project and set **Root Directory** to `booking-app`. The existing static site keeps its own project.

More sections (Stripe, Resend, cron) are added as those steps land. See `TODO.md` for what is intentionally left for later.
