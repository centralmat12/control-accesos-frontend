/**
 * Capacidades de Administración según contratos reales de ControlFichajes.API.
 *
 * El módulo no es exclusivo de SuperAdmin: “crear desde Administración”
 * significa que altas de usuarios, empresas y sucursales salen de esta UI.
 *
 * Contratos (inspección, sin modificar backend):
 * - GET  /api/usuarios  → no existe
 * - POST /api/usuarios  → Policy PuedeCrearUsuarios (SuperAdmin | ADMIN)
 *   SuperAdmin: X-Empresa-Id + body.empresaId coincidentes (JWT sin empresa_id)
 *   ADMIN: JWT empresa_id, sin X-Empresa-Id
 * - GET  /api/empresas  → SuperAdmin: todas. ADMIN/RRHH: solo Id == empresa_id
 * - POST /api/empresas  → SoloSuperadmin
 * - POST /api/sucursales → SoloSuperadmin + X-Empresa-Id
 * - GET/PUT /api/sucursales → PerteneceAUsuario (JWT empresa_id o X-Empresa-Id de SuperAdmin)
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
