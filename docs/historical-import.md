# Importación de históricos

## Objetivo

Migrar históricos desde Google Sheets a Supabase sin usar Sheets en runtime.

## Procedimiento recomendado

1. Exportar CSV desde Google Sheets.
2. Separar archivos por entidad:
   - `locations.csv`
   - `employees.csv`
   - `time_entries.csv`
3. Validar encabezados y tipos.
4. Cargar primero en una base de desarrollo o staging.
5. Verificar:
   - DNI;
   - relación empleado / sede;
   - `event_type` en `START | END`;
   - `business_date`;
   - timestamps;
   - ids duplicados;
   - jornadas inconsistentes.
6. Solo después ejecutar en productivo.

## Mapeo sugerido

### locations

- `id`
- `name`
- `active`

### employees

- `id`
- `dni`
- `first_name`
- `last_name`
- `active`
- `location_id`

### time_entries

- `id`
- `employee_id`
- `location_id`
- `event_type`
- `occurred_at`
- `business_date`
- `photo_path`
- `latitude`
- `longitude`
- `device_id`
- `idempotency_key`
- `sync_source`

## Precauciones

- no inventar `employee_id` si no existe relación limpia;
- no mezclar sedes sin validar;
- no cargar en productivo sin prueba previa;
- no sobreescribir históricos sin backup/export previo.
