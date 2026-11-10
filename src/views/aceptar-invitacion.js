import { aceptarInvitacion, MENSAJE_INVITACION_ACEPTADA } from '../api/invitacion-publica.js'
import { brandLogoAuthMarkup } from '../components/brand-logo.js'
import { createThemeToggle } from '../components/theme-toggle.js'
import {
  bindPasswordVisibilityToggle,
  formPasswordFieldMarkup,
  passwordRequirementsMarkup,
  syncPasswordRequirements,
  validatePasswordConfirm,
  validateUsuarioPasswordPolicy,
} from '../components/form-field.js'

const INPUT_EXTRA =
  'dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:placeholder:text-slate-500 focus:ring-blue-500/30'

export function rutaAceptarInvitacion() {
  const ruta = String(globalThis.location?.pathname || '').replace(/\/+$/, '') || '/'
  return ruta.toLowerCase() === '/aceptar-invitacion'
}

export function tokenDeInvitacion() {
  return new URLSearchParams(globalThis.location?.search || '').get('token')?.trim() || ''
}

export function renderAceptarInvitacion(container, { onLogin } = {}) {
  const token = tokenDeInvitacion()
  const view = document.createElement('div')
  view.className =
    'relative flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10 text-slate-900 dark:bg-slate-950 dark:text-slate-100'
  view.innerHTML = `
    <div id="aceptar-theme" class="absolute right-4 top-4 sm:right-6 sm:top-6"></div>
    <div class="w-full max-w-md">
      ${brandLogoAuthMarkup({ subtitle: '.Devs', subtitleClass: 'font-bold' })}
      <form id="aceptar-form" class="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900 sm:p-8" novalidate>
        <div id="aceptar-campos">
        <h1 class="text-lg font-semibold text-slate-900 dark:text-slate-100">Aceptar invitación</h1>
        <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">Definí la contraseña de tu cuenta.</p>
        <div class="mt-4 space-y-4">
          ${formPasswordFieldMarkup({
            id: 'aceptar-password',
            name: 'password',
            label: 'Contraseña',
            required: true,
            maxLength: 20,
            autocomplete: 'new-password',
            describedBy: 'aceptar-password-rules',
            extraInputClass: INPUT_EXTRA,
          })}
          ${passwordRequirementsMarkup('aceptar-password-rules')}
          ${formPasswordFieldMarkup({
            id: 'aceptar-confirmar',
            name: 'confirmarPassword',
            label: 'Confirmar contraseña',
            required: true,
            maxLength: 20,
            autocomplete: 'new-password',
            helpText: 'Volvé a ingresar la contraseña.',
            extraInputClass: INPUT_EXTRA,
          })}
        </div>
        </div>
        <p id="aceptar-ok" class="mt-4 hidden rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200" role="status"></p>
        <p id="aceptar-error" class="mt-4 hidden rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300" role="alert"></p>
        <button type="submit" id="aceptar-submit" class="mt-6 w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60">Guardar contraseña</button>
        <button type="button" id="aceptar-login" class="mt-3 hidden w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-800">Ir a iniciar sesión</button>
      </form>
    </div>
  `
  container.replaceChildren(view)
  view.querySelector('#aceptar-theme').append(createThemeToggle())
  const form = view.querySelector('#aceptar-form')
  const password = form.querySelector('[name="password"]')
  const confirmar = form.querySelector('[name="confirmarPassword"]')
  const rules = form.querySelector('#aceptar-password-rules')
  const error = form.querySelector('#aceptar-error')
  const ok = form.querySelector('#aceptar-ok')
  const submit = form.querySelector('#aceptar-submit')
  const ir = form.querySelector('#aceptar-login')
  form.querySelectorAll('[data-password-toggle]').forEach((button) => {
    bindPasswordVisibilityToggle(button.parentElement?.querySelector('input'), button)
  })
  password.addEventListener('input', () => syncPasswordRequirements(rules, password.value))
  syncPasswordRequirements(rules, '')

  function mostrarError(mensaje) {
    error.textContent = mensaje
    error.classList.remove('hidden')
  }

  if (!token) {
    submit.disabled = true
    password.disabled = true
    confirmar.disabled = true
    mostrarError('El enlace de invitación no es válido.')
  }

  ir.addEventListener('click', () => onLogin?.())
  form.addEventListener('submit', async (event) => {
    event.preventDefault()
    if (form.dataset.enviando === 'true' || !token) return
    const politica = validateUsuarioPasswordPolicy(password.value)
    const coincide = validatePasswordConfirm(password.value, confirmar.value)
    if (politica || coincide) {
      mostrarError(politica === 'Ingresá la contraseña inicial.' ? 'Ingresá la contraseña.' : politica || coincide)
      return
    }
    form.dataset.enviando = 'true'
    submit.disabled = true
    error.classList.add('hidden')
    try {
      const resultado = await aceptarInvitacion({
        token,
        password: password.value,
        confirmarPassword: confirmar.value,
      })
      password.value = ''
      confirmar.value = ''
      form.querySelector('#aceptar-campos')?.classList.add('hidden')
      ok.textContent = resultado.mensaje
      ok.classList.remove('mt-4')
      ok.classList.remove('hidden')
      submit.classList.add('hidden')
      ir.classList.remove('hidden')
      globalThis.history?.replaceState?.(null, '', '/aceptar-invitacion')
    } catch (fallo) {
      mostrarError(fallo?.message || 'No se pudo aceptar la invitación.')
      submit.disabled = false
    } finally {
      form.dataset.enviando = 'false'
    }
  })
  return view
}

export { MENSAJE_INVITACION_ACEPTADA }
