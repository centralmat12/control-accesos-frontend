import { CAPABILITY, CAPABILITY_STATUS, resolveCapability } from '../api/capabilities.js'
import { createTurno, deleteTurno, getTurnos, updateTurno } from '../api/turnos.js'
import { puedeAdministrarTurnos } from '../config/labor-access.js'
import { getCurrentUser } from '../api/auth.js'
import { actionButtonMarkup, BTN_SECONDARY_CLASS, createActionButton } from './button-styles.js'
import { iconPlus } from './icons.js'
import { openFormModal, openModal } from './modal.js'
import { panelForCapability } from './maintenance-panel.js'
import { showToast } from './toast.js'
import { escapeHtml } from '../utils/format.js'
import { bindTooltipRoot, helpText, infoHelpButton } from './tooltip.js'
import { createTimeSelect } from './time-field.js'
import { formatMinutosInformados, horarioNocturnoNoSoportado, minutosNetosProgramados, NOCTURNO_PENDIENTE, textoHorasProgramadas, textoHorasProgramadasDias } from '../utils/labor-format.js'
function loadingState() {
  const node = document.createElement('p')
  node.className = 'rounded-xl border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500 shadow-sm dark:border-slate-700 dark:bg-slate-900'
  node.textContent = 'Cargando turnos...'
  return node
}

const DAY_LABELS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const SHELL = 'max-h-[65vh] max-w-full overflow-auto rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900'
const TURNOS_COLUMNS = 'grid w-max max-w-none grid-cols-[minmax(180px,220px)_minmax(260px,1fr)_130px_100px_100px]'
const CELL_NOMBRE = 'min-w-0 break-words px-3 py-3 text-left'
const CELL_HORARIO = 'min-w-0 break-words px-3 py-3 text-left'
const CELL_HORAS = 'min-w-0 break-words px-3 py-3 text-center'
const CELL_DESCANSO = 'min-w-0 break-words px-3 py-3 text-center'
const CELL_ACCIONES = 'min-w-0 whitespace-nowrap px-3 py-3 text-right'

function diaLabel(dia) {
  return DAY_LABELS[dia] ?? `Día ${dia}`
}

export const MINUTOS_ALMUERZO_MESSAGE = 'Ingresá una cantidad válida de minutos.'
const CONFIRM_DESTRUCTIVE_CLASS = 'rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:cursor-not-allowed disabled:opacity-60'

export function textoConfirmacionEliminarTurno(nombre) {
  return {
    title: 'Eliminar turno',
    question: `¿Querés eliminar el turno “${nombre}”?`,
    detail: 'Esta acción solo puede realizarse si el turno no tiene asignaciones de empleados.',
  }
}

export function decidirEliminacionTurno(error) {
  if (!error) {
    return { closeEditor: true, reload: true, toast: 'Turno eliminado.', tone: 'success' }
  }
  if (error.status === 401) return { session: true }
  if (error.status === 403) return { message: 'Acceso restringido.' }
  if (error.status === 404) {
    return { closeEditor: true, reload: true, toast: 'El turno ya no existe.', tone: 'warning' }
  }
  if (error.status === 409) {
    return { message: error.message || 'El turno tiene asignaciones y no se puede eliminar.' }
  }
  return { message: 'No se pudo eliminar el turno. Podés reintentar.' }
}

export function parseMinutosAlmuerzo(value) {
  const text = String(value ?? '').trim()
  if (!/^\d+$/.test(text)) return { ok: false, message: MINUTOS_ALMUERZO_MESSAGE }
  return { ok: true, value: Number(text) }
}

const HORAS_CAMPO = 'flex h-11 w-full min-w-0 items-center rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-600 dark:bg-slate-900'
const SUFIJO_CAMPO = 'inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-900'
const SUFIJO_INPUT = 'border-0 bg-transparent p-0 text-sm outline-none [appearance:textfield] dark:bg-transparent [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none'

