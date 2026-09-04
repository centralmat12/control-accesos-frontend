# Adaptación frontend P0 — multiempresa y roles

Cambios aplicados en `control-accesos-frontend` para convivir con ControlFichajes.API (SUPERADMIN global, `X-Empresa-Id`, `EmpresaDto`). **No hay pantallas nuevas de Usuarios/Empresas/Sucursales/Agentes.**

---

## Tabla de cambios

| Archivo | Estado anterior | Cambio aplicado | Motivo | Resultado |
| --- | --- | --- | --- | --- |
| `src/config/roles.js` | No existía | `isSuperadmin`, `isAdmin`, `isRrhh`, `normalizeRole` | Una sola fuente de roles | Comparaciones centralizadas |
| `src/api/empresa-context.js` | No existía | Store `sessionStorage` + evento `ca:empresa-contexto` | Contexto SA sin tocar `user.empresaId` | Selector persistente por pestaña |
| `src/api/auth.js` | Logout solo token/user; SA sin `empresaId` ya era válido | Logout y login ADMIN/RRHH limpian contexto | No dejar tenant de un SA en otra sesión | A, G |
| `src/api/http.js` | Solo Bearer; 401 logout | SA + contexto → `X-Empresa-Id`. ADMIN/RRHH nunca. `skipEmpresaContext` para listado global | Header único | C, D, E, F |
| `src/api/empresas.js` | `list[0]` + `nombreFantasia`/`razonSocial` | `getEmpresas` vs `getEmpresaActual`; map `nombre`/`cuit`/`direccion` + fallbacks | DTO nuevo y no elegir empresa 1 para SA | H, B |
| `src/config/navigation.js` | Mismo menú; placeholders hidden | `roles` en ítems + `getNavItemsForUser` | Infra P1; ocultar placeholders | Menú igual para SA/ADMIN/RRHH |
| `src/components/sidebar.js` | `PRIMARY_NAV_ITEMS` | Nav filtrada por usuario | No mostrar Áreas/Agentes | Menú limpio |
| `src/components/header.js` | Nombre + rol | Selector SA; texto de empresa ADMIN/RRHH | Elegir contexto | B–D |
| `src/components/layout.js` | Sidebar sin user | Pasa `user` al sidebar | Nav por rol | — |
| `src/components/feedback-state.js` | Solo error/ok/loading | `createSelectEmpresaState` | Empty state unificado | B |
| `src/app.js` | Remount completo | Escucha contexto y refresca **solo** la vista activa | No recargar layout al cambiar empresa | D |
| `src/views/dashboard.js` | Siempre `getDashboardData` | SA sin contexto: empty state, **sin** GET empleados/fichadas | Evitar 403 | B, 7 |
| `src/views/empleados.js` | Sin `empresaId` = sesión rota | SA sin contexto: empty state. Alta usa `getOperativeEmpresaId` | SA válido; POST con empresa del contexto | 8 |
| `src/views/fichadas.js` | Carga siempre | SA sin contexto: empty state. Label de empresa con DTO nuevo | Consulta con header vía `apiFetch` | 9 |

---

## Flujo SUPERADMIN

1. Login → JWT **sin** `empresa_id` → sesión `{ nombre, email, rol: SUPERADMIN }` **válida**.
2. Header: `GET /api/empresas` con `skipEmpresaContext` (**sin** `X-Empresa-Id`) → todas las empresas.
3. Sin selección: Dashboard / Empleados / Fichadas muestran *“Seleccioná una empresa para consultar la información.”* No hay requests de empleados ni fichadas.
4. Elige Empresa 1 → `ca.auth.empresaContexto` + evento → vista activa recarga. `apiFetch` agrega `X-Empresa-Id: 1`.
5. Cambia a Empresa 2 → mismo mecanismo, header `2`.
6. Alta de empleado: body `empresaId` = id del contexto; header lo pone `apiFetch`.
7. Logout: borra token, user y contexto.

## Flujo ADMIN

1. Login → `empresaId` del JWT en sesión.
2. **No** ve selector. Puede ver el nombre de su empresa (GET `/api/empresas` sin header → un ítem).
3. Requests **sin** `X-Empresa-Id`. Tenant = claim.
4. CRUD empleados igual que antes.

## Flujo RRHH

Igual que ADMIN en tenant y pantallas P0 (dashboard, fichadas, empleados). Sigue pudiendo alta/PATCH/baja lógica. No hay menú de usuarios.

## `X-Empresa-Id`

| Quién | Cuándo se envía |
| --- | --- |
| SUPERADMIN con contexto | En todo `apiFetch` **excepto** `skipEmpresaContext: true` (`getEmpresas`) |
| SUPERADMIN sin contexto | No se envía (y las vistas tenant no llaman a la API) |
| ADMIN / RRHH | Nunca |

## sessionStorage

| Clave | Contenido |
| --- | --- |
| `ca.auth.token` | JWT (igual que antes) |
| `ca.auth.user` | `{ nombre, email, rol, empresaId? }` — SA **sin** `empresaId` |
| `ca.auth.empresaContexto` | `{ id, nombre, … }` solo SA |

## Pendientes P1

- Vista Usuarios (`GET/POST/PATCH /api/usuarios`).
- Alta/listado de empresas (POST) y sucursales.
- UI de agentes (secret, lista).
- Ítems de nav con `roles` más finos (p. ej. Usuarios: SA+ADMIN).
