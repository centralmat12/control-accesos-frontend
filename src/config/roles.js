export const ROLES = {
  Superadmin: 'SUPERADMIN',
  Admin: 'ADMIN',
  Rrhh: 'RRHH',
}

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
