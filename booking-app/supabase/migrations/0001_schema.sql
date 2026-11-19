-- Booking app schema. All instants are timestamptz (UTC).
-- Working hours are local wall-clock minutes, interpreted in businesses.timezone.

create extension if not exists btree_gist;
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- businesses
create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{2,39}$'),
  name text not null check (char_length(name) between 1 and 100),
  email text,                                   -- notifications + reply-to
  timezone text not null default 'Europe/London',
  logo_path text,
  cancellation_window_hours int not null default 24
    check (cancellation_window_hours between 0 and 720),
  slot_interval_minutes int not null default 15
    check (slot_interval_minutes in (5, 10, 15, 20, 30, 60)),
  min_notice_minutes int not null default 60 check (min_notice_minutes >= 0),
  max_advance_days int not null default 60 check (max_advance_days between 1 and 365),
  privacy_notice_url text,
  stripe_account_id text,
  stripe_charges_enabled boolean not null default false,
  stripe_customer_id text,
  subscription_status text not null default 'trialing'
    check (subscription_status in
      ('trialing','active','past_due','canceled','incomplete','unpaid')),
  trial_ends_at timestamptz not null default (now() + interval '14 days'),
  created_at timestamptz not null default now()
);

create table public.business_members (
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','staff')),
  created_at timestamptz not null default now(),
  primary key (business_id, user_id)
);
create index on public.business_members (user_id);

-- --------------------------------------------------------------------- staff
create table public.staff (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  name text not null check (char_length(name) between 1 and 100),
  email text,
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (business_id, id)
);
create index on public.staff (business_id);
create unique index staff_one_user_per_business
  on public.staff (business_id, user_id) where user_id is not null;

create table public.working_hours (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  staff_id uuid not null,
  weekday smallint not null check (weekday between 1 and 7),   -- ISO, 1 = Monday
  start_minute smallint not null check (start_minute between 0 and 1439),
  end_minute smallint not null check (end_minute between 1 and 1440),
  check (end_minute > start_minute),
  foreign key (business_id, staff_id)
    references public.staff (business_id, id) on delete cascade,
  constraint working_hours_no_overlap exclude using gist
    (staff_id with =, weekday with =,
     int4range(start_minute::int, end_minute::int) with &&)
);
create index on public.working_hours (business_id, staff_id);

create table public.time_off (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  staff_id uuid not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text check (char_length(reason) <= 200),
  check (ends_at > starts_at),
  foreign key (business_id, staff_id)
    references public.staff (business_id, id) on delete cascade
);
create index on public.time_off (business_id, staff_id, starts_at);

-- ------------------------------------------------------------------ services
create table public.services (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  description text check (char_length(description) <= 500),
  duration_minutes int not null check (duration_minutes between 5 and 720),
  buffer_before_minutes int not null default 0 check (buffer_before_minutes between 0 and 120),
  buffer_after_minutes int not null default 0 check (buffer_after_minutes between 0 and 120),
  price_pence int not null default 0 check (price_pence >= 0),
  deposit_pence int not null default 0,
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  check (deposit_pence >= 0 and deposit_pence <= price_pence),
  unique (business_id, id)
);
create index on public.services (business_id);

create table public.staff_services (
  business_id uuid not null,
  staff_id uuid not null,
  service_id uuid not null,
  primary key (staff_id, service_id),
  foreign key (business_id, staff_id)
    references public.staff (business_id, id) on delete cascade,
  foreign key (business_id, service_id)
    references public.services (business_id, id) on delete cascade
);
create index on public.staff_services (business_id, service_id);

-- ----------------------------------------------------------------- customers
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  email text check (char_length(email) <= 254),   -- null once anonymised
  phone text check (char_length(phone) <= 30),
  marketing_consent boolean not null default false,
  marketing_consent_at timestamptz,
  anonymised_at timestamptz,
  created_at timestamptz not null default now(),
  unique (business_id, id)
);
create unique index customers_email_per_business
  on public.customers (business_id, lower(email)) where email is not null;

-- ------------------------------------------------------------------ bookings
create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  staff_id uuid not null,
  service_id uuid not null,
  customer_id uuid not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  buffer_before_minutes int not null default 0,
  buffer_after_minutes int not null default 0,
  blocked tstzrange not null,                  -- set by trigger, includes buffers
  status text not null check (status in
    ('pending_payment','confirmed','cancelled','no_show','completed','expired')),
  service_name text not null,
  duration_minutes int not null,
  price_pence int not null,
  deposit_pence int not null default 0,
  deposit_status text not null default 'none'
    check (deposit_status in ('none','pending','paid','refunded','retained')),
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  hold_expires_at timestamptz,
  cancel_token_hash bytea not null,            -- sha256; raw token only in email
  cancelled_at timestamptz,
  cancelled_by text check (cancelled_by in ('customer','business')),
  reminder_sent_at timestamptz,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at),
  unique (business_id, id),
  foreign key (business_id, staff_id)    references public.staff (business_id, id),
  foreign key (business_id, service_id)  references public.services (business_id, id),
  foreign key (business_id, customer_id) references public.customers (business_id, id),
  -- The real guarantee: no two live bookings overlap for one staff member.
  constraint no_double_booking exclude using gist
    (staff_id with =, blocked with &&)
    where (status in ('pending_payment','confirmed','completed','no_show'))
);
create index on public.bookings (business_id, starts_at);
create index on public.bookings (staff_id, starts_at);
create index on public.bookings (customer_id);
create unique index bookings_cancel_token on public.bookings (cancel_token_hash);

-- blocked = [starts_at - buffer_before, ends_at + buffer_after)
create function public.bookings_set_blocked() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.blocked := tstzrange(
    new.starts_at - new.buffer_before_minutes * interval '1 minute',
    new.ends_at   + new.buffer_after_minutes  * interval '1 minute',
    '[)');
  return new;
end $$;

create trigger bookings_set_blocked
  before insert or update of starts_at, ends_at, buffer_before_minutes, buffer_after_minutes
  on public.bookings for each row execute function public.bookings_set_blocked();

create table public.booking_notifications (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  booking_id uuid not null,
  kind text not null check (kind in ('confirmation','reminder','cancellation','reschedule')),
  channel text not null default 'email' check (channel in ('email','sms')),
  status text not null default 'pending' check (status in ('pending','sent','failed')),
  provider_id text,
  error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (business_id, booking_id)
    references public.bookings (business_id, id) on delete cascade,
  unique (booking_id, kind, channel)
);

-- ---------------------------------------------------- platform-level (server only)
create table public.stripe_events (
  event_id text primary key,
  business_id uuid,
  type text not null,
  received_at timestamptz not null default now()
);

create table public.rate_limits (
  key text not null,
  window_start timestamptz not null,
  count int not null default 1,
  primary key (key, window_start)
);
