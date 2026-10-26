import { canOpenOperativeForm, CAPABILITY, CAPABILITY_STATUS, resolveCapability } from '../api/capabilities.js'
import { createFichadaManual } from '../api/fichadas-manuales.js'
import { OBSERVACION_MOTIVOS, observacionMotivoLabel } from '../utils/fichada-observacion.js'
import {
  commitManualFichada,
  endSubmit,
  entradaManualConfirmModel,
  FUTURE_FICHADA_MESSAGE,
  limitesFichadaManual,
  manualConfirmModel,
  salidaManualConfirmModel,
  tryBeginSubmit,
  validateEntradaContraSalida,
  validateFichadaContraMarca,
  validateManualFichadaTime,
  validateSalidaContraEntrada,
} from '../utils/fichada-manual-time.js'
import { BTN_SECONDARY_CLASS } from './button-styles.js'
import { createEmpleadoCombobox } from './empleado-combobox.js'
import { bindTooltipRoot, helpText, infoHelpButton } from './tooltip.js'
import { openFormModal, openReviewConfirm, trackFichadasOverlay } from './modal.js'
import { panelForCapability } from './maintenance-panel.js'
import { showToast } from './toast.js'
import { escapeHtml } from '../utils/format.js'

const FIELD_CLASS = 'mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900'
const PRIMARY_CLASS = 'rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60'

function empleadoNombre(empleados, id) {
  const item = empleados.find((empleado) => String(empleado.id) === String(id))
  return [item?.nombre, item?.apellido].filter(Boolean).join(' ') || item?.empleado || 'Empleado'
}

function readManualForm(form, combo) {
  const escrito = String(combo?.input?.value ?? '').trim()
  const elegido = String(combo?.getSelectedLabel?.() ?? '').trim()
  const empleadoId = combo && escrito === elegido ? combo.getEmpleadoId() : form.empleadoId.value
  if (combo) form.empleadoId.value = empleadoId
  return {
    empleadoId,
    fecha: form.fecha.value,
    hora: form.hora.value,
    tipo: form.tipo.value,
    motivo: form.motivo.value,
    detalle: form.detalle.value.trim(),
  }
}

function confirmBody(model) {
  const body = document.createElement('div')
  body.className = 'space-y-3 text-sm text-slate-600 dark:text-slate-300'
  const intro = document.createElement('p')
  intro.textContent = model.intro
  const list = document.createElement('dl')
  list.className = 'grid grid-cols-[8rem_1fr] gap-x-3 gap-y-1'
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
  const nodes = [intro, list]
  if (model.warning) {
    const warning = document.createElement('p')
    warning.className = 'text-amber-700 dark:text-amber-300'
    warning.textContent = model.warning
    nodes.push(warning)
  }
  nodes.push(legend, progress)
  body.append(...nodes)
  return body
}

function focusOpener(opener) {
  if (opener instanceof HTMLElement && opener.isConnected) opener.focus()
}

