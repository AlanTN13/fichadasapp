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
ordered_events as (
  select te.id, te.event_type, te.occurred_at
  from public.time_entries te
  where te.employee_id = p_employee_id
    and te.location_id = p_location_id
    and te.business_date = p_business_date
  order by te.occurred_at desc, te.id desc
),
latest_event as (
  select oe.id, oe.event_type, oe.occurred_at
  from ordered_events oe
  limit 1
),
start_before_latest_end as (
  select oe.occurred_at
  from ordered_events oe
  where oe.event_type = 'START'
    and exists (
      select 1
      from latest_event le
      where le.event_type = 'END'
        and oe.occurred_at <= le.occurred_at
    )
  order by oe.occurred_at desc, oe.id desc
  limit 1
),
state_calc as (
  select
    eb.id as employee_id,
    eb.employee_name,
    eb.dni,
    eb.location_id,
    p_business_date as business_date,
    case
      when le.id is null then 'NOT_STARTED'
      when le.event_type = 'END' and sbe.occurred_at is null then 'NOT_STARTED'
      when le.event_type = 'START' then 'WORKING'
      else 'COMPLETED'
    end as state,
    case
      when le.id is null then 'START'
      when le.event_type = 'END' and sbe.occurred_at is null then 'START'
      when le.event_type = 'START' then 'END'
      else 'NONE'
    end as allowed_action,
    case
      when le.event_type = 'START' then le.occurred_at
      when le.event_type = 'END' then sbe.occurred_at
      else null
    end as start_time,
    case
      when le.event_type = 'END' and sbe.occurred_at is not null then le.occurred_at
      else null
    end as end_time,
    le.occurred_at as last_event_at
  from employee_base eb
  left join latest_event le on true
  left join start_before_latest_end sbe on true
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
    when sc.start_time is not null
      and sc.end_time is not null
      and sc.end_time > sc.start_time
    then extract(epoch from (sc.end_time - sc.start_time)) / 3600.0
    else null
  end as worked_hours,
  case
    when sc.state = 'NOT_STARTED' then 'No inicio'
    when sc.state = 'WORKING' then 'Trabajando'
    else 'Jornada finalizada'
  end as status_label,
  to_char(sc.last_event_at, 'HH24:MI') as last_event_at_label
from state_calc sc;
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
  today_business_day date := public.current_business_date(p_timezone);
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
        when state = 'WORKING' and business_day <> today_business_day then 'Jornada incompleta'
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
