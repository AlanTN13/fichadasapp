create extension if not exists pgcrypto;

create table if not exists public.locations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  dni text not null unique,
  first_name text not null,
  last_name text not null,
  active boolean not null default true,
  location_id uuid not null references public.locations(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  role text not null check (role in ('super_admin', 'location_admin')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.admin_user_locations (
  admin_user_id uuid not null references public.admin_users(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade,
  primary key (admin_user_id, location_id)
);

create table if not exists public.time_entries (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id),
  location_id uuid not null references public.locations(id),
  event_type text not null check (event_type in ('START', 'END')),
  occurred_at timestamptz not null default now(),
  business_date date not null,
  photo_path text null,
  latitude double precision null,
  longitude double precision null,
  device_id text null,
  idempotency_key uuid not null unique,
  sync_source text not null default 'kiosk-web',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_employees_location on public.employees(location_id);
create index if not exists idx_time_entries_employee_business_date on public.time_entries(employee_id, business_date, occurred_at);
create index if not exists idx_time_entries_location_business_date on public.time_entries(location_id, business_date);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_locations_updated_at on public.locations;
create trigger trg_locations_updated_at
before update on public.locations
for each row execute function public.touch_updated_at();

drop trigger if exists trg_employees_updated_at on public.employees;
create trigger trg_employees_updated_at
before update on public.employees
for each row execute function public.touch_updated_at();

create or replace function public.current_business_date(p_timezone text default 'America/Argentina/Buenos_Aires')
returns date
language sql
stable
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

create or replace function public.login_with_email(p_email text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  user_row public.admin_users;
  locations_payload jsonb;
begin
  select * into user_row
  from public.admin_users
  where lower(email) = lower(trim(p_email))
    and active = true;

  if user_row.id is null then
    return jsonb_build_object('success', false, 'error', 'Email no autorizado o inactivo.');
  end if;

  select coalesce(
    jsonb_agg(jsonb_build_object('id', l.id, 'name', l.name) order by l.name),
    '[]'::jsonb
  ) into locations_payload
  from public.locations l
  where l.active = true
    and (
      user_row.role = 'super_admin'
      or exists (
        select 1
        from public.admin_user_locations aul
        where aul.admin_user_id = user_row.id
          and aul.location_id = l.id
      )
    );

  return jsonb_build_object(
    'success', true,
    'role', user_row.role,
    'locations', locations_payload
  );
end;
$$;

create or replace function public.get_locations_for_email(p_email text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.login_with_email(p_email);
end;
$$;

create or replace function public.get_kiosk_state_by_dni(
  p_dni text,
  p_location_id uuid,
  p_timezone text default 'America/Argentina/Buenos_Aires'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  employee_row public.employees;
  state_row record;
  current_business_date date := public.current_business_date(p_timezone);
begin
  select * into employee_row
  from public.employees
  where dni = trim(p_dni)
    and active = true;

  if employee_row.id is null then
    return jsonb_build_object('success', false, 'error', 'Empleado inexistente o inactivo.');
  end if;

  if employee_row.location_id <> p_location_id then
    return jsonb_build_object('success', false, 'error', 'El empleado no pertenece a la sede seleccionada.');
  end if;

  select * into state_row
  from public.build_entry_state(employee_row.id, p_location_id, current_business_date);

  return jsonb_build_object(
    'success', true,
    'employee_id', state_row.employee_id,
    'employee_name', state_row.employee_name,
    'dni', state_row.dni,
    'location_id', state_row.location_id,
    'business_date', state_row.business_date,
    'state', state_row.state,
    'allowed_action', state_row.allowed_action,
    'start_time', state_row.start_time,
    'end_time', state_row.end_time,
    'worked_hours', state_row.worked_hours,
    'status_label', state_row.status_label,
    'last_event_at_label', state_row.last_event_at_label
  );
end;
$$;

create or replace function public.record_time_entry(
  p_dni text,
  p_location_id uuid,
  p_requested_event text,
  p_idempotency_key uuid,
  p_photo_path text default null,
  p_latitude double precision default null,
  p_longitude double precision default null,
  p_device_id text default null,
  p_sync_source text default 'kiosk-web',
  p_timezone text default 'America/Argentina/Buenos_Aires'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  employee_row public.employees;
  current_state jsonb;
  business_day date := public.current_business_date(p_timezone);
  existing_entry public.time_entries;
begin
  select * into existing_entry
  from public.time_entries
  where idempotency_key = p_idempotency_key;

  if existing_entry.id is not null then
    select public.get_kiosk_state_by_dni(p_dni, p_location_id, p_timezone) into current_state;
    return jsonb_build_object('success', true, 'idempotent', true, 'state', current_state);
  end if;

  select * into employee_row
  from public.employees
  where dni = trim(p_dni)
    and active = true
  for update;

  if employee_row.id is null then
    return jsonb_build_object('success', false, 'error', 'Empleado inexistente o inactivo.');
  end if;

  if employee_row.location_id <> p_location_id then
    return jsonb_build_object('success', false, 'error', 'El empleado no pertenece a la sede seleccionada.');
  end if;

  select public.get_kiosk_state_by_dni(p_dni, p_location_id, p_timezone) into current_state;

  if current_state->>'allowed_action' <> p_requested_event then
    return jsonb_build_object(
      'success', false,
      'error', 'Secuencia invalida para la jornada actual.',
      'state', current_state
    );
  end if;

  insert into public.time_entries (
    employee_id,
    location_id,
    event_type,
    business_date,
    photo_path,
    latitude,
    longitude,
    device_id,
    idempotency_key,
    sync_source
  ) values (
    employee_row.id,
    p_location_id,
    p_requested_event,
    business_day,
    p_photo_path,
    p_latitude,
    p_longitude,
    p_device_id,
    p_idempotency_key,
    coalesce(p_sync_source, 'kiosk-web')
  );

  select public.get_kiosk_state_by_dni(p_dni, p_location_id, p_timezone) into current_state;

  return jsonb_build_object(
    'success', true,
    'idempotent', false,
    'state', current_state
  );
end;
$$;

create or replace function public.get_dashboard_summary(
  p_email text,
  p_location_id uuid default null,
  p_business_date date default null,
  p_status text default null,
  p_timezone text default 'America/Argentina/Buenos_Aires'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  user_row public.admin_users;
  business_day date := coalesce(p_business_date, public.current_business_date(p_timezone));
  metrics_payload jsonb;
  rows_payload jsonb;
  locations_payload jsonb;
begin
  select * into user_row
  from public.admin_users
  where lower(email) = lower(trim(p_email))
    and active = true;

  if user_row.id is null then
    return jsonb_build_object('success', false, 'error', 'Usuario no autorizado');
  end if;

  with allowed_locations as (
    select l.id, l.name
    from public.locations l
    where l.active = true
      and (
        user_row.role = 'super_admin'
        or exists (
          select 1
          from public.admin_user_locations aul
          where aul.admin_user_id = user_row.id
            and aul.location_id = l.id
        )
      )
      and (p_location_id is null or l.id = p_location_id)
  ),
  employee_base as (
    select e.id, e.dni, e.first_name || ' ' || e.last_name as employee_name, e.location_id, l.name as location_name
    from public.employees e
    join allowed_locations l on l.id = e.location_id
    where e.active = true
  ),
  state_rows as (
    select
      eb.employee_name,
      eb.dni,
      eb.location_id,
      eb.location_name,
      s.state,
      s.allowed_action,
      s.start_time,
      s.end_time,
      s.worked_hours
    from employee_base eb
    cross join lateral public.build_entry_state(eb.id, eb.location_id, business_day) s
  ),
  filtered_rows as (
    select *
    from state_rows
    where p_status is null
      or (
        p_status = 'NOT_CHECKED_IN' and state = 'NOT_STARTED'
      )
      or (
        p_status = 'WORKING' and state = 'WORKING'
      )
      or (
        p_status = 'COMPLETED' and state = 'COMPLETED'
      )
  )
  select jsonb_build_object(
    'checked_in_today', count(*) filter (where state <> 'NOT_STARTED'),
    'not_checked_in', count(*) filter (where state = 'NOT_STARTED'),
    'working', count(*) filter (where state = 'WORKING'),
    'completed', count(*) filter (where state = 'COMPLETED'),
    'total_worked_hours', coalesce(sum(worked_hours) filter (where state = 'COMPLETED'), 0),
    'total_worked_hours_label',
      to_char(make_interval(hours => floor(coalesce(sum(worked_hours) filter (where state = 'COMPLETED'), 0))::int, mins => floor((coalesce(sum(worked_hours) filter (where state = 'COMPLETED'), 0) - floor(coalesce(sum(worked_hours) filter (where state = 'COMPLETED'), 0))) * 60)::int), 'HH24:MI')
  ) into metrics_payload
  from filtered_rows;

  with allowed_locations as (
    select l.id, l.name
    from public.locations l
    where l.active = true
      and (
        user_row.role = 'super_admin'
        or exists (
          select 1 from public.admin_user_locations aul
          where aul.admin_user_id = user_row.id and aul.location_id = l.id
        )
      )
  ),
  employee_base as (
    select e.id, e.dni, e.first_name || ' ' || e.last_name as employee_name, e.location_id, l.name as location_name
    from public.employees e
    join allowed_locations l on l.id = e.location_id
    where e.active = true
      and (p_location_id is null or e.location_id = p_location_id)
  ),
  state_rows as (
    select
      eb.employee_name,
      eb.dni,
      eb.location_id,
      eb.location_name,
      s.state,
      s.allowed_action,
      s.start_time,
      s.end_time,
      s.worked_hours
    from employee_base eb
    cross join lateral public.build_entry_state(eb.id, eb.location_id, business_day) s
  ),
  filtered_rows as (
    select *
    from state_rows
    where p_status is null
      or (
        p_status = 'NOT_CHECKED_IN' and state = 'NOT_STARTED'
      )
      or (
        p_status = 'WORKING' and state = 'WORKING'
      )
      or (
        p_status = 'COMPLETED' and state = 'COMPLETED'
      )
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'employee_name', employee_name,
    'dni', dni,
    'location_id', location_id,
    'location_name', location_name,
    'status', state,
    'status_label',
      case
        when state = 'NOT_STARTED' then 'No ficho'
        when state = 'WORKING' then 'Trabajando'
        else 'Jornada finalizada'
      end,
    'start_time', to_char(start_time, 'HH24:MI'),
    'end_time', to_char(end_time, 'HH24:MI'),
    'worked_hours', worked_hours
  ) order by employee_name), '[]'::jsonb) into rows_payload
  from filtered_rows;

  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', name) order by name), '[]'::jsonb)
  into locations_payload
  from (
    select distinct l.id, l.name
    from public.locations l
    where l.active = true
      and (
        user_row.role = 'super_admin'
        or exists (
          select 1 from public.admin_user_locations aul
          where aul.admin_user_id = user_row.id and aul.location_id = l.id
        )
      )
  ) l;

  return jsonb_build_object(
    'success', true,
    'business_date', business_day,
    'metrics', metrics_payload,
    'rows', rows_payload,
    'locations', locations_payload
  );
end;
$$;

alter table public.locations enable row level security;
alter table public.employees enable row level security;
alter table public.admin_users enable row level security;
alter table public.admin_user_locations enable row level security;
alter table public.time_entries enable row level security;

revoke all on public.locations from anon, authenticated;
revoke all on public.employees from anon, authenticated;
revoke all on public.admin_users from anon, authenticated;
revoke all on public.admin_user_locations from anon, authenticated;
revoke all on public.time_entries from anon, authenticated;
grant usage on schema public to anon, authenticated;

grant execute on function public.login_with_email(text) to anon, authenticated;
grant execute on function public.get_locations_for_email(text) to anon, authenticated;
grant execute on function public.get_kiosk_state_by_dni(text, uuid, text) to anon, authenticated;
grant execute on function public.record_time_entry(text, uuid, text, uuid, text, double precision, double precision, text, text, text) to anon, authenticated;
grant execute on function public.get_dashboard_summary(text, uuid, date, text, text) to anon, authenticated;

insert into storage.buckets (id, name, public)
values ('time-entry-photos', 'time-entry-photos', false)
on conflict (id) do nothing;

drop policy if exists "anon can upload time entry photos" on storage.objects;
create policy "anon can upload time entry photos"
on storage.objects
for insert
to anon, authenticated
with check (bucket_id = 'time-entry-photos');

drop policy if exists "deny public reads of time entry photos" on storage.objects;
create policy "deny public reads of time entry photos"
on storage.objects
for select
to anon, authenticated
using (false);
