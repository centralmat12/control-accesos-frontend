# Observaciones de fichadas — contrato mínimo de API

Propuesta para ControlFichajes.API. El frontend ya consume este contrato. No describe infraestructura, secretos ni configuración de producción.

La UI de observaciones es una restricción visual. **La API debe validar autorización, empresa y acceso a la fichada.** El navegador no envía `empresaId`, autor ni rol como fuente de autorización: esos datos salen del JWT y del contexto de servidor.

Esta entrega **no** implementa detección automática de tardanzas ni observaciones independientes de una jornada completa.

## Endpoint de guardado

`PATCH /api/fichadas/{id}/observacion`

Autenticación: Bearer JWT de usuario web (`token_use=web`). No usar token de agente.

### Request

```json
{
  "motivo": "LlegadaTarde",
  "detalle": "El empleado informó una demora por un turno médico."
}
```

| Campo | Obligatorio | Reglas |
| --- | --- | --- |
| `motivo` | Sí | Uno de los códigos de la tabla siguiente |
| `detalle` | Sí | Texto recortado (trim). No vacío. Máximo **500** caracteres |

No incluir autor, empresa, rol ni fecha de auditoría en el body.

### Motivos

| Código API | Etiqueta en pantalla |
| --- | --- |
| `LlegadaTarde` | Llegada tarde |
| `SalidaAnticipada` | Salida anticipada |
| `OlvidoDeFichaje` | Olvido de fichaje |
| `FichajeIncorrecto` | Fichaje incorrecto |
| `AusenciaJustificada` | Ausencia justificada |
| `HorarioExcepcional` | Horario excepcional |
| `Otro` | Otro |

### Response 200

```json
{
  "fichadaId": 123,
  "motivo": "LlegadaTarde",
  "detalle": "El empleado informó una demora por un turno médico.",
  "creadoPor": "Laura Gómez",
  "creadoEn": "2026-09-14T12:42:00Z",
  "modificadoPor": null,
  "modificadoEn": null
}
```

En una modificación posterior, completar `modificadoPor` y `modificadoEn`. `creadoPor` / `creadoEn` no deben cambiar.

El frontend también acepta PascalCase (`FichadaId`, `Motivo`, `Detalle`, `CreadoPor`, `CreadoEn`, `ModificadoPor`, `ModificadoEn`).

Una respuesta 2xx sin `motivo` y `detalle` válidos se trata como contrato inválido: no se actualiza la fila.

## Listado de fichadas

`GET /api/fichadas` (filtros actuales: `limite`, `empleadoId`, `desde`, `hasta`, `tipo`, `metodo`) debería incluir, de forma opcional por ítem:

```json
{
  "id": 123,
  "observacion": {
    "motivo": "LlegadaTarde",
    "detalle": "El empleado informó una demora por un turno médico.",
    "creadoPor": "Laura Gómez",
    "creadoEn": "2026-09-14T12:42:00Z",
    "modificadoPor": null,
    "modificadoEn": null
  }
}
```

Si no hay observación, omitir `observacion` o enviarla `null`. No reutilizar este objeto para indicadores automáticos del cliente (`Movimiento intermedio`, posible duplicado).

## Autorización (servidor)

Permitir guardar solo a **RRHH**, **ADMIN** y **SuperAdmin**.

Quien ya puede consultar fichadas puede **leer** la observación en el listado. Quien no puede guardar no debe lograr un PATCH exitoso aunque manipule la UI.

SuperAdmin: aislar por empresa del claim o de `X-Empresa-Id`, igual que el resto de fichadas. ADMIN/RRHH: solo la empresa del JWT.

## Aislamiento

La fichada debe pertenecer a un empleado de una empresa autorizada para el usuario. Si no existe o no es accesible: **404** con mensaje público (`Fichada no encontrada.`), sin filtrar existencia entre empresas.

## Validaciones

- Motivo desconocido → 400
- Detalle vacío o solo espacios → 400
- Detalle mayor a 500 caracteres → 400
- Body con campos de auditoría o `empresaId` → ignorar esos campos; no confiar en ellos

## Códigos HTTP

| Código | Uso |
| --- | --- |
| 200 | Guardado o actualización correcta |
| 400 | Motivo o detalle inválidos |
| 401 | Sesión ausente o inválida |
| 403 | Autenticado pero sin permiso de escritura (u otro forbid de empresa) |
| 404 | Fichada inexistente o fuera de alcance; también el caso actual si la ruta aún no existe |
| 405 / 501 | Ruta no implementada (el frontend informa que la función no está disponible) |
| 409 | Conflicto de datos si la API lo necesita (p. ej. versión) |

Hasta que el endpoint exista, el frontend trata 404/405/501 **sin cuerpo de “no encontrada”** como: la función todavía no está disponible. No simula un guardado.

## Auditoría

La API determina autor y timestamps a partir del usuario autenticado. Mostrar nombre para personas, no tokens. No hay borrado definitivo en esta versión: el PATCH crea o reemplaza el texto de la observación de esa fichada.

## Fuera de alcance

- Cálculo automático de tardanzas, ausencias o “horario excepcional”.
- Entidad de observación a nivel jornada. El resumen de jornadas del frontend solo **cuenta** observaciones de los movimientos que ya vienen en esa jornada (misma agrupación `empleado + fecha` con los `id` de fichada).
