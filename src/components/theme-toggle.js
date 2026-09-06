import { getTheme, toggleTheme } from '../config/theme.js'
import { iconMoon, iconSun } from './icons.js'

export function createThemeToggle({ className = '' } = {}) {
  const button = document.createElement('button')
  const isDark = getTheme() === 'dark'

  button.type = 'button'
  button.dataset.themeToggle = 'true'
  button.className = [
    'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white dark:focus-visible:ring-offset-slate-900',
    className,
  ].filter(Boolean).join(' ')
  button.setAttribute('aria-label', isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro')
  button.setAttribute('title', isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro')
  button.innerHTML = `
    <span data-theme-icon="moon" class="${isDark ? 'hidden' : ''}">${iconMoon()}</span>
    <span data-theme-icon="sun" class="${isDark ? '' : 'hidden'}">${iconSun()}</span>
  `
  button.addEventListener('click', toggleTheme)

  return button
}
