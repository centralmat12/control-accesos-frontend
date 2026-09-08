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
 */
export const ROLES = {
  Superadmin: 'SUPERADMIN',
  Admin: 'ADMIN',
  Rrhh: 'RRHH',
}

/** Valores exactos que POST /api/usuarios acepta (ADMIN | RRHH). */
export const USUARIO_ROLES_API = Object.freeze([ROLES.Admin, ROLES.Rrhh])

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

export function canAccessAdministracion(user) {
  return isSuperadmin(user) || isAdmin(user)
}

export function isAssignableUsuarioRole(role) {
  return USUARIO_ROLES_API.includes(normalizeRole(role))
}
