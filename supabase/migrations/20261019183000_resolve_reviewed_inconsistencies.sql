-- Reviewing an inconsistency closes its process state while preserving its
-- classification for operational and fortnightly reporting.
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
    insert into public.attendance_inconsistencies as existing (
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
        status = case
          when existing.review_status is null then 'OPEN'
          else 'RESOLVED'
        end,
        details = excluded.details,
        resolved_at = case
          when existing.review_status is null then null
          else coalesce(existing.resolved_at, existing.reviewed_at, now())
        end
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

create or replace function public.set_inconsistency_review(
  p_inconsistency_id uuid,
  p_review_status text
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  admin_row public.admin_users := private.current_admin();
  normalized_status text := upper(trim(coalesce(p_review_status, '')));
  inconsistency_row public.attendance_inconsistencies;
  decision_at timestamptz := now();
begin
  if admin_row.role <> 'super_admin' then
    raise exception 'SUPER_ADMIN_REQUIRED' using errcode = '42501';
  end if;

  if normalized_status not in ('JUSTIFIED', 'UNJUSTIFIED') then
    raise exception 'INVALID_REVIEW_STATUS';
  end if;

  select * into inconsistency_row
  from public.attendance_inconsistencies
  where id = p_inconsistency_id;

  if inconsistency_row.id is null then
    raise exception 'INCONSISTENCY_NOT_FOUND';
  end if;

  update public.attendance_inconsistencies
  set review_status = normalized_status,
      reviewed_at = decision_at,
      reviewed_by = auth.uid(),
      status = 'RESOLVED',
      resolved_at = decision_at
  where id = p_inconsistency_id;

  return jsonb_build_object(
    'success', true,
    'inconsistency_id', p_inconsistency_id,
    'review_status', normalized_status,
    'status', 'RESOLVED'
  );
end;
$$;

update public.attendance_inconsistencies
set reviewed_at = coalesce(reviewed_at, now()),
    status = 'RESOLVED',
    resolved_at = coalesce(reviewed_at, now())
where status = 'OPEN'
  and review_status in ('JUSTIFIED', 'UNJUSTIFIED');

create or replace function public.get_fortnightly_attendance_summary(
  p_location_id uuid default null,
  p_period_start date default null,
  p_period_end date default null,
  p_timezone text default 'America/Argentina/Buenos_Aires'
)
returns jsonb
language plpgsql
security definer
set search_path = public
set timezone = 'America/Argentina/Buenos_Aires'
as $$
declare
  admin_row public.admin_users := private.current_admin();
  business_today date := public.current_business_date(p_timezone);
  period_start date := coalesce(
    p_period_start,
    case when extract(day from business_today) <= 15
      then date_trunc('month', business_today)::date
      else (date_trunc('month', business_today) + interval '15 days')::date
    end
  );
  period_end date := coalesce(
    p_period_end,
    case when extract(day from business_today) <= 15
      then (date_trunc('month', business_today) + interval '14 days')::date
      else (date_trunc('month', business_today) + interval '1 month - 1 day')::date
    end
  );
  employee_row record;
  rows_payload jsonb;
  absences_payload jsonb;
  attendance_payload jsonb;
  locations_payload jsonb;
begin
  if admin_row.role <> 'super_admin' then
    raise exception 'SUPER_ADMIN_REQUIRED' using errcode = '42501';
  end if;

  if period_start > period_end or period_end - period_start > 30 then
    raise exception 'INVALID_FORTNIGHT_RANGE';
  end if;

  if p_location_id is not null and not private.can_access_location(admin_row, p_location_id) then
    raise exception 'LOCATION_NOT_AUTHORIZED' using errcode = '42501';
  end if;

  for employee_row in
    select e.id
    from public.employees e
    where private.can_access_location(admin_row, e.location_id)
      and (p_location_id is null or e.location_id = p_location_id)
  loop
    perform private.refresh_employee_inconsistencies(
      employee_row.id,
      period_start,
      least(period_end, business_today),
      p_timezone
    );
  end loop;

  with allowed_employees as (
    select e.*
    from public.employees e
    where private.can_access_location(admin_row, e.location_id)
      and (p_location_id is null or e.location_id = p_location_id)
      and (
        e.active
        or exists (
          select 1 from public.time_entries te
          where te.employee_id = e.id
            and te.business_date between period_start and period_end
        )
        or exists (
          select 1 from public.attendance_inconsistencies ai
          where ai.employee_id = e.id
            and ai.business_date between period_start and period_end
        )
      )
  ),
  period_dates as (
    select generate_series(period_start, period_end, interval '1 day')::date as business_date
  ),
  worked as (
    select
      e.id as employee_id,
      coalesce(sum(s.worked_hours), 0) as total_hours
    from allowed_employees e
    cross join period_dates d
    cross join lateral (
      select coalesce(
        (
          select te.location_id
          from public.time_entries te
          where te.employee_id = e.id
            and te.business_date = d.business_date
          order by te.occurred_at desc, te.id desc
          limit 1
        ),
        e.location_id
      ) as location_id
    ) selected_location
    cross join lateral public.build_entry_state(e.id, selected_location.location_id, d.business_date) s
    group by e.id
  ),
  inconsistency_totals as (
    select
      e.id as employee_id,
      count(*) filter (
        where (ai.status = 'OPEN' or ai.review_status is not null)
          and ai.inconsistency_type = 'LATE_ARRIVAL'
      ) as late_arrivals,
      count(*) filter (
        where (ai.status = 'OPEN' or ai.review_status is not null)
          and ai.inconsistency_type = 'MISSING_START'
          and not exists (
            select 1 from public.time_entries te
            where te.employee_id = ai.employee_id
              and te.business_date = ai.business_date
          )
      ) as absences,
      count(*) filter (
        where ai.review_status = 'JUSTIFIED'
      ) as justified,
      count(*) filter (
        where ai.review_status = 'UNJUSTIFIED'
      ) as unjustified,
      count(*) filter (
        where ai.status = 'OPEN' and ai.review_status is null
      ) as pending_review,
      coalesce(sum(
        case
          when (ai.status = 'OPEN' or ai.review_status is not null)
            and ai.inconsistency_type = 'LATE_ARRIVAL'
            and ai.review_status is distinct from 'JUSTIFIED'
            and ai.expected_time is not null
            and ai.actual_time is not null
          then greatest(floor(extract(epoch from (ai.actual_time - ai.expected_time)) / 60)::integer, 0)
          else 0
        end
      ), 0) as late_minutes
    from allowed_employees e
    left join public.attendance_inconsistencies ai
      on ai.employee_id = e.id
      and ai.business_date between period_start and period_end
    group by e.id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'employee_id', e.id,
    'employee_name', e.first_name || ' ' || e.last_name,
    'dni', e.dni,
    'location_id', e.location_id,
    'location_name', l.name,
    'late_arrivals', coalesce(i.late_arrivals, 0),
    'absences', coalesce(i.absences, 0),
    'justified', coalesce(i.justified, 0),
    'unjustified', coalesce(i.unjustified, 0),
    'pending_review', coalesce(i.pending_review, 0),
    'late_minutes', coalesce(i.late_minutes, 0),
    'is_irregular', coalesce(i.late_minutes, 0) >= 30,
    'total_hours', coalesce(w.total_hours, 0)
  ) order by lower(e.last_name), lower(e.first_name)), '[]'::jsonb)
  into rows_payload
  from allowed_employees e
  join public.locations l on l.id = e.location_id
  left join worked w on w.employee_id = e.id
  left join inconsistency_totals i on i.employee_id = e.id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'employee_id', e.id,
    'employee_name', e.first_name || ' ' || e.last_name,
    'dni', e.dni,
    'location_name', l.name,
    'business_date', ai.business_date
  ) order by ai.business_date desc, lower(e.last_name), lower(e.first_name)), '[]'::jsonb)
  into absences_payload
  from public.attendance_inconsistencies ai
  join public.employees e on e.id = ai.employee_id
  join public.locations l on l.id = ai.location_id
  where ai.business_date between period_start and period_end
    and (ai.status = 'OPEN' or ai.review_status is not null)
    and ai.inconsistency_type = 'MISSING_START'
    and private.can_access_location(admin_row, ai.location_id)
    and (p_location_id is null or ai.location_id = p_location_id)
    and not exists (
      select 1 from public.time_entries te
      where te.employee_id = ai.employee_id
        and te.business_date = ai.business_date
    );

  with scheduled_today as (
    select distinct e.id
    from public.employees e
    join public.employee_schedule_rules r
      on r.employee_id = e.id
      and r.weekday = extract(isodow from business_today)::smallint
      and r.cycle_week = (
        1 + mod(
          mod(
            floor((business_today - r.cycle_anchor_date)::numeric / 7)::integer,
            r.cycle_weeks::integer
          ) + r.cycle_weeks::integer,
          r.cycle_weeks::integer
        )
      )::smallint
      and r.working_day = true
      and r.valid_from <= business_today
      and (r.valid_to is null or r.valid_to >= business_today)
    where e.active = true
      and private.can_access_location(admin_row, e.location_id)
      and (p_location_id is null or e.location_id = p_location_id)
  )
  select jsonb_build_object(
    'business_date', business_today,
    'clocked_in', count(*) filter (where exists (
      select 1 from public.time_entries te
      where te.employee_id = st.id
        and te.business_date = business_today
    )),
    'scheduled', count(*)
  ) into attendance_payload
  from scheduled_today st;

  select coalesce(jsonb_agg(jsonb_build_object('id', l.id, 'name', l.name) order by l.name), '[]'::jsonb)
  into locations_payload
  from public.locations l
  where l.active = true
    and private.can_access_location(admin_row, l.id);

  return jsonb_build_object(
    'success', true,
    'period', jsonb_build_object('start_date', period_start, 'end_date', period_end),
    'today_attendance', attendance_payload,
    'rows', rows_payload,
    'absences', absences_payload,
    'locations', locations_payload
  );
end;
$$;

revoke execute on function public.set_inconsistency_review(uuid, text) from public, anon;
revoke execute on function public.get_fortnightly_attendance_summary(uuid, date, date, text) from public, anon;
grant execute on function public.set_inconsistency_review(uuid, text) to authenticated;
grant execute on function public.get_fortnightly_attendance_summary(uuid, date, date, text) to authenticated;
