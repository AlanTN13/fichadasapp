insert into public.locations (id, name, active)
values ('11111111-1111-1111-1111-111111111111', 'Lavadero Nahuel - Planta Principal', true)
on conflict (id) do update
set name = excluded.name,
    active = excluded.active;

insert into public.employees (id, dni, first_name, last_name, active, location_id)
values
  ('22222222-2222-2222-2222-222222222221', '40111222', 'Juan', 'Perez', true, '11111111-1111-1111-1111-111111111111'),
  ('22222222-2222-2222-2222-222222222222', '40999888', 'Maria', 'Gomez', true, '11111111-1111-1111-1111-111111111111')
on conflict (id) do update
set dni = excluded.dni,
    first_name = excluded.first_name,
    last_name = excluded.last_name,
    active = excluded.active,
    location_id = excluded.location_id;

insert into public.admin_users (id, email, role, active)
values
  ('33333333-3333-3333-3333-333333333331', 'admin.test@nahuel.local', 'super_admin', true),
  ('33333333-3333-3333-3333-333333333332', 'kiosk.test@nahuel.local', 'location_admin', true)
on conflict (id) do update
set email = excluded.email,
    role = excluded.role,
    active = excluded.active;

insert into public.admin_user_locations (admin_user_id, location_id)
values ('33333333-3333-3333-3333-333333333332', '11111111-1111-1111-1111-111111111111')
on conflict (admin_user_id, location_id) do nothing;
