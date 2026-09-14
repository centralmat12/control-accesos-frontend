import { saveFichadaObservacion } from '../api/fichadas.js'
import { sanitizePublicErrorMessage } from '../api/http.js'
import {
  OBSERVACION_DETALLE_MAX,
  OBSERVACION_DETALLE_PLACEHOLDER,
  OBSERVACION_HELP_TEXT,
  OBSERVACION_MOTIVOS,
  OBSERVACION_SAVED_MESSAGE,
  hasObservacionHumana,
  observacionContextLabels,
  trimObservacionDetalle,
  validateObservacionForm,
} from '../utils/fichada-observacion.js'
import { escapeHtml, formatApiDateTime } from '../utils/format.js'
import { BTN_SECONDARY_CLASS } from './button-styles.js'
import {
  fieldIds,
  formFieldMarkup,
  formStaticFieldMarkup,
  wireFormFields,
} from './form-field.js'
import { openModal } from './modal.js'
import { showToast } from './toast.js'

function auditLine(prefix, user, when) {
  const who = String(user ?? '').trim()
  const whenLabel = formatApiDateTime(when)
  if (!who || !whenLabel) return ''
  return `${prefix} ${who} el ${whenLabel}`
}

export function observacionAuditLines(observacion) {
  if (!observacion) return []
  const created = auditLine('Registrado por', observacion.creadoPor, observacion.creadoEn)
  const lines = []
  if (created) lines.push(created)
  const modified = auditLine('Última modificación por', observacion.modificadoPor, observacion.modificadoEn)
  if (modified) lines.push(modified)
  return lines
}

function motivoOptionsHtml(selected) {
  const current = String(selected ?? '')
  const blank = `<option value="">Seleccioná un motivo</option>`
  const options = OBSERVACION_MOTIVOS.map((item) => {
    const selectedAttr = item.value === current ? ' selected' : ''
    return `<option value="${escapeHtml(item.value)}"${selectedAttr}>${escapeHtml(item.label)}</option>`
  }).join('')
  return `${blank}${options}`
}

