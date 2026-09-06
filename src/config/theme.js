export const THEME_STORAGE_KEY = 'ca.ui.theme'

const THEMES = new Set(['light', 'dark'])
let activeTheme = THEMES.has(document.documentElement.dataset.theme)
  ? document.documentElement.dataset.theme
  : null

function systemTheme() {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function storedTheme() {
  try {
    const value = window.localStorage.getItem(THEME_STORAGE_KEY)
    return THEMES.has(value) ? value : null
  } catch {
    return null
  }
}

function syncThemeControls(theme) {
  document.querySelectorAll('[data-theme-toggle]').forEach((button) => {
    const isDark = theme === 'dark'
    button.setAttribute('aria-label', isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro')
    button.setAttribute('title', isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro')
    button.querySelector('[data-theme-icon="moon"]')?.classList.toggle('hidden', isDark)
    button.querySelector('[data-theme-icon="sun"]')?.classList.toggle('hidden', !isDark)
  })
}

export function getTheme() {
  return storedTheme() ?? activeTheme ?? systemTheme()
}

export function applyTheme(theme = getTheme()) {
  const resolved = THEMES.has(theme) ? theme : systemTheme()
  const root = document.documentElement
  root.classList.toggle('dark', resolved === 'dark')
  root.dataset.theme = resolved
  root.style.colorScheme = resolved
  activeTheme = resolved
  syncThemeControls(resolved)
  return resolved
}

export function setTheme(theme) {
  if (!THEMES.has(theme)) return applyTheme()

  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    // El tema sigue funcionando durante la sesión aunque el storage no esté disponible.
  }

  return applyTheme(theme)
}

export function toggleTheme() {
  return setTheme(getTheme() === 'dark' ? 'light' : 'dark')
}
