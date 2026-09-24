-- Operational review and fortnightly reporting over the existing attendance model.
-- This migration is additive: time entries, schedules, tolerances and kiosk RPCs are unchanged.

alter table public.attendance_inconsistencies
  add column if not exists review_status text null,
  add column if not exists reviewed_at timestamptz null,
  add column if not exists reviewed_by uuid null;

alter table public.attendance_inconsistencies
  drop constraint if exists attendance_inconsistencies_review_status_check,
  add constraint attendance_inconsistencies_review_status_check
    check (review_status is null or review_status in ('JUSTIFIED', 'UNJUSTIFIED'));

create index if not exists attendance_inconsistencies_fortnight_review_idx
  on public.attendance_inconsistencies(
    business_date,
    location_id,
    inconsistency_type,
    review_status
  );

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
      reviewed_at = now(),
      reviewed_by = auth.uid()
  where id = p_inconsistency_id;

  return jsonb_build_object(
    'success', true,
    'inconsistency_id', p_inconsistency_id,
    'review_status', normalized_status
  );
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
    'late_minutes', case
      when ai.inconsistency_type = 'LATE_ARRIVAL'
        and ai.expected_time is not null
        and ai.actual_time is not null
      then greatest(floor(extract(epoch from (ai.actual_time - ai.expected_time)) / 60)::integer, 0)
      else 0
    end,
    'status', ai.status,
    'review_status', ai.review_status,
    'reviewed_at', ai.reviewed_at,
    'reviewed_by', ai.reviewed_by,
    'detected_at', ai.detected_at
  ) order by ai.business_date desc, lower(e.last_name), lower(e.first_name)), '[]'::jsonb)
  into inconsistencies_payload
  from public.attendance_inconsistencies ai
  join public.employees e on e.id = ai.employee_id
  join public.locations l on l.id = ai.location_id
  where ai.business_date between date_from_value and date_to_value
    and (p_location_id is null or ai.location_id = p_location_id)
    and (upper(coalesce(p_status, 'ALL')) = 'ALL' or ai.status = upper(p_status));

  select jsonb_build_object(
    'open', count(*) filter (where status = 'OPEN'),
    'resolved', count(*) filter (where status = 'RESOLVED'),
    'justified', count(*) filter (where review_status = 'JUSTIFIED'),
    'unjustified', count(*) filter (where review_status is distinct from 'JUSTIFIED')
  ) into counts_payload
  from public.attendance_inconsistencies
  where business_date between date_from_value and date_to_value
    and (p_location_id is null or location_id = p_location_id);

  select coalesce(jsonb_agg(jsonb_build_object('id', l.id, 'name', l.name) order by l.name), '[]'::jsonb)
  into locations_payload
  from public.locations l
  where l.active = true;

  return jsonb_build_object(
    'success', true,
    'period', jsonb_build_object('start_date', date_from_value, 'end_date', date_to_value),
    'counts', counts_payload,
    'inconsistencies', inconsistencies_payload,
    'locations', locations_payload
  );
end;
$$;

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
        where ai.status = 'OPEN' and ai.inconsistency_type = 'LATE_ARRIVAL'
      ) as late_arrivals,
      count(*) filter (
        where ai.status = 'OPEN'
          and ai.inconsistency_type = 'MISSING_START'
          and not exists (
            select 1 from public.time_entries te
            where te.employee_id = ai.employee_id
              and te.business_date = ai.business_date
          )
      ) as absences,
      count(*) filter (
        where ai.status = 'OPEN' and ai.review_status = 'JUSTIFIED'
      ) as justified,
      count(*) filter (
        where ai.status = 'OPEN' and ai.review_status is distinct from 'JUSTIFIED'
      ) as unjustified,
      count(*) filter (
        where ai.status = 'OPEN' and ai.review_status is null
      ) as pending_review,
      coalesce(sum(
        case
          when ai.status = 'OPEN'
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
    and ai.status = 'OPEN'
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
