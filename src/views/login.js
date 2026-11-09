import {
  cancelarSegundoFactor,
  consumeLoginNotice,
  login,
  mensajeCompatibilidadSesion,
  MENSAJE_CIERRE_SIN_CONFIRMAR,
  MENSAJE_SESION_CAMBIADA,
  verificarSegundoFactor,
} from '../api/auth.js'
import { brandLogoAuthMarkup } from '../components/brand-logo.js'
import { createThemeToggle } from '../components/theme-toggle.js'
import {
  fieldIds,
  formFieldMarkup,
  validateEmailValue,
  wireFormFields,
} from '../components/form-field.js'
import { sanitizePublicErrorMessage } from '../utils/public-error.js'

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
      ${brandLogoAuthMarkup({
      subtitle: '.Devs',
      subtitleClass: 'font-bold',
      })}

      <form id="login-form" class="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900 sm:p-8" novalidate>
        <div class="space-y-4">
          ${formFieldMarkup({
          id: 'login-email',
          name: 'email',
          label: 'Correo electrónico',
          required: true,
          showRequiredIndicator: false,
          type: 'email',
          autocomplete: 'username',
          extraInputClass: LOGIN_INPUT_EXTRA,
          helpText: '',
          })}
          ${formFieldMarkup({
          id: 'login-password',
          name: 'password',
          label: 'Contraseña',
          required: true,
          showRequiredIndicator: false,
          type: 'password',
          autocomplete: 'current-password',
          extraInputClass: LOGIN_INPUT_EXTRA,
          helpText: '',
            })}
        </div>

        <p id="login-compat" class="mt-4 hidden rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100" role="status"></p>
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
  const compatEl = view.querySelector('#login-compat')
  const errorEl = view.querySelector('#login-error')
  const submitBtn = view.querySelector('#login-submit')
  const compatibilidad = mensajeCompatibilidadSesion()
  if (compatibilidad && compatEl) {
    compatEl.textContent = compatibilidad
    compatEl.classList.remove('hidden')
  }
  const loginNotice = consumeLoginNotice()
  if (loginNotice && (loginNotice === MENSAJE_CIERRE_SIN_CONFIRMAR || loginNotice === MENSAJE_SESION_CAMBIADA) && errorEl) {
    errorEl.textContent = loginNotice
    errorEl.classList.remove('hidden')
  } else if (loginNotice && noticeEl) {
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
      const ingreso = await login({
        email: String(emailInput.value ?? '').trim(),
        password: String(passwordInput.value ?? ''),
      })
      if (ingreso?.pendienteMfa) {
        mostrarSegundoFactor(view, {
          intento: ingreso.intento,
          expiraEn: ingreso.expiraEn,
          onSuccess,
          onVolver(mensaje) {
            renderLogin(container, { onSuccess })
            if (!mensaje) return
            const alerta = container.querySelector('#login-error')
            if (!alerta) return
            alerta.textContent = mensaje
            alerta.classList.remove('hidden')
          },
        })
        return
      }
      onSuccess()
    } catch (error) {
      errorEl.textContent = sanitizePublicErrorMessage(
        error.message,
        'No se pudo iniciar sesión.',
      )
      errorEl.classList.remove('hidden')
      delete form.dataset.submitting
      submitBtn.disabled = false
      submitBtn.textContent = 'Iniciar sesión'
    }
  })

  container.replaceChildren(view)
  emailInput?.focus()
}

function mostrarSegundoFactor(view, { intento, expiraEn, onSuccess, onVolver }) {
  const limite = Date.parse(expiraEn)
  const anterior = view.querySelector('#login-form')
  const tarjeta = document.createElement('form')
  tarjeta.id = 'login-form'
  tarjeta.className = anterior.className
  tarjeta.noValidate = true
  anterior.replaceWith(tarjeta)
  let activo = true
  let enviando = false
  let usandoRecuperacion = false
  const timer = window.setInterval(() => {
    if (!activo) return
    if (Number.isNaN(limite) || limite <= Date.now()) {
      cerrar('El tiempo para ingresar el código venció. Iniciá sesión de nuevo.')
    }
  }, 1000)

  function cerrar(mensaje, duranteEnvio = false) {
    if (!activo || (enviando && !duranteEnvio)) return
    activo = false
    window.clearInterval(timer)
    cancelarSegundoFactor(intento)
    onVolver(mensaje)
  }

  tarjeta.innerHTML = `
    <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-100">Segundo factor</h2>
    <p class="mt-2 text-sm text-slate-500 dark:text-slate-400">Ingresá el código de la aplicación o usá un código de recuperación.</p>
    <label class="mt-4 block text-sm font-medium text-slate-700 dark:text-slate-200" for="mfa-codigo">Código</label>
    <input id="mfa-codigo" name="codigo" inputmode="numeric" autocomplete="one-time-code" maxlength="40" class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
    <button type="button" id="mfa-modo" class="mt-3 text-sm font-medium text-blue-700 hover:text-blue-600 dark:text-blue-300">Usar un código de recuperación</button>
    <p id="mfa-error" class="mt-4 hidden rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300" role="alert"></p>
    <button type="submit" id="mfa-submit" class="mt-6 w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60">Verificar</button>
    <button type="button" id="mfa-volver" class="mt-3 w-full rounded-lg px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">Volver al inicio</button>
  `
  const input = tarjeta.querySelector('#mfa-codigo')
  const modo = tarjeta.querySelector('#mfa-modo')
  const errorEl = tarjeta.querySelector('#mfa-error')
  const submit = tarjeta.querySelector('#mfa-submit')
  modo.addEventListener('click', () => {
    usandoRecuperacion = !usandoRecuperacion
    input.value = ''
    input.inputMode = usandoRecuperacion ? 'text' : 'numeric'
    input.autocomplete = usandoRecuperacion ? 'off' : 'one-time-code'
    input.setAttribute('aria-label', usandoRecuperacion ? 'Código de recuperación' : 'Código de la aplicación')
    modo.textContent = usandoRecuperacion ? 'Usar el código de la aplicación' : 'Usar un código de recuperación'
  })
  tarjeta.querySelector('#mfa-volver').addEventListener('click', () => cerrar('', true))
  tarjeta.addEventListener('submit', async (event) => {
    event.preventDefault()
    if (!activo || tarjeta.dataset.submitting === 'true') return
    const valor = String(input.value ?? '').trim()
    if (!valor) {
      errorEl.textContent = 'Ingresá el código.'
      errorEl.classList.remove('hidden')
      return
    }
    errorEl.classList.add('hidden')
    tarjeta.dataset.submitting = 'true'
    submit.disabled = true
    enviando = true
    try {
      await verificarSegundoFactor(usandoRecuperacion
        ? { intento, codigoRecuperacion: valor }
        : { intento, codigo: valor })
      activo = false
      enviando = false
      window.clearInterval(timer)
      input.value = ''
      onSuccess()
    } catch (error) {
      enviando = false
      if (!activo) return
      errorEl.textContent = sanitizePublicErrorMessage(error.message, 'No se pudo comprobar el código.')
      errorEl.classList.remove('hidden')
      input.value = ''
      if (error.volver) {
        cerrar(errorEl.textContent)
        return
      }
      delete tarjeta.dataset.submitting
      submit.disabled = false
    }
  })
  input.focus()
}
