import { canOpenOperativeForm, CAPABILITY, CAPABILITY_STATUS, resolveCapability } from '../api/capabilities.js'
import { getCalendario, guardarDiaLibre } from '../api/jornadas.js'
import {
  describirResultadoDiaLibre,
  diaLibreConfirmModel,
  fechasReintento,
  mensajeExitoDiaLibre,
  periodoDiaLibreExitoso,
  registrarPeriodoDiaLibre,
  validateDiaLibreRange,
} from '../utils/dia-libre.js'
import { escapeHtml } from '../utils/format.js'
import { BTN_SECONDARY_CLASS } from './button-styles.js'
import { createMaintenancePanel, panelForCapability } from './maintenance-panel.js'
import { openFormModal, openReviewConfirm, trackFichadasOverlay } from './modal.js'
import { showToast } from './toast.js'

const FIELD_CLASS = 'mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900'
const PRIMARY_CLASS = 'rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60'

function empleadoNombre(empleados, id) {
  const item = empleados.find((empleado) => String(empleado.id) === String(id))
  return [item?.nombre, item?.apellido].filter(Boolean).join(' ') || item?.empleado || 'Empleado'
}

function confirmBody(model) {
  const body = document.createElement('div')
  body.className = 'space-y-3 text-sm text-slate-600 dark:text-slate-300'
  const intro = document.createElement('p')
  intro.textContent = model.intro
  const list = document.createElement('dl')
  list.className = 'grid grid-cols-[9rem_1fr] gap-x-3 gap-y-1'
  model.rows.forEach((row) => {
    const term = document.createElement('dt')
    term.className = 'text-slate-500'
    term.textContent = row.label
    const value = document.createElement('dd')
    value.className = 'text-slate-900 dark:text-slate-100'
    value.textContent = row.value
    list.append(term, value)
  })
  const legend = document.createElement('p')
  legend.textContent = model.legend
  const progress = document.createElement('p')
  progress.dataset.progress = 'true'
  progress.setAttribute('aria-live', 'polite')
  progress.className = 'text-sm text-slate-500'
  body.append(intro, list, legend, progress)
  return body
}

