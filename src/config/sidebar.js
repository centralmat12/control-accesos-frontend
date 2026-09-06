export const SIDEBAR_COLLAPSED_KEY = 'ca.ui.sidebarCollapsed'

let sessionValue = null

export function getSidebarCollapsed() {
  try {
    const stored = window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY)
    if (stored === 'true' || stored === 'false') return stored === 'true'
  } catch {
    // Se usa el valor de la sesión si localStorage no está disponible.
  }

  return sessionValue ?? false
}

export function setSidebarCollapsed(collapsed) {
  sessionValue = Boolean(collapsed)
  try {
    window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(sessionValue))
  } catch {
    // La preferencia sigue activa durante la sesión.
  }
  return sessionValue
}
