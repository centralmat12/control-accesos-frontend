import {
  AGENTE_CLIENT_ID_MAX,
  AGENTE_NOMBRE_MAX,
  suggestClientId,
  validateAgenteClientId,
  validateAgenteNombre,
} from '../api/agentes.js'
import { escapeHtml } from '../utils/format.js'
import { showToast } from './toast.js'
import { BTN_SECONDARY_CLASS } from './button-styles.js'
import { fieldIds, formFieldMarkup, formStaticFieldMarkup, wireFormFields } from './form-field.js'

export function createAgenteForm({
  empresaNombre,
  sucursalNombre,
  sucursalId,
  existingClientIds = [],
  onCancel,
  onSubmit,
}) {
  const wrapper = document.createElement('div')
  const empresaLabel = String(empresaNombre ?? '').trim() || 'Empresa seleccionada'
  const sucursalLabel = String(sucursalNombre ?? '').trim() || 'Sucursal seleccionada'
  const contextSucursalId = Number(sucursalId)
  const suggestedClientId = suggestClientId({
    empresaNombre: empresaLabel,
    sucursalNombre: sucursalLabel,
    existingClientIds,
  })
  const nombreIds = fieldIds('agente-nombre')
  const clientIds = fieldIds('agente-clientId')

  wrapper.innerHTML = `
    <form id="agente-form" class="space-y-4" novalidate>
      <p id="agente-form-error" class="hidden rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert"></p>
      <div class="grid gap-3 sm:grid-cols-2">
        ${formStaticFieldMarkup({
          id: 'agente-empresa',
          label: 'Empresa',
          required: true,
          valueHtml: escapeHtml(empresaLabel),
          helpText: 'Determinada por la empresa abierta. No se escribe a mano.',
        })}
        ${formStaticFieldMarkup({
          id: 'agente-sucursal',
          label: 'Sucursal',
          required: true,
          valueHtml: escapeHtml(sucursalLabel),
          helpText: 'El agente quedará asociado a esta sucursal. No confundir con el serial del lector.',
        })}
      </div>
      ${formFieldMarkup({
        id: 'agente-nombre',
        name: 'nombre',
        label: 'Nombre de la terminal',
        required: true,
        maxLength: AGENTE_NOMBRE_MAX,
        helpText: 'Nombre humano para reconocer el equipo instalado, por ejemplo “Recepción”.',
      })}
      ${formFieldMarkup({
        id: 'agente-clientId',
        name: 'clientId',
        label: 'Client ID',
        required: true,
        maxLength: AGENTE_CLIENT_ID_MAX,
        autocomplete: 'off',
        helpText: 'Identificador único en todo el sistema. No es el serial del lector. Máximo 100 caracteres.',
      })}
      <div class="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
        <button type="button" id="agente-form-cancel" class="${BTN_SECONDARY_CLASS}">
          Cancelar
        </button>
        <button type="submit" id="agente-form-submit" class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60">
          Agregar agente
        </button>
      </div>
    </form>
  `

  const form = wrapper.querySelector('#agente-form')
  const formError = wrapper.querySelector('#agente-form-error')
  const submitButton = wrapper.querySelector('#agente-form-submit')
  const cancelButton = wrapper.querySelector('#agente-form-cancel')
  const nombreInput = form.querySelector('[name="nombre"]')
  const clientIdInput = form.querySelector('[name="clientId"]')

  clientIdInput.value = suggestedClientId
  let lastSuggestion = suggestedClientId
  let clientIdEdited = false

  nombreInput.addEventListener('input', () => {
    if (clientIdEdited) return
    lastSuggestion = suggestClientId({
      empresaNombre: empresaLabel,
      sucursalNombre: sucursalLabel,
      agenteNombre: nombreInput.value,
      existingClientIds,
    })
    clientIdInput.value = lastSuggestion
  })

  clientIdInput.addEventListener('input', () => {
    clientIdEdited = String(clientIdInput.value).trim() !== lastSuggestion
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

  function readValues() {
    return {
      sucursalId: contextSucursalId,
      nombre: String(nombreInput?.value ?? '').trim(),
      clientId: String(clientIdInput?.value ?? '').trim(),
    }
  }

  const fields = wireFormFields(form, [
    {
      name: 'nombre',
      helpId: nombreIds.helpId,
      errorId: nombreIds.errorId,
      normalizeOnBlur: (value) => String(value ?? '').trim(),
      getError: () => validateAgenteNombre(nombreInput.value),
    },
    {
      name: 'clientId',
      helpId: clientIds.helpId,
      errorId: clientIds.errorId,
      normalizeOnBlur: (value) => String(value ?? '').trim(),
      getError: () => validateAgenteClientId(clientIdInput.value, existingClientIds),
    },
  ])

  cancelButton.addEventListener('click', onCancel)

  form.addEventListener('submit', async (event) => {
    event.preventDefault()
    if (form.dataset.submitting === 'true') return

    showFormError('')
    const result = fields.validateAll()
    if (result.hasErrors) {
      result.firstInvalid?.focus()
      return
    }

    form.dataset.submitting = 'true'
    submitButton.disabled = true
    submitButton.textContent = 'Guardando...'
    cancelButton.disabled = true

    try {
      await onSubmit(readValues())
    } catch (error) {
      const message = error.message || 'No se pudo crear el agente.'
      showFormError(message)
      showToast({ message, tone: 'error' })
    } finally {
      if (submitButton.isConnected) {
        delete form.dataset.submitting
        submitButton.disabled = false
        submitButton.textContent = 'Agregar agente'
        cancelButton.disabled = false
      }
    }
  })

  queueMicrotask(() => nombreInput?.focus())
  return wrapper
}
