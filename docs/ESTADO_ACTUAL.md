# Estado actual

Cierre del 2 de noviembre de 2026 en `control-accesos-frontend`, rama `feat/turnos-asignaciones-ux`. El remoto es `https://github.com/centralmat12/control-accesos-frontend.git`. No implica despliegue ni merge a `main`.

## Verificación del 2 de noviembre de 2026

Comandos ejecutados en el frontend, con `TZ=UTC`:

- `npm run check` (`node scripts/run-checks.js`): 57 scripts pasaron, incluido `check-deploy-archive.js`.
- `npm run build`: terminó bien. El artefacto de esa corrida fue `dist/assets/index-_g0BTJe9.js`. `dist/` no se versiona.
- `git diff --check`: sin errores de espacio en blanco.

En el navegador, con sesión ya iniciada en `http://127.0.0.1:5173/`:

- Dashboard mostró Estado del sistema, empleados activos, fichadas de hoy, entradas, salidas y actividad.
- Fichadas abrió las pestañas Consulta de fichadas e Informes de asistencia. Consulta mostró filtros, Registrar, Exportar y las vistas Línea de tiempo, Resumen de jornadas, Movimientos registrados y Calendario. Informes dejó el hash `#/fichadas?seccion=informe`.
- Empleados mostró Nuevo empleado, búsqueda, sucursal, departamento, estado y el selector de página.
- Administración mostró las cuatro pestañas en una barra ajustada al texto, no al ancho completo.

No se recorrió cada filtro, cada página ni cada formulario hasta el guardado. Exportar quedó deshabilitado en la consulta vacía que se vio; la generación de archivos se comprobó con `scripts/check-exportacion-fichadas.js` y con un PDF armado por `buildPdfBytes`.

## Informe y PDF

El informe de asistencia se arma en el frontend con empleados, fichadas, calendario, asignaciones y alertas ya existentes. No hay un endpoint nuevo de informe. El PDF lo escribe `src/utils/pdf-document.js` con Helvetica y WinAnsi. El texto extraído del ejemplo de dos páginas contenía `Peña Ñandú`, `Período: Últimos 60 días`, `31/10/2026`, `0003`, `Página 1 de 2`, `Página 2 de 2` y el pie `Informe operativo | …`. No contenía el texto `Control de Accesos`. Una captura posterior del visor quedó en blanco; la revisión visual anterior de la misma plantilla sí mostró logo, bloques de resumen y columnas completas.

## Lo que sigue visible y no se dio por eliminado

Siguen en pantalla títulos o descripciones internas: «Resumen general del sistema y la actividad de hoy.», «Administración de la organización», «Consultá las fichadas», «Informe de asistencia» y «Administrá la nómina, sus asignaciones y su estado.». La limpieza estricta pedida después no se aplicó en este cierre.

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
