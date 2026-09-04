import { ROLES, normalizeRole } from './roles.js'

export const APP_NAME = 'Control de Accesos'

export const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', path: '/', roles: [ROLES.Superadmin, ROLES.Admin, ROLES.Rrhh] },
  { id: 'fichadas', label: 'Fichadas', path: '/fichadas', roles: [ROLES.Superadmin, ROLES.Admin, ROLES.Rrhh] },
  { id: 'empleados', label: 'Empleados', path: '/empleados', roles: [ROLES.Superadmin, ROLES.Admin, ROLES.Rrhh] },
  { id: 'areas', label: 'Áreas', path: '/areas', hidden: true },
  { id: 'horarios', label: 'Horarios', path: '/horarios', hidden: true },
  { id: 'dispositivos', label: 'Dispositivos', path: '/dispositivos', hidden: true },
  { id: 'agentes', label: 'Agentes', path: '/agentes', hidden: true },
]

export const PRIMARY_NAV_ITEMS = NAV_ITEMS.filter((item) => !item.hidden)

export const DEFAULT_VIEW = 'dashboard'

export function getNavItemsForUser(user) {
  const role = normalizeRole(user)
  const items = NAV_ITEMS.filter((item) => {
    if (item.hidden) return false
    if (!item.roles?.length) return true
    return item.roles.includes(role)
  })

  if (items.length > 0) return items

  return NAV_ITEMS.filter((item) => !item.hidden)
}
