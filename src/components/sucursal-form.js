import { escapeHtml } from '../utils/format.js'
import { showToast } from './toast.js'

const INPUT_CLASS =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-60'

function setFieldError(form, name, message) {
  const error = form.querySelector(`#sucursal-${name}-error`)
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

  wrapper.innerHTML = `
    <form id="sucursal-form" class="space-y-4" novalidate>
      <p id="sucursal-form-error" class="hidden rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert"></p>
      <div class="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 sm:grid-cols-2">
        <div>
          <p class="text-xs font-medium uppercase tracking-wide text-slate-500">Empresa</p>
          <p class="mt-1 text-sm font-medium text-slate-900">${escapeHtml(empresaLabel)}</p>
        </div>
        ${
          isEdit
            ? `<div>
                <p class="text-xs font-medium uppercase tracking-wide text-slate-500">ID de sucursal</p>
                <p class="mt-1 text-sm font-medium text-slate-900">${Number.isFinite(sucursalId) ? escapeHtml(String(sucursalId)) : '—'}</p>
              </div>`
            : ''
        }
      </div>
      <div>
        <label for="sucursal-nombre" class="mb-1.5 block text-sm font-medium text-slate-700">Nombre</label>
        <input id="sucursal-nombre" name="nombre" type="text" maxlength="100" required class="${INPUT_CLASS}" />
        <p id="sucursal-nombre-error" class="mt-1 hidden text-sm text-red-600"></p>
      </div>
      <div>
        <label for="sucursal-serialLector" class="mb-1.5 block text-sm font-medium text-slate-700">Serial del lector</label>
        <input id="sucursal-serialLector" name="serialLector" type="text" maxlength="100" required class="${INPUT_CLASS}" />
        <p id="sucursal-serialLector-error" class="mt-1 hidden text-sm text-red-600"></p>
      </div>
      <div class="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
        <button type="button" id="sucursal-form-cancel" class="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
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
      nombre: String(form.querySelector('[name="nombre"]')?.value ?? '').trim(),
      serialLector: String(form.querySelector('[name="serialLector"]')?.value ?? '').trim(),
    }
  }

  function currentErrors() {
    const values = readValues()
    return {
      nombre: validateRequired(values.nombre, 'el nombre', 100),
      serialLector: validateRequired(values.serialLector, 'el serial del lector', 100),
    }
  }

  function syncSubmitState() {
    submitButton.disabled = form.dataset.submitting === 'true' || Object.values(currentErrors()).some(Boolean)
  }

  ;['nombre', 'serialLector'].forEach((name) => {
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
    if (form.dataset.submitting === 'true') return

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
      const message =
        error.message || (isEdit ? 'No se pudo actualizar la sucursal.' : 'No se pudo crear la sucursal.')
      showFormError(message)
      showToast({ message, tone: 'error' })
    } finally {
      if (submitButton.isConnected) {
        delete form.dataset.submitting
        submitButton.textContent = submitLabel
        cancelButton.disabled = false
        syncSubmitState()
      }
    }
  })

  syncSubmitState()
  queueMicrotask(() => form.querySelector('[name="nombre"]')?.focus())
  return wrapper
}
