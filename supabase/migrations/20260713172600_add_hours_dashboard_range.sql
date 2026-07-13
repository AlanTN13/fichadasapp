create or replace function public.get_hours_dashboard_range(
  p_email text,
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
  user_row public.admin_users;
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
    swap_date := period_start;
    period_start := period_end;
    period_end := swap_date;
  end if;

  if fortnight_end < fortnight_start then
    swap_date := fortnight_start;
    fortnight_start := fortnight_end;
    fortnight_end := swap_date;
  end if;

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
    cross join lateral public.build_entry_state(eb.id, eb.location_id, pd.business_date) s
  ),
  period_totals as (
    select employee_id, coalesce(sum(worked_hours), 0) as total_period_hours
    from period_states
    group by employee_id
  )
  select jsonb_build_object(
    'employee_count', coalesce((select count(*) from employee_base), 0),
    'total_period_hours', coalesce((select sum(total_period_hours) from period_totals), 0)
  ) into summary_payload;

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
  period_dates as (
    select generate_series(period_start, period_end, interval '1 day')::date as business_date
  ),
  fortnight_dates as (
    select generate_series(fortnight_start, fortnight_end, interval '1 day')::date as business_date
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
    cross join lateral public.build_entry_state(eb.id, eb.location_id, pd.business_date) s
  ),
  fortnight_states as (
    select
      eb.id as employee_id,
      fd.business_date,
      s.worked_hours
    from employee_base eb
    cross join fortnight_dates fd
    cross join lateral public.build_entry_state(eb.id, eb.location_id, fd.business_date) s
  ),
  period_totals as (
    select employee_id, coalesce(sum(worked_hours), 0) as total_period_hours
    from period_states
    group by employee_id
  ),
  fortnight_totals as (
    select employee_id, coalesce(sum(worked_hours), 0) as total_fortnight_hours
    from fortnight_states
    group by employee_id
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'employee_id', eb.id,
        'employee_name', eb.employee_name,
        'dni', eb.dni,
        'location_id', eb.location_id,
        'location_name', eb.location_name,
        'period_total_hours', coalesce(pt.total_period_hours, 0),
        'fortnight_total_hours', coalesce(ft.total_fortnight_hours, 0),
        'days', coalesce(
          (
            select jsonb_agg(
              jsonb_build_object(
                'date', ps.business_date,
                'state', ps.state,
                'worked_hours', ps.worked_hours,
                'start_time', to_char(ps.start_time, 'HH24:MI'),
                'end_time', to_char(ps.end_time, 'HH24:MI')
              )
              order by ps.business_date
            )
            from period_states ps
            where ps.employee_id = eb.id
          ),
          '[]'::jsonb
        )
      )
      order by lower(eb.employee_name), eb.employee_name
    ),
    '[]'::jsonb
  ) into rows_payload
  from employee_base eb
  left join period_totals pt on pt.employee_id = eb.id
  left join fortnight_totals ft on ft.employee_id = eb.id;

  select coalesce(jsonb_agg(jsonb_build_object('id', l.id, 'name', l.name) order by l.name), '[]'::jsonb)
  into locations_payload
  from (
    select distinct l.id, l.name
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
  ) l;

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

grant execute on function public.get_hours_dashboard_range(text, uuid, date, date, date, date, text) to anon, authenticated;
