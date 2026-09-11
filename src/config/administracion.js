/**
 * Capacidades de Administración según contratos reales de ControlFichajes.API.
 *
 * El módulo no es exclusivo de SuperAdmin: “crear desde Administración”
 * significa que altas de usuarios, empresas y sucursales salen de esta UI.
 *
 * Contratos (inspección, sin modificar backend):
 * - GET  /api/usuarios  → Policy PuedeCrearUsuarios (SuperAdmin | ADMIN), RRHH 403
 *   SuperAdmin: listado global o filtrado por query empresaId
 *   ADMIN: la API fuerza el empresa_id del claim e ignora la query
 *   Devuelve UsuarioListItemDto: id, empresaId, nombreUsuario, correo, rol, activo,
 *   requiereCambioPassword, bloqueado, bloqueadoHasta. Sin hash, temporal ni token.
 * - POST /api/usuarios  → Policy PuedeCrearUsuarios (SuperAdmin | ADMIN)
 *   SuperAdmin: X-Empresa-Id + body.empresaId coincidentes (JWT sin empresa_id)
 *   ADMIN: JWT empresa_id, sin X-Empresa-Id. El body.rol se fuerza a RRHH en la API.
 * - PATCH /api/usuarios/{id}/identidad { nombreUsuario, correo }.
 *   Misma matriz que estado/reset. 409 si el correo pertenece a otro usuario.
 * - PATCH /api/usuarios/{id}/estado { activo } y PATCH /api/usuarios/{id}/rol { rol: ADMIN|RRHH }.
 *   SuperAdmin: ADMIN y RRHH de cualquier empresa; no sí mismo ni SuperAdmin.
 *   ADMIN: solo estado de RRHH de su empresa; no cambia roles.
 *   Fuera de alcance: 404. ADMIN contra PATCH rol in-scope: 403.
 * - POST /api/usuarios/{id}/restablecer-password y /desbloquear
 *   SuperAdmin: ADMIN y RRHH de cualquier empresa; 404 sobre SuperAdmin o sí mismo.
 *   ADMIN: solo RRHH de su empresa. RRHH: 403 por policy.
 * - El cambio definitivo lo hace el propio usuario en POST /api/Auth/cambiar-password.
 *   No hay cambio administrativo de la clave definitiva de otra persona.
 * - GET  /api/empresas  → SuperAdmin: todas. ADMIN/RRHH: solo Id == empresa_id
 * - POST /api/empresas  → SoloSuperadmin
 * - POST /api/sucursales → SoloSuperadmin + X-Empresa-Id
 * - GET/PUT /api/sucursales → PerteneceAUsuario (JWT empresa_id o X-Empresa-Id de SuperAdmin)
 * - GET/POST /api/agentes, GET /api/agentes/{id}, POST /api/agentes/{id}/rotar-secret,
 *   PATCH /api/agentes/{id}/desactivar → SoloSuperadmin (token_use=web).
 *   El listado es global: el panel filtra por sucursalId de contexto.
 *   X-Empresa-Id no aísla el listado de agentes; se envía igual en SuperAdmin
 *   para el resto del contexto de empresa (p. ej. sucursales).
 *   No hay PUT de agente, activar, DELETE ni GET por sucursal.
 */
import { isAdmin, isRrhh, isSuperadmin, normalizeRole } from './roles.js'

export const API_ENABLEMENT_HINT = 'Esta acción todavía no está disponible.'

export const USUARIO_ACCION_FUERA_DE_ALCANCE =
  'No se encontró el usuario o no tenés permiso para esta acción.'

export const USUARIOS_TABLE_COLUMNS = Object.freeze([
  'Usuario',
  'Correo',
  'Rol',
  'Empresa',
  'Estado',
  'Contraseña',
  'Bloqueo',
  'Acciones',
])

export const USUARIOS_TABLE_CENTERED_COLUMNS = Object.freeze(['Estado', 'Contraseña', 'Bloqueo', 'Acciones'])

export const API_ADMIN_ENDPOINTS = Object.freeze({
  listarUsuarios: true,
  restablecerPasswordUsuario: true,
  desbloquearUsuario: true,
  cambiarEstadoUsuario: true,
  cambiarRolUsuario: true,
  actualizarIdentidadUsuario: true,
  cambiarPasswordDeOtroUsuario: false,
  crearUsuariosComoAdmin: true,
  crearUsuariosComoSuperadmin: true,
  crearEmpresasComoAdmin: false,
  crearEmpresasComoSuperadmin: true,
  crearSucursalesComoSuperadmin: true,
  crearSucursalesComoAdmin: false,
  editarSucursalesComoSuperadmin: true,
  editarSucursalesComoAdmin: true,
  listarAgentesComoSuperadmin: true,
  listarAgentesComoAdmin: false,
  crearAgentesComoSuperadmin: true,
  crearAgentesComoAdmin: false,
  rotarSecretAgenteComoSuperadmin: true,
  rotarSecretAgenteComoAdmin: false,
  desactivarAgenteComoSuperadmin: true,
  desactivarAgenteComoAdmin: false,
})

