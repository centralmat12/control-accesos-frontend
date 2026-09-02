export const APP_NAME = 'Control de Accesos'

export const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', path: '/' },
  { id: 'fichadas', label: 'Fichadas', path: '/fichadas' },
  { id: 'empleados', label: 'Empleados', path: '/empleados' },
  { id: 'areas', label: 'Áreas', path: '/areas', hidden: true },
  { id: 'horarios', label: 'Horarios', path: '/horarios', hidden: true },
  { id: 'dispositivos', label: 'Dispositivos', path: '/dispositivos', hidden: true },
  { id: 'agentes', label: 'Agentes', path: '/agentes', hidden: true },
]

export const PRIMARY_NAV_ITEMS = NAV_ITEMS.filter((item) => !item.hidden)

export const DEFAULT_VIEW = 'dashboard'
