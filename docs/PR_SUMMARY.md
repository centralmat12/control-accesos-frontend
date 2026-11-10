# Resumen del PR

Rama: `feat/autenticacion-sesiones-web`. No hay PR abierto.

El resumen de la API está en la rama `feat/autenticacion-segura` del repositorio `ControlFichajes.API`, archivo `docs/PR_SUMMARY.md`. Ese PR tampoco está abierto. Su SHA desplegado es `f56a851119b9d140975ef4d80c80148e103da865`. La publicación de esa rama sigue sujeta a la autorización de Samu.

## Objetivo

Publicar el panel que administra usuarios e invitaciones, desbloquea cuentas y completa el primer ingreso cuando la cuenta exige MFA, contra la API del mismo origen.

## Alcance

Incluye la sesión renovable del panel, usuarios, invitaciones, desbloqueo y el primer ingreso con MFA. El build publicado llama a `/api` en el mismo origen. No incluye contraseñas, tokens, cadenas de conexión, volcados ni imágenes Docker.

## Cambios principales

- Usuarios invita con el mismo rol y la misma empresa del alta, puede exigir MFA y cancela una invitación pendiente. La aceptación deja la contraseña elegida y, si corresponde, vincula el autenticador antes de entrar al panel. El flujo está en [auth.js](../src/api/auth.js).
- El desbloqueo de una cuenta bloqueada queda en la administración de usuarios y usa el endpoint de la API.
- El primer ingreso con MFA trata `mfa_requerido` y `vinculacion_mfa_pendiente` como pasos previos a la sesión. El desafío y los códigos quedan en memoria. Seguridad muestra el estado real, el enrolamiento voluntario y la desactivación cuando el factor no es obligatorio.
- La sesión renovable envía `X-CF-Solicitud: 1` y `X-CF-Generacion` en el login. El build de producción deja `VITE_API_BASE_URL` vacío, así que esas llamadas van a `/api` del mismo origen.

## Dependencias entre frontend y API

Este panel necesita la rama `feat/autenticacion-segura` para invitaciones, desbloqueo, MFA y baja lógica. El login del navegador solo entra si `Cors:AllowedOrigins` contiene exactamente `https://controldeaccesos.online`. Sin ese origen, `POST /api/Auth/Login` responde 403 `{"mensaje":"Solicitud rechazada."}` antes de revisar la contraseña.

## Pruebas del entorno aislado

- `npm run build` del commit `a2e60f09f3d94de743dc2c4949d8ea524a36bd92` terminó con `VITE_API_BASE_URL` vacío. El artefacto no incluye un host de API.
- Pasaron `check-mfa-web`, `check-mfa-estado`, `check-usuario-modificacion`, `check-usuario-seguridad`, `check-usuario-identidad` y `check-correo-saliente`.
- En el ensayo aislado, con la API `f56a851119b9d140975ef4d80c80148e103da865`, el panel mostró empleados y fichadas históricas y registró la fichada manual 1974.

## Verificaciones en producción

Separadas del ensayo aislado.

- El build publicado es `a2e60f09f3d94de743dc2c4949d8ea524a36bd92` y usa `/api` en `https://controldeaccesos.online`.
- El primer login del navegador recibió HTTP 403 porque el origen no estaba en `Cors:AllowedOrigins`. La corrección de esa lista está registrada en el resumen de la API.
- Después de esa corrección, el login y la visualización de empleados y fichadas quedaron confirmados en producción.

## Resultados

`a2e60f09f3d94de743dc2c4949d8ea524a36bd92` es el SHA del build publicado. El SHA final de la rama es el commit posterior que agrega este archivo.

## Pendientes

- No hay PR abierto.
- La fichada nueva desde el lector en producción queda pendiente.
- Publicar la rama de la API sigue sujeto a la autorización de Samu.

## Despliegue y reversión

El despliegue de hoy publica el contenido estático de `a2e60f09f3d94de743dc2c4949d8ea524a36bd92`, con `/api` en el mismo origen. Revertir el panel es volver a servir el build anterior. Revertir la API, sin restaurar la base, usa la rama `rollback/50843f8-eliminado`, commit `a012fc24517b4c83d31cd254e679e9f721b5752f`, documentada en el resumen de la API.
