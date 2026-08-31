-- Configurable weekly or alternating two-week schedules.
-- Rotation is attached to the employee schedule, never to a DNI or a named person.

alter table public.employee_schedule_rules
  add column if not exists cycle_week smallint not null default 1,
  add column if not exists cycle_weeks smallint not null default 1,
  add column if not exists cycle_anchor_date date not null default date '2000-01-03';

alter table public.employee_schedule_rules
  drop constraint if exists employee_schedule_cycle_week_check,
  drop constraint if exists employee_schedule_cycle_weeks_check,
  add constraint employee_schedule_cycle_weeks_check
    check (cycle_weeks in (1, 2)),
  add constraint employee_schedule_cycle_week_check
    check (cycle_week between 1 and cycle_weeks);

alter table public.employee_schedule_rules
  drop constraint if exists employee_schedule_rules_employee_id_weekday_valid_from_key;

drop index if exists public.employee_schedule_one_current_rule;
drop index if exists public.employee_schedule_effective_lookup;

alter table public.employee_schedule_rules
  add constraint employee_schedule_rules_employee_cycle_day_valid_from_key
    unique (employee_id, cycle_week, weekday, valid_from);

create unique index employee_schedule_one_current_rule
  on public.employee_schedule_rules(employee_id, cycle_week, weekday)
  where valid_to is null;

