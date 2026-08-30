begin;

-- Fichadas 1.1: real Auth sessions, autonomous employee administration,
-- effective-dated weekly schedules, and persisted/idempotent inconsistencies.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

alter table public.admin_users
  add column if not exists auth_user_id uuid null references auth.users(id) on delete restrict;

create unique index if not exists admin_users_auth_user_id_key
  on public.admin_users(auth_user_id)
  where auth_user_id is not null;

-- Productive identities. Passwords remain exclusively in Supabase Auth.
delete from public.admin_user_locations aul
using public.admin_users au
where aul.admin_user_id = au.id
  and lower(au.email) = 'manager@empresa.com';

delete from public.admin_users
where lower(email) = 'manager@empresa.com';

insert into public.admin_users (email, role, active)
values
  ('romanarielmolina@gmail.com', 'super_admin', true),
  ('Lavaderoindustrialnahuel@gmail.com', 'location_admin', true)
on conflict (email) do update
set role = excluded.role,
    active = excluded.active;

update public.admin_users au
set auth_user_id = u.id
from auth.users u
where lower(u.email) = lower(au.email)
  and lower(au.email) in (
    'romanarielmolina@gmail.com',
    'lavaderoindustrialnahuel@gmail.com'
  );

delete from public.admin_user_locations aul
using public.admin_users au
where aul.admin_user_id = au.id
  and lower(au.email) = 'lavaderoindustrialnahuel@gmail.com';

insert into public.admin_user_locations (admin_user_id, location_id)
select au.id, l.id
from public.admin_users au
join public.locations l on lower(l.name) = 'planta' and l.active = true
where lower(au.email) = 'lavaderoindustrialnahuel@gmail.com'
on conflict (admin_user_id, location_id) do nothing;

create or replace function private.link_admin_auth_identity()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  update public.admin_users
  set auth_user_id = null
  where auth_user_id = new.id
    and lower(email) <> lower(new.email);

  update public.admin_users
  set auth_user_id = new.id
  where lower(email) = lower(new.email)
    and active = true;
  return new;
end;
$$;

drop trigger if exists link_admin_auth_identity on auth.users;
create trigger link_admin_auth_identity
after insert or update of email on auth.users
for each row execute function private.link_admin_auth_identity();

create or replace function private.current_admin()
returns public.admin_users
language plpgsql
security definer
stable
set search_path = public, auth
as $$
declare
  admin_row public.admin_users;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  select au.* into admin_row
  from public.admin_users au
  where au.active = true
    and au.auth_user_id = auth.uid()
  limit 1;

  if admin_row.id is null then
    raise exception 'ADMIN_NOT_AUTHORIZED' using errcode = '42501';
  end if;

  return admin_row;
end;
$$;