function turnoForm(initial) {
  const form = document.createElement('form')
  form.className = 'min-w-0 space-y-3'
  const dias = initial?.dias?.length ? initial.dias : [{ diaSemana: 1, horaEntrada: '09:00', horaSalida: '18:00', minutosAlmuerzo: 60 }]
  const fieldLabel = 'mb-1 inline-flex min-h-5 items-center gap-1 text-sm font-medium leading-5 text-slate-700 dark:text-slate-200'
  const controlClass = 'h-10 w-full min-w-0 rounded-lg border border-slate-200 px-3 text-sm dark:border-slate-600 dark:bg-slate-900'
  const submitLabel = initial?.id ? 'Guardar' : 'Crear turno'
  form.innerHTML = `
    <div class="grid w-full grid-cols-1 items-start justify-start gap-4 sm:w-fit sm:grid-cols-[minmax(240px,320px)_100px]">
      <label class="block min-w-0">
        <span class="${fieldLabel}">Nombre del turno ${infoHelpButton('Usá un nombre fácil de identificar.')}</span>
        ${helpText('turno-nombre-help', 'Usá un nombre fácil de identificar.')}
        <input name="nombre" required maxlength="100" placeholder="Ej. Turno administrativo" aria-describedby="turno-nombre-help" class="${controlClass} max-w-full sm:w-[320px]" value="${escapeHtml(initial?.nombre ?? '')}" />
      </label>
      <label class="block min-w-0">
        <span class="${fieldLabel}">Tolerancia ${infoHelpButton('Minutos permitidos después del horario de entrada.')}</span>
        ${helpText('turno-tolerancia-help', 'Minutos permitidos después del horario de entrada.')}
        <span class="${SUFIJO_CAMPO} h-10 w-full">
          <input name="tolerancia" type="number" min="0" max="1440" step="1" inputmode="numeric" required aria-describedby="turno-tolerancia-help" class="${SUFIJO_INPUT} min-w-0 flex-1" value="${Number(initial?.toleranciaMinutos ?? 0)}" />
          <span class="shrink-0 text-xs text-slate-500" aria-hidden="true">min</span>
        </span>
      </label>
    </div>
    <div class="space-y-2 border-t border-slate-200 pt-3 dark:border-slate-700">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h3 class="text-sm font-semibold text-slate-800 dark:text-slate-100">Días y horarios</h3>
        <button type="button" data-add-day class="${BTN_SECONDARY_CLASS} h-8 shrink-0 gap-1.5 px-2.5 text-[13px]">${iconPlus('h-3.5 w-3.5')}<span>Agregar día</span></button>
      </div>
      <div data-dias class="space-y-2"></div>
    </div>
    <p data-night class="hidden text-sm text-slate-600 dark:text-slate-300"></p>
    <p data-error class="hidden text-sm text-red-600" role="alert"></p>
    <div class="flex flex-wrap items-center gap-2 border-t border-slate-200 pt-3 dark:border-slate-700">
      <div data-delete-slot class="w-full sm:w-auto"></div>
      <div class="ml-auto flex flex-wrap items-center justify-end gap-2 max-sm:w-full">
        <button type="button" data-cancel class="${BTN_SECONDARY_CLASS} h-10 w-full justify-center sm:w-auto">Cancelar</button>
        <button type="submit" class="inline-flex h-10 w-full items-center justify-center rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 sm:w-auto">${submitLabel}</button>
      </div>
    </div>
  `
  const list = form.querySelector('[data-dias]')
  const night = form.querySelector('[data-night]')
  night.textContent = NOCTURNO_PENDIENTE

  function paintHoras(row) {
    const field = row.querySelector('[data-horas]')
    const resumen = textoHorasProgramadas(
      row.querySelector('[name="horaEntrada"]')?.value,
      row.querySelector('[name="horaSalida"]')?.value,
      row.querySelector('[name="minutosAlmuerzo"]')?.value,
    )
    field.textContent = resumen.texto
    field.className = `${HORAS_CAMPO} ${resumen.valido ? 'font-medium text-emerald-600 dark:text-emerald-300' : 'text-slate-400'}`
  }

  function addDay(dia = { diaSemana: 1, horaEntrada: '', horaSalida: '', minutosAlmuerzo: 60 }) {
    const row = document.createElement('div')
    const descanso = dia.minutosAlmuerzo == null || dia.minutosAlmuerzo === '' ? 60 : dia.minutosAlmuerzo
    const dayLabel = 'mb-1 inline-flex min-h-5 items-center gap-1 text-xs font-medium leading-4 text-slate-500 dark:text-slate-400'
    const dayControl = 'h-11 w-full min-w-0 rounded-lg border border-slate-200 px-2 text-sm dark:border-slate-600 dark:bg-slate-900'
    row.className = 'grid w-full min-w-0 grid-cols-1 items-end gap-3 rounded-lg border border-slate-200 p-2 dark:border-slate-700 md:grid-cols-[minmax(9rem,1.2fr)_minmax(6.25rem,6.75rem)_minmax(6.25rem,6.75rem)_minmax(6.75rem,7.5rem)_minmax(7.5rem,1fr)]'
    row.innerHTML = `
      <label class="min-w-0">
        <span class="${dayLabel}">Día</span>
        <select name="diaSemana" class="${dayControl}" aria-label="Día">
          ${DAY_LABELS.map((label, index) => `<option value="${index}" ${Number(dia.diaSemana) === index ? 'selected' : ''}>${label}</option>`).join('')}
        </select>
      </label>
      <label class="min-w-0">
        <span class="${dayLabel}">Entrada</span>
        <span data-hora-entrada></span>
      </label>
      <label class="min-w-0">
        <span class="${dayLabel}">Salida</span>
        <span data-hora-salida></span>
      </label>
      <label class="min-w-0">
        <span class="${dayLabel}"><span>Descanso</span>${infoHelpButton('Ingresá la cantidad de minutos de descanso. Solo números.')}</span>
        <span class="${SUFIJO_CAMPO} h-11 w-full">
          <input name="minutosAlmuerzo" type="number" min="0" step="1" inputmode="numeric" class="${SUFIJO_INPUT} w-12" value="${escapeHtml(descanso)}" aria-label="Descanso / almuerzo (minutos)" />
          <span class="shrink-0 text-xs text-slate-500" aria-hidden="true">min</span>
        </span>
      </label>
      <div class="min-w-0">
        <span class="mb-1 block min-h-5 text-xs font-medium leading-4 text-slate-500 dark:text-slate-400">Horas programadas</span>
        <div data-horas class="${HORAS_CAMPO} text-slate-400" role="status" aria-readonly="true" aria-live="polite">—</div>
      </div>
    `
    const refrescar = () => paintHoras(row)
    row.querySelector('[data-hora-entrada]').replaceWith(createTimeSelect({
      name: 'horaEntrada',
      value: dia.horaEntrada,
      ariaLabel: 'Hora de entrada',
      required: true,
      onChange: refrescar,
    }))
    row.querySelector('[data-hora-salida]').replaceWith(createTimeSelect({
      name: 'horaSalida',
      value: dia.horaSalida,
      ariaLabel: 'Hora de salida',
      required: true,
      onChange: refrescar,
    }))
    row.addEventListener('input', refrescar)
    list.append(row)
    refrescar()
  }
  bindTooltipRoot(form)
  dias.forEach(addDay)
  if (initial?.id) {
    const remove = createActionButton({
      variant: 'delete',
      label: 'Eliminar turno',
      ariaLabel: 'Eliminar turno',
    })
    remove.dataset.deleteTurno = 'true'
    remove.classList.add('h-10', 'w-full', 'justify-center', 'sm:w-auto')
    form.querySelector('[data-delete-slot]').append(remove)
  }
  form.querySelector('[data-add-day]').addEventListener('click', () => addDay())
  form.collect = () => {
    const rows = [...list.children]
    const fieldError = form.querySelector('[data-error]')
    fieldError.textContent = ''
    fieldError.classList.add('hidden')
    const parsed = []
    for (const row of rows) {
      const minutos = parseMinutosAlmuerzo(row.querySelector('[name="minutosAlmuerzo"]').value)
      if (!minutos.ok) {
        form.querySelector('[data-error]').textContent = minutos.message
        form.querySelector('[data-error]').classList.remove('hidden')
        return null
      }
      parsed.push({
        diaSemana: Number(row.querySelector('[name="diaSemana"]').value),
        horaEntrada: row.querySelector('[name="horaEntrada"]').value,
        horaSalida: row.querySelector('[name="horaSalida"]').value,
        minutosAlmuerzo: minutos.value,
      })
    }
    const nocturnal = parsed.some((dia) => horarioNocturnoNoSoportado(dia.horaEntrada, dia.horaSalida))
    night.classList.toggle('hidden', !nocturnal)
    if (nocturnal) return null
    return {
      nombre: form.nombre.value,
      toleranciaMinutos: Number(form.tolerancia.value),
      dias: parsed,
    }
  }
  return form
}

