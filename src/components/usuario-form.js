import { getEmpresas, empresaDisplayName } from '../api/empresas.js'
import {
  clearPasswordInput,
  validateUsuarioAlta,
} from '../api/usuarios.js'
import { USUARIO_ROLES_API } from '../config/roles.js'
import { escapeHtml } from '../utils/format.js'
import { showToast } from './toast.js'
import {
  applyPasswordConfirmPresentation,
  bindPasswordVisibilityToggle,
  fieldIds,
  formFieldMarkup,
  formPasswordFieldMarkup,
  formStaticFieldMarkup,
  passwordConfirmStatus,
  passwordRequirementsMarkup,
  syncPasswordRequirements,
  wireFormFields,
} from './form-field.js'

function parsePositiveId(value) {
  const id = Number(value)
  return Number.isFinite(id) && id > 0 ? id : null
}

function empresaFieldMarkup({ permitirElegirEmpresa, empresaIdFija }) {
  if (permitirElegirEmpresa) {
    return formFieldMarkup({
      id: 'usuario-empresaId',
      name: 'empresaId',
      label: 'Empresa asignada',
      required: true,
      tag: 'select',
      helpText: 'Seleccioná la empresa a la que pertenecerá el usuario.',
      optionsHtml: '<option value="">Cargando empresas...</option>',
    })
  }

  const fixedId = empresaIdFija ? escapeHtml(String(empresaIdFija)) : ''
  return `
    ${formStaticFieldMarkup({
      id: 'usuario-empresa',
      label: 'Empresa asignada',
      required: true,
      valueHtml: fixedId ? `Empresa ${fixedId}` : 'Empresa de la sesión',
      helpText: 'El usuario quedará asociado a la empresa de tu sesión.',
    })}
    <input id="usuario-empresaId" name="empresaId" type="hidden" value="${fixedId}" />
  `
}