create or replace function private.can_access_location(p_admin public.admin_users, p_location_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select p_admin.role = 'super_admin'
    or exists (
      select 1
      from public.admin_user_locations aul
      where aul.admin_user_id = p_admin.id
        and aul.location_id = p_location_id
    );
$$;

create or replace function private.is_current_admin()
returns boolean
language plpgsql
security definer
stable
set search_path = public, auth
as $$
begin
  perform private.current_admin();
  return true;
exception
  when others then return false;
end;
$$;

create table if not exists public.employee_schedule_rules (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete restrict,
  weekday smallint not null check (weekday between 1 and 7),
  working_day boolean not null default false,
  expected_start time null,
  expected_end time null,
  tolerance_minutes integer not null default 0 check (tolerance_minutes between 0 and 180),
  valid_from date not null,
  valid_to date null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint employee_schedule_time_check check (
    (working_day = false and expected_start is null and expected_end is null)
    or
    (working_day = true and expected_start is not null and expected_end is not null and expected_end > expected_start)
  ),
  constraint employee_schedule_validity_check check (valid_to is null or valid_to >= valid_from),
  unique (employee_id, weekday, valid_from)
);

create unique index if not exists employee_schedule_one_current_rule
  on public.employee_schedule_rules(employee_id, weekday)
  where valid_to is null;

create index if not exists employee_schedule_effective_lookup
  on public.employee_schedule_rules(employee_id, weekday, valid_from, valid_to);

drop trigger if exists trg_employee_schedule_rules_updated_at on public.employee_schedule_rules;
create trigger trg_employee_schedule_rules_updated_at
before update on public.employee_schedule_rules
for each row execute function public.touch_updated_at();

create table if not exists public.attendance_inconsistencies (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete restrict,
  location_id uuid not null references public.locations(id) on delete restrict,
  business_date date not null,
  inconsistency_type text not null check (
    inconsistency_type in ('LATE_ARRIVAL', 'EARLY_DEPARTURE', 'MISSING_END', 'MISSING_START')
  ),
  expected_time time null,
  actual_time time null,
  tolerance_minutes integer not null default 0,
  status text not null default 'OPEN' check (status in ('OPEN', 'RESOLVED')),
  details jsonb not null default '{}'::jsonb,
  detected_at timestamptz not null default now(),
  resolved_at timestamptz null,
  updated_at timestamptz not null default now(),
  unique (employee_id, business_date, inconsistency_type)
);

create index if not exists attendance_inconsistencies_review_idx
  on public.attendance_inconsistencies(status, business_date desc, location_id);

drop trigger if exists trg_attendance_inconsistencies_updated_at on public.attendance_inconsistencies;
create trigger trg_attendance_inconsistencies_updated_at
before update on public.attendance_inconsistencies
for each row execute function public.touch_updated_at();

alter table public.employee_schedule_rules enable row level security;
alter table public.attendance_inconsistencies enable row level security;

revoke all on public.employee_schedule_rules from anon, authenticated;
revoke all on public.attendance_inconsistencies from anon, authenticated;

drop policy if exists deny_direct_access_employee_schedule_rules on public.employee_schedule_rules;
create policy deny_direct_access_employee_schedule_rules
on public.employee_schedule_rules
as restrictive
for all
to anon, authenticated
using (false)
with check (false);

drop policy if exists deny_direct_access_attendance_inconsistencies on public.attendance_inconsistencies;
create policy deny_direct_access_attendance_inconsistencies
on public.attendance_inconsistencies
as restrictive
for all
to anon, authenticated
using (false)
with check (false);

create or replace function private.refresh_employee_inconsistencies(
  p_employee_id uuid,
  p_date_from date,
  p_date_to date,
  p_timezone text default 'America/Argentina/Buenos_Aires'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  business_today date := public.current_business_date(p_timezone);
  local_time time := timezone(p_timezone, now())::time;
begin
  with schedule_days as (
    select
      e.id as employee_id,
      coalesce(
        (
          select te.location_id
          from public.time_entries te
          where te.employee_id = e.id
            and te.business_date = d.business_date
          order by te.occurred_at asc, te.id asc
          limit 1
        ),
        e.location_id
      ) as location_id,
      d.business_date,
      r.expected_start,
      r.expected_end,
      r.tolerance_minutes,
      (
        select min(timezone(p_timezone, te.occurred_at)::time)
        from public.time_entries te
        where te.employee_id = e.id
          and te.business_date = d.business_date
          and te.event_type = 'START'
      ) as actual_start,
      (
        select max(timezone(p_timezone, te.occurred_at)::time)
        from public.time_entries te
        where te.employee_id = e.id
          and te.business_date = d.business_date
          and te.event_type = 'END'
      ) as actual_end
    from public.employees e
    cross join lateral (
      select generate_series(p_date_from, p_date_to, interval '1 day')::date as business_date
    ) d
    join public.employee_schedule_rules r
      on r.employee_id = e.id
      and r.weekday = extract(isodow from d.business_date)::smallint
      and r.working_day = true
      and r.valid_from <= d.business_date
      and (r.valid_to is null or r.valid_to >= d.business_date)
    where e.id = p_employee_id
      and d.business_date <= business_today
  ),
  candidates as (
    select
      employee_id,
      location_id,
      business_date,
      'LATE_ARRIVAL'::text as inconsistency_type,
      expected_start as expected_time,
      actual_start as actual_time,
      tolerance_minutes,
      jsonb_build_object('message', 'Ingreso posterior al horario esperado') as details
    from schedule_days
    where actual_start is not null
      and actual_start > expected_start + make_interval(mins => tolerance_minutes)

    union all

    select
      employee_id,
      location_id,
      business_date,
      'EARLY_DEPARTURE',
      expected_end,
      actual_end,
      tolerance_minutes,
      jsonb_build_object('message', 'Salida anterior al horario esperado')
    from schedule_days
    where actual_end is not null
      and actual_end < expected_end - make_interval(mins => tolerance_minutes)

    union all

    select
      employee_id,
      location_id,
      business_date,
      'MISSING_END',
      expected_end,
      null::time,
      tolerance_minutes,
      jsonb_build_object('message', 'Jornada iniciada sin fichada de salida')
    from schedule_days
    where actual_start is not null
      and actual_end is null
      and (
        business_date < business_today
        or (business_date = business_today and local_time > expected_end + make_interval(mins => tolerance_minutes))
      )

    union all

    select
      employee_id,
      location_id,
      business_date,
      'MISSING_START',
      expected_start,
      null::time,
      tolerance_minutes,
      jsonb_build_object('message', 'Jornada esperada sin fichada de inicio')
    from schedule_days
    where actual_start is null
      and (
        business_date < business_today
        or (business_date = business_today and local_time > expected_start + make_interval(mins => tolerance_minutes))
      )
  ),
  upserted as (
    insert into public.attendance_inconsistencies (
      employee_id,
      location_id,
      business_date,
      inconsistency_type,
      expected_time,
      actual_time,
      tolerance_minutes,
      status,
      details,
      resolved_at
    )
    select
      employee_id,
      location_id,
      business_date,
      inconsistency_type,
      expected_time,
      actual_time,
      tolerance_minutes,
      'OPEN',
      details,
      null
    from candidates
    on conflict (employee_id, business_date, inconsistency_type) do update
    set location_id = excluded.location_id,
        expected_time = excluded.expected_time,
        actual_time = excluded.actual_time,
        tolerance_minutes = excluded.tolerance_minutes,
        status = 'OPEN',
        details = excluded.details,
        resolved_at = null
    returning employee_id, business_date, inconsistency_type
  )
  update public.attendance_inconsistencies ai
  set status = 'RESOLVED',
      resolved_at = now()
  where ai.employee_id = p_employee_id
    and ai.business_date between p_date_from and p_date_to
    and ai.status = 'OPEN'
    and not exists (
      select 1
      from candidates c
      where c.employee_id = ai.employee_id
        and c.business_date = ai.business_date
        and c.inconsistency_type = ai.inconsistency_type
    );
end;
$$;

create or replace function private.refresh_inconsistencies_after_entry()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform private.refresh_employee_inconsistencies(
    new.employee_id,
    new.business_date,
    new.business_date,
    'America/Argentina/Buenos_Aires'
  );
  return new;
end;
$$;

drop trigger if exists refresh_inconsistencies_after_entry on public.time_entries;
create trigger refresh_inconsistencies_after_entry
after insert on public.time_entries
for each row execute function private.refresh_inconsistencies_after_entry();

create or replace function public.get_admin_context()
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  admin_row public.admin_users := private.current_admin();
  locations_payload jsonb;
begin
  select coalesce(
    jsonb_agg(jsonb_build_object('id', l.id, 'name', l.name) order by l.name),
    '[]'::jsonb
  ) into locations_payload
  from public.locations l
  where l.active = true
    and private.can_access_location(admin_row, l.id);

  return jsonb_build_object(
    'success', true,
    'email', admin_row.email,
    'role', admin_row.role,
    'locations', locations_payload
  );
end;
$$;

create or replace function public.list_employees(
  p_include_inactive boolean default true,
  p_location_id uuid default null
)
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  admin_row public.admin_users := private.current_admin();
  employees_payload jsonb;
  locations_payload jsonb;
begin
  if admin_row.role <> 'super_admin' then
    raise exception 'SUPER_ADMIN_REQUIRED' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', e.id,
    'dni', e.dni,
    'first_name', e.first_name,
    'last_name', e.last_name,
    'active', e.active,
    'location_id', e.location_id,
    'location_name', l.name,
    'created_at', e.created_at,
    'updated_at', e.updated_at
  ) order by e.active desc, lower(e.last_name), lower(e.first_name)), '[]'::jsonb)
  into employees_payload
  from public.employees e
  join public.locations l on l.id = e.location_id
  where (p_include_inactive or e.active)
    and (p_location_id is null or e.location_id = p_location_id);

  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', name) order by name), '[]'::jsonb)
  into locations_payload
  from public.locations
  where active = true;

  return jsonb_build_object(
    'success', true,
    'employees', employees_payload,
    'locations', locations_payload
  );
