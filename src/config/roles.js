/**
 * Roles humanos del JWT / API.
 *
 * Claim `role` emitido por JwtTokenService:
 * - SuperAdmin (constante AppRoles.SuperAdmin; IsSuperAdmin es case-insensitive)
 * - ADMIN
 * - RRHH
 *
 * AGENTE_SUCURSAL es token de agente (`token_use=agent`), no usuario humano del panel.
 * AUDITOR no existe en AppRoles ni en UsuariosController.
 *
 * Estas funciones solo ocultan o muestran UI. La autorización real corresponde a la API.
 */
export const ROLES = {
  Superadmin: 'SUPERADMIN',
  Admin: 'ADMIN',
  Rrhh: 'RRHH',
  AgenteSucursal: 'AGENTE_SUCURSAL',
}

/** Valores exactos que POST /api/usuarios y PATCH /rol aceptan (ADMIN | RRHH). */
export const USUARIO_ROLES_API = Object.freeze([ROLES.Admin, ROLES.Rrhh])

export const USUARIO_ROL_LABELS = Object.freeze({
  [ROLES.Admin]: 'Administrador',
  [ROLES.Rrhh]: 'Recursos Humanos',
})

export function normalizeRole(userOrRole) {
  const raw = typeof userOrRole === 'string' ? userOrRole : userOrRole?.rol
  return String(raw ?? '')
    .trim()
    .toUpperCase()
}

export function isSuperadmin(user) {
  return normalizeRole(user) === ROLES.Superadmin
}

export function isAdmin(user) {
  return normalizeRole(user) === ROLES.Admin
}

export function isRrhh(user) {
  return normalizeRole(user) === ROLES.Rrhh
}

export function isAgenteSucursal(user) {
  return normalizeRole(user) === ROLES.AgenteSucursal
}

export function canAccessAdministracion(user) {
  return isSuperadmin(user) || isAdmin(user)
}

export function isAssignableUsuarioRole(role) {
  return USUARIO_ROLES_API.includes(normalizeRole(role))
}

export function usuarioRolLabel(role) {
  const normalized = normalizeRole(role)
  return USUARIO_ROL_LABELS[normalized] ?? (String(role ?? '').trim() || '—')
}

export function cuentaRolLabel(role) {
  if (isSuperadmin(role)) return 'SuperAdmin'
  return usuarioRolLabel(role)
}

export function rolesAsignablesParaAlta(operador) {
  if (isSuperadmin(operador)) return [...USUARIO_ROLES_API]
  if (isAdmin(operador)) return [ROLES.Rrhh]
  return []
}
