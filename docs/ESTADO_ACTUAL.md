# Estado actual

Seguridad consulta `GET /api/Auth/mfa/estado` al abrirse. Si el autenticador está activo, muestra «Activo» y «Códigos de recuperación» sin iniciar un enrolamiento; los códigos en claro aparecen solo cuando la API devuelve un conjunto nuevo. Si no está activo, la recuperación permanece oculta y la activación se ofrece cuando `configuracionDisponible` es verdadero. Una consulta en curso o fallida no dice «Sin configurar» y permite reintentar. Una respuesta tardía se descarta si cambió la cuenta o se cerró la sesión. «Activación obligatoria» sigue solo en la vinculación.

Etapa 7D del frontend, 9 de noviembre de 2026. Usuarios muestra Invitar, con rol y empresa iguales al alta y con **Exigir MFA** desmarcado. `vinculacion_mfa_pendiente` abre el QR local, la clave manual y los códigos antes del panel. El desafío y los secretos quedan en memoria. Cancelar, vencer o cambiar de generación descarta una respuesta tardía y no publica sesión. Después de guardar los códigos se vuelve al login.

Etapa 7C.2 del frontend, 9 de noviembre de 2026. No se desplegó, no se publicó y no se mergeó. La API no se modificó: sigue en `feat/autenticacion-segura`, `b5e397946fc3f1e2d5d3cefc066959e3bc89346a`, con el commit funcional `da38172767fd8a9d5da69d4116e26389c355e1f4`.

El login trata `401` con `codigo=mfa_requerido` como un paso intermedio. El desafío, el vencimiento, el modo y la generación quedan en memoria. La verificación reutiliza ese modo y esa generación, y la sesión se publica solo después de una respuesta válida. El Web Lock se libera mientras se escribe el código. Antes de enviarlo se revalida el contexto. Una respuesta de un intento cancelado o reemplazado no publica la sesión. Si la verificación queda incierta, hay que volver a iniciar sesión y el código no se reenvía. El acceso sin MFA, el modo tradicional y el cambio obligatorio de contraseña siguen.

Seguridad, en el menú de cuenta, activa el autenticador con contraseña, QR local y clave manual, y confirma con TOTP. Los diez códigos se muestran una sola vez, solo en memoria, y después se vuelve al login. Regenerar usa contraseña y un segundo factor. Si esa respuesta se pierde, la pantalla explica cómo entrar de nuevo y generar otro conjunto. No están el requisito administrativo, la desactivación, el reemplazo ni el restablecimiento.

El QR lo dibuja `qrcode` 1.5.4 en un canvas. No había una dependencia previa para eso y no se usa un servicio externo de imágenes. `Auth:PermitirEnrolamientoMfa` quedó en falso después de las pruebas.

En el navegador, contra `http://127.0.0.1:5173`, la API en `http://127.0.0.1:5088` y MySQL local, una cuenta ficticia activó el autenticador con QR y clave manual, entró con TOTP y con un código de recuperación, regeneró el conjunto y el código anterior fue rechazado. El desafío de un minuto volvió al login sin publicar sesión. Con el segundo factor abierto, el login del SuperAdmin en otra pestaña hizo descartar ese intento. El SuperAdmin compartido entró sin pantalla de segundo factor; su contraseña de laboratorio se restauró y sigue sin MFA ni obligación. La cuenta ficticia se borró. `check-mfa-web.js` cubre, además, la respuesta tardía de un intento cancelado y la verificación incierta que no se reenvía. `npm run build` terminó con el aviso conocido del chunk grande. `npm run check` sigue fallando solo en `check-action-buttons.js`, igual que en `09d8fcd`.

## Cierre de la etapa 6B

Cierre local del 4 de noviembre de 2026, etapa 6B del frontend. No se desplegó, no se publicó y no se mergeó.

## Sesión renovable en el panel

Rama local `feat/autenticacion-sesiones-web`, creada desde `feat/turnos-asignaciones-ux` en `09d8fcd3f00cbe225bb4f59ff94fe106e4308289`. No tiene upstream. La API no se modificó y sigue en `feat/autenticacion-segura`, commit `79d395dc8e16052db5b8fd8e6a9214c643df9046`. El access de la API sigue en `Jwt:ExpireMinutes` (1440). No se pasó a 15 minutos.

