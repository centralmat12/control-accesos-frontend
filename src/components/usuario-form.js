import { getEmpresas, empresaDisplayName } from '../api/empresas.js'
import { validateUsuarioEmail, validateUsuarioPassword } from '../api/usuarios.js'
import { USUARIO_ROLES_API } from '../config/roles.js'
import { escapeHtml } from '../utils/format.js'
import { showToast } from './toast.js'

const INPUT_CLASS =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-60'

function setFieldError(form, name, message) {
  const error = form.querySelector(`#usuario-${name}-error`)
  const input = form.querySelector(`[name="${name}"]`)
  if (message) {
    if (error) {
      error.textContent = message
      error.classList.remove('hidden')
    }
    input?.classList.add('border-red-300')
    input?.setAttribute('aria-invalid', 'true')
  } else {
    if (error) {
      error.textContent = ''
      error.classList.add('hidden')
    }
    input?.classList.remove('border-red-300')
    input?.removeAttribute('aria-invalid')
  }
}

function validateNombre(value) {
  const nombre = String(value ?? '').trim()
  if (!nombre) return 'Ingresá el nombre.'
  if (nombre.length > 50) return 'El nombre no puede superar 50 caracteres.'
  return ''
}

function validateEmpresa(value) {
  const id = Number(value)
  if (!Number.isFinite(id) || id <= 0) return 'Seleccioná una empresa.'
  return ''
}

function validateRol(value) {
  if (!USUARIO_ROLES_API.includes(String(value ?? '').trim())) return 'Seleccioná un rol.'
  return ''
}

