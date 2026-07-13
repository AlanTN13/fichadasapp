# Sistema Nahuel · Fichadas MVP

Aplicación MVP para control de fichadas de Lavadero Nahuel.

## Arquitectura

- `Vite + React` para la interfaz.
- `Supabase` como fuente única de verdad.
- `Supabase RPC` para:
  - login por email;
  - consulta de estado del kiosco por DNI;
  - registro atómico de Inicio / Fin;
  - dashboard administrativo.
- `Supabase Storage` para fotos de fichada.
- `localStorage` solo para:
  - cola offline;
  - cache visual del último estado conocido.

## Regla funcional actual

Secuencia válida diaria por empleado y sede:

1. `START` / Inicio de Jornada
2. `END` / Fin de Jornada

Reglas:

- si no fichó hoy, solo puede hacer `START`;
- si ya hizo `START`, solo puede hacer `END`;
- si ya hizo `START` y `END`, queda bloqueado ese día;
- el backend decide la secuencia válida;
- el frontend no es fuente de verdad;
- el `idempotency_key` evita duplicados.

## Variables de entorno

Copiar `.env.example` a `.env.local`:

```bash
cp .env.example .env.local
```

Variables:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_SUPABASE_BUCKET`
- `VITE_BUSINESS_TIMEZONE`

No exponer nunca `SUPABASE_SERVICE_ROLE_KEY` en frontend.

## Levantar la app

```bash
npm install
npm run dev
```

## Scripts

- `npm run dev`
- `npm run build`
- `npm run lint`
- `npm run typecheck`
- `npm test`

## Supabase

Migración principal:

- [supabase/migrations/202607130001_init_fichadas.sql](/Users/alanfernandez/Desktop/fichadas-app/supabase/migrations/202607130001_init_fichadas.sql)

Incluye:

- tablas `locations`, `employees`, `admin_users`, `admin_user_locations`, `time_entries`;
- bucket privado `time-entry-photos`;
- políticas básicas;
- RPCs:
  - `login_with_email`
  - `get_locations_for_email`
  - `get_kiosk_state_by_dni`
  - `record_time_entry`
  - `get_dashboard_summary`

## Fotos

Flujo:

1. la app toma foto;
2. la comprime antes de sincronizar;
3. la sube al bucket privado;
4. en `time_entries` solo se guarda `photo_path`.

Si la foto falla:

- la fichada puede seguir si el backend la acepta;
- queda advertencia local de sincronización;
- no se guarda base64 en la tabla principal.

## Cola offline

La cola local:

- guarda eventos `pending`, `syncing`, `confirmed`, `failed`;
- usa `idempotency_key` por evento;
- reintenta con backoff;
- no consolida el estado diario hasta confirmación del backend;
- muestra fallos y permite reintento manual desde administración.

## Dashboard

Incluye:

- Ficharon hoy;
- No ficharon;
- Trabajando;
- Jornada finalizada;
- Horas trabajadas;
- tabla operativa;
- panel de sincronización local.

Filtros mínimos:

- fecha;
- sede;
- estado.

## Datos históricos

Google Sheets deja de ser runtime.

Si hay que importar históricos:

1. exportar CSV desde Sheets;
2. mapear columnas a `time_entries`, `employees`, `locations`;
3. cargar contra una base de desarrollo primero;
4. validar `business_date`, `event_type` e ids;
5. recién después ejecutar en productivo.

Ver:

- [docs/business-rules.md](/Users/alanfernandez/Desktop/fichadas-app/docs/business-rules.md)
- [docs/historical-import.md](/Users/alanfernandez/Desktop/fichadas-app/docs/historical-import.md)

## Estado del proyecto

Esta versión ya:

- elimina Google Sheets del runtime;
- migra el frontend a Supabase;
- deja la regla Inicio / Fin pensada para servidor;
- agrega cola offline con idempotencia;
- incorpora tests base, build, lint y typecheck.

Todavía requiere:

- configurar credenciales reales de Supabase;
- ejecutar migraciones en un proyecto/dev database;
- cargar datos iniciales;
- validar el flujo real contra un entorno Supabase activo;
- crear PR borrador y push final.
