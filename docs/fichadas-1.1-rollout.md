# Fichadas 1.1 — entrega y puesta en producción

## Alcance implementado

- acceso administrativo con Supabase Auth, email, contraseña y sesión individual;
- `romanarielmolina@gmail.com` como `super_admin`;
- `Lavaderoindustrialnahuel@gmail.com` como `location_admin` limitado a Planta;
- eliminación productiva de `manager@empresa.com`;
- alta, edición, cambio de sede, activación y desactivación de empleados;
- jornadas semanales por empleado con vigencia histórica y tolerancia;
- inconsistencias persistidas y sin duplicados por empleado, fecha y tipo;
- fichadas incompletas sin horas inventadas;
- conservación de empleados inactivos y fichadas históricas en el tablero;
- autorización de todas las RPC según la sesión y la sede asignada.

## Preparación de Auth

Las contraseñas no se incluyen en SQL, variables de frontend ni tablas de la aplicación.

Antes de aplicar la migración, crear o invitar desde **Supabase → Authentication → Users** estas dos cuentas:

1. `romanarielmolina@gmail.com`;
2. `Lavaderoindustrialnahuel@gmail.com`.

Cada usuario debe definir su propia contraseña. Conviene mantener deshabilitado el registro público y exigir al menos ocho caracteres.

La migración vincula automáticamente cada identidad de Auth con su perfil administrativo por email. También deja un trigger para vincular invitaciones creadas después.

## Secuencia de despliegue

La versión actual y la 1.1 usan mecanismos de acceso incompatibles. Programar una ventana breve de mantenimiento:

1. respaldar la base o confirmar el backup disponible;
2. crear las dos identidades de Auth;
3. validar la migración en una rama de Supabase o base de desarrollo;
4. aplicar `20260828175049_fichadas_1_1_auth_employees_schedules_inconsistencies.sql`;
5. desplegar inmediatamente el frontend 1.1;
6. cerrar cualquier sesión anterior y recargar la aplicación;
7. ejecutar el checklist funcional siguiente.

No aplicar la migración de forma aislada mientras la interfaz anterior siga atendiendo fichadas.

## Checklist de aceptación

### Super Admin

- iniciar sesión como Román con email y contraseña;
- visualizar Horas, Empleados, Jornadas e Inconsistencias;
- crear un empleado de validación con DNI único;
- editar nombre, apellido y sede;
- configurar al menos un día laboral;
- desactivar el empleado y comprobar que no pueda fichar;
- comprobar que su fila histórica siga visible;
- reactivar o dejar desactivado el empleado según corresponda.

### Cuenta de Planta

- iniciar sesión con `Lavaderoindustrialnahuel@gmail.com`;
- comprobar que solo aparezca Planta;
- comprobar que no aparezcan las áreas administrativas del Super Admin;
- realizar con un empleado habilitado la secuencia Inicio → Fin;
- confirmar que un tercer intento quede bloqueado;
- confirmar que las fotos nuevas queden en el bucket privado.

### Inconsistencias

- llegada posterior a ingreso + tolerancia: `LATE_ARRIVAL`;
- salida anterior a salida − tolerancia: `EARLY_DEPARTURE`;
- inicio sin fin al vencer la jornada: `MISSING_END`;
- día esperado sin inicio al vencer el ingreso: `MISSING_START`;
- recalcular dos veces y confirmar que no haya duplicados;
- confirmar que una jornada incompleta conserve horas en `null`.

## Reversión

Si la interfaz falla después del despliegue, revertir primero el frontend y restaurar la base desde el backup previo. No intentar volver al login por email reabriendo RPC anónimas en producción.
