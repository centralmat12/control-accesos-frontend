import { DEPARTAMENTO_NOMBRE_MAX, validateDepartamentoAlta } from '../api/departamentos.js'
import { showToast } from './toast.js'
import { BTN_SECONDARY_CLASS } from './button-styles.js'
import {
  fieldIds,
  formFieldMarkup,
  formStaticFieldMarkup,
  validateRequiredText,
  wireFormFields,
} from './form-field.js'
import { fillSucursalOptions, parseEntityId } from './sucursal-departamento-selects.js'
import { escapeHtml } from '../utils/format.js'

function sucursalNombre(sucursales, sucursalId) {
  const id = Number(sucursalId)
  const match = (sucursales ?? []).find((item) => Number(item.id) === id)
  return String(match?.nombre ?? '').trim() || (id > 0 ? `Sucursal ${id}` : '')
}

export function createDepartamentoForm({
  sucursales = [],
  sucursalId = null,
  onCancel,
  onSubmit,
}) {
  const wrapper = document.createElement('div')
  const inferredId = parseEntityId(sucursalId)
  const inferSucursal = Boolean(inferredId)
  const nombreIds = fieldIds('departamento-nombre')
  const sucursalIds = fieldIds('departamento-sucursalId')
  const sucursalLabel = sucursalNombre(sucursales, inferredId)
  const submitLabel = 'Agregar departamento'

  wrapper.innerHTML = `
    <form id="departamento-form" class="space-y-4" novalidate>
      <p id="departamento-form-error" class="hidden rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert"></p>
      ${
        inferSucursal
          ? formStaticFieldMarkup({
              id: 'departamento-sucursal',
              label: 'Sucursal',
              required: true,
              valueHtml: escapeHtml(sucursalLabel),
              helpText: 'El departamento se creará en la sucursal seleccionada para el empleado.',
            })
          : formFieldMarkup({
              id: 'departamento-sucursalId',
              name: 'sucursalId',
              label: 'Sucursal',
              tag: 'select',
              required: true,
              helpText: 'Elegí una sucursal de la empresa activa.',
              optionsHtml: '<option value="">Seleccionar...</option>',
            })
      }
      ${formFieldMarkup({
        id: 'departamento-nombre',
        name: 'nombre',
        label: 'Nombre del departamento',
        required: true,
        maxLength: DEPARTAMENTO_NOMBRE_MAX,
        helpText: 'Ingresá una denominación clara, por ejemplo “Sistemas”.',
      })}
      <div class="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
        <button type="button" id="departamento-form-cancel" class="${BTN_SECONDARY_CLASS}">
          Cancelar
        </button>
        <button type="submit" id="departamento-form-submit" class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60">
          ${submitLabel}
        </button>
      </div>
    </form>
  `

  const form = wrapper.querySelector('#departamento-form')
  const formError = wrapper.querySelector('#departamento-form-error')
  const submitButton = wrapper.querySelector('#departamento-form-submit')
  const cancelButton = wrapper.querySelector('#departamento-form-cancel')
  const nombreInput = form.querySelector('[name="nombre"]')
  const sucursalSelect = form.querySelector('[name="sucursalId"]')

  if (sucursalSelect) {
    fillSucursalOptions(sucursalSelect, sucursales, {
      currentId: inferredId,
      placeholder: 'Seleccionar...',
    })
  }

  function showFormError(message) {
    if (!message) {
      formError.textContent = ''
      formError.classList.add('hidden')
      return
    }
    formError.textContent = message
    formError.classList.remove('hidden')
  }

  function currentSucursalId() {
    return inferSucursal ? inferredId : parseEntityId(sucursalSelect?.value)
  }

  function readValues() {
    return {
      nombre: String(nombreInput?.value ?? '').trim(),
      sucursalId: currentSucursalId(),
    }
  }

  const fieldConfigs = [
    {
      name: 'nombre',
      helpId: nombreIds.helpId,
      errorId: nombreIds.errorId,
      normalizeOnBlur: (value) => String(value ?? '').trim(),
      getError: () =>
        validateRequiredText(
          nombreInput.value,
          'Ingresá el nombre del departamento.',
          DEPARTAMENTO_NOMBRE_MAX,
          `El nombre no puede superar ${DEPARTAMENTO_NOMBRE_MAX} caracteres.`,
        ),
    },
  ]

  if (sucursalSelect) {
    fieldConfigs.push({
      name: 'sucursalId',
      helpId: sucursalIds.helpId,
      errorId: sucursalIds.errorId,
      getError: () => validateDepartamentoAlta(readValues()).errors.sucursalId ?? '',
    })
  }

  const fields = wireFormFields(form, fieldConfigs)

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

    const values = readValues()
    const validated = validateDepartamentoAlta(values)
    if (validated.hasErrors) {
      showFormError(validated.errors.nombre || validated.errors.sucursalId)
      return
    }

    form.dataset.submitting = 'true'
    submitButton.disabled = true
    submitButton.textContent = 'Guardando...'
    cancelButton.disabled = true

    try {
      await onSubmit({
        nombre: validated.nombre,
        sucursalId: validated.sucursalId,
      })
    } catch (error) {
      const message = error.message || 'No se pudo crear el departamento.'
      showFormError(message)
      showToast({ message, tone: 'error' })
    } finally {
      if (submitButton.isConnected) {
        delete form.dataset.submitting
        submitButton.disabled = false
        submitButton.textContent = submitLabel
        cancelButton.disabled = false
      }
    }
  })

  queueMicrotask(() => nombreInput?.focus())
  return wrapper
}
