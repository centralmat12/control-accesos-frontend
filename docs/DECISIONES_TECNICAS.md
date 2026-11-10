# Decisiones técnicas

Decisiones ya visibles en el código o pedidas de forma explícita. No son propuestas nuevas.

## Alta por invitación, 10 de noviembre de 2026

Decisión para la próxima sesión. El prompt de implementación sigue pendiente.

Retirar Correo saliente. Completar la pantalla de aceptación. Cuando ese flujo esté probado, dejar Nuevo usuario como única acción de alta y que esa alta sea por invitación.

## Dos repositorios, sin monorepo

El frontend y la API tienen remotos distintos. El directorio que los contiene no es un repositorio. La documentación compartida queda duplicada en los dos clones para que un agente la encuentre al abrir cualquiera de los dos. Un repositorio tercer no se creó.

## Descanso del turno

- `0` significa «Sin descanso» y es un valor persistible.
- No se usa `valor > 0 ? valor : 60` ni `MinutosAlmuerzo = 60` al mapear un día recibido.
- `?? 60` solo corresponde cuando el valor está ausente. El inicializador del DTO cubre un JSON que no trae la propiedad.
- El centinela de EF es `-1`, no `0`, con `ValueGeneratedNever`, para que el default de la columna no reemplace un cero.
- El descanso puede ser cualquier entero mayor o igual que cero y menor que la duración del tramo. No hay una lista cerrada en la validación.
- El campo del formulario es numérico. Los accesos «Sin descanso», «30 min», «45 min» y «60 min» solo completan el campo.
- Un día nuevo puede iniciar en 60. Borrar el campo mientras se edita no lo vuelve a poner en 60.

## Jornadas

- La clasificación original de fichadas permanece en `JornadaClasificador.Clasificar`. El resumen no inventa una entrada o una salida que la clasificación no haya marcado.
- El reloj laboral del resumen es `America/Argentina/Buenos_Aires`.
- Un día futuro no suma minutos programados ni saldo. Un día pasado laborable sin fichadas sí genera la deuda del turno.
- El saldo del resumen es trabajado menos programado más reposiciones. La deuda y el tiempo a favor se muestran por separado.
- Una salida anterior a la entrada es un turno que cruza la medianoche. La duración usa el tramo completo y el descanso se resta una sola vez.

## Pruebas y entorno

- La prueba de persistencia del descanso usa SQLite en memoria porque el proveedor en memoria no reproduce el default de la columna. `SQLitePCLRaw.lib.e_sqlite3` quedó en 2.1.14 por el aviso de la versión transitiva anterior.
- La corrida habitual excluye las categorías `LocalTunnelAcceptance` y `ProductionAcceptance`.
- Los secretos de desarrollo no se versionan: `appsettings.*.local.json` en la API y `.env.local` en el frontend.

## MFA voluntario en el panel

- El segundo factor del login no se guarda en `localStorage` ni en `sessionStorage`. El desafío, el vencimiento, el modo y la generación viven en la memoria de la pestaña.
- La sesión renovable se escribe solo cuando `POST /api/Auth/mfa/verificar` responde con un access válido. Una respuesta perdida o un intento reemplazado no se reenvían.
- El QR se dibuja en el navegador con `qrcode` 1.5.4. No había una biblioteca de QR en el proyecto y no se llama a un generador externo.
- Esta entrega no desactiva, no reemplaza y no restablece el autenticador. Esas operaciones quedan para etapas posteriores.
- La invitación nueva puede marcar Exigir MFA. El alta con contraseña no cambia. La vinculación usa el mismo QR local y no escribe el desafío, la clave ni los códigos en el almacenamiento.
- `Auth:PermitirEnrolamientoMfa` sigue en falso fuera de las pruebas locales.

## Informe y PDF del frontend

- El informe de asistencia se compone en el navegador con los endpoints ya existentes. No se inventa un contrato nuevo ni se considera cerrado hasta que la API publique un informe histórico.
- El PDF usa Helvetica con WinAnsi, sin fuente Unicode embebida. Los separadores decorativos son líneas, bloques o los caracteres `|` y `-`. El punto medio `·` no se escribe en el PDF: la fuente no lo tiene y antes aparecía como `?`.
- Acentos y `ñ` se codifican en WinAnsi. Un signo `?` escrito por el usuario se conserva.
- Las pestañas de Administración ocupan el ancho de sus etiquetas (`w-fit`), no el ancho del módulo.
- El Dashboard no repite una descripción bajo la barra ni muestra el botón manual Actualizar. El intervalo de actualización sigue. El aviso de empresa solo se muestra cuando no hay una empresa seleccionada.

## Bitácora

- Registros muestra solo eventos persistidos por la API. Hasta que ese listado exista, la pantalla queda vacía.
- La traza de `activity-log.js` no se presenta como auditoría.

## Borrado de un turno

- El listado cuenta asignaciones vigentes.
- El DELETE hace borrado lógico. Lo rechaza solo si queda una asignación sin fecha de fin, o con fin de hoy o posterior.
- Las filas históricas de `EmpleadoTurno` se conservan.

## Sesión renovable del panel

- El access vive en memoria y en `sessionStorage`. `localStorage` no recibe el token ni la cookie. Solo guarda la coordinación: fase `habilitada`, `cerrada` o `incierta`, generación, revisión, usuario, sid y marcador.
- La generación del encabezado `X-CF-Generacion` es la misma que se guarda. Cada login renovable crea un UUID. La revisión aumenta con cada access nuevo y no usa `iat`.
- El lock `ca-auth-sesion` cubre login, refresh, cierre y transiciones. No hay mutex en `localStorage`.
- Antes de enviar el refresh se escriben el marcador y la fase `incierta`. Un 200 válido habilita y sube la revisión. Un 401 cierra esa generación. Red, timeout, cuerpo ilegible o 5xx dejan la incertidumbre y no se reintenta. Un 429 devuelve la fase habilitada y no se repite enseguida.
- Una fase cerrada o incierta no se restaura al recargar. Hace falta un login explícito.
- Como máximo se repite una vez un GET o HEAD después de renovar la misma generación, usuario y sid. No se repiten escrituras, el cambio de contraseña ni un resultado ambiguo.
- El cierre de una generación no borra una generación posterior. Si la red del cierre falla, el estado local queda cerrado y el login lo explica.
- Si falta una sola de estas tres capacidades, el login queda tradicional: Web Locks, BroadcastChannel o un `localStorage` que no responde o lanza. Ese login envía solo `Content-Type`, sin `credentials`, sin `X-CF-Solicitud`, sin `X-CF-Generacion` y sin refresh.
- Una pestaña que conserva una generación distinta de la publicada no marca la generación nueva como incierta ni la refresca. Descarta solo su access y cancela la operación.
- Si el usuario que envió la petición no es el de la renovación, la operación no se repite. El contexto de empresa se olvida cuando la sesión local sigue siendo la anterior. La sesión más nueva no se cierra.
- El contexto de empresa del SuperAdmin se mantiene si renueva el mismo usuario. Cambia de usuario o cierra sesión, y se limpia.

## Lo que no se decidió aquí

No se eligió un repositorio único para la documentación y no se cambió el descanso fijo de 60 minutos de una excepción de jornada con horario propio. La skill de traspaso sí existe; el procedimiento está en `.cursor/skills/traspaso-computadora/SKILL.md`.