end;
$$;

create or replace function public.save_employee(
  p_employee_id uuid,
  p_dni text,
  p_first_name text,
  p_last_name text,
  p_location_id uuid,
  p_active boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  admin_row public.admin_users := private.current_admin();
  saved_row public.employees;
begin
  if admin_row.role <> 'super_admin' then
    raise exception 'SUPER_ADMIN_REQUIRED' using errcode = '42501';
  end if;

  if trim(coalesce(p_dni, '')) !~ '^[0-9]{7,9}$' then
    return jsonb_build_object('success', false, 'error', 'El DNI debe tener entre 7 y 9 números.');
  end if;

  if trim(coalesce(p_first_name, '')) = '' or trim(coalesce(p_last_name, '')) = '' then
    return jsonb_build_object('success', false, 'error', 'Nombre y apellido son obligatorios.');
  end if;

  if not exists (select 1 from public.locations where id = p_location_id and active = true) then
    return jsonb_build_object('success', false, 'error', 'La sede seleccionada no está disponible.');
  end if;

  if p_employee_id is null then
    insert into public.employees (dni, first_name, last_name, location_id, active)
    values (
      trim(p_dni),
      initcap(trim(p_first_name)),
      initcap(trim(p_last_name)),
      p_location_id,
      coalesce(p_active, true)
    )
    returning * into saved_row;
  else
    update public.employees
    set dni = trim(p_dni),
        first_name = initcap(trim(p_first_name)),
        last_name = initcap(trim(p_last_name)),
        location_id = p_location_id,
        active = coalesce(p_active, active)
    where id = p_employee_id
    returning * into saved_row;

    if saved_row.id is null then
      return jsonb_build_object('success', false, 'error', 'Empleado inexistente.');
    end if;
  end if;

  if saved_row.active = false then
    delete from public.employee_schedule_rules
    where employee_id = saved_row.id
      and valid_to is null
      and valid_from = public.current_business_date();

    update public.employee_schedule_rules
    set valid_to = public.current_business_date() - 1
    where employee_id = saved_row.id
      and valid_to is null;
  end if;

  return jsonb_build_object(
    'success', true,
    'employee', jsonb_build_object(
      'id', saved_row.id,
      'dni', saved_row.dni,
      'first_name', saved_row.first_name,
      'last_name', saved_row.last_name,
      'location_id', saved_row.location_id,
      'active', saved_row.active
    )
  );
exception
  when unique_violation then
    return jsonb_build_object('success', false, 'error', 'Ya existe un empleado con ese DNI.');
end;
$$;

create or replace function public.get_employee_schedule(p_employee_id uuid)
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  admin_row public.admin_users := private.current_admin();
  employee_payload jsonb;
  schedule_payload jsonb;
begin
  if admin_row.role <> 'super_admin' then
    raise exception 'SUPER_ADMIN_REQUIRED' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'id', e.id,
    'name', e.first_name || ' ' || e.last_name,
    'active', e.active,
    'location_id', e.location_id,
    'location_name', l.name
  ) into employee_payload
  from public.employees e
  join public.locations l on l.id = e.location_id
  where e.id = p_employee_id;

  if employee_payload is null then
    return jsonb_build_object('success', false, 'error', 'Empleado inexistente.');
  end if;

  with weekdays as (
    select generate_series(1, 7)::smallint as weekday
  )
  select jsonb_agg(jsonb_build_object(
    'weekday', w.weekday,
    'working_day', coalesce(r.working_day, false),
    'expected_start', to_char(r.expected_start, 'HH24:MI'),
    'expected_end', to_char(r.expected_end, 'HH24:MI'),
    'tolerance_minutes', coalesce(r.tolerance_minutes, 0),
    'configured', r.id is not null
  ) order by w.weekday)
  into schedule_payload
  from weekdays w
  left join public.employee_schedule_rules r
    on r.employee_id = p_employee_id
    and r.weekday = w.weekday
    and r.valid_to is null;

  return jsonb_build_object(
    'success', true,
    'employee', employee_payload,
    'schedule', schedule_payload
  );