export function createFichadaObservacionForm({
  fichada,
  canEdit = true,
  onCancel,
  onSaved,
  save = saveFichadaObservacion,
} = {}) {
  const wrapper = document.createElement('div')
  const ctx = observacionContextLabels(fichada)
  const existing = hasObservacionHumana(fichada) ? fichada.observacionHumana : null
  const motivoIds = fieldIds('fichada-observacion-motivo')
  const detalleIds = fieldIds('fichada-observacion-detalle')
  const audit = observacionAuditLines(existing)

  wrapper.innerHTML = `
    <form id="fichada-observacion-form" class="space-y-4" novalidate data-observacion-form="true">
      <p id="fichada-observacion-form-error" class="hidden rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-500/40 dark:bg-red-950/40 dark:text-red-200" role="alert"></p>
      <div class="grid gap-3 sm:grid-cols-2">
        ${formStaticFieldMarkup({
          id: 'fichada-observacion-empleado',
          label: 'Empleado',
          valueHtml: escapeHtml(ctx.empleado),
        })}
        ${formStaticFieldMarkup({
          id: 'fichada-observacion-fecha',
          label: 'Fecha',
          valueHtml: escapeHtml(ctx.fecha),
        })}
        ${formStaticFieldMarkup({
          id: 'fichada-observacion-hora',
          label: 'Hora',
          valueHtml: escapeHtml(ctx.hora),
        })}
        ${formStaticFieldMarkup({
          id: 'fichada-observacion-movimiento',
          label: 'Movimiento',
          valueHtml: escapeHtml(ctx.movimiento),
        })}
      </div>
      ${formFieldMarkup({
        id: 'fichada-observacion-motivo',
        name: 'motivo',
        label: 'Motivo',
        required: true,
        tag: 'select',
        disabled: !canEdit,
        extraInputClass: 'dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100',
        optionsHtml: motivoOptionsHtml(existing?.motivo),
      })}
      ${formFieldMarkup({
        id: 'fichada-observacion-detalle',
        name: 'detalle',
        label: 'Detalle de la observación',
        required: true,
        tag: 'textarea',
        maxLength: OBSERVACION_DETALLE_MAX,
        disabled: !canEdit,
        placeholder: OBSERVACION_DETALLE_PLACEHOLDER,
        value: existing?.detalle ?? '',
        extraInputClass: 'min-h-[7rem] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100',
        helpText: OBSERVACION_HELP_TEXT,
      })}
      <p id="fichada-observacion-counter" class="text-xs text-slate-500 dark:text-slate-400" aria-live="polite"></p>
      ${
        audit.length
          ? `<div class="space-y-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/60" data-observacion-audit="true">
              ${audit.map((line) => `<p class="text-xs text-slate-600 dark:text-slate-300">${escapeHtml(line)}</p>`).join('')}
            </div>`
          : ''
      }
      <div class="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end dark:border-slate-800">
        <button type="button" id="fichada-observacion-cancel" class="${BTN_SECONDARY_CLASS}">
          Cancelar
        </button>
        ${
          canEdit
            ? `<button type="submit" id="fichada-observacion-submit" class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60">
                Guardar observación
              </button>`
            : ''
        }
      </div>
    </form>
  `

  const form = wrapper.querySelector('#fichada-observacion-form')
  const formError = wrapper.querySelector('#fichada-observacion-form-error')
  const motivoInput = form.querySelector('[name="motivo"]')
  const detalleInput = form.querySelector('[name="detalle"]')
  const counter = wrapper.querySelector('#fichada-observacion-counter')
  const cancelBtn = wrapper.querySelector('#fichada-observacion-cancel')
  const submitBtn = wrapper.querySelector('#fichada-observacion-submit')
  const initialMotivo = String(existing?.motivo ?? '')
  const initialDetalle = String(existing?.detalle ?? '')

  function showError(message) {
    const raw = String(message ?? '').trim()
    if (!raw) {
      formError.textContent = ''
      formError.classList.add('hidden')
      return
    }
    formError.textContent = sanitizePublicErrorMessage(raw, 'No se pudo guardar la observación.')
    formError.classList.remove('hidden')
  }

  function updateCounter() {
    const length = String(detalleInput.value ?? '').length
    counter.textContent = `${length}/${OBSERVACION_DETALLE_MAX}`
  }

  function setBusy(busy) {
    form.dataset.submitting = busy ? 'true' : 'false'
    if (submitBtn) {
      submitBtn.disabled = busy
      submitBtn.textContent = busy ? 'Guardando...' : 'Guardar observación'
    }
    motivoInput.disabled = !canEdit || busy
    detalleInput.disabled = !canEdit || busy
  }

  function isDirty() {
    if (!canEdit) return false
    return (
      String(motivoInput.value ?? '') !== initialMotivo ||
      String(detalleInput.value ?? '') !== initialDetalle
    )
  }

  const fields = canEdit
    ? wireFormFields(form, [
        {
          name: 'motivo',
          helpId: motivoIds.helpId,
          errorId: motivoIds.errorId,
          getError: () => validateObservacionForm(readValues()).errors.motivo || '',
        },
        {
          name: 'detalle',
          helpId: detalleIds.helpId,
          errorId: detalleIds.errorId,
          live: true,
          getError: () => validateObservacionForm(readValues()).errors.detalle || '',
        },
      ])
    : null

  function readValues() {
    return {
      motivo: motivoInput.value,
      detalle: detalleInput.value,
    }
  }

  detalleInput.addEventListener('input', updateCounter)
  updateCounter()

  cancelBtn.addEventListener('click', () => onCancel?.())

  if (canEdit) {
    form.addEventListener('submit', async (event) => {
      event.preventDefault()
      if (form.dataset.submitting === 'true') return

      const validated = validateObservacionForm(readValues())
      fields?.validateAll({ submitted: true })
      if (!validated.ok) {
        showError(validated.errors.motivo || validated.errors.detalle)
        return
      }

      setBusy(true)
      showError('')
      try {
        const saved = await save(fichada.id, {
          motivo: validated.value.motivo,
          detalle: trimObservacionDetalle(validated.value.detalle),
        })
        showToast(OBSERVACION_SAVED_MESSAGE)
        await onSaved?.(saved)
      } catch (error) {
        showError(error?.message || 'No se pudo guardar la observación.')
        setBusy(false)
      }
    })
  }

  if (!canEdit) {
    motivoInput.setAttribute('aria-readonly', 'true')
    detalleInput.setAttribute('aria-readonly', 'true')
  } else {
    motivoInput.setAttribute('data-autofocus', 'true')
  }

  return {
    element: wrapper,
    isDirty,
    isBusy: () => form.dataset.submitting === 'true',
  }
}

export function openFichadaObservacionModal({
  fichada,
  canEdit = true,
  onSaved,
  onClose,
  save = saveFichadaObservacion,
} = {}) {
  const form = createFichadaObservacionForm({
    fichada,
    canEdit,
    save,
    onCancel: () => modal.close(),
    onSaved: async (saved) => {
      await onSaved?.(saved)
      modal.close({ force: true })
    },
  })

  const modal = openModal({
    title: 'Observación de la fichada',
    labelledBy: 'fichada-observacion-title',
    content: form.element,
    dialogClass: 'max-w-xl',
    unsavedChanges: canEdit,
    closeOnBackdrop: true,
    closeOnEscape: true,
    isDirty: () => form.isDirty(),
    onClose,
  })

  return modal
}
