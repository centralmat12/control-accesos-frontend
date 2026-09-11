import { consumeLoginNotice, login } from '../api/auth.js'
import { APP_NAME } from '../config/navigation.js'
import { createThemeToggle } from '../components/theme-toggle.js'
import {
  fieldIds,
  formFieldMarkup,
  validateEmailValue,
  wireFormFields,
} from '../components/form-field.js'

const LOGIN_INPUT_EXTRA =
  'dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:placeholder:text-slate-500 focus:ring-blue-500/30'

export function renderLogin(container, { onSuccess }) {
  const view = document.createElement('div')
  view.className =
    'relative flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10 text-slate-900 dark:bg-slate-950 dark:text-slate-100'

  const emailIds = fieldIds('login-email')
  const passwordIds = fieldIds('login-password')

  view.innerHTML = `
    <div id="login-theme-toggle" class="absolute right-4 top-4 sm:right-6 sm:top-6"></div>
    <div class="w-full max-w-md">
      <div class="mb-8 flex flex-col items-center text-center">
        <span class="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-lg font-bold text-white">CA</span>
        <h1 class="mt-4 text-xl font-semibold tracking-tight text-slate-900 dark:text-white">${APP_NAME}</h1>
        <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">Iniciá sesión para acceder al panel</p>
      </div>

      <form id="login-form" class="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900 sm:p-8" novalidate>
        <div class="space-y-4">
          ${formFieldMarkup({
            id: 'login-email',
            name: 'email',
            label: 'Correo electrónico',
            required: true,
            type: 'email',
            autocomplete: 'username',
            extraInputClass: LOGIN_INPUT_EXTRA,
            helpText: 'Ingresá el correo asociado a tu cuenta.',
          })}
          ${formFieldMarkup({
            id: 'login-password',
            name: 'password',
            label: 'Contraseña',
            required: true,
            type: 'password',
            autocomplete: 'current-password',
            extraInputClass: LOGIN_INPUT_EXTRA,
            helpText: 'Ingresá la contraseña correspondiente a tu usuario.',
          })}
        </div>

        <p id="login-notice" class="mt-4 hidden rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200" role="status"></p>
        <p id="login-error" class="mt-4 hidden rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300" role="alert"></p>

        <button
          type="submit"
          id="login-submit"
          class="mt-6 w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Iniciar sesión
        </button>
      </form>
    </div>
  `

  view.querySelector('#login-theme-toggle')?.replaceChildren(createThemeToggle())

  const form = view.querySelector('#login-form')
  const noticeEl = view.querySelector('#login-notice')
  const errorEl = view.querySelector('#login-error')
  const submitBtn = view.querySelector('#login-submit')
  const loginNotice = consumeLoginNotice()
  if (loginNotice && noticeEl) {
    noticeEl.textContent = loginNotice
    noticeEl.classList.remove('hidden')
  }
  const emailInput = form.querySelector('[name="email"]')
  const passwordInput = form.querySelector('[name="password"]')

  const fields = wireFormFields(form, [
    {
      name: 'email',
      helpId: emailIds.helpId,
      errorId: emailIds.errorId,
      normalizeOnBlur: (value) => String(value ?? '').trim(),
      getError: () => validateEmailValue(emailInput.value),
    },
    {
      name: 'password',
      helpId: passwordIds.helpId,
      errorId: passwordIds.errorId,
      getError: () => (String(passwordInput.value ?? '') ? '' : 'Ingresá la contraseña.'),
    },
  ])

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
    submitBtn.textContent = 'Ingresando...'

    try {
      await login({
        email: String(emailInput.value ?? '').trim(),
        password: String(passwordInput.value ?? ''),
      })
      onSuccess()
    } catch (error) {
      errorEl.textContent = error.message || 'No se pudo iniciar sesión.'
      errorEl.classList.remove('hidden')
      delete form.dataset.submitting
      submitBtn.disabled = false
      submitBtn.textContent = 'Iniciar sesión'
    }
  })

  container.replaceChildren(view)
  emailInput?.focus()
}
