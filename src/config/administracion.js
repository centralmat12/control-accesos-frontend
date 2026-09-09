/**
 * Capacidades de Administración según contratos reales de ControlFichajes.API.
 *
 * El módulo no es exclusivo de SuperAdmin: “crear desde Administración”
 * significa que altas de usuarios, empresas y sucursales salen de esta UI.
 *
 * Contratos (inspección, sin modificar backend):
 * - GET  /api/usuarios  → no existe (confirmado en el commit actual de la API)
 * - POST /api/usuarios  → Policy PuedeCrearUsuarios (SuperAdmin | ADMIN)
 *   SuperAdmin: X-Empresa-Id + body.empresaId coincidentes (JWT sin empresa_id)
 *   ADMIN: JWT empresa_id, sin X-Empresa-Id
 * - Restablecer / cambiar / desbloquear contraseña → no existen
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

export const API_ENABLEMENT_HINT = 'Requiere habilitación en API'

export const API_ADMIN_ENDPOINTS = Object.freeze({
  listarUsuarios: false,
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

export function puedeListarUsuarios() {
  return API_ADMIN_ENDPOINTS.listarUsuarios === true
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