export async function openFichadaManual({ getEmpleados = () => [], onSaved, preset = null, opener = null } = {}) {
  const capability = await resolveCapability(CAPABILITY.fichadasManual)
  if (capability.status === CAPABILITY_STATUS.unauthorized) return
  if (!canOpenOperativeForm(capability)) {
    focusOpener(opener)
    const panel = panelForCapability(capability, {
      onRetry: () => {
        modal.close({ force: true })
        void openFichadaManual({ getEmpleados, onSaved, preset, opener })
      },
    })
    const modal = trackFichadasOverlay(openFormModal({
      title: 'Registrar fichada manual',
      content: panel,
      unsavedChanges: false,
    }))
    return
  }

  const empleados = getEmpleados()
  const motivoPendiente = Boolean(preset) && !preset.motivo
  const form = document.createElement('form')
  form.className = 'space-y-3'
  form.innerHTML = `
      <div data-empleado></div>
      <input type="hidden" name="empleadoId" />
      <div class="grid gap-3 sm:grid-cols-2">
        <label class="block text-sm" for="fichada-manual-fecha">
          <span class="mb-1 flex items-center gap-1">Fecha ${infoHelpButton('No puede ser posterior a hoy.')}</span>
          ${helpText('fichada-manual-fecha-help', 'No puede ser posterior a hoy.')}
          <input id="fichada-manual-fecha" name="fecha" type="date" required aria-describedby="fichada-manual-fecha-help" data-help-id="fichada-manual-fecha-help" class="${FIELD_CLASS}" />
        </label>
        <label class="block text-sm" for="fichada-manual-hora">
          <span class="mb-1 flex items-center gap-1">Hora ${infoHelpButton('No puede ser posterior a la hora actual.')}</span>
          ${helpText('fichada-manual-hora-help', 'No puede ser posterior a la hora actual.')}
          <input id="fichada-manual-hora" name="hora" type="time" required aria-describedby="fichada-manual-hora-help" data-help-id="fichada-manual-hora-help" class="${FIELD_CLASS}" />
        </label>
      </div>
      <label class="block text-sm" for="fichada-manual-tipo">
        <span class="mb-1 flex items-center gap-1">Tipo ${infoHelpButton('Indicá si corresponde a una entrada o una salida.')}</span>
        ${helpText('fichada-manual-tipo-help', 'Indicá si corresponde a una entrada o una salida.')}
        <select id="fichada-manual-tipo" name="tipo" required aria-describedby="fichada-manual-tipo-help" data-help-id="fichada-manual-tipo-help" class="${FIELD_CLASS}">
          ${preset?.agregarFichada ? '<option value="">Seleccioná</option>' : ''}
          <option value="Entrada">Entrada</option>
          <option value="Salida">Salida</option>
        </select>
      </label>
      <label class="block text-sm" for="fichada-manual-motivo">
        <span class="mb-1 flex items-center gap-1">Motivo ${infoHelpButton('Seleccioná el motivo del registro manual.')}</span>
        ${helpText('fichada-manual-motivo-help', 'Seleccioná el motivo del registro manual.')}
        <select id="fichada-manual-motivo" name="motivo" required aria-describedby="fichada-manual-motivo-help" data-help-id="fichada-manual-motivo-help" class="${FIELD_CLASS}">
          ${motivoPendiente ? '<option value="">Seleccioná</option>' : ''}
          ${OBSERVACION_MOTIVOS.map((item) => `<option value="${item.value}">${escapeHtml(item.label)}</option>`).join('')}
        </select>
      </label>
      <label class="block text-sm" for="fichada-manual-detalle">
        <span class="mb-1 flex items-center gap-1">Observación ${infoHelpButton('Agregá el detalle que justifica la fichada.')}</span>
        ${helpText('fichada-manual-detalle-help', 'Agregá el detalle que justifica la fichada.')}
        <textarea id="fichada-manual-detalle" name="detalle" required maxlength="500" aria-describedby="fichada-manual-detalle-help" data-help-id="fichada-manual-detalle-help" class="${FIELD_CLASS}"></textarea>
      </label>
      <p id="fichada-manual-aviso" class="hidden text-sm text-slate-600 dark:text-slate-300"></p>
      <p id="fichada-manual-duracion" class="hidden text-sm text-amber-700 dark:text-amber-300" role="status"></p>
      <p id="fichada-manual-error" data-error class="hidden text-sm text-red-600" role="alert" aria-live="polite"></p>
      <div class="flex justify-end gap-2">
        <button type="button" data-cancel class="${BTN_SECONDARY_CLASS}">Cancelar</button>
        <button type="submit" class="${PRIMARY_CLASS}">Continuar</button>
      </div>
    `
  const error = form.querySelector('[data-error]')
  const submitState = { pending: false }

  function applyLimits(now = new Date()) {
    const limits = limitesFichadaManual(form.fecha.value, now)
    form.fecha.max = limits.maxDate
    if (limits.maxTime) form.hora.max = limits.maxTime
    else form.hora.removeAttribute('max')
  }

  function clearError() {
    error.textContent = ''
    error.classList.add('hidden')
    ;[form.fecha, form.hora, form.detalle, form.motivo, form.empleadoId].forEach((field) => {
      field.removeAttribute('aria-invalid')
      if (field.getAttribute('aria-describedby') === error.id) {
        if (field.dataset.helpId) field.setAttribute('aria-describedby', field.dataset.helpId)
        else field.removeAttribute('aria-describedby')
      }
    })
  }

  const empleadoFijo = Boolean(preset?.bloquear && preset?.empleadoId)
  const catalogo = [...empleados]
  if (preset?.empleadoId && !catalogo.some((item) => String(item.id) === String(preset.empleadoId))) {
    const nombre = preset.empleadoNombre || empleadoNombre(empleados, preset.empleadoId)
    catalogo.push({ id: preset.empleadoId, nombre, apellido: '', legajo: '' })
  }
  const empleadoCombo = createEmpleadoCombobox({
    id: 'fichada-manual-empleado',
    mode: 'select',
    locked: empleadoFijo,
    help: 'Buscá por nombre, apellido o legajo.',
    helpMode: 'icon',
    emptyMessage: 'No se encontraron empleados.',
    onChange: (id) => {
      form.empleadoId.value = id || ''
    },
  })
  form.querySelector('[data-empleado]').replaceChildren(empleadoCombo.root)
  bindTooltipRoot(form)
  empleadoCombo.setEmpleados(catalogo)
  if (preset?.empleadoId) empleadoCombo.setEmpleadoId(String(preset.empleadoId), { silent: true })
  form.empleadoId.value = empleadoCombo.getEmpleadoId()

  function showError(message, field) {
    error.textContent = message
    error.classList.remove('hidden')
    if (!field) return
    const target = field === form.empleadoId ? empleadoCombo.input : field
    target.setAttribute('aria-invalid', 'true')
    target.setAttribute('aria-describedby', error.id)
    if (typeof target.focus === 'function' && target.tabIndex >= 0) target.focus()
  }
  if (preset?.fecha) form.fecha.value = preset.fecha
  form.hora.value = preset?.hora || ''
  if (preset?.tipo) form.tipo.value = preset.tipo
  if (preset?.motivo) form.motivo.value = preset.motivo
  else if (motivoPendiente) form.motivo.value = ''
  form.detalle.value = preset?.detalle || ''
  if (preset?.bloquear) {
    form.fecha.disabled = true
    if (!preset.agregarFichada) form.tipo.disabled = true
  }
  if (preset?.completarSalida || preset?.completarEntrada || preset?.agregarFichada) {
    const aviso = form.querySelector('#fichada-manual-aviso')
    const nombre = preset.empleadoNombre || empleadoNombre(empleados, preset.empleadoId)
    aviso.textContent = preset.agregarFichada
      ? `Se detectó una jornada incompleta. ${nombre} tiene una sola fichada a las ${preset.marcaHora} y no se puede distinguir si fue ingreso o egreso. Elegí Entrada o Salida únicamente si corresponde registrarla.`
      : preset.completarEntrada
        ? `Se detectó una jornada incompleta. ${nombre} registra egreso a las ${preset.salidaHora} y no posee una entrada válida. Completá los datos únicamente si corresponde registrar la entrada manualmente.`
        : `Se detectó una jornada incompleta. ${nombre} registra ingreso a las ${preset.entradaHora} y no posee una salida válida. Completá los datos únicamente si corresponde registrar la salida manualmente.`
    aviso.classList.remove('hidden')
  }
  applyLimits(new Date())
  ;(preset?.fecha && preset.hora === '' ? form.hora : form.fecha).setAttribute('data-autofocus', 'true')

  focusOpener(opener)
  const modal = trackFichadasOverlay(openFormModal({
    title: 'Registrar fichada manual',
    content: form,
    onClose: () => empleadoCombo.destroy(),
  }))
  form.querySelector('[data-cancel]').addEventListener('click', () => modal.close())

  function extremoExtra(input) {
    if (preset?.completarSalida) return validateSalidaContraEntrada(input, preset.entradaFechaHora)
    if (preset?.completarEntrada) return validateEntradaContraSalida(input, preset.salidaFechaHora)
    if (preset?.agregarFichada) return validateFichadaContraMarca(input, preset.marcaFechaHora)
    return { ok: true, warning: '' }
  }

  function refreshDuracion() {
    const note = form.querySelector('#fichada-manual-duracion')
    if (!preset?.completarSalida && !preset?.completarEntrada && !preset?.agregarFichada) return
    const check = extremoExtra(readManualForm(form, empleadoCombo))
    note.textContent = check.ok ? check.warning || '' : ''
    note.classList.toggle('hidden', !note.textContent)
  }

  form.hora.addEventListener('change', refreshDuracion)
  form.tipo.addEventListener('change', refreshDuracion)
  form.fecha.addEventListener('change', () => {
    applyLimits(new Date())
    const input = readManualForm(form, empleadoCombo)
    if (!input.fecha || !input.hora) return
    const check = validateManualFichadaTime(input, new Date())
    if (!check.ok && check.message === FUTURE_FICHADA_MESSAGE) showError(check.message, form[check.field] || form.fecha)
    else if (error.textContent === FUTURE_FICHADA_MESSAGE) clearError()
  })

  form.addEventListener('submit', async (event) => {
    event.preventDefault()
    if (!tryBeginSubmit(submitState)) return
    const submitButton = form.querySelector('[type="submit"]')
    submitButton.disabled = true
    try {
      clearError()
      applyLimits(new Date())
      const input = readManualForm(form, empleadoCombo)
      if (!input.empleadoId) {
        showError('Seleccioná un empleado.', form.empleadoId)
        return
      }
      const time = validateManualFichadaTime(input, new Date())
      if (!time.ok) {
        showError(time.message, form[time.field] || form.fecha)
        return
      }
      if (!input.motivo) {
        showError('Seleccioná un motivo.', form.motivo)
        return
      }
      if (!input.detalle) {
        showError('La observación es obligatoria.', form.detalle)
        return
      }
      const extremo = extremoExtra(input)
      if (!extremo.ok) {
        showError(extremo.message, form[extremo.field] || form.hora)
        return
      }
      const snapshot = { ...input }
      const empleado = preset?.empleadoNombre || empleadoNombre(empleados, snapshot.empleadoId)
      const model = preset?.completarSalida
        ? salidaManualConfirmModel({
            empleado,
            entrada: preset.entradaHora,
            fecha: snapshot.fecha,
            hora: snapshot.hora,
            motivo: snapshot.motivo,
            detalle: snapshot.detalle,
            warning: extremo.warning,
          })
        : preset?.completarEntrada
          ? entradaManualConfirmModel({
              empleado,
              salida: preset.salidaHora,
              fecha: snapshot.fecha,
              hora: snapshot.hora,
              motivo: snapshot.motivo,
              detalle: snapshot.detalle,
              warning: extremo.warning,
            })
        : manualConfirmModel({
            ...snapshot,
            empleado,
            motivo: observacionMotivoLabel(snapshot.motivo),
          })
      const result = await openReviewConfirm({
        title: model.title,
        body: confirmBody(model),
        confirmLabel: model.confirm,
        cancelLabel: model.cancel,
        onConfirm: async () => {
          applyLimits(new Date())
          const live = readManualForm(form, empleadoCombo)
          try {
            const beforeSend = extremoExtra(live)
            if (!beforeSend.ok) {
              showError(beforeSend.message, form[beforeSend.field] || form.hora)
              return false
            }
            await commitManualFichada(live, {
              now: new Date(),
              confirmed: snapshot,
              create: createFichadaManual,
              extraCheck: (value) => extremoExtra(value),
            })
            return true
          } catch (saveError) {
            if (saveError.status === 401 || saveError.code === 'UNAUTHORIZED') return false
            showError(saveError.message || 'No se pudo registrar la fichada.', form[saveError.field] || null)
            return false
          }
        },
      })
      if (!result?.ok) return
      modal.close({ force: true })
      let announcement = null
      try {
        announcement = await onSaved?.({ ...snapshot, origenAlerta: preset?.origenAlerta || null })
      } catch (saveError) {
        if (saveError?.status !== 401) {
          showToast({ message: saveError.message || 'No se pudieron actualizar las vistas.', tone: 'warning' })
        }
        return
      }
      if (!announcement?.suppressToast) showToast({ message: 'Fichada manual registrada.', tone: 'success' })
    } finally {
      submitButton.disabled = false
      endSubmit(submitState)
    }
  })
}