end;
$$;

create or replace function public.save_employee_schedule(
  p_employee_id uuid,
  p_schedule jsonb,
  p_timezone text default 'America/Argentina/Buenos_Aires'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  admin_row public.admin_users := private.current_admin();
  business_today date := public.current_business_date(p_timezone);
  item jsonb;
  day_number smallint;
  works boolean;
  start_at time;
  end_at time;
  tolerance integer;
begin
  if admin_row.role <> 'super_admin' then
    raise exception 'SUPER_ADMIN_REQUIRED' using errcode = '42501';
  end if;

  if not exists (select 1 from public.employees where id = p_employee_id) then
    return jsonb_build_object('success', false, 'error', 'Empleado inexistente.');
  end if;

  if jsonb_typeof(p_schedule) <> 'array' or jsonb_array_length(p_schedule) <> 7 then
    return jsonb_build_object('success', false, 'error', 'La jornada debe incluir los siete días de la semana.');
  end if;

  if (
    select count(distinct (value ->> 'weekday')::smallint)
    from jsonb_array_elements(p_schedule)
  ) <> 7 then
    return jsonb_build_object('success', false, 'error', 'Cada día de la semana debe aparecer una sola vez.');
  end if;

  for item in select value from jsonb_array_elements(p_schedule)
  loop
    day_number := (item ->> 'weekday')::smallint;
    works := coalesce((item ->> 'working_day')::boolean, false);
    tolerance := coalesce((item ->> 'tolerance_minutes')::integer, 0);
    start_at := case when works then nullif(item ->> 'expected_start', '')::time else null end;
    end_at := case when works then nullif(item ->> 'expected_end', '')::time else null end;

    if day_number not between 1 and 7 then
      return jsonb_build_object('success', false, 'error', 'Día de semana inválido.');
    end if;

    if tolerance not between 0 and 180 then
      return jsonb_build_object('success', false, 'error', 'La tolerancia debe estar entre 0 y 180 minutos.');
    end if;

    if works and (start_at is null or end_at is null or end_at <= start_at) then
      return jsonb_build_object('success', false, 'error', 'Cada día laboral necesita un ingreso y una salida válidos.');
    end if;

    if exists (
      select 1
      from public.employee_schedule_rules
      where employee_id = p_employee_id
        and weekday = day_number
        and valid_to is null
        and valid_from = business_today
    ) then
      update public.employee_schedule_rules
      set working_day = works,
          expected_start = start_at,
          expected_end = end_at,
          tolerance_minutes = tolerance
      where employee_id = p_employee_id
        and weekday = day_number
        and valid_to is null
        and valid_from = business_today;
    else
      update public.employee_schedule_rules
      set valid_to = business_today - 1
      where employee_id = p_employee_id
        and weekday = day_number
        and valid_to is null;

      insert into public.employee_schedule_rules (
        employee_id,
        weekday,
        working_day,
        expected_start,
        expected_end,
        tolerance_minutes,
        valid_from
      ) values (
        p_employee_id,
        day_number,
        works,
        start_at,
        end_at,
        tolerance,
        business_today
      );
    end if;
  end loop;

  perform private.refresh_employee_inconsistencies(
    p_employee_id,
    business_today,
    business_today,
    p_timezone
  );

  return jsonb_build_object('success', true);
exception
  when invalid_text_representation or datetime_field_overflow then
    return jsonb_build_object('success', false, 'error', 'Revisá los horarios y la tolerancia ingresados.');
end;
$$;

create or replace function public.list_inconsistencies(
  p_location_id uuid default null,
  p_date_from date default null,
  p_date_to date default null,
  p_status text default 'OPEN',
  p_timezone text default 'America/Argentina/Buenos_Aires'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  admin_row public.admin_users := private.current_admin();
  date_to_value date := coalesce(p_date_to, public.current_business_date(p_timezone));
  date_from_value date := coalesce(p_date_from, date_to_value - 30);
  employee_row record;
  inconsistencies_payload jsonb;
  counts_payload jsonb;
  locations_payload jsonb;
begin
  if admin_row.role <> 'super_admin' then
    raise exception 'SUPER_ADMIN_REQUIRED' using errcode = '42501';
  end if;

  if date_from_value > date_to_value then
    raise exception 'INVALID_DATE_RANGE';
  end if;

  for employee_row in
    select id
    from public.employees
    where p_location_id is null or location_id = p_location_id
  loop
    perform private.refresh_employee_inconsistencies(
      employee_row.id,
      date_from_value,
      date_to_value,
      p_timezone
    );
  end loop;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', ai.id,
    'employee_id', ai.employee_id,
    'employee_name', e.first_name || ' ' || e.last_name,
    'dni', e.dni,
    'location_id', ai.location_id,
    'location_name', l.name,
    'business_date', ai.business_date,
    'type', ai.inconsistency_type,
    'expected_time', to_char(ai.expected_time, 'HH24:MI'),
    'actual_time', to_char(ai.actual_time, 'HH24:MI'),
    'tolerance_minutes', ai.tolerance_minutes,
    'status', ai.status,
    'detected_at', ai.detected_at
  ) order by ai.business_date desc, lower(e.last_name), lower(e.first_name)), '[]'::jsonb)
  into inconsistencies_payload
  from public.attendance_inconsistencies ai
  join public.employees e on e.id = ai.employee_id
  join public.locations l on l.id = ai.location_id
  where ai.business_date between date_from_value and date_to_value
    and (p_location_id is null or ai.location_id = p_location_id)
    and (p_status is null or p_status = 'ALL' or ai.status = p_status);

  select jsonb_build_object(
    'open', count(*) filter (where status = 'OPEN'),
    'resolved', count(*) filter (where status = 'RESOLVED')
  ) into counts_payload
  from public.attendance_inconsistencies
  where business_date between date_from_value and date_to_value
    and (p_location_id is null or location_id = p_location_id);

  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', name) order by name), '[]'::jsonb)
  into locations_payload
  from public.locations
  where active = true;

  return jsonb_build_object(
    'success', true,
    'date_from', date_from_value,
    'date_to', date_to_value,
    'counts', counts_payload,
    'inconsistencies', inconsistencies_payload,
    'locations', locations_payload
  );