function parsePositiveId(value) {
  const id = Number(value)
  return Number.isFinite(id) && id > 0 ? id : null
}

export function puedeAccederAdministracion(user) {
  return isSuperadmin(user) || isAdmin(user)
}

export function puedeListarUsuarios(user) {
  if (API_ADMIN_ENDPOINTS.listarUsuarios !== true) return false
  if (isRrhh(user) || normalizeRole(user) === 'AGENTE_SUCURSAL') return false
  if (isSuperadmin(user)) return true
  return isAdmin(user) && Boolean(empresaIdDeTenant(user))
}

export function puedeRestablecerPasswordUsuario() {
  return API_ADMIN_ENDPOINTS.restablecerPasswordUsuario === true
}

export function puedeDesbloquearUsuario() {
  return API_ADMIN_ENDPOINTS.desbloquearUsuario === true
}

export function puedeCambiarPasswordDeOtroUsuario() {
  return API_ADMIN_ENDPOINTS.cambiarPasswordDeOtroUsuario === true
}

export function puedeCambiarEstadoUsuario() {
  return API_ADMIN_ENDPOINTS.cambiarEstadoUsuario === true
}

export function puedeCambiarRolUsuario() {
  return API_ADMIN_ENDPOINTS.cambiarRolUsuario === true
}

export function puedeActualizarIdentidadUsuario() {
  return API_ADMIN_ENDPOINTS.actualizarIdentidadUsuario === true
}

function parseUsuarioId(value) {
  const id = Number(value)
  return Number.isFinite(id) && id > 0 ? id : null
}

function emailIdentidad(value) {
  return String(value ?? '').trim().toLowerCase()
}

export function puedeIdentificarOperador(operador) {
  return Boolean(parseUsuarioId(operador?.id) || emailIdentidad(operador?.email))
}

export function esMismoUsuario(operador, objetivo) {
  const operadorId = parseUsuarioId(operador?.id)
  const objetivoId = parseUsuarioId(objetivo?.id)
  if (operadorId) return Boolean(objetivoId) && operadorId === objetivoId

  const operadorEmail = emailIdentidad(operador?.email)
  const objetivoEmail = emailIdentidad(objetivo?.correo ?? objetivo?.email)
  return Boolean(operadorEmail && objetivoEmail && operadorEmail === objetivoEmail)
}

function mismaEmpresa(operador, objetivo) {
  const operadorEmpresa = parsePositiveId(operador?.empresaId)
  const objetivoEmpresa = parsePositiveId(objetivo?.empresaId)
  return Boolean(operadorEmpresa && objetivoEmpresa && operadorEmpresa === objetivoEmpresa)
}

function puedeAdministrarUsuarioObjetivo(operador, objetivo) {
  if (!objetivo || !parseUsuarioId(objetivo.id)) return false
  if (!puedeIdentificarOperador(operador)) return false
  if (isSuperadmin(objetivo) || esMismoUsuario(operador, objetivo)) return false

  if (isSuperadmin(operador)) {
    return isAdmin(objetivo) || isRrhh(objetivo)
  }

  if (isAdmin(operador)) {
    return isRrhh(objetivo) && mismaEmpresa(operador, objetivo)
  }

  return false
}

export function puedeRestablecerUsuarioObjetivo(operador, objetivo) {
  if (!puedeRestablecerPasswordUsuario()) return false
  if (!objetivo?.activo) return false
  return puedeAdministrarUsuarioObjetivo(operador, objetivo)
}

export function puedeDesbloquearUsuarioObjetivo(operador, objetivo) {
  if (!puedeDesbloquearUsuario()) return false
  if (!objetivo?.activo) return false
  if (!objetivo?.bloqueado) return false
  return puedeAdministrarUsuarioObjetivo(operador, objetivo)
}

export function puedeEditarUsuarioObjetivo(operador, objetivo) {
  if (!puedeCambiarEstadoUsuario() && !puedeCambiarRolUsuario() && !puedeActualizarIdentidadUsuario()) {
    return puedeRestablecerUsuarioObjetivo(operador, objetivo) || puedeDesbloquearUsuarioObjetivo(operador, objetivo)
  }
  return puedeAdministrarUsuarioObjetivo(operador, objetivo)
}