export function createUsuarioForm({ onCancel, onSubmit, empresaIdPermitida = null }) {
  const wrapper = document.createElement('div')

  wrapper.innerHTML = `
    <form id="usuario-form" class="space-y-4" novalidate>
      <p id="usuario-form-error" class="hidden rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert"></p>
      <div>
        <label for="usuario-nombreUsuario" class="mb-1.5 block text-sm font-medium text-slate-700">Nombre</label>
        <input id="usuario-nombreUsuario" name="nombreUsuario" type="text" maxlength="50" autocomplete="name" required class="${INPUT_CLASS}" />
        <p id="usuario-nombreUsuario-error" class="mt-1 hidden text-sm text-red-600"></p>
      </div>
      <div>
        <label for="usuario-email" class="mb-1.5 block text-sm font-medium text-slate-700">Correo</label>
        <input id="usuario-email" name="email" type="email" maxlength="100" autocomplete="email" required class="${INPUT_CLASS}" />
        <p id="usuario-email-error" class="mt-1 hidden text-sm text-red-600"></p>
      </div>
      <div>
        <label for="usuario-password" class="mb-1.5 block text-sm font-medium text-slate-700">Contraseña inicial</label>
        <input id="usuario-password" name="password" type="password" maxlength="255" autocomplete="new-password" required class="${INPUT_CLASS}" />
        <p class="mt-1 text-xs text-slate-500">Mínimo 8 caracteres. No se guarda en el navegador.</p>
        <p id="usuario-password-error" class="mt-1 hidden text-sm text-red-600"></p>
      </div>
      <div>
        <label for="usuario-empresaId" class="mb-1.5 block text-sm font-medium text-slate-700">Empresa asignada</label>
        <select id="usuario-empresaId" name="empresaId" required class="${INPUT_CLASS}">
          <option value="">Cargando empresas...</option>
        </select>
        <p class="mt-1 text-xs text-slate-500">Obligatoria. La API exige EmpresaId en el alta.</p>
        <p id="usuario-empresaId-error" class="mt-1 hidden text-sm text-red-600"></p>
      </div>
      <div>
        <label for="usuario-rol" class="mb-1.5 block text-sm font-medium text-slate-700">Rol</label>
        <select id="usuario-rol" name="rol" required class="${INPUT_CLASS}">
          <option value="">Seleccionar...</option>
          ${USUARIO_ROLES_API.map((rol) => `<option value="${escapeHtml(rol)}">${escapeHtml(rol)}</option>`).join('')}
        </select>
        <p class="mt-1 text-xs text-slate-500">La API solo acepta ADMIN o RRHH.</p>
        <p id="usuario-rol-error" class="mt-1 hidden text-sm text-red-600"></p>
      </div>
      <div class="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
        <button type="button" id="usuario-form-cancel" class="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
          Cancelar
        </button>
        <button type="submit" id="usuario-form-submit" class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60">
          Crear usuario
        </button>
      </div>
    </form>
  `

  const form = wrapper.querySelector('#usuario-form')
  const formError = wrapper.querySelector('#usuario-form-error')
  const submitButton = wrapper.querySelector('#usuario-form-submit')
  const cancelButton = wrapper.querySelector('#usuario-form-cancel')
  const empresaSelect = form.querySelector('[name="empresaId"]')
  const passwordInput = form.querySelector('[name="password"]')

  function showFormError(message) {
    if (!message) {
      formError.textContent = ''
      formError.classList.add('hidden')
      return
    }
    formError.textContent = message
    formError.classList.remove('hidden')
  }

  function clearPassword() {
    if (passwordInput) passwordInput.value = ''
  }

  function readValues() {
    return {
      nombreUsuario: String(form.querySelector('[name="nombreUsuario"]')?.value ?? '').trim(),
      email: String(form.querySelector('[name="email"]')?.value ?? '').trim(),
      password: String(passwordInput?.value ?? ''),
      empresaId: empresaSelect?.value,
      rol: String(form.querySelector('[name="rol"]')?.value ?? '').trim(),
    }
  }

  function currentErrors() {
    const values = readValues()
    return {
      nombreUsuario: validateNombre(values.nombreUsuario),
      email: validateUsuarioEmail(values.email),
      password: validateUsuarioPassword(values.password),
      empresaId: validateEmpresa(values.empresaId),
      rol: validateRol(values.rol),
    }
  }

  function syncSubmitState() {
    const errors = currentErrors()
    submitButton.disabled = form.dataset.submitting === 'true' || Object.values(errors).some(Boolean)
  }

  ;['nombreUsuario', 'email', 'password', 'empresaId', 'rol'].forEach((name) => {
    const control = form.querySelector(`[name="${name}"]`)
    control?.addEventListener('input', () => {
      setFieldError(form, name, '')
      showFormError('')
      syncSubmitState()
    })
    control?.addEventListener('change', () => {
      const errors = currentErrors()
      setFieldError(form, name, errors[name] ?? '')
      syncSubmitState()
    })
  })

  form.querySelector('[name="email"]')?.addEventListener('focusout', (event) => {
    event.target.value = String(event.target.value ?? '').trim()
  })
  form.querySelector('[name="nombreUsuario"]')?.addEventListener('focusout', (event) => {
    event.target.value = String(event.target.value ?? '').trim()
  })

  cancelButton.addEventListener('click', () => {
    clearPassword()
    onCancel()
  })

  form.addEventListener('submit', async (event) => {
    event.preventDefault()
    showFormError('')
    const values = readValues()
    const errors = currentErrors()
    const errorNames = Object.keys(errors).filter((name) => errors[name])
    if (errorNames.length > 0) {
      errorNames.forEach((name) => setFieldError(form, name, errors[name]))
      syncSubmitState()
      form.querySelector(`[name="${errorNames[0]}"]`)?.focus()
      return
    }

    form.dataset.submitting = 'true'
    submitButton.disabled = true
    submitButton.textContent = 'Guardando...'
    cancelButton.disabled = true

    try {
      await onSubmit({
        nombreUsuario: values.nombreUsuario,
        email: values.email,
        password: values.password,
        rol: values.rol,
        empresaId: Number(values.empresaId),
      })
    } catch (error) {
      const message = error.message || 'No se pudo crear el usuario.'
      showFormError(message)
      showToast({ message, tone: 'error' })
    } finally {
      clearPassword()
      if (submitButton.isConnected) {
        delete form.dataset.submitting
        submitButton.textContent = 'Crear usuario'
        cancelButton.disabled = false
        syncSubmitState()
      }
    }
  })

  syncSubmitState()
  queueMicrotask(() => form.querySelector('[name="nombreUsuario"]')?.focus())

  ;(async () => {
    try {
      const empresas = await getEmpresas()
      if (!form.isConnected) return

      const allowedId = Number(empresaIdPermitida)
      const scoped =
        Number.isFinite(allowedId) && allowedId > 0
          ? empresas.filter((empresa) => Number(empresa.id) === allowedId)
          : empresas

      empresaSelect.replaceChildren(new Option('Seleccionar...', ''))
      scoped
        .slice()
        .sort((a, b) => empresaDisplayName(a).localeCompare(empresaDisplayName(b), 'es'))
        .forEach((empresa) => {
          const label = empresaDisplayName(empresa)
          if (!label || !empresa.id) return
          empresaSelect.append(new Option(label, String(empresa.id)))
        })

      if (scoped.length === 1) {
        empresaSelect.value = String(scoped[0].id)
      }

      if (scoped.length === 0) {
        showFormError('No hay empresas disponibles para asignar.')
      }
      syncSubmitState()
    } catch (error) {
      if (error.message === 'Sesión expirada o no autorizada.') return
      if (!form.isConnected) return
      empresaSelect.replaceChildren(new Option('Empresas no disponibles', ''))
      const message = error.message || 'No se pudieron cargar las empresas.'
      showFormError(message)
      showToast({ message, tone: 'error' })
      syncSubmitState()
    }
  })()

  return wrapper
}