end;
$$;

-- Authenticated kiosk access with server-side role/location authorization.
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
  admin_row public.admin_users := private.current_admin();
  employee_row public.employees;
  state_row record;
  current_business_date date := public.current_business_date(p_timezone);
begin
  if not private.can_access_location(admin_row, p_location_id) then
    raise exception 'LOCATION_NOT_AUTHORIZED' using errcode = '42501';
  end if;

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
  admin_row public.admin_users := private.current_admin();
  employee_row public.employees;
  current_state jsonb;
  business_day date := public.current_business_date(p_timezone);
  existing_entry public.time_entries;
begin
  if not private.can_access_location(admin_row, p_location_id) then
    raise exception 'LOCATION_NOT_AUTHORIZED' using errcode = '42501';
  end if;

  select * into existing_entry
  from public.time_entries
  where idempotency_key = p_idempotency_key;

  if existing_entry.id is not null then
    if existing_entry.location_id <> p_location_id then
      raise exception 'IDEMPOTENCY_KEY_CONFLICT' using errcode = '23505';
    end if;
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

  if current_state ->> 'allowed_action' <> p_requested_event then
    return jsonb_build_object(
      'success', false,
      'error', 'Secuencia inválida para la jornada actual.',
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

-- Authenticated hours dashboard. It includes inactive employees when they have
-- entries in the selected range and reads historical entries from their stored
-- location, so changing an employee's current location does not erase history.
create or replace function public.get_hours_dashboard_range(
  p_location_id uuid default null,
  p_period_start date default null,
  p_period_end date default null,
  p_fortnight_start date default null,
  p_fortnight_end date default null,
  p_timezone text default 'America/Argentina/Buenos_Aires'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  admin_row public.admin_users := private.current_admin();
  period_start date := coalesce(p_period_start, public.current_business_date(p_timezone));
  period_end date := coalesce(p_period_end, coalesce(p_period_start, public.current_business_date(p_timezone)));
  fortnight_start date := coalesce(p_fortnight_start, period_start);
  fortnight_end date := coalesce(p_fortnight_end, period_end);
  swap_date date;
  summary_payload jsonb;
  rows_payload jsonb;
  locations_payload jsonb;
begin
  if period_end < period_start then
    swap_date := period_start; period_start := period_end; period_end := swap_date;
  end if;
  if fortnight_end < fortnight_start then
    swap_date := fortnight_start; fortnight_start := fortnight_end; fortnight_end := swap_date;
  end if;

  if p_location_id is not null and not private.can_access_location(admin_row, p_location_id) then
    raise exception 'LOCATION_NOT_AUTHORIZED' using errcode = '42501';
  end if;

  with allowed_locations as (
    select l.id, l.name
    from public.locations l
    where private.can_access_location(admin_row, l.id)
      and (p_location_id is null or l.id = p_location_id)
  ),
  employee_base as (
    select e.*
    from public.employees e
    where (
      (e.active and exists (select 1 from allowed_locations al where al.id = e.location_id))
      or exists (
        select 1
        from public.time_entries te
        join allowed_locations al on al.id = te.location_id
        where te.employee_id = e.id
          and te.business_date between least(period_start, fortnight_start) and greatest(period_end, fortnight_end)
      )
    )
  ),
  period_dates as (
    select generate_series(period_start, period_end, interval '1 day')::date as business_date
  ),
  period_states as (
    select
      eb.id as employee_id,
      pd.business_date,
      s.state,
      s.start_time,
      s.end_time,
      s.worked_hours
    from employee_base eb
    cross join period_dates pd
    cross join lateral (
      select coalesce(
        (
          select te.location_id
          from public.time_entries te
          join allowed_locations al on al.id = te.location_id
          where te.employee_id = eb.id and te.business_date = pd.business_date
          order by te.occurred_at desc, te.id desc
          limit 1
        ),
        case when exists (select 1 from allowed_locations al where al.id = eb.location_id) then eb.location_id end
      ) as location_id
    ) selected_location
    cross join lateral public.build_entry_state(eb.id, selected_location.location_id, pd.business_date) s
    where selected_location.location_id is not null
  ),
  period_totals as (
    select employee_id, coalesce(sum(worked_hours), 0) as total_period_hours
    from period_states
    group by employee_id
  )
  select jsonb_build_object(
    'employee_count', (select count(*) from employee_base),
    'total_period_hours', coalesce((select sum(total_period_hours) from period_totals), 0)
  ) into summary_payload;

  with allowed_locations as (
    select l.id, l.name
    from public.locations l
    where private.can_access_location(admin_row, l.id)
      and (p_location_id is null or l.id = p_location_id)
  ),
  employee_base as (
    select e.*
    from public.employees e
    where (
      (e.active and exists (select 1 from allowed_locations al where al.id = e.location_id))
      or exists (
        select 1
        from public.time_entries te
        join allowed_locations al on al.id = te.location_id
        where te.employee_id = e.id
          and te.business_date between least(period_start, fortnight_start) and greatest(period_end, fortnight_end)
      )
    )
  ),
  all_dates as (
    select generate_series(least(period_start, fortnight_start), greatest(period_end, fortnight_end), interval '1 day')::date as business_date
  ),
  all_states as (
    select
      eb.id as employee_id,
      ad.business_date,
      s.state,
      s.start_time,
      s.end_time,
      s.worked_hours
    from employee_base eb
    cross join all_dates ad
    cross join lateral (
      select coalesce(
        (
          select te.location_id
          from public.time_entries te
          join allowed_locations al on al.id = te.location_id
          where te.employee_id = eb.id and te.business_date = ad.business_date
          order by te.occurred_at desc, te.id desc
          limit 1
        ),
        case when exists (select 1 from allowed_locations al where al.id = eb.location_id) then eb.location_id end
      ) as location_id
    ) selected_location
    cross join lateral public.build_entry_state(eb.id, selected_location.location_id, ad.business_date) s
    where selected_location.location_id is not null
  ),
  period_totals as (
    select employee_id, coalesce(sum(worked_hours), 0) as total_period_hours
    from all_states
    where business_date between period_start and period_end
    group by employee_id
  ),
  fortnight_totals as (
    select employee_id, coalesce(sum(worked_hours), 0) as total_fortnight_hours
    from all_states
    where business_date between fortnight_start and fortnight_end
    group by employee_id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'employee_id', eb.id,
    'employee_name', eb.first_name || ' ' || eb.last_name,
    'dni', eb.dni,
    'active', eb.active,
    'location_id', eb.location_id,
    'location_name', l.name,
    'period_total_hours', coalesce(pt.total_period_hours, 0),
    'fortnight_total_hours', coalesce(ft.total_fortnight_hours, 0),
    'days', coalesce((
      select jsonb_agg(jsonb_build_object(
        'date', d.business_date::date,
        'state', coalesce(s.state, 'NOT_STARTED'),
        'worked_hours', s.worked_hours,
        'start_time', to_char(s.start_time, 'HH24:MI'),
        'end_time', to_char(s.end_time, 'HH24:MI')
      ) order by d.business_date)
      from generate_series(period_start, period_end, interval '1 day') d(business_date)
      left join all_states s
        on s.employee_id = eb.id
        and s.business_date = d.business_date::date
    ), '[]'::jsonb)
  ) order by eb.active desc, lower(eb.last_name), lower(eb.first_name)), '[]'::jsonb)
  into rows_payload
  from employee_base eb
  join public.locations l on l.id = eb.location_id
  left join period_totals pt on pt.employee_id = eb.id
  left join fortnight_totals ft on ft.employee_id = eb.id;

  select coalesce(jsonb_agg(jsonb_build_object('id', l.id, 'name', l.name) order by l.name), '[]'::jsonb)
  into locations_payload
  from public.locations l
  where l.active = true
    and private.can_access_location(admin_row, l.id);

  return jsonb_build_object(
    'success', true,
    'period', jsonb_build_object(
      'start_date', period_start,
      'end_date', period_end,
      'fortnight_start', fortnight_start,
      'fortnight_end', fortnight_end
    ),
    'summary', summary_payload,
    'rows', rows_payload,
    'locations', locations_payload
  );
