# Lavadero Nahuel — Entrada de agentes

Las instrucciones superiores de la plataforma y los controles reales de acceso prevalecen siempre.

## Gobierno AlanOS

Antes de trabajo sustantivo, leer por una vía autorizada la versión vigente de `Alan/01_Architecture/Execution_Runtime_Contract.md` en `AlanTN13/Alanos` y registrar la revisión consultada.

URL canónica: https://github.com/AlanTN13/Alanos/blob/main/Alan/01_Architecture/Execution_Runtime_Contract.md

Un enlace no se carga solo. Si el contrato no está accesible, declarar `BLOCKED_EXTERNAL` y no iniciar cambios. No reconstruir reglas de memoria ni recorrer otros repos por reflejo. Una sesión ya abierta no se da por actualizada.

Contexto de negocio/cuenta en AlanOS:
- `Alan/04_Clientes NexOps/Lavadero_Nahuel/`;
- `Alan/04_Clientes NexOps/Lavadero Nahuel/`.

Leer sólo el contexto necesario. El repositorio técnico conserva implementación y runtime; AlanOS conserva decisiones, prioridad y estado ejecutivo.

## Preflight obligatorio

Antes de modificar, dejar:

```text
EXECUTION PREFLIGHT
Rol y superficie real:
Resultado y autorización:
Contexto verificado / revisión:
Budget / tipo / riesgo:
Dentro y fuera de alcance:
Aceptación y validaciones:
Permisos de producción / recuperación:
STOP y señal de BUDGET_RISK:
```

## Límites

- Una consulta o rol no autoriza ejecución.
- No ampliar alcance por hallazgos laterales.
- Hallazgo no bloqueante: registrar y continuar sólo el resultado autorizado.
- Defecto que invalida aceptación/seguridad: no declarar éxito; resolver sólo si entra en alcance/riesgo aprobado o escalar.
- No tocar datos productivos, fichadas reales, identidades, roles, sedes, permisos, migraciones destructivas o producción sin gate explícito.
- No confundir implementación, merge, deploy y validación operativa del cliente.
- No redefinir reglas laborales/operativas desde el código.

## Cierre

Toda entrega no trivial deja `EXECUTION RECEIPT` o checkpoint durable con evidencia, validaciones realmente ejecutadas, riesgos residuales y STOP.
