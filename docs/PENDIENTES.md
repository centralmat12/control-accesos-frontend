# Pendientes

Hechos abiertos al 2 de noviembre de 2026.

## Publicación

- `feat/turnos-asignaciones-ux` del frontend no está mergeada a `main` y no se desplegó.
- El clon local `api` apunta a `https://github.com/SamusSalinas/ControlFichajes.API.git`, rama `fix/departamentos-gestion-segura`, y no tiene las cuatro guías de `docs/`. No se modificó. La copia publicada de esas guías queda en este repositorio.

## Informe de asistencia

- El panel calcula el informe con los datos que el frontend ya puede consultar. Falta un endpoint autoritativo de la API para informes históricos y exportables. Hasta que exista, no tratar el resultado del navegador como cierre contable.

## Interfaz pedida y no cerrada

- Siguen títulos y descripciones internas en Dashboard, Fichadas, Empleados y Administración. La limpieza que los quitaba no se implementó en este cierre.
- La columna ID de Empresas sigue visible. No se confirmó en esta sesión si el usuario la usa para una acción.

## Entorno

- El 2 de noviembre de 2026, `check-deploy-archive.js` pasó en esta máquina, incluido `bash -n`. El fallo `/bin/bash` exit 127 del 27 de octubre no se reprodujo aquí. Puede volver en un Windows sin Bash.

## Relevamiento del 28 de octubre de 2026

Hechos que seguían abiertos en ese relevamiento y no se revalidaron contra la API.

## Entorno y pruebas

- `scripts/check-deploy-archive.js` ejecuta `bash -n` sobre el script de publicación. En la corrida del 27 de octubre de 2026, Windows respondió `/bin/bash` con exit 127. No se cambió el script.
- `LocalTunnelBiometricAcceptanceTests` tiene la categoría `LocalTunnelAcceptance`. El comentario de `LocalTunnelAcceptanceFactAttribute` dice que la prueba corre igual, mientras el README de la API dice que está omitida por defecto. Sin `CFB_LOCAL_TEST_API_BASE_URL`, la corrida sin filtro del 27 de octubre falló por esa variable ausente. No se ejecutó en este relevamiento.
- `ProductionBiometricAcceptanceTests` usa el servicio y la base de `.devs`. Queda fuera de la corrida habitual. No se habilitó.

## Código conocido, no corregido aquí

- Una excepción de jornada con horario propio sigue asignando `MinutosAlmuerzo = 60` en `JornadaService`. No es el guardado de `TurnoDia`. No se cambió.
- El parámetro por defecto `MinutosAlmuerzo = 60` de `HorarioPrevisto` tampoco es el guardado del turno.
- `docs/ADAPTACION_FRONTEND_MULTIEMPRESA_P0.md` dice que no había pantallas nuevas de usuarios, empresas, sucursales ni agentes. El código actual de `administracion.js` sí administra agentes. El documento histórico se dejó como estaba.
- El código del lector biométrico no está en el workspace. No hay evidencia aquí de su rama, remoto ni estado.

## Documentación

- La skill `traspaso-computadora` ya está en el repositorio. El procedimiento completo está en `.cursor/skills/traspaso-computadora/SKILL.md`. `.agents/skills/traspaso-computadora/SKILL.md` solo remite a ese archivo.
- `.agents/rules/continuidad.md` y `.cursor/rules/continuidad.mdc` remiten a `AGENTS.md` y a las cuatro guías de `docs/`. No copian su contenido.
- El clon de la API presente en este equipo no tiene esas guías. No hay una segunda copia local para sincronizar.