export async function openDiaLibre({ getEmpleados = () => [], onChanged, opener = null } = {}) {
  const capability = await resolveCapability(CAPABILITY.jornadasExceptions)
  if (capability.status === CAPABILITY_STATUS.unauthorized) return
  if (!canOpenOperativeForm(capability)) {
    if (opener instanceof HTMLElement && opener.isConnected) opener.focus()
    const panel = panelForCapability(capability, {
      onRetry: () => {
        modal.close({ force: true })
        void openDiaLibre({ getEmpleados, onChanged, opener })
      },
    })
    const modal = trackFichadasOverlay(openFormModal({
      title: 'Vacaciones / día libre',
      content: panel,
      unsavedChanges: false,
    }))
    return
  }

  const empleados = getEmpleados()
  const form = document.createElement('form')
  form.className = 'space-y-3'
  form.innerHTML = `
    <label class="block text-sm" for="dia-libre-empleado">Empleado
      <select id="dia-libre-empleado" name="empleadoId" required class="${FIELD_CLASS}">
        <option value="">Seleccioná</option>
        ${empleados.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml([item.nombre, item.apellido].filter(Boolean).join(' ') || item.empleado || 'Empleado')}</option>`).join('')}
      </select>
    </label>
    <div class="grid gap-3 sm:grid-cols-2">
      <label class="block text-sm" for="dia-libre-desde">Fecha desde
        <input id="dia-libre-desde" name="desde" type="date" required class="${FIELD_CLASS}" />
      </label>
      <label class="block text-sm" for="dia-libre-hasta">Fecha hasta
        <input id="dia-libre-hasta" name="hasta" type="date" required class="${FIELD_CLASS}" />
      </label>
    </div>
    <p id="dia-libre-count" aria-live="polite" class="text-sm text-slate-500"></p>
    <p id="dia-libre-progress" data-progress aria-live="polite" class="text-sm text-slate-500"></p>
    <p id="dia-libre-error" data-error class="hidden text-sm text-red-600" role="alert"></p>
    <div data-result></div>
    <div class="flex justify-end gap-2">
      <button type="button" data-cancel class="${BTN_SECONDARY_CLASS}">Cancelar</button>
      <button type="submit" class="${PRIMARY_CLASS}">Continuar</button>
    </div>
  `
  form.desde.setAttribute('data-autofocus', 'true')
  const error = form.querySelector('[data-error]')
  const count = form.querySelector('#dia-libre-count')
  const progress = form.querySelector('#dia-libre-progress')
  const resultHost = form.querySelector('[data-result]')
  let busy = false
  let retryDates = []

  function setBusy(next) {
    busy = next
    form.setAttribute('aria-busy', next ? 'true' : 'false')
    ;[...form.querySelectorAll('input, select, button')].forEach((field) => {
      if (field.dataset.keep !== 'true') field.disabled = next
    })
  }

  function showError(message, field) {
    error.textContent = message
    error.classList.remove('hidden')
    ;[form.desde, form.hasta, form.empleadoId].forEach((item) => {
      item.removeAttribute('aria-invalid')
      if (item.getAttribute('aria-describedby') === error.id) item.removeAttribute('aria-describedby')
    })
    if (!field) return
    field.setAttribute('aria-invalid', 'true')
    field.setAttribute('aria-describedby', error.id)
  }

  function clearError() {
    error.textContent = ''
    error.classList.add('hidden')
  }

  function refreshCount() {
    const range = validateDiaLibreRange({ desde: form.desde.value, hasta: form.hasta.value })
    count.textContent = range.ok ? `Días calendario incluidos: ${range.dias}` : ''
  }

  async function writeDates(fechas, { setProgress } = {}) {
    const empleadoId = Number(form.empleadoId.value)
    const again = await resolveCapability(CAPABILITY.jornadasExceptions, {
      force: true,
      context: { empleadoId },
    })
    if (again.status === CAPABILITY_STATUS.unauthorized) return { unauthorized: true }
    if (!canOpenOperativeForm(again)) return { blocked: true, capability: again }
    return registrarPeriodoDiaLibre({
      fechas,
      readDias: () => getCalendario(empleadoId, fechas[0], fechas.at(-1)),
      writeDia: (fecha) => guardarDiaLibre(empleadoId, fecha),
      onProgress: ({ current, total }) => {
        const text = `Registrando ${current} de ${total}…`
        progress.textContent = text
        setProgress?.(text)
      },
    })
  }

  function showPartial(result) {
    resultHost.replaceChildren()
    progress.textContent = ''
    if (result.maintenance && result.registradas.length === 0) {
      resultHost.append(createMaintenancePanel({ compact: true }))
      return
    }
    if (result.forbidden && result.registradas.length === 0) {
      resultHost.append(panelForCapability({ status: CAPABILITY_STATUS.forbidden }))
      return
    }
    if (result.invalidContract) {
      showError(result.message || 'La respuesta del calendario no tiene el formato esperado.')
      return
    }
    const summary = document.createElement('p')
    summary.setAttribute('aria-live', 'polite')
    summary.className = 'text-sm text-slate-700 dark:text-slate-200'
    summary.textContent = describirResultadoDiaLibre(result) || result.message || 'No se pudo completar el período.'
    resultHost.append(summary)
    retryDates = fechasReintento(result)
    if (!retryDates.length) return
    const retry = document.createElement('button')
    retry.type = 'button'
    retry.dataset.keep = 'true'
    retry.className = `${BTN_SECONDARY_CLASS} mt-3`
    retry.textContent = 'Reintentar fechas fallidas'
    retry.addEventListener('click', () => {
      void run(retryDates, { fromRetry: true })
    })
    resultHost.append(retry)
  }

  async function run(fechas, { setProgress, fromRetry = false } = {}) {
    if (busy) return null
    setBusy(true)
    clearError()
    if (!fromRetry) resultHost.replaceChildren()
    try {
      const result = await writeDates(fechas, { setProgress })
      if (!result || result.unauthorized) return result
      if (result.blocked) {
        resultHost.replaceChildren(panelForCapability(result.capability, {
          onRetry: () => {
            void run(fechas)
          },
        }))
        return result
      }
      if (periodoDiaLibreExitoso(result)) {
        modal.close({ force: true })
        showToast({ message: mensajeExitoDiaLibre(result), tone: 'success' })
        try {
          await onChanged?.()
        } catch {
          /* La vista conserva su propio aviso si la recarga falla. */
        }
        return result
      }
      showPartial(result)
      try {
        await onChanged?.()
      } catch {
        /* La recarga no borra el resultado parcial ya informado. */
      }
      return result
    } finally {
      if (form.isConnected) setBusy(false)
    }
  }

  form.desde.addEventListener('change', refreshCount)
  form.hasta.addEventListener('change', refreshCount)
  if (opener instanceof HTMLElement && opener.isConnected) opener.focus()
  const modal = trackFichadasOverlay(openFormModal({ title: 'Vacaciones / día libre', content: form, canClose: () => !busy }))
  form.querySelector('[data-cancel]').addEventListener('click', () => modal.close())
  let confirming = false
  form.addEventListener('submit', async (event) => {
    event.preventDefault()
    if (busy || confirming) return
    confirming = true
    try {
      clearError()
      if (!form.empleadoId.value) {
        showError('Seleccioná un empleado.', form.empleadoId)
        return
      }
      const range = validateDiaLibreRange({ desde: form.desde.value, hasta: form.hasta.value })
      if (!range.ok) {
        showError(range.message, form[range.field] || form.hasta)
        return
      }
      const model = diaLibreConfirmModel({
        empleado: empleadoNombre(empleados, form.empleadoId.value),
        desde: form.desde.value,
        hasta: form.hasta.value,
        dias: range.dias,
      })
      await openReviewConfirm({
        title: model.title,
        body: confirmBody(model),
        confirmLabel: model.confirm,
        cancelLabel: model.cancel,
        onConfirm: ({ setProgress }) => run(range.fechas, { setProgress }).then((result) => {
          if (!result || result.unauthorized || result.blocked) return false
          return periodoDiaLibreExitoso(result) ? true : false
        }),
      })
    } finally {
      confirming = false
    }
  })
}