El panel en `http://127.0.0.1:5173` usa el proxy hacia `http://127.0.0.1:5088`. Login, refresh y cierre renovables envían `credentials: 'include'`, `X-CF-Solicitud: 1` y `X-CF-Generacion`. Cada login renovable usa un UUID nuevo. El access queda en memoria y en `sessionStorage` (`ca.auth.token`). `localStorage` guarda solo `ca.auth.coordinacion`: fase, generación, revisión, usuario, sid y marcador. La revisión sube con cada access nuevo. El refresh queda en la cookie HttpOnly de la API.

Un Web Lock `ca-auth-sesion` ordena login, refresh, cierre y cambios de estado. `BroadcastChannel` `ca-auth` comparte el access. Quien recibe un pedido responde sin tomar el lock. Si falta Web Locks, falta BroadcastChannel o `localStorage` no se puede usar, el login queda tradicional y el formulario muestra un aviso breve. Una generación anterior no refresca ni cierra la sesión que la reemplazó.

En el navegador, con la API y MySQL locales y el usuario ficticio `etapa6a.sesion@local.test`:

- El login renovable abrió el dashboard. La coordinación quedó en `localStorage` sin JWT. El access quedó en `sessionStorage`. `document.cookie` no mostró la cookie.
- `intentarRenovar()` pasó la revisión de 1 a 2 en la misma generación, sin esperar el vencimiento del access.
- Una segunda pestaña entró al dashboard con la misma sesión. Dos renovaciones concurrentes produjeron un solo refresh: una pestaña `renovado` y la otra `adoptado`, ambas en la revisión 3.
- Un refresh que no respondió dejó la fase `incierta` y el marcador. La recarga mostró el login y no llamó a refresh.
- El cierre de la generación anterior, después de un login nuevo, se omitió. La generación nueva siguió habilitada.
- Cerrar sesión en una pestaña dejó la otra en el login, con fase `cerrada` y sin access. Recargar esa sesión cerrada volvió a mostrar el login.
- Un cierre cuya red falló dejó la fase `cerrada`, sin access, y el texto de que el cierre del servidor no se confirmó.
- La pantalla de cambio obligatorio apareció para esa cuenta. Al guardar, la sesión quedó cerrada y el login mostró que la contraseña fue actualizada. La contraseña de laboratorio de esa cuenta quedó restaurada.
- Un access sin `sid`, guardado como sesión anterior, se conservó al arrancar y no disparó refresh.
- Un GET que recibió 401 se reintentó una vez después de una renovación. Un POST con 401 no se reenvió y mostró que había que repetir la acción. Un 403 de cambio de contraseña no renovó. Un 429 se devolvió sin otro intento. Un fallo de red de una lectura no borró el access.
- Este Chrome tiene Web Locks, BroadcastChannel y `localStorage`, así que no apareció el aviso de compatibilidad. Las tres ausencias se comprobaron por separado en `check-sesion-coordinada.js`.

Con el SuperAdmin ficticio `super.local@local.test`, recuperado por el flujo local de recuperación, el login renovable abrió el panel. Se eligió Empresa Dos. La renovación mantuvo el mismo usuario, el mismo sid y ese contexto, y subió la revisión. El GET siguiente envió `X-Empresa-Id: 2` y respondió 200. Al entrar la otra cuenta ficticia, el contexto anterior desapareció. Una operación que ya había salido con el SuperAdmin se envió una sola vez y no se repitió con la otra identidad. El panel indicó que la sesión cambió.

El cierre de pestaña se controló con un proxy local que reenvió el refresh a la API y retuvo la respuesta recién cuando la API la había completado. Se cerró la pestaña que lo había iniciado. La otra adquirió el Web Lock, vio la fase incierta y el marcador, y quedó en login sin enviar otro refresh. La recarga también mostró el login y no pidió refresh. Esa operación produjo un solo refresh en el servidor.

Los atributos de la cookie se observaron en el `Set-Cookie` que ese proxy entregó al navegador, sin el valor y sin el jar de DevTools. El nombre es `cf_g_` seguido de 32 hexadecimales. Atributos: `HttpOnly`, sin `Secure`, `Path=/api/Auth`, sin `Domain`, `SameSite=Lax`, `Max-Age=43199` y `Expires` presente.

`node scripts/check-sesion-coordinada.js` cubre dos pestañas y una renovación, canal sin respuesta, respuesta perdida, 401 y 5xx sin reintento, reintento de GET y no de escritura, arranque cerrado, una generación anterior que no refresca la nueva, y el login tradicional cuando falta cada capacidad por separado. `npm run check` sigue fallando en `check-action-buttons.js`, igual que en `09d8fcd`: espera una grilla `minmax(0,1fr)_7rem_auto` que `turnos-panel.js` ya no tiene. Esos dos archivos no cambiaron en esta entrega. `npm run build` terminó y avisó el chunk grande de siempre. No se versiona `dist/`.

