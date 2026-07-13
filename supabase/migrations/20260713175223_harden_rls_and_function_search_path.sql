create index if not exists idx_admin_user_locations_location_id
  on public.admin_user_locations(location_id);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.current_business_date(p_timezone text default 'America/Argentina/Buenos_Aires')
returns date
language sql
stable
set search_path = public
as $$
  select (timezone(coalesce(p_timezone, 'America/Argentina/Buenos_Aires'), now()))::date;
$$;

create or replace function public.build_entry_state(
  p_employee_id uuid,
  p_location_id uuid,
  p_business_date date
)
returns table (
  employee_id uuid,
  employee_name text,
  dni text,
  location_id uuid,
  business_date date,
  state text,
  allowed_action text,
  start_time timestamptz,
  end_time timestamptz,
  worked_hours numeric,
  status_label text,
  last_event_at_label text
)
language sql
stable
set search_path = public
as $$
with employee_base as (
  select e.id, e.first_name || ' ' || e.last_name as employee_name, e.dni, e.location_id
  from public.employees e
  where e.id = p_employee_id
),
events as (
  select
    max(case when te.event_type = 'START' then te.occurred_at end) as start_time,
    max(case when te.event_type = 'END' then te.occurred_at end) as end_time
  from public.time_entries te
  where te.employee_id = p_employee_id
    and te.location_id = p_location_id
    and te.business_date = p_business_date
),
state_calc as (
  select
    eb.id as employee_id,
    eb.employee_name,
    eb.dni,
    eb.location_id,
    p_business_date as business_date,
    ev.start_time,
    ev.end_time,
    case
      when ev.start_time is null then 'NOT_STARTED'
      when ev.end_time is null then 'WORKING'
      else 'COMPLETED'
    end as state,
    case
      when ev.start_time is null then 'START'
      when ev.end_time is null then 'END'
      else 'NONE'
    end as allowed_action
  from employee_base eb
  cross join events ev
)
select
  sc.employee_id,
  sc.employee_name,
  sc.dni,
  sc.location_id,
  sc.business_date,
  sc.state,
  sc.allowed_action,
  sc.start_time,
  sc.end_time,
  case
    when sc.start_time is not null and sc.end_time is not null
    then extract(epoch from (sc.end_time - sc.start_time)) / 3600.0
    else null
  end as worked_hours,
  case
    when sc.state = 'NOT_STARTED' then 'No inicio'
    when sc.state = 'WORKING' then 'Trabajando'
    else 'Jornada finalizada'
  end as status_label,
  to_char(coalesce(sc.end_time, sc.start_time), 'HH24:MI') as last_event_at_label
from state_calc sc;
$$;

drop policy if exists deny_direct_access_locations on public.locations;
create policy deny_direct_access_locations
on public.locations
as restrictive
for all
to anon, authenticated
using (false)
with check (false);

drop policy if exists deny_direct_access_employees on public.employees;
create policy deny_direct_access_employees
on public.employees
as restrictive
for all
to anon, authenticated
using (false)
with check (false);

drop policy if exists deny_direct_access_admin_users on public.admin_users;
create policy deny_direct_access_admin_users
on public.admin_users
as restrictive
for all
to anon, authenticated
using (false)
with check (false);

drop policy if exists deny_direct_access_admin_user_locations on public.admin_user_locations;
create policy deny_direct_access_admin_user_locations
on public.admin_user_locations
as restrictive
for all
to anon, authenticated
using (false)
with check (false);

drop policy if exists deny_direct_access_time_entries on public.time_entries;
create policy deny_direct_access_time_entries
on public.time_entries
as restrictive
for all
to anon, authenticated
using (false)
with check (false);
