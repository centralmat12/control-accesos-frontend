import { CAPABILITY, CAPABILITY_STATUS, resolveCapability } from '../api/capabilities.js'
import { getCurrentUser } from '../api/auth.js'
import { getEmpleados } from '../api/empleados.js'
import { assignTurno } from '../api/jornadas.js'
import { consultarTurnoExistente, createTurno, deleteTurno, getTurnoEmpleados, getTurnos, updateTurno } from '../api/turnos.js'
import { puedeAdministrarTurnos } from '../config/labor-access.js'
import { escapeHtml } from '../utils/format.js'
import {
  ACCESOS_DESCANSO,
  aplicarMarcadoTurno,
  clasificarEstadoNomina,
  coincideAsignadoTurno,
  coincideEmpleadoTurno,
  esEmpleadoDesasignable,
  esEmpleadoElegible,
  estadoMarcadoTurno,
  fechaCierreDesasignacion,
  marcadoEnTurno,
  NOMINA_SIN_COINCIDENCIAS,
  NOMINA_VACIA,
  parseMinutosAlmuerzo,
  textoCantidadCambiosTurno,
  textoConfirmacionCambiosTurno,
  textoDiasConfigurados,
  textoEmpleadosAsignados,
  textoHorarioHabitual,
  textoHorasSemanales,
  textoJornadaNeta,
  textoResultadoCambiosTurno,
  validarTramoTurno,
  valorCampoDescanso,
  horaTexto,
} from '../utils/turno-presentacion.js'
import { actionButtonMarkup, BTN_DELETE_CLASS, BTN_SECONDARY_CLASS, createActionButton } from './button-styles.js'
import {
  ADMIN_FIELD_CONTROL_CLASS,
  ADMIN_FILTER_GRID_CLASS,
  ADMIN_PRIMARY_BUTTON_CLASS,
  adminSectionHeaderMarkup,
  createAdminEmptyState,
} from './admin-panel-layout.js'
import { FORM_INPUT_CLASS, FORM_LABEL_CLASS } from './form-field.js'
import { claimOpenDropdown, enhanceSelectsIn, positionDropdownPanel, releaseOpenDropdown } from './dropdown.js'
import { createTurnoHoraField } from './turno-hora-field.js'
import { iconPlus, iconTrash, iconUsers } from './icons.js'
import { panelForCapability } from './maintenance-panel.js'
import { openFormModal, openModal } from './modal.js'
import { showToast } from './toast.js'
import { bindTooltipRoot, helpText, infoHelpButton } from './tooltip.js'

function loadingState() {
  const node = document.createElement('p')
  node.className = 'rounded-xl border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500 shadow-sm dark:border-slate-700 dark:bg-slate-900'
  node.textContent = 'Cargando turnos...'
  return node
}

const DAY_LABELS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const MAX_DIAS_TURNO = 7
const SHELL = 'w-full min-w-0 max-w-full overflow-x-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900'
const TURNOS_COLUMNS = 'md:grid-cols-[minmax(0,1.2fr)_minmax(0,0.7fr)_minmax(0,1.5fr)_minmax(0,0.9fr)_minmax(0,1fr)_auto]'
const DIA_COLUMNS = 'grid-cols-[minmax(8.25rem,9rem)_minmax(5.5rem,6.25rem)_minmax(5.5rem,6.25rem)_minmax(7rem,8rem)_max-content_2.25rem]'
const CELL = 'min-w-0 break-words px-3 py-3 text-left'
const CELL_CENTER = 'min-w-0 break-words px-3 py-3 text-center'

export { parseMinutosAlmuerzo }
const CONFIRM_DESTRUCTIVE_CLASS = 'rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:cursor-not-allowed disabled:opacity-60'
const CONFIRM_PRIMARY_CLASS = 'rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60'

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

const SUFIJO_CAMPO = 'inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-900'
const SUFIJO_INPUT = 'border-0 bg-transparent p-0 text-sm outline-none [appearance:textfield] dark:bg-transparent [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none'

let secuenciaDescanso = 0

function fijarOpcion(select, value) {
  if (!select) return
  const text = String(value)
  if (![...select.options].some((option) => option.value === text)) return
  select.value = text
}

function montarPopoverDescanso({ input, toggle, control, onSelect }) {
  const panel = document.createElement('div')
  const panelId = `descanso-menu-${secuenciaDescanso += 1}`
  panel.id = panelId
  panel.hidden = true
  panel.className = 'z-[80] overflow-auto rounded-lg border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-600 dark:bg-slate-900'
  panel.style.position = 'fixed'
  panel.setAttribute('role', 'listbox')
  panel.setAttribute('aria-label', 'Accesos rápidos de descanso')
  panel.innerHTML = ACCESOS_DESCANSO.map((acceso) => (
    `<button type="button" role="option" data-descanso-rapido="${acceso.minutos}" aria-selected="false" class="flex h-9 w-full items-center rounded-md px-2 text-left text-sm text-slate-700 hover:bg-slate-100 focus:outline-none dark:text-slate-200 dark:hover:bg-slate-800">${escapeHtml(acceso.etiqueta)}</button>`
  )).join('')
  document.body.append(panel)
  toggle.setAttribute('aria-controls', panelId)
  toggle.setAttribute('aria-haspopup', 'listbox')
  toggle.setAttribute('aria-expanded', 'false')
  input.setAttribute('aria-controls', panelId)
  input.setAttribute('aria-haspopup', 'listbox')
  input.setAttribute('aria-expanded', 'false')

  let open = false
  let active = 0
  const api = { close() { setOpen(false) } }

  function options() {
    return [...panel.querySelectorAll('[data-descanso-rapido]')]
  }

  function paintActive() {
    const value = String(input.value).trim()
    options().forEach((button, index) => {
      const selected = button.dataset.descansoRapido === value
      const current = index === active
      button.setAttribute('aria-selected', selected ? 'true' : 'false')
      button.classList.toggle('bg-slate-100', current)
      button.classList.toggle('dark:bg-slate-800', current)
      button.classList.toggle('font-medium', selected)
      button.classList.toggle('text-blue-700', selected)
      button.classList.toggle('dark:text-blue-200', selected)
    })
  }

  function setOpen(next) {
    if (open === next) {
      if (next) positionDropdownPanel(control, panel)
      return
    }
    open = next
    panel.hidden = !open
    toggle.setAttribute('aria-expanded', String(open))
    input.setAttribute('aria-expanded', String(open))
    if (open) {
      claimOpenDropdown(api)
      const match = options().findIndex((button) => button.dataset.descansoRapido === String(input.value).trim())
      active = match >= 0 ? match : 0
      paintActive()
      positionDropdownPanel(control, panel)
    } else {
      releaseOpenDropdown(api)
    }
  }

  function elegir(button) {
    if (!button) return
    input.value = button.dataset.descansoRapido
    onSelect()
    setOpen(false)
    input.focus()
  }

  function onReposition() {
    if (open) positionDropdownPanel(control, panel)
  }

  function onPointerDown(event) {
    if (!open) return
    if (control.contains(event.target) || panel.contains(event.target)) return
    setOpen(false)
  }

  function onKeyCapture(event) {
    if (!open) return
    const list = options()
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopImmediatePropagation()
      setOpen(false)
      input.focus()
      return
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      active = (active + 1) % list.length
      paintActive()
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      active = (active - 1 + list.length) % list.length
      paintActive()
      return
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      event.stopImmediatePropagation()
      elegir(list[active])
      return
    }
    if (event.key === 'Tab') setOpen(false)
  }

  input.addEventListener('click', () => setOpen(true))
  input.addEventListener('keydown', (event) => {
    if (open || event.key !== 'ArrowDown') return
    event.preventDefault()
    setOpen(true)
  })
  toggle.addEventListener('click', (event) => {
    event.preventDefault()
    event.stopPropagation()
    const next = !open
    setOpen(next)
    if (!next) input.focus()
  })
  toggle.addEventListener('keydown', (event) => {
    if (open || event.key !== 'ArrowDown') return
    event.preventDefault()
    setOpen(true)
    input.focus()
  })
  panel.addEventListener('click', (event) => {
    const button = event.target.closest('[data-descanso-rapido]')
    if (!button) return
    event.preventDefault()
    elegir(button)
  })
  document.addEventListener('pointerdown', onPointerDown)
  document.addEventListener('keydown', onKeyCapture, true)
  window.addEventListener('resize', onReposition)
  window.addEventListener('scroll', onReposition, true)

  return {
    sync: paintActive,
    destroy() {
      setOpen(false)
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyCapture, true)
      window.removeEventListener('resize', onReposition)
      window.removeEventListener('scroll', onReposition, true)
      panel.remove()
    },
  }
}