export function presentarFilaTurno(turno) {
  const horas = textoHorasProgramadasDias(turno?.dias)
  const dias = (Array.isArray(turno?.dias) ? turno.dias : []).flatMap((dia) => {
    const neto = minutosNetosProgramados(dia?.horaEntrada, dia?.horaSalida, dia?.minutosAlmuerzo)
    const descanso = formatMinutosInformados(dia?.minutosAlmuerzo)
    if (neto == null || !descanso || !dia?.horaEntrada || !dia?.horaSalida) return []
    return [{
      horario: `${diaLabel(dia.diaSemana)} ${dia.horaEntrada}–${dia.horaSalida}`,
      descanso,
    }]
  })
  if (!dias.length) return { vacio: true, texto: 'Sin días configurados', horas }
  return {
    vacio: false,
    horario: dias.map((dia) => dia.horario).join(' · '),
    horas,
    descanso: dias.map((dia) => dia.descanso).join(' · '),
  }
}

function renderTable(turnos, canWrite, host, reload, onSaved) {
  if (!turnos.length) {
    host.innerHTML = `<div class="${SHELL} px-4 py-10 text-center"><p class="text-sm font-semibold">No hay turnos cargados</p><p class="mt-1 text-sm text-slate-500">Cuando existan turnos de la empresa van a aparecer en esta tabla.</p></div>`
    return
  }
  const section = document.createElement('div')
  section.className = SHELL
  const head = 'sticky top-0 z-10 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800 dark:text-slate-400'
  const columns = canWrite
    ? TURNOS_COLUMNS
    : 'grid w-max max-w-none grid-cols-[minmax(180px,220px)_minmax(260px,1fr)_130px_100px]'
  section.innerHTML = `
    <div role="table" class="${columns} text-sm">
      <div role="row" class="contents">
        <div role="columnheader" class="${CELL_NOMBRE} ${head}">Nombre</div>
        <div role="columnheader" class="${CELL_HORARIO} ${head}">Horario</div>
        <div role="columnheader" class="${CELL_HORAS} ${head}">Horas programadas</div>
        <div role="columnheader" class="${CELL_DESCANSO} ${head}">Descanso</div>
        ${canWrite ? `<div role="columnheader" class="${CELL_ACCIONES} ${head}">Acciones</div>` : ''}
      </div>
    </div>
  `
  const grid = section.querySelector('[role="table"]')
  turnos.forEach((turno) => {
    const fila = presentarFilaTurno(turno)
    const acciones = canWrite
      ? `<div role="cell" class="${CELL_ACCIONES} border-t border-slate-100 dark:border-slate-800">${actionButtonMarkup({ label: 'Editar', ariaLabel: 'Editar turno', attrs: 'data-edit', compact: true })}</div>`
      : ''
    const detalle = fila.vacio
      ? `<div role="cell" class="${CELL_HORARIO} border-t border-slate-100 text-slate-500 dark:border-slate-800">Sin días configurados</div>
      <div role="cell" class="${CELL_HORAS} border-t border-slate-100 dark:border-slate-800">${escapeHtml(fila.horas)}</div>
      <div role="cell" class="${CELL_DESCANSO} border-t border-slate-100 dark:border-slate-800"></div>`
      : `<div role="cell" class="${CELL_HORARIO} border-t border-slate-100 dark:border-slate-800">${escapeHtml(fila.horario)}</div>
      <div role="cell" class="${CELL_HORAS} border-t border-slate-100 dark:border-slate-800">${escapeHtml(fila.horas)}</div>
      <div role="cell" class="${CELL_DESCANSO} border-t border-slate-100 dark:border-slate-800">${escapeHtml(fila.descanso)}</div>`
    const row = document.createElement('div')
    row.setAttribute('role', 'row')
    row.className = 'contents'
    row.innerHTML = `
      <div role="cell" class="${CELL_NOMBRE} border-t border-slate-100 font-medium dark:border-slate-800">${escapeHtml(turno.nombre)}</div>
      ${detalle}
      ${acciones}
    `
    row.querySelector('[data-edit]')?.addEventListener('click', () => openEditor(turno, reload, onSaved))
    grid.append(row)
  })
  host.replaceChildren(section)
}

