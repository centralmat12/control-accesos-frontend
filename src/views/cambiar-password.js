import {
  cambiarPassword,
  finishPasswordChange,
  getCurrentUser,
  logout,
} from '../api/auth.js'
import { brandLogoAuthMarkup } from '../components/brand-logo.js'
import { createCambiarPasswordForm } from '../components/cambiar-password-form.js'
import { createThemeToggle } from '../components/theme-toggle.js'

const LOGIN_INPUT_EXTRA =
  'dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:placeholder:text-slate-500 focus:ring-blue-500/30'

export function renderCambioPasswordObligatorio(container, { onLogout, onCompleted } = {}) {
  const user = getCurrentUser()
  const view = document.createElement('div')
  view.className =
    'relative flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10 text-slate-900 dark:bg-slate-950 dark:text-slate-100'

  const form = createCambiarPasswordForm({
    idPrefix: 'cambio',
    actualLabel: 'Contraseña temporal o actual',
    actualHelpText: 'Usá la contraseña temporal recibida o tu contraseña actual.',
    extraInputClass: LOGIN_INPUT_EXTRA,
    showLogout: true,
    compactActions: true,
    onLogout: () => {
      void logout().then(() => onLogout?.())
    },
    onSubmit: async (dto) => {
      const resultado = await cambiarPassword(dto)
      await finishPasswordChange(resultado.generacion)
      onCompleted?.()
    },
  })

  view.innerHTML = `
    <div id="cambio-theme-toggle" class="absolute right-4 top-4 sm:right-6 sm:top-6"></div>
    <div class="w-full max-w-md">
      ${brandLogoAuthMarkup({ subtitle: 'Debés cambiar tu contraseña antes de continuar.' })}
      <div id="cambio-password-card" class="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900 sm:p-8"></div>
    </div>
  `

  const intro = document.createElement('p')
  intro.className = 'mb-4 text-sm text-slate-600 dark:text-slate-300'
  intro.textContent = user?.email
    ? `Sesión de ${user.email}. Ingresá la contraseña temporal o actual y definí una nueva.`
    : 'Sesión restringida. Ingresá la contraseña temporal o actual y definí una nueva.'

  const card = view.querySelector('#cambio-password-card')
  card.append(intro, form.element)
  view.querySelector('#cambio-theme-toggle')?.replaceChildren(createThemeToggle())
  container.replaceChildren(view)
  form.focus()
}
