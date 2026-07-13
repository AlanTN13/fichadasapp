insert into public.employees (id, dni, first_name, last_name, active, location_id)
values ('22222222-2222-2222-2222-222222222224', '40000112', 'Lucia', 'Suarez', true, '11111111-1111-1111-1111-111111111111')
on conflict (id) do update
set dni = excluded.dni,
    first_name = excluded.first_name,
    last_name = excluded.last_name,
    active = excluded.active,
    location_id = excluded.location_id;
