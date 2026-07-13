# Reglas de negocio

## Qué es Inicio

`Inicio de Jornada` significa la apertura válida de trabajo para un empleado en una sede durante una fecha de negocio.

## Qué es Fin

`Fin de Jornada` significa el cierre válido de esa jornada para ese mismo empleado y sede.

## Cuándo se bloquea

La jornada se bloquea cuando el empleado ya tiene:

1. un `Inicio` válido del día;
2. un `Fin` válido del mismo día.

Desde ese momento no puede volver a fichar durante esa fecha.

## Qué significa Fichó

Un empleado `Fichó` cuando tiene al menos un `Inicio` válido durante la fecha seleccionada.

## Qué significa No fichó

Un empleado `No fichó` cuando está activo para esa sede y no tiene `Inicio` válido en la fecha.

## Cómo se calculan las horas

Solo se calculan para jornadas completas:

`Fin - Inicio`

Si la jornada sigue abierta, no se computa como jornada cerrada y se muestra `En curso`.

## Qué ocurre sin conexión

La app puede guardar localmente la fichada para sincronizar después.

Importante:

- eso no significa confirmación del servidor;
- la verdad final la define Supabase;
- la UI debe avisar cuando una fichada está pendiente o falló.

## Fuente de verdad

La única fuente de verdad del negocio es Supabase.

El navegador:

- puede cachear estado para mostrar;
- puede transportar eventos en cola offline;
- pero no decide la regla final de Inicio / Fin.
