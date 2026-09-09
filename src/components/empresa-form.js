import { showToast } from './toast.js'
import { fieldIds, formFieldMarkup, wireFormFields } from './form-field.js'
import {
  buildEmpresaAltaDto,
  normalizeEmpresaText,
  sanitizeCuitDigits,
  validateEmpresaCuit,
  validateNombreComercial,
  validateRazonSocial,
} from '../utils/empresa-data.js'

export function createEmpresaForm({ onCancel, onSubmit }) {
  const wrapper = document.createElement('div')
  const nombreIds = fieldIds('empresa-nombreFantasia')
  const razonIds = fieldIds('empresa-razonSocial')
  const cuitIds = fieldIds('empresa-cuit')

  wrapper.innerHTML = `
    <form id="empresa-form" class="space-y-4" novalidate>
      <p id="empresa-form-error" class="hidden rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert"></p>
      ${formFieldMarkup({
        id: 'empresa-nombreFantasia',
        name: 'nombreFantasia',
        label: 'Nombre comercial',
        required: true,
        type: 'text',
        maxLength: 100,
        autocomplete: 'organization',
        helpText: 'Ingresá el nombre por el que se identifica públicamente la empresa.',
      })}
      ${formFieldMarkup({
        id: 'empresa-razonSocial',
        name: 'razonSocial',
        label: 'Razón social',
        required: true,
        type: 'text',
        maxLength: 100,
        autocomplete: 'off',
        helpText: 'Ingresá la denominación legal registrada, incluyendo el tipo societario cuando corresponda.',
      })}
      ${formFieldMarkup({
        id: 'empresa-cuit',
        name: 'cuit',
        label: 'CUIT',
        required: true,
        type: 'text',
        maxLength: 11,
        inputMode: 'numeric',
        autocomplete: 'off',
        helpText: 'Ingresá los 11 dígitos sin puntos, espacios ni guiones. Ejemplo: 30123456789.',
      })}
      <div class="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
        <button type="button" id="empresa-form-cancel" class="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
          Cancelar
        </button>
        <button type="submit" id="empresa-form-submit" class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60">
          Crear empresa
        </button>
      </div>
    </form>
  `

  const form = wrapper.querySelector('#empresa-form')
  const formError = wrapper.querySelector('#empresa-form-error')
  const submitButton = wrapper.querySelector('#empresa-form-submit')
  const cancelButton = wrapper.querySelector('#empresa-form-cancel')
  const nombreInput = form.querySelector('[name="nombreFantasia"]')
  const razonInput = form.querySelector('[name="razonSocial"]')
  const cuitInput = form.querySelector('[name="cuit"]')

  cuitInput.setAttribute('inputmode', 'numeric')
  cuitInput.setAttribute('maxlength', '11')
  cuitInput.setAttribute('pattern', '[0-9]*')

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
    const { dto } = buildEmpresaAltaDto({
      nombreFantasia: nombreInput?.value,
      razonSocial: razonInput?.value,
      cuit: cuitInput?.value,
    })
    return dto
  }

  const fields = wireFormFields(form, [
    {
      name: 'nombreFantasia',
      helpId: nombreIds.helpId,
      errorId: nombreIds.errorId,
      normalizeOnBlur: (value) => normalizeEmpresaText(value),
      getError: () => validateNombreComercial(nombreInput.value),
    },
    {
      name: 'razonSocial',
      helpId: razonIds.helpId,
      errorId: razonIds.errorId,
      normalizeOnBlur: (value) => normalizeEmpresaText(value),
      getError: () => validateRazonSocial(razonInput.value),
    },
    {
      name: 'cuit',
      helpId: cuitIds.helpId,
      errorId: cuitIds.errorId,
      normalizeOnBlur: (value) => sanitizeCuitDigits(value),
      getError: () => validateEmpresaCuit(cuitInput.value),
    },
  ])

  cuitInput.addEventListener(
    'input',
    () => {
      const sanitized = sanitizeCuitDigits(cuitInput.value)
      if (cuitInput.value !== sanitized) {
        cuitInput.value = sanitized
        fields.markInteracted('cuit')
      }
    },
    true,
  )

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

    const payload = readValues()
    const { hasErrors, errors } = buildEmpresaAltaDto({
      nombreFantasia: payload.nombreFantasia,
      razonSocial: payload.razonSocial,
      cuit: sanitizeCuitDigits(cuitInput.value),
    })
    if (hasErrors) {
      fields.validateAll()
      const first = Object.keys(errors).find((name) => errors[name])
      form.querySelector(`[name="${first}"]`)?.focus()
      return
    }

    form.dataset.submitting = 'true'
    submitButton.disabled = true
    submitButton.textContent = 'Guardando...'
    cancelButton.disabled = true

    try {
      await onSubmit(payload)
    } catch (error) {
      const message = error.message || 'No se pudo crear la empresa.'
      showFormError(message)
      showToast({ message, tone: 'error' })
    } finally {
      if (submitButton.isConnected) {
        delete form.dataset.submitting
        submitButton.textContent = 'Crear empresa'
        cancelButton.disabled = false
      }
    }
  })

  queueMicrotask(() => nombreInput?.focus())
  return wrapper
}
