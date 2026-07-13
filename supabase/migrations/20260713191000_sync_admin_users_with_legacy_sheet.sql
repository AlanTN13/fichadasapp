-- Replace seeded admin users with the legacy Google Sheet administrators.
-- The old sheet used the role label "manager"; the current MVP schema expects
-- "location_admin", so we map it here to keep the application compatible.

with target_admins as (
  select *
  from (
    values
      ('880e8400-e29b-41d4-a716-446655440001'::uuid, 'Lavaderoindustrialnahuel@gmail.com'::text, 'super_admin'::text, true),
      ('880e8400-e29b-41d4-a716-446655440002'::uuid, 'manager@empresa.com'::text, 'location_admin'::text, true)
  ) as admins(id, email, role, active)
),
upsert_admins as (
  insert into public.admin_users (id, email, role, active)
  select id, email, role, active
  from target_admins
  on conflict (email) do update
  set role = excluded.role,
      active = excluded.active
  returning id, email
)
delete from public.admin_user_locations aul
using public.admin_users au
where aul.admin_user_id = au.id
  and (
    lower(au.email) like '%@nahuel.local'
    or lower(au.email) in ('lavaderoindustrialnahuel@gmail.com', 'manager@empresa.com')
  );

delete from public.admin_users
where lower(email) like '%@nahuel.local';

insert into public.admin_users (id, email, role, active)
select id, email, role, active
from (
  values
    ('880e8400-e29b-41d4-a716-446655440001'::uuid, 'Lavaderoindustrialnahuel@gmail.com'::text, 'super_admin'::text, true),
    ('880e8400-e29b-41d4-a716-446655440002'::uuid, 'manager@empresa.com'::text, 'location_admin'::text, true)
) as admins(id, email, role, active)
on conflict (email) do update
set role = excluded.role,
    active = excluded.active;

insert into public.admin_user_locations (admin_user_id, location_id)
select au.id, l.id
from public.admin_users au
join public.locations l on l.active = true
where lower(au.email) = 'manager@empresa.com'
on conflict (admin_user_id, location_id) do nothing;