function turnoForm(initial, { canAssign = false, onCantidad } = {}) {
  const form = document.createElement('form')
  form.className = 'flex min-h-0 flex-1 flex-col w-fit max-w-full gap-2 overflow-x-hidden'
  const dias = initial?.dias?.length ? initial.dias : [{ diaSemana: 1, horaEntrada: '09:00', horaSalida: '18:00', minutosAlmuerzo: 60 }]
  const fieldLabel = 'mb-1 inline-flex min-h-5 items-center gap-1 text-sm font-medium leading-5 text-slate-700 dark:text-slate-200'
  const controlClass = 'h-10 w-full min-w-0 rounded-lg border border-slate-200 px-3 text-sm dark:border-slate-600 dark:bg-slate-900'
  const submitLabel = initial?.id ? 'Guardar' : 'Crear turno'
  const mostrarAsignar = Boolean(initial?.id) && canAssign
  form.innerHTML = `
    <div class="grid w-fit shrink-0 grid-cols-1 items-end justify-start gap-3 ${mostrarAsignar ? 'sm:grid-cols-[14rem_7rem_auto]' : 'sm:grid-cols-[14rem_7rem]'}">
      <label class="block min-w-0">
        <span class="${fieldLabel}">Nombre del turno ${infoHelpButton('Usá un nombre fácil de identificar.')}</span>
        ${helpText('turno-nombre-help', 'Usá un nombre fácil de identificar.')}
        <input name="nombre" required maxlength="100" placeholder="Ej. Turno administrativo" aria-describedby="turno-nombre-help" class="${controlClass}" value="${escapeHtml(initial?.nombre ?? '')}" />
      </label>
      <label class="block min-w-0">
        <span class="${fieldLabel}">Tolerancia ${infoHelpButton('Minutos permitidos después del horario de entrada.')}</span>
        ${helpText('turno-tolerancia-help', 'Minutos permitidos después del horario de entrada.')}
        <span class="${SUFIJO_CAMPO} h-10 w-full">
          <input name="tolerancia" type="number" min="0" max="1440" step="1" inputmode="numeric" required aria-describedby="turno-tolerancia-help" class="${SUFIJO_INPUT} min-w-0 flex-1" value="${Number(initial?.toleranciaMinutos ?? 0)}" />
          <span class="shrink-0 text-xs text-slate-500" aria-hidden="true">min</span>
        </span>
      </label>
      ${mostrarAsignar ? `<div class="flex min-h-10 min-w-0 items-center sm:justify-self-end">
        <button type="button" data-gestionar-empleados class="${BTN_SECONDARY_CLASS} h-10 shrink-0 gap-1.5 px-3" aria-label="Gestionar empleados">${iconUsers('h-4 w-4')}<span>Gestionar empleados</span></button>
      </div>` : ''}
    </div>
    <div data-scroll class="min-h-0 flex-1 space-y-2 overflow-y-auto overflow-x-hidden pr-1">
      <div class="space-y-1.5 border-t border-slate-200 pt-2 dark:border-slate-700">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <h3 class="text-sm font-semibold text-slate-800 dark:text-slate-100">Días y horarios</h3>
          <button type="button" data-add-day class="${BTN_SECONDARY_CLASS} h-8 shrink-0 gap-1.5 px-2.5 text-[13px]">${iconPlus('h-3.5 w-3.5')}<span>Agregar día</span></button>
        </div>
        <div data-dias-grid class="grid w-full min-w-0 ${DIA_COLUMNS} items-center gap-x-2 gap-y-1">
          <div class="contents text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>Día</span><span>Entrada</span><span>Salida</span><span>Descanso</span><span>Horas netas</span><span><span class="sr-only">Quitar</span></span>
          </div>
          <div data-dias class="contents"></div>
        </div>
      </div>
    </div>
    <p data-error class="hidden shrink-0 text-sm text-red-600" role="alert"></p>
    <div class="flex shrink-0 flex-wrap items-center gap-2 border-t border-slate-200 pt-2 dark:border-slate-700">
      <div data-delete-slot class="w-full sm:w-auto"></div>
      <div class="ml-auto flex flex-wrap items-center justify-end gap-2 max-sm:w-full">
        <button type="button" data-cancel class="${BTN_SECONDARY_CLASS} h-10 w-full justify-center sm:w-auto">Cancelar</button>
        <button type="submit" class="inline-flex h-10 w-full items-center justify-center rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto">${submitLabel}</button>
      </div>
    </div>
  `
  const list = form.querySelector('[data-dias]')
  const dayLabel = 'sr-only'
  const dayControl = 'h-9 w-full min-w-0 rounded-lg border border-slate-200 px-2 text-sm dark:border-slate-600 dark:bg-slate-900'

  function nombreDia(value) {
    const nombre = DAY_LABELS[Number(value)] || 'día'
    return nombre.toLocaleLowerCase('es')
  }

  function paintHoras(row) {
    const input = row.querySelector('[name="minutosAlmuerzo"]')
    const valor = input?.value ?? ''
    row._descansoSync?.()
    const quitar = row.querySelector('[data-remove-day]')
    if (quitar) quitar.setAttribute('aria-label', `Quitar ${nombreDia(row.querySelector('[name="diaSemana"]')?.value)}`)
    const field = row.querySelector('[data-horas]')
    const resumen = textoJornadaNeta(
      row.querySelector('[name="horaEntrada"]')?.value,
      row.querySelector('[name="horaSalida"]')?.value,
      valor,
    )
    const vacio = resumen === '—'
    field.textContent = resumen
    field.dataset.empty = vacio ? 'true' : 'false'
    field.className = 'turno-horas-netas'
  }

  function syncRemove() {
    const rows = [...list.children]
    rows.forEach((row) => {
      const button = row.querySelector('[data-remove-day]')
      if (button) button.hidden = rows.length < 2
    })
    const agregar = form.querySelector('[data-add-day]')
    if (agregar) agregar.disabled = rows.length >= MAX_DIAS_TURNO
  }

  function siguienteDia() {
    const usados = new Set([...list.querySelectorAll('[name="diaSemana"]')].map((select) => Number(select.value)))
    const libre = [1, 2, 3, 4, 5, 6, 0].find((dia) => !usados.has(dia))
    return { diaSemana: libre ?? 1, horaEntrada: '09:00', horaSalida: '18:00', minutosAlmuerzo: 60 }
  }

  function addDay(dia = { diaSemana: 1, horaEntrada: '09:00', horaSalida: '18:00', minutosAlmuerzo: 60 }) {
    const row = document.createElement('div')
    const entrada = horaTexto(dia.horaEntrada)
    const salida = horaTexto(dia.horaSalida)
    const descanso = valorCampoDescanso(dia.minutosAlmuerzo)
    row.dataset.diaRow = 'true'
    row.className = 'contents'
    row.innerHTML = `
      <label class="min-w-0">
        <span class="${dayLabel}">Día</span>
        <select name="diaSemana" aria-label="Día" class="${dayControl}">
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
        <span class="${dayLabel}">Descanso ${infoHelpButton('Tiempo de descanso que se descuenta de la jornada programada.')}</span>
        <span data-descanso-control class="${SUFIJO_CAMPO} h-9 w-full">
          <input name="minutosAlmuerzo" type="number" min="0" step="1" inputmode="numeric" aria-label="Descanso" class="${SUFIJO_INPUT} min-w-0 flex-1" value="${escapeHtml(descanso)}" />
          <span class="shrink-0 text-xs text-slate-500" aria-hidden="true">min</span>
          <button type="button" data-descanso-toggle class="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:hover:bg-slate-800 dark:hover:text-slate-100" aria-label="Accesos rápidos de descanso" aria-haspopup="listbox" aria-expanded="false">▾</button>
        </span>
      </label>
      <div class="min-w-0">
        <span class="${dayLabel}">Horas netas</span>
        <span data-horas data-tooltip="Horas programadas después del descanso" class="turno-horas-netas" data-empty="true" role="status" aria-readonly="true" aria-live="polite">—</span>
      </div>
      <button type="button" data-remove-day data-tooltip="Quitar día" aria-label="Quitar ${escapeHtml(nombreDia(dia.diaSemana))}" class="${BTN_DELETE_CLASS} h-9 w-9 shrink-0 justify-self-end px-0">${iconTrash('h-4 w-4')}</button>
    `
    row.querySelector('[data-hora-entrada]').replaceWith(createTurnoHoraField({
      name: 'horaEntrada',
      value: entrada,
      ariaLabel: 'Seleccionar hora de entrada',
      required: true,
      onChange: () => paintHoras(row),
    }))
    row.querySelector('[data-hora-salida]').replaceWith(createTurnoHoraField({
      name: 'horaSalida',
      value: salida,
      ariaLabel: 'Seleccionar hora de salida',
      required: true,
      onChange: () => paintHoras(row),
    }))
    const descansoMenu = montarPopoverDescanso({
      input: row.querySelector('[name="minutosAlmuerzo"]'),
      toggle: row.querySelector('[data-descanso-toggle]'),
      control: row.querySelector('[data-descanso-control]'),
      onSelect: () => paintHoras(row),
    })
    row._descansoSync = descansoMenu.sync
    row._descansoDestroy = descansoMenu.destroy
    row.addEventListener('change', () => paintHoras(row))
    row.querySelector('[name="minutosAlmuerzo"]').addEventListener('input', () => paintHoras(row))
    row.querySelector('[data-remove-day]').addEventListener('click', () => {
      row.querySelectorAll('select').forEach((select) => select._caSelect?.destroy())
      row.querySelectorAll('[data-turno-hora]').forEach((field) => field.destroy?.())
      row._descansoDestroy?.()
      row.remove()
      syncRemove()
    })
    const diaSemana = Number(dia.diaSemana)
    if (Number.isInteger(diaSemana)) fijarOpcion(row.querySelector('[name="diaSemana"]'), diaSemana)
    list.append(row)
    // El modal mejora los selects cuando ya están en el documento. Hacerlo antes
    // elimina el día de todas las filas salvo la última.
    if (row.isConnected) enhanceSelectsIn(row)
    paintHoras(row)
    syncRemove()
    bindTooltipRoot(row)
  }

  dias.forEach(addDay)
  let gestion = null
  if (initial?.id) {
    form.querySelector('[data-gestionar-empleados]')?.addEventListener('click', () => {
      const button = form.querySelector('[data-gestionar-empleados]')
      if (!button || button.disabled || gestion) return
      gestion = openGestionarEmpleados(initial, form, (cantidad) => {
        if (initial) initial.cantidadEmpleadosAsignados = cantidad
        onCantidad?.(cantidad)
      }, () => {
        gestion = null
      })
    })
    const remove = createActionButton({
      variant: 'delete',
      label: 'Eliminar turno',
      ariaLabel: 'Eliminar turno',
    })
    remove.dataset.deleteTurno = 'true'
    remove.classList.add('h-10', 'w-full', 'justify-center', 'sm:w-auto')
    form.querySelector('[data-delete-slot]').append(remove)
  }
  form.querySelector('[data-add-day]').addEventListener('click', () => {
    if (list.children.length >= MAX_DIAS_TURNO) return
    addDay(siguienteDia())
  })
  form.collect = () => {
    const rows = [...list.children]
    const fieldError = form.querySelector('[data-error]')
    fieldError.textContent = ''
    fieldError.classList.add('hidden')
    const parsed = []
    for (const row of rows) {
      row.querySelectorAll('[aria-invalid="true"]').forEach((field) => field.removeAttribute('aria-invalid'))
      const minutos = parseMinutosAlmuerzo(row.querySelector('[name="minutosAlmuerzo"]').value)
      const entrada = row.querySelector('[name="horaEntrada"]').value
      const salida = row.querySelector('[name="horaSalida"]').value
      const tramo = minutos.ok ? validarTramoTurno(entrada, salida, minutos.value) : minutos
      if (!tramo.ok) {
        fieldError.textContent = tramo.message
        fieldError.classList.remove('hidden')
        const control = row.querySelector(!minutos.ok ? '[name="minutosAlmuerzo"]' : '[name="horaSalida"]')
        control?.setAttribute('aria-invalid', 'true')
        control?.focus()
        return null
      }
      parsed.push({
        diaSemana: Number(row.querySelector('[name="diaSemana"]').value),
        horaEntrada: entrada,
        horaSalida: salida,
        minutosAlmuerzo: minutos.value,
      })
    }
    if (parsed.length > MAX_DIAS_TURNO) {
      fieldError.textContent = 'Un turno puede tener hasta 7 días.'
      fieldError.classList.remove('hidden')
      return null
    }
    if (new Set(parsed.map((dia) => dia.diaSemana)).size !== parsed.length) {
      fieldError.textContent = 'No puede haber más de un horario para el mismo día.'
      fieldError.classList.remove('hidden')
      return null
    }
    return {
      nombre: form.nombre.value,
      toleranciaMinutos: Number(form.tolerancia.value),
      dias: parsed,
    }
  }
  form.cerrarGestion = () => gestion?.close({ force: true })
  bindTooltipRoot(form)
  return form
}

