# Seguridad y arquitectura del frontend

Documento de referencia para auditorías. Describe el comportamiento **real** del panel en este repositorio. No certifica el sistema ni sustituye controles de la API.

El frontend utiliza los claims para adaptar la interfaz. La autorización real corresponde a la API.

## 1. Arquitectura general

Aplicación JavaScript vanilla con Vite y Tailwind. Entrada: `index.html` → `src/main.js` → `src/app.js`. Las vistas se montan según el hash (`#/dashboard`, `#/fichadas`, `#/empleados`, `#/administracion`, `#/registros`). No hay React ni Axios.

La persistencia y las reglas de negocio viven en ControlFichajes.API. Este cliente solo habla HTTP.

## 2. Flujo de autenticación

1. `POST /api/Auth/Login` con correo y contraseña.
2. La API devuelve un JWT. El panel decodifica el payload (base64) para nombre, correo, rol, `empresa_id` e id de usuario.
3. No se valida la firma del token en el navegador.
4. Si el claim `token_use` es `agent` o el rol es `AGENTE_SUCURSAL`, no se guarda sesión.
5. Un 401 de login muestra un mensaje genérico (`Correo o contraseña incorrectos.`). No se distingue si el correo existe.
6. Tras un cambio de contraseña exitoso, `finishPasswordChange()` guarda un aviso de login, llama a `logout()` y exige un nuevo inicio de sesión.

## 3. Almacenamiento de sesión

| Clave | Dónde | Contenido |
| ----- | ----- | --------- |
| `ca.auth.token` | `sessionStorage` | JWT |
| `ca.auth.user` | `sessionStorage` | Perfil derivado de claims (sin contraseña) |
| `ca.auth.notice` | `sessionStorage` | Aviso breve post-cambio de contraseña |
| `ca.auth.empresaContexto` | `sessionStorage` | Empresa elegida por SuperAdmin |
| `ca.activity.logs` | `sessionStorage` | Actividad local del panel |
| `ca.ui.theme` | `localStorage` | `light` / `dark` |
| Sidebar colapsado | `localStorage` | Preferencia de UI |
| Columnas de fichadas | `localStorage` | Preferencia de UI |

El JWT no se guarda en `localStorage`. Cerrar la pestaña elimina token, usuario, contexto de empresa y actividad local. Un 401 autenticado llama `notifyUnauthorized()` una sola vez: logout, toast y evento `ca:unauthorized`. Un 403 no cierra la sesión (salvo el caso de cambio de contraseña obligatorio detectado por mensaje de la API).

## 4. Roles y visibilidad

Helpers: `src/config/roles.js` (`normalizeRole`, `isSuperadmin`, `isAdmin`, `isRrhh`, `isAgenteSucursal`) y `src/config/administracion.js`.

Ocultar un menú no es un control de seguridad. La API debe rechazar lo no autorizado.

## 5. Contexto de empresa

`X-Empresa-Id` solo lo agrega `apiFetch` si el usuario es SuperAdmin y hay empresa de contexto (o un `empresaId` explícito). ADMIN y RRHH usan `empresa_id` del JWT. Al cerrar sesión o al pasar de SuperAdmin a otro rol se limpia el contexto. SuperAdmin sin empresa no dispara listados de tenant (empleados, fichadas, usuarios) para no mezclar empresas. El Dashboard ignora respuestas de cargas anteriores (`loadSeq` / `cancelled`).

## 6. Clientes de API reales

Usados por el panel (API oficial, HEAD de referencia `f55f1efe73dcfc998272880f8774ce53de7d6f40`):

- Auth, empleados, fichadas, empresas, sucursales, departamentos, usuarios y agentes, según el rol y el módulo.

No forman parte de la API oficial y **no se llaman en el flujo por defecto**:

- `GET /health/ready` (opcional; ver variables)
- `GET /api/dashboard/estado-sistema`
- `GET /api/dashboard/estado-dispositivos`
- `GET /api/huellas/...`

El estado operativo del Dashboard se deriva de consultas reales (`/api/empleados`, `/api/fichadas`, y para SuperAdmin `/api/agentes` y opcionalmente `/api/usuarios`).

## 7. Manejo de errores

