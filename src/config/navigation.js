import { ROLES, normalizeRole } from './roles.js'
import { puedeAccederAdministracion } from './administracion.js'

export const APP_NAME = 'Control de Accesos'

export const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', path: '/', roles: [ROLES.Superadmin, ROLES.Admin, ROLES.Rrhh] },
  { id: 'fichadas', label: 'Fichadas', path: '/fichadas', roles: [ROLES.Superadmin, ROLES.Admin, ROLES.Rrhh] },
  { id: 'empleados', label: 'Empleados', path: '/empleados', roles: [ROLES.Superadmin, ROLES.Admin, ROLES.Rrhh] },
  { id: 'registros', label: 'Registros', path: '/registros', roles: [ROLES.Superadmin, ROLES.Admin, ROLES.Rrhh] },
  { id: 'administracion', label: 'Administración', path: '/administracion', roles: [ROLES.Superadmin, ROLES.Admin] },
  { id: 'areas', label: 'Áreas', path: '/areas', hidden: true },
  { id: 'horarios', label: 'Horarios', path: '/horarios', hidden: true },
  { id: 'dispositivos', label: 'Dispositivos', path: '/dispositivos', hidden: true },
  { id: 'agentes', label: 'Agentes', path: '/agentes', hidden: true },
]

export const PRIMARY_NAV_ITEMS = NAV_ITEMS.filter((item) => !item.hidden)

export const DEFAULT_VIEW = 'dashboard'

export function getNavItemsForUser(user) {
  return NAV_ITEMS.filter((item) => {
    if (item.hidden) return false
    if (item.id === 'administracion') return puedeAccederAdministracion(user)
    if (!item.roles?.length) return true
    return item.roles.includes(normalizeRole(user))
  })
}

export function canAccessView(user, viewId) {
  if (viewId === 'administracion') return puedeAccederAdministracion(user)

  const item = NAV_ITEMS.find((nav) => nav.id === viewId)
  if (!item || item.hidden) return false
  if (!item.roles?.length) return true
  return item.roles.includes(normalizeRole(user))
}