export function createUsuarioForm({
  onCancel,
  onSubmit,
  empresaIdPermitida = null,
  permitirElegirEmpresa = empresaIdPermitida == null,
} = {}) {
  const wrapper = document.createElement('div')
  const empresaIdFija = parsePositiveId(empresaIdPermitida)
  const canChooseEmpresa = permitirElegirEmpresa === true
  const nombreIds = fieldIds('usuario-nombreUsuario')
  const emailIds = fieldIds('usuario-email')
  const passwordIds = fieldIds('usuario-password')
  const confirmIds = fieldIds('usuario-passwordConfirm')
  const empresaIds = fieldIds('usuario-empresaId')
  const rolIds = fieldIds('usuario-rol')

  wrapper.innerHTML = `
    <form id="usuario-form" class="space-y-4" novalidate>
      <p id="usuario-form-error" class="hidden rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert"></p>
      ${formFieldMarkup({
        id: 'usuario-nombreUsuario',
        name: 'nombreUsuario',
        label: 'Nombre del usuario',
        required: true,
        maxLength: 50,
        autocomplete: 'name',
        helpText: 'Ingresá el nombre y apellido de la persona que utilizará la cuenta.',
      })}
      ${formFieldMarkup({
        id: 'usuario-email',
        name: 'email',
        label: 'Correo electrónico',
        required: true,
        type: 'email',
        maxLength: 100,
        autocomplete: 'email',
        helpText: 'Ingresá un correo válido. Se utilizará para iniciar sesión.',
      })}
      ${formPasswordFieldMarkup({
        id: 'usuario-password',
        name: 'password',
        label: 'Contraseña inicial',
        required: true,
        autocomplete: 'new-password',
        describedBy: 'usuario-password-rules',
      })}
      ${passwordRequirementsMarkup('usuario-password-rules')}
      ${formPasswordFieldMarkup({
        id: 'usuario-passwordConfirm',
        name: 'passwordConfirm',
        label: 'Confirmar contraseña',
        required: true,
        autocomplete: 'new-password',
        helpText: 'Volvé a ingresar la contraseña.',
      })}
      ${empresaFieldMarkup({ permitirElegirEmpresa: canChooseEmpresa, empresaIdFija })}
      ${formFieldMarkup({
        id: 'usuario-rol',
        name: 'rol',
        label: 'Rol de acceso',
        required: true,
        tag: 'select',
        helpText: 'Define las funciones disponibles. Solo se permiten ADMIN y RRHH.',
        optionsHtml: `<option value="">Seleccionar...</option>${USUARIO_ROLES_API.map(
          (rol) => `<option value="${escapeHtml(rol)}">${escapeHtml(rol)}</option>`,
        ).join('')}`,
      })}
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
  const passwordConfirmInput = form.querySelector('[name="passwordConfirm"]')
  const empresaNombreLabel = form.querySelector('#usuario-empresa-value')
  const passwordRules = form.querySelector('#usuario-password-rules')
  const confirmHelp = form.querySelector('#usuario-passwordConfirm-help')
  const confirmError = form.querySelector('#usuario-passwordConfirm-error')
  const confirmSuccess = form.querySelector('#usuario-passwordConfirm-success')

  form.querySelectorAll('[data-password-toggle]').forEach((button) => {
    const input = button.parentElement?.querySelector('input')
    bindPasswordVisibilityToggle(input, button)
  })

  function showFormError(message) {
    if (!message) {
      formError.textContent = ''
      formError.classList.add('hidden')
      return
    }
    formError.textContent = message
    formError.classList.remove('hidden')
  }

  function clearPasswords() {
    clearPasswordInput(passwordInput)
    clearPasswordInput(passwordConfirmInput)
    syncPasswordRequirements(passwordRules, '')
  }

  function readValues() {
    return {
      nombreUsuario: String(form.querySelector('[name="nombreUsuario"]')?.value ?? '').trim(),
      email: String(form.querySelector('[name="email"]')?.value ?? '').trim(),
      password: String(passwordInput?.value ?? ''),
      passwordConfirm: String(passwordConfirmInput?.value ?? ''),
      empresaId: empresaSelect?.value,
      rol: String(form.querySelector('[name="rol"]')?.value ?? '').trim(),
    }
  }

  const fieldConfigs = [
    {
      name: 'nombreUsuario',
      helpId: nombreIds.helpId,
      errorId: nombreIds.errorId,
      normalizeOnBlur: (value) => String(value ?? '').trim(),
      getError: () => validateUsuarioAlta(readValues()).nombreUsuario,
    },
    {
      name: 'email',
      helpId: emailIds.helpId,
      errorId: emailIds.errorId,
      normalizeOnBlur: (value) => String(value ?? '').trim(),
      getError: () => validateUsuarioAlta(readValues()).email,
    },
    {
      name: 'password',
      helpId: '',
      errorId: passwordIds.errorId,
      extraDescribedBy: 'usuario-password-rules',
      live: true,
      silent: true,
      getError: () => validateUsuarioAlta(readValues()).password,
    },
    {
      name: 'passwordConfirm',
      helpId: confirmIds.helpId,
      errorId: confirmIds.errorId,
      live: true,
      customPresentation: true,
      getError: () => validateUsuarioAlta(readValues()).passwordConfirm,
      onPresent: ({ submitted }) => {
        applyPasswordConfirmPresentation({
          input: passwordConfirmInput,
          helpEl: confirmHelp,
          errorEl: confirmError,
          successEl: confirmSuccess,
          helpId: confirmIds.helpId,
          errorId: confirmIds.errorId,
          successId: 'usuario-passwordConfirm-success',
          status: passwordConfirmStatus(passwordInput.value, passwordConfirmInput.value),
          submitted,
        })
      },
    },
    {
      name: 'empresaId',
      helpId: canChooseEmpresa ? empresaIds.helpId : fieldIds('usuario-empresa').helpId,
      errorId: canChooseEmpresa ? empresaIds.errorId : fieldIds('usuario-empresa').errorId,
      getError: () => validateUsuarioAlta(readValues()).empresaId,
    },
    {
      name: 'rol',
      helpId: rolIds.helpId,
      errorId: rolIds.errorId,
      getError: () => validateUsuarioAlta(readValues()).rol,
    },
  ]

  const fields = wireFormFields(form, fieldConfigs, {
    onAfterChange: (name) => {
      if (name === 'password') {
        syncPasswordRequirements(passwordRules, passwordInput.value)
        fields.refresh('passwordConfirm')
      }
      showFormError('')
    },
  })

  syncPasswordRequirements(passwordRules, '')

  cancelButton.addEventListener('click', () => {
    onCancel()
  })

  form.addEventListener('submit', async (event) => {
    event.preventDefault()
    if (form.dataset.submitting === 'true') return

    showFormError('')
    const values = readValues()
    const altaErrors = validateUsuarioAlta(values)
    const result = fields.validateAll()
    const hasAltaErrors = Object.values(altaErrors).some(Boolean)
    if (result.hasErrors || hasAltaErrors) {
      const first = result.firstInvalid ?? form.querySelector(
        ['nombreUsuario', 'email', 'password', 'passwordConfirm', 'empresaId', 'rol']
          .filter((name) => altaErrors[name])
          .map((name) => `[name="${name}"]`)
          .join(','),
      )
      first?.focus()
      return
    }

    if (!canChooseEmpresa && parsePositiveId(values.empresaId) !== empresaIdFija) {
      showFormError('No se puede cambiar la empresa de la sesión ADMIN.')
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
      clearPasswords()
      fields.refresh('password')
      fields.refresh('passwordConfirm')
      if (submitButton.isConnected) {
        delete form.dataset.submitting
        submitButton.textContent = 'Crear usuario'
        cancelButton.disabled = false
      }
    }
  })

  queueMicrotask(() => form.querySelector('[name="nombreUsuario"]')?.focus())

  ;(async () => {
    try {
      const empresas = await getEmpresas()
      if (!form.isConnected) return

      if (!canChooseEmpresa) {
        const scoped = empresaIdFija
          ? empresas.filter((empresa) => Number(empresa.id) === empresaIdFija)
          : []
        const nombre = scoped[0] ? empresaDisplayName(scoped[0]) : ''
        if (empresaNombreLabel) {
          empresaNombreLabel.textContent =
            nombre || (empresaIdFija ? `Empresa ${empresaIdFija}` : 'Empresa de la sesión')
        }
        if (empresaSelect && empresaIdFija) {
          empresaSelect.value = String(empresaIdFija)
        }
        if (!empresaIdFija) {
          showFormError('La sesión ADMIN no incluye una empresa válida.')
        }
        return
      }

      empresaSelect.replaceChildren(new Option('Seleccionar...', ''))
      empresas
        .slice()
        .sort((a, b) => empresaDisplayName(a).localeCompare(empresaDisplayName(b), 'es'))
        .forEach((empresa) => {
          const label = empresaDisplayName(empresa)
          const id = parsePositiveId(empresa.id)
          if (!label || !id) return
          empresaSelect.append(new Option(label, String(id)))
        })

      if (empresas.length === 0) {
        showFormError('No hay empresas disponibles para asignar.')
      }
    } catch (error) {
      if (error.message === 'Sesión expirada o no autorizada.') return
      if (!form.isConnected) return
      if (canChooseEmpresa) {
        empresaSelect.replaceChildren(new Option('Empresas no disponibles', ''))
      }
      const message = error.message || 'No se pudieron cargar las empresas.'
      showFormError(message)
      showToast({ message, tone: 'error' })
    }
  })()

  return wrapper
}