function fechaCorta(value) {
  const text = String(value ?? '')
  return text.length >= 10 ? text.slice(0, 10) : ''
}

function hoyLocal() {
  const date = new Date()
  const mes = String(date.getMonth() + 1).padStart(2, '0')
  const dia = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${mes}-${dia}`
}

function idTurnoValido(id) {
  const turnoId = Number(id)
  return Number.isInteger(turnoId) && turnoId > 0 ? turnoId : null
}

function nombreEmpleado(empleado) {
  return [empleado?.apellido, empleado?.nombre].filter(Boolean).join(', ') || empleado?.nombreCompleto || 'Empleado'
}

function mountAsignados(host, turno, { onCantidad, form } = {}) {
  let asignados = []
  let fase = 'cargando'
  let filtro = ''
  let estado = null
  host.innerHTML = `
    <div data-toolbar class="min-w-0 shrink-0"></div>
    <div data-lista class="min-h-0 min-w-0 max-h-[min(20rem,40vh)] overflow-x-hidden overflow-y-auto"></div>
  `
  const toolbar = host.querySelector('[data-toolbar]')
  const lista = host.querySelector('[data-lista]')

  function ocultarSiVacio() {
    const visible = Boolean(toolbar.textContent?.trim() || lista.textContent?.trim() || lista.childElementCount)
    host.hidden = !visible
  }

  function pintarLista() {
    if (fase === 'cargando') {
      lista.innerHTML = '<p class="text-sm text-slate-500" role="status">Cargando empleados asignados...</p>'
      return
    }
    if (fase !== 'ok') {
      lista.replaceChildren()
      if (fase === 'mantenimiento') return
      const message = document.createElement('p')
      message.className = estado?.tipo === 'temporal' ? 'text-sm text-red-600' : 'text-sm text-slate-600 dark:text-slate-300'
      message.setAttribute('role', estado?.tipo === 'temporal' ? 'alert' : 'status')
      message.textContent = estado?.texto || ''
      lista.append(message)
      if (estado?.reintentar) {
        const retry = document.createElement('button')
        retry.type = 'button'
        retry.className = `${BTN_SECONDARY_CLASS} mt-2 h-10`
        retry.textContent = 'Reintentar'
        retry.addEventListener('click', () => cargar())
        lista.append(retry)
      }
      return
    }
    if (!asignados.length) {
      lista.replaceChildren()
      return
    }
    const visibles = asignados.filter((item) => coincideAsignadoTurno(item, filtro))
    if (!visibles.length) {
      lista.innerHTML = `<p class="text-sm text-slate-600 dark:text-slate-300" role="status">${NOMINA_SIN_COINCIDENCIAS}</p>`
      return
    }
    lista.innerHTML = `<ul class="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-700">${visibles.map((item) => `
      <li class="flex min-w-0 flex-wrap items-baseline justify-between gap-2 px-3 py-2 text-sm">
        <span class="font-medium">${escapeHtml(item.nombreCompleto || 'Empleado')}</span>
        <span class="text-slate-500">${escapeHtml([item.legajo ? `Legajo ${item.legajo}` : '', `Inicio ${fechaCorta(item.fechaInicio)}`, item.fechaFin ? `Fin ${fechaCorta(item.fechaFin)}` : 'Vigencia abierta'].filter(Boolean).join(' · '))}</span>
      </li>`).join('')}</ul>`
  }

  function pintar() {
    const modo = fase === 'ok' ? (asignados.length ? 'lista' : 'vacio') : fase
    if (toolbar.dataset.modo !== modo) {
      toolbar.dataset.modo = modo
      if (modo === 'lista') {
        toolbar.innerHTML = `
          <label class="block min-w-0" for="turno-buscar-asignados">
            <span class="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Buscar entre asignados</span>
            <input id="turno-buscar-asignados" data-buscar type="search" value="${escapeHtml(filtro)}" class="h-10 w-full min-w-0 rounded-lg border border-slate-200 px-3 text-sm text-slate-900 focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-500/20 focus-visible:outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100" placeholder="Nombre, apellido o legajo" />
          </label>`
        toolbar.querySelector('[data-buscar]').addEventListener('input', (event) => {
          filtro = event.target.value
          pintarLista()
        })
      } else if (modo === 'vacio') {
        toolbar.innerHTML = `<p class="min-w-0 text-sm text-slate-600 dark:text-slate-300" role="status">${NOMINA_VACIA}</p>`
      } else if (modo === 'mantenimiento') {
        toolbar.replaceChildren()
      } else {
        toolbar.innerHTML = ''
      }
    }
    pintarLista()
    ocultarSiVacio()
  }

  function fijarAcciones(bloquear) {
    host.parentElement?.querySelector('[data-asignar-turno]')?.toggleAttribute('disabled', bloquear || estado?.asignar === false)
    form?.querySelector('[type="submit"]')?.toggleAttribute('disabled', bloquear)
    form?.querySelector('[data-delete-turno]')?.toggleAttribute('disabled', bloquear)
    form?.querySelector('[data-gestionar-empleados]')?.toggleAttribute('disabled', bloquear)
  }

  function aplicarEstado(next) {
    estado = next
    fase = next.tipo
    fijarAcciones(next.tipo === 'ausente')
    if (next.tipo === 'sesion') return
    toolbar.dataset.modo = ''
    pintar()
  }

  async function cargar() {
    fase = 'cargando'
    estado = null
    toolbar.dataset.modo = ''
    pintar()
    const turnoId = idTurnoValido(turno?.id)
    if (!turnoId) {
      aplicarEstado(clasificarEstadoNomina({ status: 404, turnoExiste: false }))
      return
    }
    try {
      asignados = await getTurnoEmpleados(turnoId)
      fase = 'ok'
      estado = null
      fijarAcciones(false)
      toolbar.dataset.modo = ''
      pintar()
      onCantidad?.(asignados.length)
    } catch (error) {
      if (error?.status === 401) return
      let turnoExiste = null
      if (error?.status === 404) {
        try {
          const existencia = await consultarTurnoExistente(turnoId)
          if (existencia === 'existe') turnoExiste = true
          else if (existencia === 'ausente') turnoExiste = false
          else if (existencia === 'restringido') {
            aplicarEstado(clasificarEstadoNomina({ status: 403 }))
            return
          } else {
            aplicarEstado(clasificarEstadoNomina({ status: 500 }))
            return
          }
        } catch (probeError) {
          if (probeError?.status === 401) return
          aplicarEstado(clasificarEstadoNomina({ status: probeError?.status || 0 }))
          return
        }
      }
      aplicarEstado(clasificarEstadoNomina({ status: error?.status || 0, turnoExiste }))
    }
  }

  host.limpiar = () => {
    filtro = ''
    const input = host.querySelector('[data-buscar]')
    if (input) input.value = ''
    if (fase === 'ok') pintarLista()
  }
  host.abrirAsignacion = () => {
    openAsignar(turno, fase === 'ok' ? asignados : null, () => cargar())
  }
  cargar()
}

function openGestionarEmpleados(turno, form, onCantidad, onDismiss) {
  if (!puedeAdministrarTurnos(getCurrentUser()) || !idTurnoValido(turno?.id)) return null
  if (document.querySelector('[data-gestionar-empleados-panel]')) return null
  const content = document.createElement('div')
  content.dataset.gestionarEmpleadosPanel = 'true'
  content.className = 'flex min-h-0 w-full min-w-0 flex-col gap-3 overflow-x-hidden'
  content.innerHTML = `
    <p class="shrink-0 text-sm text-slate-600 dark:text-slate-300">Turno: <span class="font-medium text-slate-900 dark:text-slate-100">${escapeHtml(turno.nombre || 'turno')}</span></p>
    <div data-asignados class="flex min-h-0 min-w-0 flex-col gap-3 overflow-hidden"></div>
    <div class="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-3 dark:border-slate-700">
      <button type="button" data-asignar-turno class="${BTN_SECONDARY_CLASS} h-10 gap-1.5 px-3">${iconUsers('h-4 w-4')}<span>Asignar empleados</span></button>
      <button type="button" data-cerrar class="${BTN_SECONDARY_CLASS} h-10 px-3">Cerrar</button>
    </div>
  `
  const host = content.querySelector('[data-asignados]')
  mountAsignados(host, turno, { onCantidad, form })
  const modal = openModal({
    title: 'Gestionar empleados',
    content,
    stacked: true,
    labelledBy: 'gestionar-empleados-titulo',
    closeOnBackdrop: false,
    unsavedChanges: false,
    scrollBody: false,
    dialogClass: 'max-w-lg',
    onClose: () => {
      host.limpiar?.()
      onDismiss?.()
      const opener = form?.querySelector('[data-gestionar-empleados]')
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus()
    },
  })
  const asignar = content.querySelector('[data-asignar-turno]')
  asignar.addEventListener('click', () => {
    if (asignar.disabled) return
    host.abrirAsignacion?.()
  })
  content.querySelector('[data-cerrar]').addEventListener('click', () => modal.close())
  return modal
}

function openAsignar(turno, nomina, onDone) {
  let empleados = []
  let asignando = false
  let filtro = ''
  const seleccion = new Set()
  const quitar = new Set()
  const asignadosPorId = new Map((Array.isArray(nomina) ? nomina : []).map((item) => [item.empleadoId, item]))
  const content = document.createElement('form')
  content.className = 'min-w-0 space-y-3 overflow-x-hidden'
  content.innerHTML = `
    <p class="text-sm text-slate-600 dark:text-slate-300">Turno: <span class="font-medium text-slate-900 dark:text-slate-100">${escapeHtml(turno.nombre || 'turno')}</span></p>
    <label class="block min-w-0">
      <span class="mb-1 block text-sm font-medium">Buscar empleados</span>
      <input data-buscar name="buscar" type="search" class="h-10 w-full min-w-0 rounded-lg border border-slate-200 px-3 text-sm focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-500/20 focus-visible:outline-none dark:border-slate-600 dark:bg-slate-900" placeholder="Nombre, apellido, legajo o documento" />
    </label>
    <div class="flex min-w-0 items-center justify-between gap-2">
      <label class="flex min-w-0 items-center gap-2 text-sm" for="asignar-seleccionar-todos">
        <input id="asignar-seleccionar-todos" data-seleccionar-todos type="checkbox" class="h-4 w-4 rounded border-slate-300 text-blue-600 focus-visible:ring-2 focus-visible:ring-blue-500" />
        <span>Seleccionar todos los resultados</span>
      </label>
      <p data-contador class="shrink-0 text-sm text-slate-500" aria-live="polite">0 seleccionados</p>
    </div>
    <div data-resultado class="max-h-52 min-w-0 space-y-1 overflow-x-hidden overflow-y-auto"></div>
    <div class="grid gap-3 sm:grid-cols-2">
      <label class="block min-w-0">
        <span class="mb-1 block text-sm font-medium">Fecha de inicio</span>
        <input name="fechaInicio" type="date" required class="h-10 w-full min-w-0 rounded-lg border border-slate-200 px-3 text-sm dark:border-slate-600 dark:bg-slate-900" />
      </label>
      <label class="block min-w-0">
        <span class="mb-1 block text-sm font-medium">Fecha de finalización</span>
        <input name="fechaFin" type="date" class="h-10 w-full min-w-0 rounded-lg border border-slate-200 px-3 text-sm dark:border-slate-600 dark:bg-slate-900" />
      </label>
    </div>
    <p class="text-xs text-slate-500">Si la fecha final queda vacía, la vigencia queda abierta. Una asignación vigente anterior se cierra el día previo al nuevo inicio, o el servicio rechaza el cruce.</p>
    <p data-error class="hidden text-sm text-red-600" role="alert"></p>
    <div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <button type="button" data-cancel class="${BTN_SECONDARY_CLASS} h-10 justify-center">Cancelar</button>
      <button type="submit" class="${CONFIRM_PRIMARY_CLASS} h-10">Revisar cambios</button>
    </div>
  `
  const resultado = content.querySelector('[data-resultado]')
  const error = content.querySelector('[data-error]')
  const todos = content.querySelector('[data-seleccionar-todos]')
  const contador = content.querySelector('[data-contador]')

  function mostrarError(message) {
    error.textContent = message
    error.classList.toggle('hidden', !message)
  }

  function visibles() {
    return empleados.filter((empleado) => coincideEmpleadoTurno(empleado, filtro))
  }

  function sincronizarSeleccion() {
    const estado = estadoMarcadoTurno(visibles(), seleccion, quitar)
    todos.checked = estado.marcado
    todos.indeterminate = estado.indeterminado
    todos.disabled = estado.deshabilitado
    todos.setAttribute('aria-checked', estado.indeterminado ? 'mixed' : String(estado.marcado))
    contador.textContent = textoCantidadCambiosTurno({ asignar: seleccion.size, quitar: quitar.size })
  }

  function pintar() {
    const lista = visibles()
    if (!lista.length) {
      resultado.innerHTML = `<p class="text-sm text-slate-500">${empleados.length ? 'No hay empleados para esa búsqueda.' : 'No hay empleados activos para asignar.'}</p>`
      sincronizarSeleccion()
      return
    }
    resultado.innerHTML = lista.map((empleado) => {
      const marcado = marcadoEnTurno(empleado, seleccion, quitar)
      const bloqueado = empleado.activo === false
      return `
      <label class="flex min-w-0 items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-800">
        <input type="checkbox" name="empleadoId" value="${empleado.id}" class="h-4 w-4 rounded border-slate-300 text-blue-600 focus-visible:ring-2 focus-visible:ring-blue-500" ${marcado ? 'checked' : ''} ${bloqueado ? 'disabled' : ''} />
        <span class="min-w-0 break-words">${escapeHtml(nombreEmpleado(empleado))}${empleado.legajo ? ` · ${escapeHtml(empleado.legajo)}` : ''}</span>
        ${empleado.yaAsignado ? '<span class="shrink-0 text-xs text-slate-500">Ya asignado</span>' : ''}
      </label>`
    }).join('')
    sincronizarSeleccion()
  }

  async function cargar() {
    resultado.innerHTML = '<p class="text-sm text-slate-500">Cargando empleados...</p>'
    try {
      empleados = (await getEmpleados()).filter((empleado) => empleado.activo !== false).map((empleado) => {
        const asignado = asignadosPorId.get(empleado.id)
        return {
          ...empleado,
          yaAsignado: Boolean(asignado),
          fechaInicioAsignacion: asignado?.fechaInicio || '',
        }
      })
      pintar()
    } catch (loadError) {
      if (loadError.status === 401) return
      resultado.innerHTML = ''
      const message = document.createElement('p')
      message.className = 'text-sm text-red-600'
      message.textContent = loadError.status === 403 ? 'Acceso restringido.' : 'No se pudieron consultar los empleados.'
      const retry = document.createElement('button')
      retry.type = 'button'
      retry.className = `${BTN_SECONDARY_CLASS} mt-2 h-10`
      retry.textContent = 'Reintentar'
      retry.addEventListener('click', () => cargar())
      resultado.append(message, retry)
      todos.disabled = true
    }
  }

  content.querySelector('[data-buscar]').addEventListener('input', (event) => {
    filtro = event.target.value
    pintar()
  })
  todos.addEventListener('change', () => {
    const next = aplicarMarcadoTurno(visibles(), seleccion, quitar, todos.checked)
    seleccion.clear()
    quitar.clear()
    next.seleccion.forEach((id) => seleccion.add(id))
    next.quitar.forEach((id) => quitar.add(id))
    pintar()
  })
  resultado.addEventListener('change', (event) => {
    const input = event.target
    if (!(input instanceof HTMLInputElement) || input.name !== 'empleadoId' || input.disabled) return
    const id = Number(input.value)
    const empleado = empleados.find((candidato) => candidato.id === id)
    if (esEmpleadoDesasignable(empleado)) {
      if (input.checked) quitar.delete(id)
      else quitar.add(id)
    } else if (input.checked) seleccion.add(id)
    else seleccion.delete(id)
    sincronizarSeleccion()
  })

  const modal = openModal({
    title: 'Asignar empleados',
    content,
    stacked: true,
    closeOnBackdrop: false,
    unsavedChanges: true,
    dialogClass: 'max-w-lg',
    onClose: () => {
      document.querySelector('[data-asignar-turno]')?.focus()
    },
  })
  content.querySelector('[data-cancel]').addEventListener('click', () => modal.close())
  content.addEventListener('submit', async (event) => {
    event.preventDefault()
    if (asignando) return
    const elegidos = empleados.filter((empleado) => esEmpleadoElegible(empleado) && seleccion.has(empleado.id))
    const aQuitar = empleados.filter((empleado) => esEmpleadoDesasignable(empleado) && quitar.has(empleado.id))
    const fechaInicio = content.fechaInicio.value
    const fechaFin = content.fechaFin.value
    if (!elegidos.length && !aQuitar.length) {
      mostrarError('Seleccioná un empleado para asignar o desmarcá uno para quitarlo del turno.')
      return
    }
    if (elegidos.length && !fechaInicio) {
      mostrarError('Indicá la fecha de inicio.')
      return
    }
    if (elegidos.length && fechaFin && fechaFin < fechaInicio) {
      mostrarError('La fecha final no puede ser anterior al inicio.')
      return
    }
    mostrarError('')
    asignando = true
    const submit = content.querySelector('[type="submit"]')
    submit.disabled = true
    const hoy = hoyLocal()
    const bajas = aQuitar.map((empleado) => ({
      id: empleado.id,
      nombre: nombreEmpleado(empleado),
      fechaInicio: empleado.fechaInicioAsignacion,
      fechaFin: fechaCierreDesasignacion(empleado.fechaInicioAsignacion, hoy),
    }))
    if (bajas.some((item) => !item.fechaFin)) {
      mostrarError('No se pudo determinar hasta cuándo sigue asignado el empleado.')
      asignando = false
      submit.disabled = false
      return
    }
    const confirmado = await confirmarAsignacion({
      turno,
      cantidad: elegidos.length,
      fechaInicio,
      fechaFin,
      nombres: elegidos.map(nombreEmpleado),
      bajas,
    })
    if (!confirmado) {
      asignando = false
      submit.disabled = false
      return
    }
    submit.setAttribute('aria-busy', 'true')
    const resultados = []
    for (const empleado of elegidos) {
      try {
        await assignTurno(empleado.id, { turnoId: turno.id, fechaInicio, fechaFin: fechaFin || null })
        resultados.push({ ok: true, accion: 'asignar', empleadoId: empleado.id })
      } catch (assignError) {
        resultados.push({ ok: false, accion: 'asignar', status: assignError.status, message: assignError.message, empleadoId: empleado.id })
      }
    }
    for (const baja of bajas) {
      try {
        await assignTurno(baja.id, { turnoId: turno.id, fechaInicio: baja.fechaInicio, fechaFin: baja.fechaFin })
        resultados.push({ ok: true, accion: 'quitar', empleadoId: baja.id })
      } catch (assignError) {
        resultados.push({ ok: false, accion: 'quitar', status: assignError.status, message: assignError.message, empleadoId: baja.id })
      }
    }
    for (const item of resultados) {
      if (!item.ok) continue
      const empleado = empleados.find((candidato) => candidato.id === item.empleadoId)
      if (item.accion === 'quitar') {
        quitar.delete(item.empleadoId)
        if (empleado) {
          empleado.yaAsignado = false
          empleado.fechaInicioAsignacion = ''
        }
      } else {
        seleccion.delete(item.empleadoId)
        if (empleado) empleado.yaAsignado = true
      }
    }
    pintar()
    const resumen = textoResultadoCambiosTurno(resultados)
    asignando = false
    submit.disabled = false
    submit.removeAttribute('aria-busy')
    if (resumen.parcial || resultados.some((item) => item.ok)) await onDone?.()
    if (resumen.parcial || resultados.every((item) => !item.ok)) {
      mostrarError(resumen.mensaje)
      return
    }
    showToast({ message: resumen.mensaje, tone: 'success' })
    modal.close({ force: true })
  })
  cargar()
}

function confirmarAsignacion({ turno, cantidad, fechaInicio, fechaFin, nombres, bajas = [] }) {
  return new Promise((resolve) => {
    let settled = false
    let busy = false
    const content = document.createElement('div')
    const copy = document.createElement('p')
    copy.className = 'text-sm text-slate-700 dark:text-slate-200'
    copy.textContent = textoConfirmacionCambiosTurno({
      nombre: turno.nombre,
      altas: cantidad ? { cantidad, fechaInicio, fechaFin, nombres } : null,
      bajas,
    })
    const detail = document.createElement('p')
    detail.className = 'mt-2 text-sm text-slate-500'
    detail.textContent = cantidad
      ? 'Si ya hay una asignación que se cruza, el servicio la cierra el día anterior o informa el conflicto. No se reemplaza sin esta confirmación.'
      : 'Quitar cierra la vigencia en este turno. No se borra el historial de días ya trabajados.'
    const actions = document.createElement('div')
    actions.className = 'mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end'
    const cancel = document.createElement('button')
    cancel.type = 'button'
    cancel.className = BTN_SECONDARY_CLASS
    cancel.textContent = 'Volver'
    const confirm = document.createElement('button')
    confirm.type = 'button'
    confirm.className = CONFIRM_PRIMARY_CLASS
    confirm.textContent = cantidad && bajas.length ? 'Confirmar cambios' : bajas.length ? 'Quitar del turno' : 'Confirmar asignación'
    actions.append(cancel, confirm)
    content.append(copy, detail, actions)
    const finish = (value) => {
      if (settled) return
      settled = true
      modal.close({ force: true })
      resolve(value)
    }
    const modal = openModal({
      title: cantidad && bajas.length ? 'Confirmar cambios' : bajas.length ? 'Quitar del turno' : 'Confirmar asignación',
      content,
      stacked: true,
      closeOnBackdrop: false,
      unsavedChanges: false,
      canClose: () => !busy,
      onClose: () => {
        if (!settled) {
          settled = true
          resolve(false)
        }
      },
    })
    cancel.addEventListener('click', () => {
      if (busy || settled) return
      finish(false)
    })
    confirm.addEventListener('click', () => {
      if (busy || settled) return
      busy = true
      confirm.disabled = true
      cancel.disabled = true
      finish(true)
    })
  })
}
export function presentarFilaTurno(turno) {
  const dias = Array.isArray(turno?.dias) ? turno.dias : []
  return {
    vacio: dias.length === 0,
    texto: textoDiasConfigurados(dias),
    horario: dias.length ? textoHorarioHabitual(dias) : '—',
    horas: textoHorasSemanales(dias),
    empleados: textoEmpleadosAsignados(turno?.cantidadEmpleadosAsignados),
  }
}

function renderTable(turnos, canWrite, host, reload, onSaved) {
  if (!turnos.length) {
    host.innerHTML = `<div class="${SHELL} px-4 py-10 text-center"><p class="text-sm font-semibold">No hay turnos cargados</p><p class="mt-1 text-sm text-slate-500">Cuando existan turnos de la empresa van a aparecer en esta tabla.</p></div>`
    return
  }
  const section = document.createElement('div')
  section.className = SHELL
  const head = 'bg-slate-50 text-xs font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400'
  const columns = canWrite ? TURNOS_COLUMNS : 'md:grid-cols-[minmax(0,1.2fr)_minmax(0,0.7fr)_minmax(0,1.5fr)_minmax(0,0.9fr)_minmax(0,1fr)]'
  const desktop = document.createElement('div')
  desktop.className = 'hidden md:block'
  desktop.innerHTML = `
    <div role="table" class="grid w-full min-w-0 ${columns} text-sm">
      <div role="row" class="contents">
        <div role="columnheader" class="${CELL} ${head}">Nombre</div>
        <div role="columnheader" class="${CELL_CENTER} ${head}">Días</div>
        <div role="columnheader" class="${CELL} ${head}">Horario habitual</div>
        <div role="columnheader" class="${CELL_CENTER} ${head}">Horas semanales</div>
        <div role="columnheader" class="${CELL} ${head}">Empleados asignados</div>
        ${canWrite ? `<div role="columnheader" class="${CELL} text-right ${head}">Acciones</div>` : ''}
      </div>
    </div>
  `
  const grid = desktop.querySelector('[role="table"]')
  const cards = document.createElement('div')
  cards.className = 'space-y-2 p-3 md:hidden'
  turnos.forEach((turno) => {
    const fila = presentarFilaTurno(turno)
    const dias = fila.vacio ? 'Sin días configurados' : fila.texto
    const row = document.createElement('div')
    row.setAttribute('role', 'row')
    row.className = 'contents'
    const acciones = canWrite
      ? `<div role="cell" class="${CELL} border-t border-slate-100 text-right dark:border-slate-800">${actionButtonMarkup({ label: 'Editar', ariaLabel: 'Editar turno', attrs: 'data-edit', compact: true })}</div>`
      : ''
    row.innerHTML = `
      <div role="cell" class="${CELL} border-t border-slate-100 font-medium dark:border-slate-800">${escapeHtml(turno.nombre)}</div>
      <div role="cell" class="${CELL_CENTER} border-t border-slate-100 dark:border-slate-800">${escapeHtml(dias)}</div>
      <div role="cell" class="${CELL} border-t border-slate-100 dark:border-slate-800">${escapeHtml(fila.horario)}</div>
      <div role="cell" class="${CELL_CENTER} border-t border-slate-100 dark:border-slate-800">${escapeHtml(fila.horas)}</div>
      <div role="cell" class="${CELL} border-t border-slate-100 dark:border-slate-800">${escapeHtml(fila.empleados)}</div>
      ${acciones}
    `
    row.querySelector('[data-edit]')?.addEventListener('click', () => openEditor(turno, reload, onSaved))
    grid.append(row)

    const card = document.createElement('article')
    card.className = 'rounded-lg border border-slate-200 p-3 dark:border-slate-700'
    card.innerHTML = `
      <div class="flex items-start justify-between gap-2">
        <h3 class="text-sm font-medium">${escapeHtml(turno.nombre)}</h3>
        ${canWrite ? actionButtonMarkup({ label: 'Editar', ariaLabel: 'Editar turno', attrs: 'data-edit', compact: true }) : ''}
      </div>
      <dl class="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
        <dt class="text-slate-500">Días</dt><dd>${escapeHtml(dias)}</dd>
        <dt class="text-slate-500">Horario habitual</dt><dd class="break-words">${escapeHtml(fila.horario)}</dd>
        <dt class="text-slate-500">Horas semanales</dt><dd>${escapeHtml(fila.horas)}</dd>
        <dt class="text-slate-500">Empleados asignados</dt><dd>${escapeHtml(fila.empleados)}</dd>
      </dl>
    `
    card.querySelector('[data-edit]')?.addEventListener('click', () => openEditor(turno, reload, onSaved))
    cards.append(card)
  })
  section.append(desktop, cards)
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
    confirm.className = `${CONFIRM_DESTRUCTIVE_CLASS} inline-flex h-10 items-center justify-center gap-2`
    confirm.innerHTML = `${iconTrash('h-4 w-4')}<span>Eliminar turno</span>`
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
      confirm.querySelector('span').textContent = 'Eliminando…'
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
  const cantidadInicial = turno?.cantidadEmpleadosAsignados
  const form = turnoForm(turno, {
    canAssign: puedeAdministrarTurnos(getCurrentUser()),
    onCantidad(cantidad) {
      if (turno) turno.cantidadEmpleadosAsignados = cantidad
    },
  })
  const error = form.querySelector('[data-error]')
  let deleting = false
  let saving = false
  let saved = false
  const modal = openFormModal({
    title: turno ? 'Editar turno' : 'Nuevo turno',
    content: form,
    dialogClass: '!w-fit max-w-[min(48rem,calc(100vw-2rem))]',
    scrollBody: false,
    onClose: () => {
      form.cerrarGestion?.()
      form.querySelectorAll('[data-turno-hora]').forEach((field) => field.destroy?.())
      form.querySelectorAll('[data-dia-row]').forEach((row) => row._descansoDestroy?.())
      if (!saved && turno?.id && turno.cantidadEmpleadosAsignados !== cantidadInicial) reload()
    },
  })
  form.querySelector('[data-cancel]').addEventListener('click', () => modal.close())
  form.querySelector('[data-delete-turno]')?.addEventListener('click', async () => {
    if (deleting || saving || !turno?.id) return
    deleting = true
    const button = form.querySelector('[data-delete-turno]')
    const submit = form.querySelector('[type="submit"]')
    const gestionar = form.querySelector('[data-gestionar-empleados]')
    button.disabled = true
    if (submit) submit.disabled = true
    if (gestionar) gestionar.disabled = true
    const outcome = await openEliminarTurnoConfirm(turno.nombre || 'turno', () => deleteTurno(turno.id))
    deleting = false
    if (!outcome || outcome.cancelled) {
      button.disabled = false
      if (submit) submit.disabled = false
      if (gestionar) gestionar.disabled = false
      return
    }
    const decision = decidirEliminacionTurno(outcome.ok ? null : outcome.error)
    if (decision.session) {
      button.disabled = false
      if (submit) submit.disabled = false
      if (gestionar) gestionar.disabled = false
      return
    }
    aplicarResultadoEliminacion(error, decision)
    if (decision.closeEditor) modal.close({ force: true })
    if (decision.reload) reload()
    if (!decision.closeEditor) {
      button.disabled = false
      if (submit) submit.disabled = false
      if (gestionar) gestionar.disabled = false
    }
  })
  form.addEventListener('submit', async (event) => {
    event.preventDefault()
    if (saving) return
    if (deleting) return
    const body = form.collect()
    if (!body) return
    saving = true
    const submit = form.querySelector('[type="submit"]')
    const removeButton = form.querySelector('[data-delete-turno]')
    const gestionar = form.querySelector('[data-gestionar-empleados]')
    const submitText = submit.textContent
    submit.disabled = true
    submit.setAttribute('aria-busy', 'true')
    submit.textContent = 'Guardando…'
    if (removeButton) removeButton.disabled = true
    if (gestionar) gestionar.disabled = true
    try {
      const guardado = turno?.id
        ? (await updateTurno(turno.id, body), { ...turno, ...body, id: turno.id })
        : await createTurno(body)
      const row = guardado?.id
        ? { ...guardado, ...body, id: guardado.id, dias: guardado.dias?.length ? guardado.dias : body.dias }
        : { ...body, cantidadEmpleadosAsignados: 0 }
      showToast({ message: turno?.id ? 'Turno actualizado.' : 'Turno creado.', tone: 'success' })
      saved = true
      modal.close({ force: true })
      if (onSaved) onSaved(row)
      else reload()
    } catch (saveError) {
      if (saveError.status !== 401) {
        error.textContent = saveError.status === 403
          ? 'Acceso restringido.'
          : (saveError.message || 'No se pudo guardar el turno.')
        error.classList.remove('hidden')
      }
    } finally {
      saving = false
      if (form.isConnected) {
        submit.disabled = false
        submit.textContent = submitText
        submit.removeAttribute('aria-busy')
        if (removeButton && !deleting) removeButton.disabled = false
        if (gestionar && !deleting) gestionar.disabled = false
      }
    }
  })
}

export function createTurnosPanel({ context = '' } = {}) {
  const root = document.createElement('section')
  root.className = 'w-full min-w-0 space-y-4 overflow-x-hidden'
  const header = document.createElement('div')
  const filters = document.createElement('div')
  filters.className = ADMIN_FILTER_GRID_CLASS
  filters.innerHTML = `
    <div class="min-w-0">
      <label for="admin-turnos-search" class="${FORM_LABEL_CLASS}">Buscar</label>
      <input id="admin-turnos-search" type="search" placeholder="Nombre del turno" class="${FORM_INPUT_CLASS} ${ADMIN_FIELD_CONTROL_CLASS}" />
    </div>
    <button type="button" id="admin-turnos-clear" class="${BTN_SECONDARY_CLASS} h-10" disabled>Limpiar</button>
  `
  const host = document.createElement('div')
  host.className = 'min-w-0 overflow-x-hidden'
  root.append(header, filters, host)
  let listaTurnos = []
  let puedeEscribir = false
  let busqueda = ''
  const search = filters.querySelector('#admin-turnos-search')
  const clear = filters.querySelector('#admin-turnos-clear')

  function turnosVisibles() {
    const query = busqueda.trim().toLowerCase()
    if (!query) return listaTurnos
    return listaTurnos.filter((turno) => String(turno?.nombre ?? '').toLowerCase().includes(query))
  }

  function syncHeader() {
    header.innerHTML = adminSectionHeaderMarkup({
      titleId: 'admin-turnos-title',
      title: 'Turnos de trabajo',
      description: 'Configurá las jornadas y asignaciones de la nómina.',
      context,
    })
    if (!puedeEscribir) return
    const button = document.createElement('button')
    button.type = 'button'
    button.className = ADMIN_PRIMARY_BUTTON_CLASS
    button.innerHTML = `${iconPlus('h-4 w-4')}<span>Nuevo turno</span>`
    button.addEventListener('click', () => openEditor(null, () => load(false), aplicarTurnoGuardado))
    header.querySelector('[data-admin-action]')?.append(button)
  }

  function mostrarTurnos(turnos = listaTurnos) {
    listaTurnos = turnos
    syncHeader()
    const visibles = turnosVisibles()
    if (!listaTurnos.length) {
      host.replaceChildren(createAdminEmptyState({
        title: 'No hay turnos de trabajo',
        detail: 'Todavía no hay registros disponibles.',
        actionLabel: puedeEscribir ? '+ Nuevo turno' : '',
        onAction: puedeEscribir ? () => openEditor(null, () => load(false), aplicarTurnoGuardado) : undefined,
      }))
      return
    }
    if (!visibles.length) {
      host.replaceChildren(createAdminEmptyState({
        title: 'No encontramos resultados',
        detail: 'Probá cambiar o limpiar los filtros aplicados.',
        actionLabel: 'Limpiar filtros',
        onAction: () => clear.click(),
      }))
      return
    }
    renderTable(visibles, puedeEscribir, host, () => load(false), aplicarTurnoGuardado)
  }

  search.addEventListener('input', () => {
    busqueda = search.value
    clear.disabled = !busqueda.trim()
    mostrarTurnos()
  })
  clear.addEventListener('click', () => {
    busqueda = ''
    search.value = ''
    clear.disabled = true
    mostrarTurnos()
  })

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
      puedeEscribir = false
      syncHeader()
      host.replaceChildren(panelForCapability(read, { onRetry: () => load(true) }))
      return
    }
    const write = await resolveCapability(CAPABILITY.turnosWrite, { force })
    puedeEscribir = write.status === CAPABILITY_STATUS.available && puedeAdministrarTurnos(user)
    syncHeader()
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
  syncHeader()
  bindTooltipRoot(root)
  return root
}