function openEliminarTurnoConfirm(nombre, onConfirm) {
  const copy = textoConfirmacionEliminarTurno(nombre)
  return new Promise((resolve) => {
    let settled = false
    let busy = false
    const content = document.createElement('div')
    const question = document.createElement('p')
    question.className = 'text-sm text-slate-700 dark:text-slate-200'
    question.textContent = copy.question
    const detail = document.createElement('p')
    detail.className = 'mt-2 text-sm text-slate-500 dark:text-slate-400'
    detail.textContent = copy.detail
    const actions = document.createElement('div')
    actions.className = 'mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end'
    const cancel = document.createElement('button')
    cancel.type = 'button'
    cancel.className = BTN_SECONDARY_CLASS
    cancel.textContent = 'Cancelar'
    const confirm = document.createElement('button')
    confirm.type = 'button'
    confirm.className = CONFIRM_DESTRUCTIVE_CLASS
    confirm.textContent = 'Eliminar turno'
    actions.append(cancel, confirm)
    content.append(question, detail, actions)

    const finish = (value) => {
      if (settled) return
      settled = true
      modal.close({ force: true })
      resolve(value)
    }

    const modal = openModal({
      title: copy.title,
      content,
      stacked: true,
      closeOnBackdrop: false,
      unsavedChanges: false,
      canClose: () => !busy,
      onClose: () => {
        if (!settled) {
          settled = true
          resolve({ cancelled: true })
        }
      },
    })

    cancel.addEventListener('click', () => {
      if (busy || settled) return
      finish({ cancelled: true })
    })
    confirm.addEventListener('click', () => {
      if (busy || settled) return
      busy = true
      confirm.disabled = true
      cancel.disabled = true
      confirm.setAttribute('aria-busy', 'true')
      confirm.textContent = 'Eliminando…'
      void (async () => {
        try {
          await onConfirm()
          finish({ ok: true })
        } catch (error) {
          finish({ ok: false, error })
        }
      })()
    })
  })
}