`src/utils/public-error.js` y `readErrorMessage` en `src/api/http.js`:

- Mensajes recortados (180 caracteres).
- Se descartan stacks, SQL, connection strings y HTML.
- 401 → cierre de sesión único.
- 403 → se muestra rechazo; no logout.
- Red / CORS → mensaje de conectividad, sin cuerpo interno.
- Toasts de error/advertencia se sanitizan y se deduplican ~2 s.

## 8. Datos que nunca se muestran como “oficiales” en UI de listados

- Hash de contraseña, JWT, `clientSecret` persistido, plantillas biométricas (`templateBiometrico` / `templateHuellaBase64`).
- Contraseñas temporales y secretos de agente solo en paneles one-shot; se descartan al cerrar.

## 9. Limitaciones de seguridad del frontend

Cualquier usuario puede editar HTML, `sessionStorage` y el JWT en memoria. El panel no es un perímetro. CSP y cabeceras las debe poner el servidor web de despliegue. Este repo no define CSP en `index.html` para no romper Vite.

Cabeceras recomendadas en el reverse proxy (no implementadas aquí):

- `Content-Security-Policy` (ajustar a los orígenes reales de API y de assets)
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy` restrictiva
- Framing: `frame-ancestors 'none'` (o equivalente en CSP)

## 10. Actividad local del panel

La vista Registros (SuperAdmin) muestra **actividad local del panel**. Vive en `sessionStorage`. El usuario puede borrarla o falsearla. No es evidencia, no reemplaza logs del servidor y no debe contener JWT, contraseñas ni secretos. `src/utils/activity-log.js` filtra claves sensibles.

## 11. Variables de entorno

Ver `.env.example`. `.env.local` está ignorado (`*.local`). No versionar tokens ni contraseñas.

| Variable | Alcance | Uso |
| -------- | ------- | --- |
| `VITE_API_BASE_URL` | Bundle | Prefijo de `/api`. Vacío en dev (proxy Vite). |
| `DEV_API_PROXY_TARGET` | Solo Node/Vite | Destino del proxy. No se inyecta como `VITE_*`. |
| `VITE_ENABLE_HEALTH_READY` | Bundle | Solo `true` habilita `GET /health/ready`. Por defecto no se llama; no genera 404 en cada carga del Dashboard. La API oficial no tiene ese endpoint. |

## 12. Procedimiento de verificación

```bash
npm run check
npm run build
npm audit
git diff --check
```

`npm run check` ejecuta los scripts `scripts/check-*.js`.

## 13. Matriz de permisos visuales

| Capacidad en UI | SuperAdmin | ADMIN | RRHH |
| --------------- | ---------- | ----- | ---- |
| Dashboard (empleados/fichadas del tenant) | Con empresa seleccionada | Sí (JWT) | Sí (JWT) |
| Selector de empresa | Sí | No | No |
| Fichadas / Empleados | Sí | Sí | Sí |
| Administración | Sí | Sí | No |
| Sección Empresas | Sí | No | No |
| Listado de usuarios | Sí | Sí, sin SuperAdmin | No consulta |
| Agentes (admin y dispositivos) | Sí | No consulta | No consulta |
| `X-Empresa-Id` | Sí | No | No |
| Alertas de usuarios bloqueados | Sí (con empresa) | Sí | No |
| Actividad local (Registros) | Sí | No | No |
| Header `X-Empresa-Id` | Solo este rol | No | No |

## 14. Pendiente por limitación de API

- ADMIN/RRHH no pueden ver dispositivos: `GET /api/agentes` es SoloSuperadmin.
- No hay endpoints oficiales de dashboard ni health.
- Enrolamiento biométrico y plantillas: el panel no los consume a propósito.
- La API autoriza; este cliente solo oculta opciones.
- Empleados inactivos: `GET /api/empleados` (sin query) sigue devolviendo solo activos. El listado del panel usa `?incluirInactivos=true` y filtra en cliente. `GET /api/empleados/{id}` y `PATCH` siguen exigiendo `Activo`; el detalle de un inactivo usa la fila del listado. `POST /api/empleados/{id}/reactivar` reactiva sin editar otros campos. Dashboard y fichadas no envían el query.
