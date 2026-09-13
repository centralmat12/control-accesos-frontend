import { sanitizePublicErrorMessage } from '../utils/public-error.js'
import { BTN_SECONDARY_CLASS } from './button-styles.js'
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
} from './form-field.js'

function clearPasswordFields(...inputs) {
  inputs.forEach((input) => {
    if (input && 'value' in input) input.value = ''
  })
}

export function createCambiarPasswordForm({
  idPrefix = 'cambio',
  actualLabel = 'Contraseña actual',
  actualHelpText = 'Ingresá tu contraseña actual.',
  submitLabel = 'Cambiar contraseña',
  extraInputClass = '',
  showCancel = false,
  showLogout = false,
  compactActions = false,
  onSubmit,
  onCancel,
  onLogout,
} = {}) {
  const actualIds = fieldIds(`${idPrefix}-passwordActual`)
  const nuevaIds = fieldIds(`${idPrefix}-nuevaPassword`)
  const confirmIds = fieldIds(`${idPrefix}-confirmarPassword`)
  const formId = `${idPrefix}-form`
  const errorId = `${idPrefix}-error`
  const submitId = `${idPrefix}-submit`
  const cancelId = `${idPrefix}-cancel`
  const logoutId = `${idPrefix}-logout`
  const rulesId = `${idPrefix}-nuevaPassword-rules`

  const wrapper = document.createElement('div')
  const actionsClass = compactActions
    ? 'mt-6 flex flex-col gap-2'
    : 'mt-6 flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 dark:border-slate-800 sm:flex-row sm:justify-end'

  wrapper.innerHTML = `
    <form id="${formId}" class="space-y-4" novalidate>
      ${formPasswordFieldMarkup({
        id: `${idPrefix}-passwordActual`,
        name: 'passwordActual',
        label: actualLabel,
        required: true,
        autocomplete: 'current-password',
        extraInputClass,
        helpText: actualHelpText,
      })}
      ${formPasswordFieldMarkup({
        id: `${idPrefix}-nuevaPassword`,
        name: 'nuevaPassword',
        label: 'Nueva contraseña',
        required: true,
        autocomplete: 'new-password',
        extraInputClass,
        describedBy: rulesId,
      })}
      ${passwordRequirementsMarkup(rulesId)}
      ${formPasswordFieldMarkup({
        id: `${idPrefix}-confirmarPassword`,
        name: 'confirmarPassword',
        label: 'Confirmar nueva contraseña',
        required: true,
        autocomplete: 'new-password',
        extraInputClass,
      })}
      <p id="${errorId}" class="hidden rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300" role="alert"></p>
      <div class="${actionsClass}">
        ${
          showLogout
            ? `<button type="button" id="${logoutId}" class="${BTN_SECONDARY_CLASS} w-full justify-center">Cerrar sesión</button>`
            : ''
        }
        ${
          showCancel
            ? `<button type="button" id="${cancelId}" class="${BTN_SECONDARY_CLASS}">Cancelar</button>`
            : ''
        }
        <button
          type="submit"
          id="${submitId}"
          class="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60 ${compactActions ? 'w-full' : ''}"
        >
          ${submitLabel}
        </button>
      </div>
    </form>
  `

  const form = wrapper.querySelector('form')
  const errorEl = wrapper.querySelector(`#${errorId}`)
  const submitBtn = wrapper.querySelector(`#${submitId}`)
  const cancelBtn = wrapper.querySelector(`#${cancelId}`)
  const logoutBtn = wrapper.querySelector(`#${logoutId}`)
  const actualInput = form.querySelector('[name="passwordActual"]')
  const nuevaInput = form.querySelector('[name="nuevaPassword"]')
  const confirmInput = form.querySelector('[name="confirmarPassword"]')
  const passwordRules = form.querySelector(`#${rulesId}`)
  const confirmHelp = form.querySelector(`#${idPrefix}-confirmarPassword-help`)
  const confirmError = form.querySelector(`#${idPrefix}-confirmarPassword-error`)
  const confirmSuccess = form.querySelector(`#${idPrefix}-confirmarPassword-success`)

  form.querySelectorAll('[data-password-toggle]').forEach((button) => {
    const input = button.parentElement?.querySelector('input')
    bindPasswordVisibilityToggle(input, button)
  })

  function showError(message) {
    const raw = String(message ?? '').trim()
    if (!raw) {
      errorEl.textContent = ''
      errorEl.classList.add('hidden')
      return
    }
    errorEl.textContent = sanitizePublicErrorMessage(raw, 'No se pudo cambiar la contraseña.')
    errorEl.classList.remove('hidden')
  }

  function setBusy(busy) {
    form.dataset.submitting = busy ? 'true' : 'false'
    submitBtn.disabled = busy
    if (cancelBtn) cancelBtn.disabled = busy
    if (logoutBtn) logoutBtn.disabled = busy
    submitBtn.textContent = busy ? 'Guardando...' : submitLabel
  }

  function clear() {
    clearPasswordFields(actualInput, nuevaInput, confirmInput)
    showError('')
    syncPasswordRequirements(passwordRules, '')
    fields.refresh('passwordActual')
    fields.refresh('nuevaPassword')
    fields.refresh('confirmarPassword')
  }

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
      extraDescribedBy: rulesId,
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
          successId: `${idPrefix}-confirmarPassword-success`,
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

  cancelBtn?.addEventListener('click', () => onCancel?.())
  logoutBtn?.addEventListener('click', () => onLogout?.())

  form.addEventListener('submit', async (event) => {
    event.preventDefault()
    if (form.dataset.submitting === 'true') return

    const result = fields.validateAll()
    if (result.hasErrors) {
      result.firstInvalid?.focus()
      return
    }

    showError('')
    setBusy(true)

    try {
      await onSubmit?.({
        passwordActual: String(actualInput.value ?? ''),
        nuevaPassword: String(nuevaInput.value ?? ''),
        confirmarPassword: String(confirmInput.value ?? ''),
      })
      clear()
    } catch (error) {
      if (error?.code === 'UNAUTHORIZED') return
      showError(error.message || 'No se pudo cambiar la contraseña.')
      setBusy(false)
    }
  })

  return {
    element: wrapper,
    form,
    focus() {
      actualInput?.focus()
    },
    clear,
    setBusy,
  }
}