## Cierre de la noche del 2 de noviembre de 2026

## Verificación de la noche del 2 de noviembre de 2026

No se corrió `npm run check` completo ni `npm run build`. No se reinició el proceso de la API.

- Edición de usuario: el encabezado muestra nombre, empresa y estado. El pie deja «Blanqueo de clave» arriba y, en la fila de abajo, «Desactivar cuenta» a la izquierda y «Guardar» a la derecha, con ícono de disquete. `node scripts/check-usuario-identidad.js`, `check-usuario-modificacion.js`, `check-usuario-estado-rol.js` y `check-ux-panel.js` terminaron sin fallos.
- Turnos: el formulario no deja agregar más de 7 días y «Agregar día» queda deshabilitado al llegar a ese tope. `node scripts/check-turnos-dias-roundtrip.js`, `check-turnos-modal-compacto.js` y `check-descanso-numerico.js` terminaron sin fallos.
- Inicio de sesión: Correo electrónico y Contraseña ya no muestran el asterisco rojo. Se vio en `http://localhost:5173/#/login`. Siguen siendo obligatorios.
- API: `TurnoService.EliminarAsync` permite el borrado lógico si no hay una asignación abierta ni con fin de hoy o posterior. Una asignación ya cerrada no bloquea. `dotnet test` con filtro `Turno_SeBorraSiSoloTieneAsignacionHistorica|Turno_NoSeBorraSiTieneAsignacionVigente|EliminarAsync_RealizaBorradoLogico` dejó 3 pruebas correctas. No se corrió la suite completa.

## Cierre anterior del 2 de noviembre de 2026

Cierre en `control-accesos-frontend`, rama `feat/turnos-asignaciones-ux`. El remoto es `https://github.com/centralmat12/control-accesos-frontend.git`. No implica despliegue ni merge a `main`.

## Verificación del 2 de noviembre de 2026

Comandos ejecutados en el frontend. `package.json` define `dev`, `build`, `preview` y `check`. No hay un script separado de lint ni de tests.

- `npm run check` (`node scripts/run-checks.js`): 57 scripts pasaron, incluido `check-deploy-archive.js`. Se repitió después de ocultar el encabezado del Dashboard y volvió a pasar.
- `npm run build`: terminó bien. El artefacto de la corrida posterior al cambio del Dashboard fue `dist/assets/index-CYGYwBdu.js`. `dist/` no se versiona.
- `git diff --check`: sin errores de espacio en blanco.

En el navegador, con sesión ya iniciada en `http://127.0.0.1:5173/`:

- Dashboard mostró Estado del sistema, empleados activos, fichadas de hoy, entradas, salidas y actividad. No mostró «Resumen general del sistema y la actividad de hoy.» ni el botón Actualizar. El cómputo del botón quedó en `display: none`.
- Fichadas abrió Consulta de fichadas e Informes de asistencia (`#/fichadas?seccion=informe`). Consulta mostró filtros, Registrar, Exportar deshabilitado sin datos y las vistas Línea de tiempo, Resumen de jornadas, Movimientos registrados y Calendario. Informes mostró el estado de carga y el vacío de jornadas.
- Empleados cargó 11 registros, búsqueda, sucursal, departamento, estado, «Mostrando 1–10 de 11 empleados» y el panel de edición de un empleado, que se cerró sin guardar.
- Administración abrió Usuarios, Empresas, Departamentos y Turnos. Departamentos y Turnos seguían cargando al cambiar de pestaña. Las pestañas ocupan el ancho del texto.

No se recorrió cada filtro ni cada guardado. No se repitió una pasada en viewport estrecho en este cierre. La exportación CSV y PDF está cubierta por `scripts/check-exportacion-fichadas.js` y por el PDF de abajo. El menú Exportar no se abrió porque el botón estaba deshabilitado en la consulta vacía.

## Informe y PDF

El informe de asistencia se arma en el frontend con empleados, fichadas, calendario, asignaciones y alertas ya existentes. No hay un endpoint nuevo de informe. El PDF lo escribe `src/utils/pdf-document.js` con Helvetica y WinAnsi. En este cierre se abrió un PDF de dos páginas generado con el logo real. La página mostró el logo sin el texto «Control de Accesos» debajo, `Peña Ñandú`, `Período: Últimos 60 días`, bloques Completas, En curso, Incompletas y En revisión, `31/10/2026`, legajos `0003` y `0012`, `¿Llegó?`, `áéíóú ñ`, el pie `Informe operativo | … | Página 1 de 2` y, en la página 2, el mismo encabezado y las columnas. No apareció `?` de reemplazo ni la columna Observaciones vacía. El archivo de prueba no se versiona.

