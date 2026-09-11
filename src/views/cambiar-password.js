import {
  cambiarPassword,
  finishPasswordChange,
  getCurrentUser,
  logout,
} from '../api/auth.js'
import { brandLogoAuthMarkup } from '../components/brand-logo.js'
import { createThemeToggle } from '../components/theme-toggle.js'
import {
  applyPasswordConfirmPresentation,
  bindPasswordVisibilityToggle,
  fieldIds,
  formPasswordFieldMarkup,
  passwordConfirmStatus,
  passwordRequirementsMarkup,
  syncPasswordRequirements,
  validatePasswordConfirm,
  validateUsuarioPasswordPolicy,
  wireFormFields,
} from '../components/form-field.js'
import { BTN_SECONDARY_CLASS } from '../components/button-styles.js'

const LOGIN_INPUT_EXTRA =
  'dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:placeholder:text-slate-500 focus:ring-blue-500/30'

export function renderCambioPasswordObligatorio(container, { onLogout, onCompleted } = {}) {
  const user = getCurrentUser()
  const view = document.createElement('div')
  view.className =
    'relative flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10 text-slate-900 dark:bg-slate-950 dark:text-slate-100'

  const actualIds = fieldIds('cambio-passwordActual')
  const nuevaIds = fieldIds('cambio-nuevaPassword')
  const confirmIds = fieldIds('cambio-confirmarPassword')

  view.innerHTML = `
    <div id="cambio-theme-toggle" class="absolute right-4 top-4 sm:right-6 sm:top-6"></div>
    <div class="w-full max-w-md">
      ${brandLogoAuthMarkup({ subtitle: 'Debés cambiar tu contraseña antes de continuar.' })}

      <form id="cambio-password-form" class="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900 sm:p-8" novalidate>
        <p class="text-sm text-slate-600 dark:text-slate-300">
          ${user?.email ? `Sesión de ${user.email}.` : 'Sesión restringida.'}
          Ingresá la contraseña temporal o actual y definí una nueva.
        </p>
        <div class="mt-4 space-y-4">
          ${formPasswordFieldMarkup({
            id: 'cambio-passwordActual',
            name: 'passwordActual',
            label: 'Contraseña temporal o actual',
            required: true,
            autocomplete: 'current-password',
            extraInputClass: LOGIN_INPUT_EXTRA,
            helpText: 'Usá la contraseña temporal recibida o tu contraseña actual.',
          })}
          ${formPasswordFieldMarkup({
            id: 'cambio-nuevaPassword',
            name: 'nuevaPassword',
            label: 'Nueva contraseña',
            required: true,
            autocomplete: 'new-password',
            extraInputClass: LOGIN_INPUT_EXTRA,
            describedBy: 'cambio-nuevaPassword-rules',
          })}
          ${passwordRequirementsMarkup('cambio-nuevaPassword-rules')}
          ${formPasswordFieldMarkup({
            id: 'cambio-confirmarPassword',
            name: 'confirmarPassword',
            label: 'Confirmar nueva contraseña',
            required: true,
            autocomplete: 'new-password',
            extraInputClass: LOGIN_INPUT_EXTRA,
          })}
        </div>

        <p id="cambio-password-error" class="mt-4 hidden rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300" role="alert"></p>

        <div class="mt-6 flex flex-col gap-2">
          <button
            type="submit"
            id="cambio-password-submit"
            class="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cambiar contraseña
          </button>
          <button type="button" id="cambio-password-logout" class="${BTN_SECONDARY_CLASS} w-full justify-center">
            Cerrar sesión
          </button>
        </div>
      </form>
    </div>
  `

  view.querySelector('#cambio-theme-toggle')?.replaceChildren(createThemeToggle())

  const form = view.querySelector('#cambio-password-form')
  const errorEl = view.querySelector('#cambio-password-error')
  const submitBtn = view.querySelector('#cambio-password-submit')
  const logoutBtn = view.querySelector('#cambio-password-logout')
  const actualInput = form.querySelector('[name="passwordActual"]')
  const nuevaInput = form.querySelector('[name="nuevaPassword"]')
  const confirmInput = form.querySelector('[name="confirmarPassword"]')
  const passwordRules = form.querySelector('#cambio-nuevaPassword-rules')
  const confirmHelp = form.querySelector('#cambio-confirmarPassword-help')
  const confirmError = form.querySelector('#cambio-confirmarPassword-error')
  const confirmSuccess = form.querySelector('#cambio-confirmarPassword-success')

  form.querySelectorAll('[data-password-toggle]').forEach((button) => {
    const input = button.parentElement?.querySelector('input')
    bindPasswordVisibilityToggle(input, button)
  })

  const fields = wireFormFields(form, [
    {
      name: 'passwordActual',
      helpId: actualIds.helpId,
      errorId: actualIds.errorId,
      getError: () => (String(actualInput.value ?? '') ? '' : 'Ingresá la contraseña actual.'),
    },
    {
      name: 'nuevaPassword',
      helpId: nuevaIds.helpId,
      errorId: nuevaIds.errorId,
      extraDescribedBy: 'cambio-nuevaPassword-rules',
      live: true,
      getError: () => validateUsuarioPasswordPolicy(nuevaInput.value),
    },
    {
      name: 'confirmarPassword',
      helpId: confirmIds.helpId,
      errorId: confirmIds.errorId,
      live: true,
      customPresentation: true,
      getError: () => validatePasswordConfirm(nuevaInput.value, confirmInput.value),
      onPresent: ({ submitted }) => {
        applyPasswordConfirmPresentation({
          input: confirmInput,
          helpEl: confirmHelp,
          errorEl: confirmError,
          successEl: confirmSuccess,
          helpId: confirmIds.helpId,
          errorId: confirmIds.errorId,
          successId: 'cambio-confirmarPassword-success',
          status: passwordConfirmStatus(nuevaInput.value, confirmInput.value),
          submitted,
        })
      },
    },
  ])

  form.addEventListener('input', (event) => {
    if (event.target?.name === 'nuevaPassword') {
      syncPasswordRequirements(passwordRules, nuevaInput.value)
      fields.refresh('confirmarPassword')
    }
  })

  syncPasswordRequirements(passwordRules, '')

  logoutBtn.addEventListener('click', () => {
    logout()
    onLogout?.()
  })

  form.addEventListener('submit', async (event) => {
    event.preventDefault()
    if (form.dataset.submitting === 'true') return

    const result = fields.validateAll()
    if (result.hasErrors) {
      result.firstInvalid?.focus()
      return
    }

    errorEl.classList.add('hidden')
    errorEl.textContent = ''
    form.dataset.submitting = 'true'
    submitBtn.disabled = true
    logoutBtn.disabled = true
    submitBtn.textContent = 'Guardando...'

    try {
      await cambiarPassword({
        passwordActual: String(actualInput.value ?? ''),
        nuevaPassword: String(nuevaInput.value ?? ''),
        confirmarPassword: String(confirmInput.value ?? ''),
      })
      actualInput.value = ''
      nuevaInput.value = ''
      confirmInput.value = ''
      finishPasswordChange()
      onCompleted?.()
    } catch (error) {
      if (error?.code === 'UNAUTHORIZED') return
      errorEl.textContent = error.message || 'No se pudo cambiar la contraseña.'
      errorEl.classList.remove('hidden')
      delete form.dataset.submitting
      submitBtn.disabled = false
      logoutBtn.disabled = false
      submitBtn.textContent = 'Cambiar contraseña'
    }
  })

  container.replaceChildren(view)
  actualInput?.focus()
}
