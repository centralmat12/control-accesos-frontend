import { showToast } from './toast.js'

const INPUT_CLASS =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-60'

function setFieldError(form, name, message) {
  const error = form.querySelector(`#empresa-${name}-error`)
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

function validateRequired(value, label, maxLength) {
  const text = String(value ?? '').trim()
  if (!text) return `Ingresá ${label}.`
  if (text.length > maxLength) return `No puede superar ${maxLength} caracteres.`
  return ''
}

export function createEmpresaForm({ onCancel, onSubmit }) {
  const wrapper = document.createElement('div')

  wrapper.innerHTML = `
    <form id="empresa-form" class="space-y-4" novalidate>
      <p id="empresa-form-error" class="hidden rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert"></p>
      <div>
        <label for="empresa-nombreFantasia" class="mb-1.5 block text-sm font-medium text-slate-700">Nombre de fantasía</label>
        <input id="empresa-nombreFantasia" name="nombreFantasia" type="text" maxlength="100" required class="${INPUT_CLASS}" />
        <p id="empresa-nombreFantasia-error" class="mt-1 hidden text-sm text-red-600"></p>
      </div>
      <div>
        <label for="empresa-razonSocial" class="mb-1.5 block text-sm font-medium text-slate-700">Razón social</label>
        <input id="empresa-razonSocial" name="razonSocial" type="text" maxlength="100" required class="${INPUT_CLASS}" />
        <p id="empresa-razonSocial-error" class="mt-1 hidden text-sm text-red-600"></p>
      </div>
      <div>
        <label for="empresa-cuit" class="mb-1.5 block text-sm font-medium text-slate-700">CUIT</label>
        <input id="empresa-cuit" name="cuit" type="text" maxlength="20" required class="${INPUT_CLASS}" />
        <p id="empresa-cuit-error" class="mt-1 hidden text-sm text-red-600"></p>
      </div>
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
      nombreFantasia: String(form.querySelector('[name="nombreFantasia"]')?.value ?? '').trim(),
      razonSocial: String(form.querySelector('[name="razonSocial"]')?.value ?? '').trim(),
      cuit: String(form.querySelector('[name="cuit"]')?.value ?? '').trim(),
    }
  }

  function currentErrors() {
    const values = readValues()
    return {
      nombreFantasia: validateRequired(values.nombreFantasia, 'el nombre de fantasía', 100),
      razonSocial: validateRequired(values.razonSocial, 'la razón social', 100),
      cuit: validateRequired(values.cuit, 'el CUIT', 20),
    }
  }

  function syncSubmitState() {
    submitButton.disabled = form.dataset.submitting === 'true' || Object.values(currentErrors()).some(Boolean)
  }

  ;['nombreFantasia', 'razonSocial', 'cuit'].forEach((name) => {
    const control = form.querySelector(`[name="${name}"]`)
    control?.addEventListener('input', () => {
      setFieldError(form, name, '')
      showFormError('')
      syncSubmitState()
    })
    control?.addEventListener('focusout', (event) => {
      event.target.value = String(event.target.value ?? '').trim()
      setFieldError(form, name, currentErrors()[name] ?? '')
      syncSubmitState()
    })
  })

  cancelButton.addEventListener('click', onCancel)

  form.addEventListener('submit', async (event) => {
    event.preventDefault()
    showFormError('')
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
      await onSubmit(readValues())
    } catch (error) {
      const message = error.message || 'No se pudo crear la empresa.'
      showFormError(message)
      showToast({ message, tone: 'error' })
    } finally {
      if (submitButton.isConnected) {
        delete form.dataset.submitting
        submitButton.textContent = 'Crear empresa'
        cancelButton.disabled = false
        syncSubmitState()
      }
    }
  })

  syncSubmitState()
  queueMicrotask(() => form.querySelector('[name="nombreFantasia"]')?.focus())
  return wrapper
}
