# Booking app: schema proposal (awaiting approval)

Decisions so far: lives in `booking-app/`, Stripe Connect Standard for deposits, owner and staff logins.

## Conventions
- All instants are `timestamptz` (UTC). Working hours are local wall-clock, interpreted in `businesses.timezone` at slot generation, so BST/GMT is handled correctly.
- Money is integer pence.
- Every table has `business_id`; composite FKs `(business_id, x_id)` stop cross-tenant references.
- Extensions: `btree_gist`, `pgcrypto`.

## Tables

| Table | Key columns |
|---|---|
| businesses | id, slug (unique, `^[a-z0-9][a-z0-9-]{2,39}$`), name, timezone (default Europe/London), logo_path, cancellation_window_hours (24), slot_interval_minutes (15), min_notice_minutes, max_advance_days, stripe_account_id, stripe_charges_enabled, stripe_customer_id, subscription_status, trial_ends_at, privacy_notice_url |
| business_members | PK (business_id, user_id), role in (owner, staff) |
| staff | id, business_id, user_id (nullable until invite accepted), name, email, active, sort_order; unique (business_id, id) |
| working_hours | staff_id, weekday 1-7, start_minute, end_minute; several ranges per day; exclusion constraint prevents overlaps |
| time_off | staff_id, starts_at, ends_at, reason; check ends_at > starts_at |
| services | name, description, duration_minutes, buffer_before_minutes, buffer_after_minutes, price_pence, deposit_pence (0 <= deposit <= price), active |
| staff_services | PK (staff_id, service_id) |
| customers | name, email, phone, marketing_consent, marketing_consent_at, anonymised_at; unique (business_id, lower(email)) |
| bookings | see below |
| booking_notifications | booking_id, kind (confirmation/reminder/cancellation), channel (email now, sms later), status, provider_id, sent_at; unique (booking_id, kind, channel) |
| stripe_events | event_id PK, business_id nullable; webhook idempotency; service role only |
| rate_limits | key, window_start, count; Postgres-based limiter, no extra infra; service role only |

`stripe_events` and `rate_limits` are platform-level (RLS on, no policies, server only).

## bookings and the double-booking constraint

```sql
create table bookings (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  staff_id uuid not null,
  service_id uuid not null,
  customer_id uuid not null,
  starts_at timestamptz not null,
  ends_at   timestamptz not null,
  blocked   tstzrange not null,             -- includes buffers
  status text not null check (status in
    ('pending_payment','confirmed','cancelled','no_show','completed','expired')),
  service_name text not null, duration_minutes int not null,
  price_pence int not null, deposit_pence int not null default 0,
  deposit_status text not null default 'none'
    check (deposit_status in ('none','pending','paid','refunded','retained')),
  stripe_checkout_session_id text, stripe_payment_intent_id text,
  hold_expires_at timestamptz,
  cancel_token_hash bytea not null,         -- sha256; raw token only in email
  cancelled_at timestamptz,
  cancelled_by text check (cancelled_by in ('customer','business')),
  reminder_sent_at timestamptz,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at),
  foreign key (business_id, staff_id)    references staff(business_id, id),
  foreign key (business_id, service_id)  references services(business_id, id),
  foreign key (business_id, customer_id) references customers(business_id, id),
  constraint no_double_booking exclude using gist
    (staff_id with =, blocked with &&)
    where (status in ('pending_payment','confirmed','completed','no_show'))
);
```

- Reschedule is an UPDATE, so the same constraint applies.
- "Any staff" resolves to a concrete staff_id on the server; on SQLSTATE 23P01 retry with the next staff member or return "slot just taken".
- Expired unpaid holds are released by lazy cleanup in the booking transaction plus a Vercel cron.

## RLS
- Helpers (private schema, security definer, stable): `is_member(business_id)`, `is_owner(business_id)`, `my_staff_id(business_id)`.
- Anon has no table grants. The public page and booking endpoint run server-side (service role) after zod validation and rate limiting, creating bookings via a single `create_booking()` function.

| Table | Owner | Staff |
|---|---|---|
| businesses | read, update | read |
| staff, services, staff_services, working_hours, time_off | full | read; edit own hours/time off |
| bookings | full | read/update own bookings (no-show, cancel, reschedule) |
| customers | full | read customers of own bookings |
| booking_notifications | read | read own |
| business_members | read, manage | read own |

- Business creation via `create_business()` RPC (business + owner membership + staff row, atomic).
- Logos: Supabase Storage bucket with policies limiting writes to the user's own `business_id/` path.

## GDPR
- Export: JSON of one customer's record and bookings.
- Delete: anonymise (name "Deleted customer", email/phone nulled, `anonymised_at` set); booking rows kept without PII for financial records.
- Only name, email, phone collected; marketing consent defaults to false.

## Assumptions to confirm
1. Deposit refunded if customer cancels outside the window, retained inside it; always refunded if the business cancels.
2. Slot hold 15 minutes during deposit payment.
3. Slot interval 15 minutes, configurable per business.
4. Subscription via Stripe Billing, 14-day trial, price ID in env var; dashboard locks when lapsed.
5. Manual booking creation by owners, multi-location, recurring bookings and SMS go to TODO.md as "later".