create index employee_schedule_effective_lookup
  on public.employee_schedule_rules(
    employee_id,
    cycle_week,
    weekday,
    valid_from,
    valid_to
  );

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
      and r.cycle_week = (
        1 + mod(
          mod(
            floor((d.business_date - r.cycle_anchor_date)::numeric / 7)::integer,
            r.cycle_weeks::integer
          ) + r.cycle_weeks::integer,
          r.cycle_weeks::integer
        )
      )::smallint
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
  configured_cycle_weeks smallint;
  configured_anchor_date date;
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

  select
    coalesce(max(cycle_weeks), 1)::smallint,
    coalesce(
      min(cycle_anchor_date),
      current_date - (extract(isodow from current_date)::integer - 1)
    )
  into configured_cycle_weeks, configured_anchor_date
  from public.employee_schedule_rules
  where employee_id = p_employee_id
    and valid_to is null;

  with cycle_weeks as (
    select generate_series(1, configured_cycle_weeks)::smallint as cycle_week
  ),
  weekdays as (
    select generate_series(1, 7)::smallint as weekday
  )
  select jsonb_agg(jsonb_build_object(
    'cycle_week', c.cycle_week,
    'weekday', w.weekday,
    'working_day', coalesce(r.working_day, false),
    'expected_start', to_char(r.expected_start, 'HH24:MI'),
    'expected_end', to_char(r.expected_end, 'HH24:MI'),
    'tolerance_minutes', coalesce(r.tolerance_minutes, 0),
    'configured', r.id is not null
  ) order by c.cycle_week, w.weekday)
  into schedule_payload
  from cycle_weeks c
  cross join weekdays w
  left join public.employee_schedule_rules r
    on r.employee_id = p_employee_id
    and r.cycle_week = c.cycle_week
    and r.weekday = w.weekday
    and r.valid_to is null;

  return jsonb_build_object(
    'success', true,
    'employee', employee_payload,
    'schedule_type', case when configured_cycle_weeks = 2 then 'BIWEEKLY' else 'WEEKLY' end,
    'cycle_weeks', configured_cycle_weeks,
    'cycle_anchor_date', configured_anchor_date,
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
  schedule_items jsonb;
  configured_cycle_weeks smallint;
  configured_anchor_date date;
  item jsonb;
  week_number smallint;
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

  if jsonb_typeof(p_schedule) = 'array' then
    schedule_items := p_schedule;
    configured_cycle_weeks := 1;
    configured_anchor_date := business_today - (extract(isodow from business_today)::integer - 1);
  elsif jsonb_typeof(p_schedule) = 'object' then
    schedule_items := p_schedule -> 'days';
    configured_cycle_weeks := coalesce((p_schedule ->> 'cycle_weeks')::smallint, 1);
    configured_anchor_date := coalesce(
      nullif(p_schedule ->> 'cycle_anchor_date', '')::date,
      business_today - (extract(isodow from business_today)::integer - 1)
    );
  else
    return jsonb_build_object('success', false, 'error', 'La configuración de jornada es inválida.');
  end if;

  if configured_cycle_weeks not in (1, 2) then
    return jsonb_build_object('success', false, 'error', 'La jornada debe ser semanal o de dos semanas.');
  end if;

  if configured_cycle_weeks = 2 and extract(isodow from configured_anchor_date)::integer <> 1 then
    return jsonb_build_object('success', false, 'error', 'El inicio de la Semana A debe ser un lunes.');
  end if;

  if jsonb_typeof(schedule_items) <> 'array'
    or jsonb_array_length(schedule_items) <> configured_cycle_weeks * 7 then
    return jsonb_build_object('success', false, 'error', 'La jornada debe incluir todos los días de cada semana.');
  end if;

  if (
    select count(distinct (
      coalesce((value ->> 'cycle_week')::smallint, 1),
      (value ->> 'weekday')::smallint
    ))
    from jsonb_array_elements(schedule_items)
  ) <> configured_cycle_weeks * 7 then
    return jsonb_build_object('success', false, 'error', 'Cada día de cada semana debe aparecer una sola vez.');
  end if;

  for item in select value from jsonb_array_elements(schedule_items)
  loop
    week_number := coalesce((item ->> 'cycle_week')::smallint, 1);
    day_number := (item ->> 'weekday')::smallint;
    works := coalesce((item ->> 'working_day')::boolean, false);
    tolerance := coalesce((item ->> 'tolerance_minutes')::integer, 0);
    start_at := case when works then nullif(item ->> 'expected_start', '')::time else null end;
    end_at := case when works then nullif(item ->> 'expected_end', '')::time else null end;

    if week_number not between 1 and configured_cycle_weeks or day_number not between 1 and 7 then
      return jsonb_build_object('success', false, 'error', 'Día o semana inválidos.');
    end if;

    if tolerance not between 0 and 180 then
      return jsonb_build_object('success', false, 'error', 'La tolerancia debe estar entre 0 y 180 minutos.');
    end if;

    if works and (start_at is null or end_at is null or end_at <= start_at) then
      return jsonb_build_object('success', false, 'error', 'Cada día laboral necesita un ingreso y una salida válidos.');
    end if;
  end loop;

  delete from public.employee_schedule_rules
  where employee_id = p_employee_id
    and valid_to is null
    and valid_from = business_today;

  update public.employee_schedule_rules
  set valid_to = business_today - 1
  where employee_id = p_employee_id
    and valid_to is null;

  for item in select value from jsonb_array_elements(schedule_items)
  loop
    week_number := coalesce((item ->> 'cycle_week')::smallint, 1);
    day_number := (item ->> 'weekday')::smallint;
    works := coalesce((item ->> 'working_day')::boolean, false);
    tolerance := coalesce((item ->> 'tolerance_minutes')::integer, 0);
    start_at := case when works then nullif(item ->> 'expected_start', '')::time else null end;
    end_at := case when works then nullif(item ->> 'expected_end', '')::time else null end;

    insert into public.employee_schedule_rules (
      employee_id,
      cycle_week,
      cycle_weeks,
      cycle_anchor_date,
      weekday,
      working_day,
      expected_start,
      expected_end,
      tolerance_minutes,
      valid_from
    ) values (
      p_employee_id,
      week_number,
      configured_cycle_weeks,
      configured_anchor_date,
      day_number,
      works,
      start_at,
      end_at,
      tolerance,
      business_today
    );
  end loop;

  perform private.refresh_employee_inconsistencies(
    p_employee_id,
    business_today,
    business_today,
    p_timezone
  );

  return jsonb_build_object(
    'success', true,
    'schedule_type', case when configured_cycle_weeks = 2 then 'BIWEEKLY' else 'WEEKLY' end,
    'cycle_weeks', configured_cycle_weeks,
    'cycle_anchor_date', configured_anchor_date
  );
exception
  when invalid_text_representation or datetime_field_overflow or check_violation then
    return jsonb_build_object('success', false, 'error', 'Revisá los horarios, la rotación y la tolerancia ingresados.');
end;
$$;

revoke all on function public.get_employee_schedule(uuid) from public, anon;
revoke all on function public.save_employee_schedule(uuid, jsonb, text) from public, anon;
grant execute on function public.get_employee_schedule(uuid) to authenticated;
grant execute on function public.save_employee_schedule(uuid, jsonb, text) to authenticated;
