-- Row Level Security. Anon gets nothing; the public booking flow runs server-side
-- with the service role after zod validation and rate limiting.

create schema if not exists private;
grant usage on schema private to authenticated;

-- ------------------------------------------------------------------ helpers
create function private.is_member(b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.business_members m
    where m.business_id = b and m.user_id = (select auth.uid()));
$$;

create function private.is_owner(b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.business_members m
    where m.business_id = b and m.user_id = (select auth.uid()) and m.role = 'owner');
$$;

create function private.my_staff_id(b uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select s.id from public.staff s
  where s.business_id = b and s.user_id = (select auth.uid()) limit 1;
$$;

-- Storage helper: first path segment must be a business id the caller owns.
create function private.is_owner_path(name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select case
    when split_part(name, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then private.is_owner(split_part(name, '/', 1)::uuid)
    else false end;
$$;

revoke all on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated;

-- -------------------------------------------------- reset default privileges
revoke all on all tables in schema public from anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;

alter table public.businesses            enable row level security;
alter table public.business_members      enable row level security;
alter table public.staff                 enable row level security;
alter table public.working_hours         enable row level security;
alter table public.time_off              enable row level security;
alter table public.services              enable row level security;
alter table public.staff_services        enable row level security;
alter table public.customers             enable row level security;
alter table public.bookings              enable row level security;
alter table public.booking_notifications enable row level security;
alter table public.stripe_events         enable row level security;  -- no policies: server only
alter table public.rate_limits           enable row level security;  -- no policies: server only

-- ---------------------------------------------------------------- businesses
-- Insert only through create_business(). Stripe/subscription columns are not
-- writable by clients (column-level grant).
grant select on public.businesses to authenticated;
grant update (name, email, timezone, logo_path, cancellation_window_hours,
              slot_interval_minutes, min_notice_minutes, max_advance_days,
              privacy_notice_url)
  on public.businesses to authenticated;

create policy businesses_select on public.businesses
  for select to authenticated using (private.is_member(id));
create policy businesses_update on public.businesses
  for update to authenticated
  using (private.is_owner(id)) with check (private.is_owner(id));

-- ---------------------------------------------------------- business_members
grant select on public.business_members to authenticated;
create policy members_select on public.business_members
  for select to authenticated
  using (user_id = (select auth.uid()) or private.is_owner(business_id));

-- --------------------------------------------------------------------- staff
grant select, insert, update, delete on public.staff to authenticated;
create policy staff_select on public.staff
  for select to authenticated using (private.is_member(business_id));
create policy staff_insert on public.staff
  for insert to authenticated with check (private.is_owner(business_id));
create policy staff_update on public.staff
  for update to authenticated
  using (private.is_owner(business_id)) with check (private.is_owner(business_id));
create policy staff_delete on public.staff
  for delete to authenticated using (private.is_owner(business_id));

-- ----------------------------------------- working_hours and time_off
-- Owner manages everyone; a staff member manages their own.
grant select, insert, update, delete on public.working_hours, public.time_off to authenticated;

create policy wh_select on public.working_hours
  for select to authenticated using (private.is_member(business_id));
create policy wh_write on public.working_hours
  for all to authenticated
  using (private.is_owner(business_id) or staff_id = private.my_staff_id(business_id))
  with check (private.is_owner(business_id) or staff_id = private.my_staff_id(business_id));

create policy to_select on public.time_off
  for select to authenticated using (private.is_member(business_id));
create policy to_write on public.time_off
  for all to authenticated
  using (private.is_owner(business_id) or staff_id = private.my_staff_id(business_id))
  with check (private.is_owner(business_id) or staff_id = private.my_staff_id(business_id));

-- ------------------------------------------------ services, staff_services
grant select, insert, update, delete on public.services, public.staff_services to authenticated;

create policy services_select on public.services
  for select to authenticated using (private.is_member(business_id));
create policy services_write on public.services
  for all to authenticated
  using (private.is_owner(business_id)) with check (private.is_owner(business_id));

create policy ss_select on public.staff_services
  for select to authenticated using (private.is_member(business_id));
create policy ss_write on public.staff_services
  for all to authenticated
  using (private.is_owner(business_id)) with check (private.is_owner(business_id));

-- ----------------------------------------------------------------- bookings
-- Created only server-side. Owner: all bookings. Staff: their own.
grant select on public.bookings to authenticated;
grant update (staff_id, starts_at, ends_at, status, cancelled_at, cancelled_by)
  on public.bookings to authenticated;

create policy bookings_select on public.bookings
  for select to authenticated
  using (private.is_owner(business_id) or staff_id = private.my_staff_id(business_id));
create policy bookings_update on public.bookings
  for update to authenticated
  using (private.is_owner(business_id) or staff_id = private.my_staff_id(business_id))
  with check (private.is_owner(business_id) or staff_id = private.my_staff_id(business_id));

-- ---------------------------------------------------------------- customers
-- Business may correct contact details; consent is never writable by clients.
grant select on public.customers to authenticated;
grant update (name, email, phone) on public.customers to authenticated;

create policy customers_select on public.customers
  for select to authenticated
  using (
    private.is_owner(business_id)
    or exists (
      select 1 from public.bookings b
      where b.customer_id = customers.id
        and b.business_id = customers.business_id
        and b.staff_id = private.my_staff_id(b.business_id)));
create policy customers_update on public.customers
  for update to authenticated
  using (private.is_owner(business_id)) with check (private.is_owner(business_id));

-- ----------------------------------------------------- booking_notifications
grant select on public.booking_notifications to authenticated;
create policy notif_select on public.booking_notifications
  for select to authenticated
  using (
    private.is_owner(business_id)
    or exists (
      select 1 from public.bookings b
      where b.id = booking_notifications.booking_id
        and b.staff_id = private.my_staff_id(b.business_id)));

-- ---------------------------------------------------------- create_business()
-- Atomically creates the business, the owner membership and a staff row.
create function public.create_business(p_name text, p_slug text, p_staff_name text)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  uemail text := (select auth.jwt() ->> 'email');
  bid uuid;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if exists (select 1 from public.business_members where user_id = uid) then
    raise exception 'user already belongs to a business' using errcode = 'P0001';
  end if;

  insert into public.businesses (name, slug, email)
  values (p_name, p_slug, uemail) returning id into bid;

  insert into public.business_members (business_id, user_id, role)
  values (bid, uid, 'owner');

  insert into public.staff (business_id, user_id, name, email)
  values (bid, uid, p_staff_name, uemail);

  return bid;
end $$;

revoke all on function public.create_business(text, text, text) from public, anon;
grant execute on function public.create_business(text, text, text) to authenticated;

-- ----------------------------------------------------------------- storage
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('logos', 'logos', true, 2097152, array['image/png','image/jpeg','image/webp'])
on conflict (id) do nothing;

create policy logos_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'logos' and private.is_owner_path(name));
create policy logos_update on storage.objects
  for update to authenticated
  using (bucket_id = 'logos' and private.is_owner_path(name))
  with check (bucket_id = 'logos' and private.is_owner_path(name));
create policy logos_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'logos' and private.is_owner_path(name));
