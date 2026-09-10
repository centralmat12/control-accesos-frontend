import { escapeHtml } from '../utils/format.js'
import { showToast } from './toast.js'
import { BTN_SECONDARY_CLASS } from './button-styles.js'
import {
  fieldIds,
  formFieldMarkup,
  formStaticFieldMarkup,
  validateNameWithLetter,
  validateRequiredText,
  wireFormFields,
} from './form-field.js'

export function createSucursalForm({
  empresaNombre,
  sucursal = null,
  mode = 'create',
  onCancel,
  onSubmit,
}) {
  const wrapper = document.createElement('div')
  const empresaLabel = String(empresaNombre ?? '').trim() || 'Empresa seleccionada'
  const isEdit = mode === 'edit'
  const submitLabel = isEdit ? 'Guardar cambios' : 'Agregar sucursal'
  const sucursalId = Number(sucursal?.id)
  const initialNombre = String(sucursal?.nombre ?? '').trim()
  const initialSerialLector = String(sucursal?.serialLector ?? '').trim()
  const nombreIds = fieldIds('sucursal-nombre')
  const serialIds = fieldIds('sucursal-serialLector')

  wrapper.innerHTML = `
    <form id="sucursal-form" class="space-y-4" novalidate>
      <p id="sucursal-form-error" class="hidden rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert"></p>
      <div class="grid gap-3 sm:grid-cols-2">
        ${formStaticFieldMarkup({
          id: 'sucursal-empresa',
          label: 'Empresa',
          required: true,
          valueHtml: escapeHtml(empresaLabel),
          helpText: 'La sucursal quedará asociada a esta empresa.',
        })}
        ${
          isEdit
            ? formStaticFieldMarkup({
                id: 'sucursal-id',
                label: 'ID de sucursal',
                valueHtml: Number.isFinite(sucursalId) ? escapeHtml(String(sucursalId)) : '—',
                helpText: 'Identificador asignado por el sistema. No se modifica.',
              })
            : ''
        }
      </div>
      ${formFieldMarkup({
        id: 'sucursal-nombre',
        name: 'nombre',
        label: 'Nombre de la sucursal',
        required: true,
        maxLength: 100,
        helpText: 'Ingresá una denominación clara, por ejemplo “Sede Central”.',
      })}
      ${formFieldMarkup({
        id: 'sucursal-serialLector',
        name: 'serialLector',
        label: 'Serial del lector',
        required: true,
        maxLength: 100,
        helpText: 'Ingresá exactamente el identificador informado por el dispositivo biométrico.',
      })}
      <div class="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
        <button type="button" id="sucursal-form-cancel" class="${BTN_SECONDARY_CLASS}">
          Cancelar
        </button>
        <button type="submit" id="sucursal-form-submit" class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60">
          ${submitLabel}
        </button>
      </div>
    </form>
  `

  const form = wrapper.querySelector('#sucursal-form')
  const formError = wrapper.querySelector('#sucursal-form-error')
  const submitButton = wrapper.querySelector('#sucursal-form-submit')
  const cancelButton = wrapper.querySelector('#sucursal-form-cancel')
  const nombreInput = form.querySelector('[name="nombre"]')
  const serialLectorInput = form.querySelector('[name="serialLector"]')

  nombreInput.value = initialNombre
  serialLectorInput.value = initialSerialLector

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
      nombre: String(nombreInput?.value ?? '').trim(),
      serialLector: String(serialLectorInput?.value ?? '').trim(),
    }
  }

  const fields = wireFormFields(form, [
    {
      name: 'nombre',
      helpId: nombreIds.helpId,
      errorId: nombreIds.errorId,
      normalizeOnBlur: (value) => String(value ?? '').trim(),
      getError: () =>
        validateNameWithLetter(
          nombreInput.value,
          'Ingresá el nombre de la sucursal.',
          'El nombre debe contener al menos una letra.',
          100,
          'El nombre no puede superar 100 caracteres.',
        ),
    },
    {
      name: 'serialLector',
      helpId: serialIds.helpId,
      errorId: serialIds.errorId,
      normalizeOnBlur: (value) => String(value ?? '').trim(),
      getError: () =>
        validateRequiredText(
          serialLectorInput.value,
          'Ingresá el serial informado por el lector.',
          100,
          'El serial no puede superar 100 caracteres.',
        ),
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
      const message =
        error.message || (isEdit ? 'No se pudo actualizar la sucursal.' : 'No se pudo crear la sucursal.')
      showFormError(message)
      showToast({ message, tone: 'error' })
    } finally {
      if (submitButton.isConnected) {
        delete form.dataset.submitting
        submitButton.textContent = submitLabel
        cancelButton.disabled = false
      }
    }
  })

  queueMicrotask(() => nombreInput?.focus())
  return wrapper
}