## Lo que sigue visible y no se dio por eliminado

El Dashboard ya no muestra «Resumen general del sistema y la actividad de hoy.» ni el botón Actualizar. La actualización periódica sigue activa y el aviso de seleccionar una empresa solo aparece cuando hace falta. Siguen en pantalla «Administración de la organización», «Consultá las fichadas», «Informe de asistencia» y «Administrá la nómina, sus asignaciones y su estado.».

## Cómo levantarlo

En este repositorio: `npm install` si faltan dependencias, `npm run dev` para el panel, `npm run check` para la verificación y `npm run build` para el artefacto de producción. El siguiente paso recomendado es no rehacer estas pantallas: publicar el endpoint autoritativo de informes en la API y, si se retoma la limpieza visual, quitar solo los títulos internos que todavía se listan arriba.

## Relevamiento anterior

Relevado el 28 de octubre de 2026. Solo se lista lo que está en Git o lo que se ejecutó en la sesión anterior. No implica despliegue ni merge a `main`.

## Ramas

| Repositorio | Rama de trabajo | Commit | `main` local, alineado con `origin/main` |
| --- | --- | --- | --- |
| API | `feat/turnos-asignaciones-ux` | `96925be297ccf114eaee170fc8bb9c28b8e1e642` | `5108784` |
| Frontend | `feat/turnos-asignaciones-ux` | `0d558638bfb96d3077bde5f6ddb95cf29d67315f` | `dd682fd` |

Ambas ramas siguen a su remoto del mismo nombre. El working tree de los dos clones estaba limpio en este relevamiento. No se hizo merge a `main`.

## Verificación del 27 de octubre de 2026

Se ejecutó antes de publicar esos commits. No se repitió en este relevamiento.

- API: `dotnet build --configuration Release` terminó sin advertencias. `dotnet test --configuration Release` con filtro `Category!=LocalTunnelAcceptance&Category!=ProductionAcceptance` dejó 331 pruebas correctas.
- Frontend: `npm run build` terminó bien. `node scripts/run-checks.js` falló solo en `check-deploy-archive.js` al invocar `/bin/bash` (exit 127). El resto de los checks de esa corrida pasó.
- `git diff --check` no marcó errores de espacio en blanco. En el frontend, Git avisó la conversión LF/CRLF de `turnos-panel.js`; el archivo se normalizó a CRLF en el working tree antes del commit y el índice guardó LF, como el resto del repositorio.

## Funcionalidad incluida en esas ramas

Turnos y descanso, en la API:

- `TurnoMappers` copia `MinutosAlmuerzo` recibido, incluido `0`. Ya no asigna `60` fijo al persistir.
- `AppDbContext` marca el centinela `-1` y `ValueGeneratedNever` para que EF escriba `0`.
- El PUT reemplaza los `TurnoDia` con `Clear` y `Add`.
- Se rechaza un descanso negativo o mayor o igual que la duración del tramo, también si la salida es del día siguiente.
- Los minutos programados restan el descanso una sola vez.
- Hay prueba de integración SQLite `TurnoDescansoIntegracionTests` para 0, 20, 30 y 60, cambios 60→0 y 0→20, y el turno 22:00–06:00 con 60 minutos.

Turnos, en el frontend:

- El descanso del día es un campo numérico con sufijo `min`, accesos rápidos y texto `Jornada neta`.
- `0` se muestra como «Sin descanso» y se reenvía como `0`.
- Un día que no está en el formulario no exige horario ni descanso.
- La rama también incluye la UI de asignación de empleados, el campo de hora del turno y el resumen laboral del calendario que consume la API.

Jornadas, en la API de esa misma rama:

- El resumen mensual no suma días futuros según el reloj `America/Argentina/Buenos_Aires`.
- Los minutos programados salen del turno vigente o de la excepción, no del horario legado suelto.
- El DTO separa deuda y saldo a favor, llegadas y salidas dentro o fuera de tolerancia, días sin registros y jornadas incompletas.
- `JornadaClasificador.Clasificar` no se modificó para inventar entrada o salida.

## Ya existente en `main` y conservado

El README de cada repositorio y, en el frontend, `docs/FRONTEND-SECURITY.md` describen autenticación, roles, empresas, sucursales, departamentos, usuarios, agentes y fichadas. Esas funciones no se revalidaron en este relevamiento.