function aplicarResultadoEliminacion(errorElement, decision) {
  if (decision.toast) showToast({ message: decision.toast, tone: decision.tone || 'success' })
  if (decision.message) {
    errorElement.textContent = decision.message
    errorElement.classList.remove('hidden')
  }
}

function openEditor(turno, reload, onSaved) {
  const form = turnoForm(turno)
  const error = form.querySelector('[data-error]')
  const modal = openFormModal({
    title: turno ? 'Editar turno' : 'Nuevo turno',
    content: form,
    dialogClass: 'max-w-[45rem]',
  })
  let deleting = false
  form.querySelector('[data-cancel]').addEventListener('click', () => modal.close())
  form.querySelector('[data-delete-turno]')?.addEventListener('click', async () => {
    if (deleting || !turno?.id) return
    deleting = true
    const button = form.querySelector('[data-delete-turno]')
    button.disabled = true
    const outcome = await openEliminarTurnoConfirm(turno.nombre || 'turno', () => deleteTurno(turno.id))
    deleting = false
    if (!outcome || outcome.cancelled) {
      button.disabled = false
      return
    }
    const decision = decidirEliminacionTurno(outcome.ok ? null : outcome.error)
    if (decision.session) {
      button.disabled = false
      return
    }
    aplicarResultadoEliminacion(error, decision)
    if (decision.closeEditor) modal.close({ force: true })
    if (decision.reload) reload()
    if (!decision.closeEditor) button.disabled = false
  })
  form.addEventListener('submit', async (event) => {
    event.preventDefault()
    const body = form.collect()
    if (!body) {
      if (error.classList.contains('hidden')) {
        error.textContent = NOCTURNO_PENDIENTE
        error.classList.remove('hidden')
      }
      return
    }
    try {
      const saved = turno?.id
        ? (await updateTurno(turno.id, body), { ...turno, ...body, id: turno.id })
        : await createTurno(body)
      const row = saved?.id
        ? { ...saved, ...body, id: saved.id, dias: saved.dias?.length ? saved.dias : body.dias }
        : { ...body }
      showToast({ message: turno?.id ? 'Turno actualizado.' : 'Turno creado.', tone: 'success' })
      modal.close({ force: true })
      if (onSaved) onSaved(row)
      else reload()
    } catch (saveError) {
      error.textContent = saveError.message || 'No se pudo guardar el turno.'
      error.classList.remove('hidden')
    }
  })
}

