-- Atomic "replace all" helpers. SECURITY INVOKER: RLS still decides who may
-- change which staff member's rows (owner: anyone; staff: only themselves).

create function public.set_working_hours(p_staff_id uuid, p_hours jsonb)
returns void
language plpgsql security invoker set search_path = '' as $$
declare bid uuid;
begin
  select business_id into bid from public.staff where id = p_staff_id;
  if bid is null then
    raise exception 'staff member not found' using errcode = 'P0002';
  end if;

  delete from public.working_hours where staff_id = p_staff_id;

  insert into public.working_hours (business_id, staff_id, weekday, start_minute, end_minute)
  select bid, p_staff_id,
         (h ->> 'weekday')::smallint, (h ->> 'start')::smallint, (h ->> 'end')::smallint
  from jsonb_array_elements(p_hours) h;
end $$;

create function public.set_staff_services(p_staff_id uuid, p_service_ids uuid[])
returns void
language plpgsql security invoker set search_path = '' as $$
declare bid uuid;
begin
  select business_id into bid from public.staff where id = p_staff_id;
  if bid is null then
    raise exception 'staff member not found' using errcode = 'P0002';
  end if;

  delete from public.staff_services where staff_id = p_staff_id;

  insert into public.staff_services (business_id, staff_id, service_id)
  select bid, p_staff_id, s from unnest(p_service_ids) as s;
end $$;

revoke all on function public.set_working_hours(uuid, jsonb) from public, anon;
revoke all on function public.set_staff_services(uuid, uuid[]) from public, anon;
grant execute on function public.set_working_hours(uuid, jsonb) to authenticated;
grant execute on function public.set_staff_services(uuid, uuid[]) to authenticated;