export function puedeCambiarEstadoUsuarioObjetivo(operador, objetivo) {
  if (!puedeCambiarEstadoUsuario()) return false
  return puedeAdministrarUsuarioObjetivo(operador, objetivo)
}

export function puedeCambiarRolUsuarioObjetivo(operador, objetivo) {
  if (!puedeCambiarRolUsuario()) return false
  if (!isSuperadmin(operador)) return false
  return puedeAdministrarUsuarioObjetivo(operador, objetivo)
}

export function puedeActualizarIdentidadUsuarioObjetivo(operador, objetivo) {
  if (!puedeActualizarIdentidadUsuario()) return false
  return puedeAdministrarUsuarioObjetivo(operador, objetivo)
}

export function empresaIdDeTenant(user) {
  if (isSuperadmin(user)) return null
  return parsePositiveId(user?.empresaId)
}

export function puedeAbrirNuevoUsuario(user) {
  return puedeCrearUsuarios(user)
}

export function puedeCrearUsuarios(user, empresaId) {
  if (isRrhh(user) || normalizeRole(user) === 'AGENTE_SUCURSAL') return false

  if (isSuperadmin(user)) {
    if (!API_ADMIN_ENDPOINTS.crearUsuariosComoSuperadmin) return false
    if (empresaId == null) return true
    return Boolean(parsePositiveId(empresaId))
  }

  if (!isAdmin(user) || !API_ADMIN_ENDPOINTS.crearUsuariosComoAdmin) return false

  const tenantId = empresaIdDeTenant(user)
  if (!tenantId) return false
  if (empresaId == null) return true
  return parsePositiveId(empresaId) === tenantId
}

export function puedeCrearEmpresas(user) {
  if (isRrhh(user)) return false
  if (isSuperadmin(user)) return API_ADMIN_ENDPOINTS.crearEmpresasComoSuperadmin
  return isAdmin(user) && API_ADMIN_ENDPOINTS.crearEmpresasComoAdmin
}

export function puedeCrearSucursales(user, empresaId) {
  if (isRrhh(user)) return false

  if (isSuperadmin(user)) {
    if (!API_ADMIN_ENDPOINTS.crearSucursalesComoSuperadmin) return false
    if (empresaId == null) return true
    return Boolean(parsePositiveId(empresaId))
  }

  if (!isAdmin(user) || !API_ADMIN_ENDPOINTS.crearSucursalesComoAdmin) return false

  const tenantId = empresaIdDeTenant(user)
  if (!tenantId) return false
  if (empresaId == null) return true
  return parsePositiveId(empresaId) === tenantId
}

export function puedeEditarSucursales(user, empresaId) {
  if (isRrhh(user)) return false

  const scopedEmpresaId = parsePositiveId(empresaId)
  if (!scopedEmpresaId) return false

  if (isSuperadmin(user)) {
    return API_ADMIN_ENDPOINTS.editarSucursalesComoSuperadmin
  }

  if (!isAdmin(user) || !API_ADMIN_ENDPOINTS.editarSucursalesComoAdmin) return false
  return scopedEmpresaId === empresaIdDeTenant(user)
}

function puedeAgentesComoSuperadmin(user, empresaId, endpointFlag) {
  if (isRrhh(user) || normalizeRole(user) === 'AGENTE_SUCURSAL') return false
  if (!isSuperadmin(user) || !endpointFlag) return false
  if (empresaId == null) return true
  return Boolean(parsePositiveId(empresaId))
}

export function puedeListarAgentes(user, empresaId) {
  if (isAdmin(user) && !isSuperadmin(user)) return false
  return puedeAgentesComoSuperadmin(user, empresaId, API_ADMIN_ENDPOINTS.listarAgentesComoSuperadmin)
}

export function puedeCrearAgentes(user, empresaId) {
  if (isAdmin(user) && !isSuperadmin(user)) return false
  return puedeAgentesComoSuperadmin(user, empresaId, API_ADMIN_ENDPOINTS.crearAgentesComoSuperadmin)
}

export function puedeRotarSecretAgente(user, empresaId) {
  if (isAdmin(user) && !isSuperadmin(user)) return false
  return puedeAgentesComoSuperadmin(user, empresaId, API_ADMIN_ENDPOINTS.rotarSecretAgenteComoSuperadmin)
}

export function puedeDesactivarAgente(user, empresaId) {
  if (isAdmin(user) && !isSuperadmin(user)) return false
  return puedeAgentesComoSuperadmin(user, empresaId, API_ADMIN_ENDPOINTS.desactivarAgenteComoSuperadmin)
}

export function puedeAdministrarAgentes(user, empresaId) {
  return puedeListarAgentes(user, empresaId)
}