end;
$$;

alter function public.get_kiosk_state_by_dni(text, uuid, text)
  set timezone to 'America/Argentina/Buenos_Aires';
alter function public.record_time_entry(text, uuid, text, uuid, text, double precision, double precision, text, text, text)
  set timezone to 'America/Argentina/Buenos_Aires';
alter function public.get_hours_dashboard_range(uuid, date, date, date, date, text)
  set timezone to 'America/Argentina/Buenos_Aires';

-- Remove the email-only public entry points and expose only session-bound RPCs.
revoke execute on all functions in schema public from public, anon;
revoke execute on function public.login_with_email(text) from authenticated;
revoke execute on function public.get_locations_for_email(text) from authenticated;
revoke execute on function public.get_dashboard_summary(text, uuid, date, text, text) from authenticated;
revoke execute on function public.get_hours_dashboard_range(text, uuid, date, date, date, date, text) from authenticated;

grant usage on schema private to authenticated;
grant execute on function private.is_current_admin() to authenticated;

grant execute on function public.get_admin_context() to authenticated;
grant execute on function public.list_employees(boolean, uuid) to authenticated;
grant execute on function public.save_employee(uuid, text, text, text, uuid, boolean) to authenticated;
grant execute on function public.get_employee_schedule(uuid) to authenticated;
grant execute on function public.save_employee_schedule(uuid, jsonb, text) to authenticated;
grant execute on function public.list_inconsistencies(uuid, date, date, text, text) to authenticated;
grant execute on function public.get_kiosk_state_by_dni(text, uuid, text) to authenticated;
grant execute on function public.record_time_entry(text, uuid, text, uuid, text, double precision, double precision, text, text, text) to authenticated;
grant execute on function public.get_hours_dashboard_range(uuid, date, date, date, date, text) to authenticated;

drop policy if exists "anon can upload time entry photos" on storage.objects;
drop policy if exists "authenticated admins can upload time entry photos" on storage.objects;
create policy "authenticated admins can upload time entry photos"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'time-entry-photos'
  and private.is_current_admin()
);

commit;