export function createTurnosPanel() {
  const root = document.createElement('section')
  root.className = 'w-fit min-w-0 max-w-[min(100%,65rem)] space-y-2'
  const actions = document.createElement('div')
  actions.className = 'flex flex-wrap items-center justify-end gap-2'
  const host = document.createElement('div')
  root.append(actions, host)
  let listaTurnos = []
  let puedeEscribir = false

  function mostrarTurnos(turnos = listaTurnos) {
    listaTurnos = turnos
    renderTable(listaTurnos, puedeEscribir, host, () => load(false), aplicarTurnoGuardado)
  }

  function aplicarTurnoGuardado(row) {
    if (!row) return
    const next = row.id && listaTurnos.some((item) => item.id === row.id)
      ? listaTurnos.map((item) => (item.id === row.id ? { ...item, ...row } : item))
      : [row, ...listaTurnos]
    mostrarTurnos(next)
    load(false, { silent: true })
  }

  async function load(force = false, { silent = false } = {}) {
    if (!silent) host.replaceChildren(loadingState())
    const user = getCurrentUser()
    const read = await resolveCapability(CAPABILITY.turnosRead, { force })
    if (read.status !== CAPABILITY_STATUS.available) {
      actions.replaceChildren()
      host.replaceChildren(panelForCapability(read, { onRetry: () => load(true) }))
      return
    }
    const write = await resolveCapability(CAPABILITY.turnosWrite, { force })
    puedeEscribir = write.status === CAPABILITY_STATUS.available && puedeAdministrarTurnos(user)
    actions.replaceChildren()
    if (puedeEscribir) {
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-500'
      button.textContent = 'Nuevo turno'
      button.addEventListener('click', () => openEditor(null, () => load(false), aplicarTurnoGuardado))
      actions.append(button)
    }
    try {
      const turnos = await getTurnos()
      mostrarTurnos(turnos)
    } catch (error) {
      if (silent || error.status === 401) return
      host.replaceChildren(panelForCapability(
        { status: error.status === 403 ? CAPABILITY_STATUS.forbidden : CAPABILITY_STATUS.temporarilyUnavailable, reason: error.status ? 'server' : 'network' },
        { onRetry: () => load(true) },
      ))
    }
  }

  load(false)
  bindTooltipRoot(root)
  return root
}
