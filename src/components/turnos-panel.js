import { CAPABILITY, CAPABILITY_STATUS, resolveCapability } from '../api/capabilities.js'
import { getCurrentUser } from '../api/auth.js'
import { getEmpleados } from '../api/empleados.js'
import { assignTurno } from '../api/jornadas.js'
import { consultarTurnoExistente, createTurno, deleteTurno, getTurnoEmpleados, getTurnos, updateTurno } from '../api/turnos.js'
import { puedeAdministrarTurnos } from '../config/labor-access.js'
import { escapeHtml } from '../utils/format.js'
import {
  ACCESOS_DESCANSO,
  aplicarSeleccionVisible,
  clasificarEstadoNomina,
  coincideAsignadoTurno,
  coincideEmpleadoTurno,
  esEmpleadoElegible,
  estadoSeleccionVisible,
  NOMINA_SIN_COINCIDENCIAS,
  NOMINA_VACIA,
  notaDescanso,
  parseMinutosAlmuerzo,
  textoCantidadSeleccionada,
  textoConfirmacionAsignacion,
  textoDiasConfigurados,
  textoEmpleadosAsignados,
  textoHorarioHabitual,
  textoHorasSemanales,
  textoJornadaNeta,
  textoResultadoAsignacion,
  validarTramoTurno,
  valorCampoDescanso,
  horaTexto,
} from '../utils/turno-presentacion.js'
import { actionButtonMarkup, BTN_SECONDARY_CLASS, createActionButton } from './button-styles.js'
import { enhanceSelectsIn } from './dropdown.js'
import { createTurnoHoraField } from './turno-hora-field.js'
import { iconPlus } from './icons.js'
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
const SHELL = 'w-full min-w-0 max-w-full overflow-x-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900'
const TURNOS_COLUMNS = 'md:grid-cols-[minmax(0,1.2fr)_minmax(0,0.7fr)_minmax(0,1.5fr)_minmax(0,0.9fr)_minmax(0,1fr)_auto]'
const DIA_COLUMNS = 'md:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)_minmax(0,0.85fr)_minmax(0,0.95fr)_minmax(0,0.8fr)_auto]'
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

const HORAS_CAMPO = 'flex h-10 w-full min-w-0 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm dark:border-slate-600 dark:bg-slate-950'
const SUFIJO_CAMPO = 'inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-900'
const SUFIJO_INPUT = 'border-0 bg-transparent p-0 text-sm outline-none [appearance:textfield] dark:bg-transparent [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none'

let secuenciaDescanso = 0

function fijarOpcion(select, value) {
  if (!select) return
  const text = String(value)
  if (![...select.options].some((option) => option.value === text)) return
  select.value = text
}

function turnoForm(initial, { canAssign = false } = {}) {
  const form = document.createElement('form')
  form.className = 'flex min-h-0 flex-col gap-3'
  const dias = initial?.dias?.length ? initial.dias : [{ diaSemana: 1, horaEntrada: '09:00', horaSalida: '18:00', minutosAlmuerzo: 60 }]
  const fieldLabel = 'mb-1 inline-flex min-h-5 items-center gap-1 text-sm font-medium leading-5 text-slate-700 dark:text-slate-200'
  const controlClass = 'h-10 w-full min-w-0 rounded-lg border border-slate-200 px-3 text-sm dark:border-slate-600 dark:bg-slate-900'
  const submitLabel = initial?.id ? 'Guardar' : 'Crear turno'
  const mostrarAsignar = Boolean(initial?.id) && canAssign
  form.innerHTML = `
    <div class="grid w-full shrink-0 grid-cols-1 items-end justify-start gap-4 ${mostrarAsignar ? 'sm:grid-cols-[minmax(240px,320px)_100px_minmax(0,1fr)]' : 'sm:w-fit sm:grid-cols-[minmax(240px,320px)_100px]'}">
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
      ${mostrarAsignar ? `<div class="sm:justify-self-end"><button type="button" data-asignar-turno class="${BTN_SECONDARY_CLASS} h-10 w-full shrink-0 justify-center sm:w-auto">Asignar empleados</button></div>` : ''}
    </div>
    <div data-scroll class="min-h-0 max-h-[min(58vh,34rem)] space-y-3 overflow-y-auto overflow-x-hidden pr-1">
      <div class="space-y-2 border-t border-slate-200 pt-3 dark:border-slate-700">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <h3 class="text-sm font-semibold text-slate-800 dark:text-slate-100">Días y horarios</h3>
          <button type="button" data-add-day class="${BTN_SECONDARY_CLASS} h-8 shrink-0 gap-1.5 px-2.5 text-[13px]">${iconPlus('h-3.5 w-3.5')}<span>Agregar día</span></button>
        </div>
        <div class="hidden text-xs font-medium text-slate-500 dark:text-slate-400 md:grid ${DIA_COLUMNS} md:gap-2">
          <span>Día</span><span>Entrada</span><span>Salida</span><span>Descanso</span><span>Horas netas</span><span class="sr-only">Quitar</span>
        </div>
        <div data-dias class="space-y-2"></div>
      </div>
      <div data-asignados></div>
    </div>
    <p data-error class="hidden shrink-0 text-sm text-red-600" role="alert"></p>
    <div class="flex shrink-0 flex-wrap items-center gap-2 border-t border-slate-200 pt-3 dark:border-slate-700">
      <div data-delete-slot class="w-full sm:w-auto"></div>
      <div class="ml-auto flex flex-wrap items-center justify-end gap-2 max-sm:w-full">
        <button type="button" data-cancel class="${BTN_SECONDARY_CLASS} h-10 w-full justify-center sm:w-auto">Cancelar</button>
        <button type="submit" class="inline-flex h-10 w-full items-center justify-center rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto">${submitLabel}</button>
      </div>
    </div>
  `
  const list = form.querySelector('[data-dias]')
  const dayLabel = 'mb-1 inline-flex min-h-5 items-center gap-1 text-xs font-medium leading-4 text-slate-500 dark:text-slate-400 md:sr-only'
  const dayControl = 'h-10 w-full min-w-0 rounded-lg border border-slate-200 px-2 text-sm dark:border-slate-600 dark:bg-slate-900'

  function paintHoras(row) {
    const input = row.querySelector('[name="minutosAlmuerzo"]')
    const nota = row.querySelector('[data-descanso-nota]')
    const valor = input?.value ?? ''
    if (nota) nota.textContent = notaDescanso(valor)
    row.querySelectorAll('[data-descanso-rapido]').forEach((button) => {
      button.setAttribute('aria-pressed', button.dataset.descansoRapido === String(valor).trim() ? 'true' : 'false')
    })
    const field = row.querySelector('[data-horas]')
    const resumen = textoJornadaNeta(
      row.querySelector('[name="horaEntrada"]')?.value,
      row.querySelector('[name="horaSalida"]')?.value,
      valor,
    )
    field.textContent = resumen
    field.className = `${HORAS_CAMPO} ${resumen === '—' ? 'text-slate-400' : 'font-medium text-emerald-700 dark:text-emerald-300'}`
  }

  function syncRemove() {
    const rows = [...list.children]
    rows.forEach((row) => {
      const button = row.querySelector('[data-remove-day]')
      if (button) button.hidden = rows.length < 2
    })
  }

  function addDay(dia = { diaSemana: 1, horaEntrada: '09:00', horaSalida: '18:00', minutosAlmuerzo: 60 }) {
    const row = document.createElement('div')
    const entrada = horaTexto(dia.horaEntrada)
    const salida = horaTexto(dia.horaSalida)
    const descanso = valorCampoDescanso(dia.minutosAlmuerzo)
    const notaId = `descanso-nota-${secuenciaDescanso += 1}`
    row.className = `grid w-full min-w-0 grid-cols-1 items-start gap-2 rounded-lg border border-slate-200 p-2 dark:border-slate-700 md:grid ${DIA_COLUMNS} md:items-start md:gap-2 md:rounded-none md:border-0 md:bg-transparent md:p-0`
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
        <span class="${SUFIJO_CAMPO} h-10 w-full">
          <input name="minutosAlmuerzo" type="number" min="0" step="1" inputmode="numeric" aria-label="Descanso" aria-describedby="${notaId}" class="${SUFIJO_INPUT} min-w-0 flex-1" value="${escapeHtml(descanso)}" />
          <span class="shrink-0 text-xs text-slate-500" aria-hidden="true">min</span>
        </span>
        <span id="${notaId}" data-descanso-nota class="mt-1 block min-h-4 text-[11px] leading-4 text-slate-500"></span>
        <span class="mt-1 flex flex-wrap gap-1" role="group" aria-label="Accesos rápidos de descanso">
          ${ACCESOS_DESCANSO.map((acceso) => `<button type="button" data-descanso-rapido="${acceso.minutos}" class="h-6 rounded-md border border-slate-200 px-1.5 text-[11px] font-medium leading-none text-slate-600 hover:border-blue-400 hover:text-blue-700 dark:border-slate-600 dark:text-slate-300">${escapeHtml(acceso.etiqueta)}</button>`).join('')}
        </span>
      </label>
      <div class="min-w-0">
        <span class="${dayLabel}">Horas netas</span>
        <div data-horas class="${HORAS_CAMPO} text-slate-400" role="status" aria-readonly="true" aria-live="polite">—</div>
      </div>
      <div class="min-w-0">
        <button type="button" data-remove-day class="${BTN_SECONDARY_CLASS} h-10 w-full justify-center px-2.5 md:w-auto">Quitar</button>
      </div>
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
    row.addEventListener('change', () => paintHoras(row))
    row.querySelector('[name="minutosAlmuerzo"]').addEventListener('input', () => paintHoras(row))
    row.querySelectorAll('[data-descanso-rapido]').forEach((button) => {
      button.addEventListener('click', () => {
        const input = row.querySelector('[name="minutosAlmuerzo"]')
        input.value = button.dataset.descansoRapido
        paintHoras(row)
      })
    })
    row.querySelector('[data-remove-day]').addEventListener('click', () => {
      row.querySelectorAll('select').forEach((select) => select._caSelect?.destroy())
      row.querySelectorAll('[data-turno-hora]').forEach((field) => field.destroy?.())
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
  if (initial?.id) {
    const asignadosHost = form.querySelector('[data-asignados]')
    mountAsignados(asignadosHost, initial)
    form.querySelector('[data-asignar-turno]')?.addEventListener('click', () => {
      if (form.querySelector('[data-asignar-turno]')?.disabled) return
      asignadosHost.abrirAsignacion?.()
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
  form.querySelector('[data-add-day]').addEventListener('click', () => addDay())
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
  bindTooltipRoot(form)
  return form
}

function fechaCorta(value) {
  const text = String(value ?? '')
  return text.length >= 10 ? text.slice(0, 10) : ''
}

function idTurnoValido(id) {
  const turnoId = Number(id)
  return Number.isInteger(turnoId) && turnoId > 0 ? turnoId : null
}

function nombreEmpleado(empleado) {
  return [empleado?.apellido, empleado?.nombre].filter(Boolean).join(', ') || empleado?.nombreCompleto || 'Empleado'
}

function mountAsignados(host, turno) {
  let asignados = []
  let fase = 'cargando'
  let filtro = ''
  let estado = null
  host.innerHTML = `
    <div data-toolbar class="min-w-0"></div>
    <div data-lista class="min-w-0"></div>
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
    const form = host.closest('form')
    form?.querySelector('[type="submit"]')?.toggleAttribute('disabled', bloquear)
    form?.querySelector('[data-delete-turno]')?.toggleAttribute('disabled', bloquear)
    form?.querySelector('[data-asignar-turno]')?.toggleAttribute('disabled', bloquear || estado?.asignar === false)
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

function openAsignar(turno, nomina, onDone) {
  let empleados = []
  let asignando = false
  let filtro = ''
  const seleccion = new Set()
  const asignadosIds = new Set((Array.isArray(nomina) ? nomina : []).map((item) => item.empleadoId))
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
      <button type="submit" class="${CONFIRM_PRIMARY_CLASS} h-10">Revisar asignación</button>
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
    const estado = estadoSeleccionVisible(visibles(), seleccion)
    todos.checked = estado.marcado
    todos.indeterminate = estado.indeterminado
    todos.disabled = estado.deshabilitado
    todos.setAttribute('aria-checked', estado.indeterminado ? 'mixed' : String(estado.marcado))
    contador.textContent = textoCantidadSeleccionada(seleccion.size)
  }

  function pintar() {
    const lista = visibles()
    if (!lista.length) {
      resultado.innerHTML = `<p class="text-sm text-slate-500">${empleados.length ? 'No hay empleados para esa búsqueda.' : 'No hay empleados activos para asignar.'}</p>`
      sincronizarSeleccion()
      return
    }
    resultado.innerHTML = lista.map((empleado) => {
      const elegido = esEmpleadoElegible(empleado)
      const marcado = empleado.yaAsignado || (elegido && seleccion.has(empleado.id))
      return `
      <label class="flex min-w-0 items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-800">
        <input type="checkbox" name="empleadoId" value="${empleado.id}" class="h-4 w-4 rounded border-slate-300 text-blue-600 focus-visible:ring-2 focus-visible:ring-blue-500" ${marcado ? 'checked' : ''} ${elegido ? '' : 'disabled'} />
        <span class="min-w-0 break-words">${escapeHtml(nombreEmpleado(empleado))}${empleado.legajo ? ` · ${escapeHtml(empleado.legajo)}` : ''}</span>
        ${empleado.yaAsignado ? '<span class="shrink-0 text-xs text-slate-500">Ya asignado</span>' : ''}
      </label>`
    }).join('')
    sincronizarSeleccion()
  }

  async function cargar() {
    resultado.innerHTML = '<p class="text-sm text-slate-500">Cargando empleados...</p>'
    try {
      empleados = (await getEmpleados()).filter((empleado) => empleado.activo !== false).map((empleado) => ({
        ...empleado,
        yaAsignado: Array.isArray(nomina) && asignadosIds.has(empleado.id),
      }))
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
    const next = aplicarSeleccionVisible(visibles(), seleccion, todos.checked)
    seleccion.clear()
    next.forEach((id) => seleccion.add(id))
    pintar()
  })
  resultado.addEventListener('change', (event) => {
    const input = event.target
    if (!(input instanceof HTMLInputElement) || input.name !== 'empleadoId' || input.disabled) return
    const id = Number(input.value)
    if (input.checked) seleccion.add(id)
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
    const fechaInicio = content.fechaInicio.value
    const fechaFin = content.fechaFin.value
    if (!elegidos.length) {
      mostrarError('Seleccioná al menos un empleado.')
      return
    }
    if (!fechaInicio) {
      mostrarError('Indicá la fecha de inicio.')
      return
    }
    if (fechaFin && fechaFin < fechaInicio) {
      mostrarError('La fecha final no puede ser anterior al inicio.')
      return
    }
    mostrarError('')
    asignando = true
    const submit = content.querySelector('[type="submit"]')
    submit.disabled = true
    const confirmado = await confirmarAsignacion({
      turno,
      cantidad: elegidos.length,
      fechaInicio,
      fechaFin,
      nombres: elegidos.map(nombreEmpleado),
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
        resultados.push({ ok: true, empleadoId: empleado.id })
      } catch (assignError) {
        resultados.push({ ok: false, status: assignError.status, message: assignError.message, empleadoId: empleado.id })
      }
    }
    for (const item of resultados) {
      if (!item.ok) continue
      seleccion.delete(item.empleadoId)
      const empleado = empleados.find((candidato) => candidato.id === item.empleadoId)
      if (empleado) empleado.yaAsignado = true
    }
    pintar()
    const resumen = textoResultadoAsignacion(resultados)
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

function confirmarAsignacion({ turno, cantidad, fechaInicio, fechaFin, nombres }) {
  return new Promise((resolve) => {
    let settled = false
    let busy = false
    const content = document.createElement('div')
    const copy = document.createElement('p')
    copy.className = 'text-sm text-slate-700 dark:text-slate-200'
    copy.textContent = textoConfirmacionAsignacion({
      nombre: turno.nombre,
      cantidad,
      fechaInicio,
      fechaFin,
      nombres,
    })
    const detail = document.createElement('p')
    detail.className = 'mt-2 text-sm text-slate-500'
    detail.textContent = 'Si ya hay una asignación que se cruza, el servicio la cierra el día anterior o informa el conflicto. No se reemplaza sin esta confirmación.'
    const actions = document.createElement('div')
    actions.className = 'mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end'
    const cancel = document.createElement('button')
    cancel.type = 'button'
    cancel.className = BTN_SECONDARY_CLASS
    cancel.textContent = 'Volver'
    const confirm = document.createElement('button')
    confirm.type = 'button'
    confirm.className = CONFIRM_PRIMARY_CLASS
    confirm.textContent = 'Confirmar asignación'
    actions.append(cancel, confirm)
    content.append(copy, detail, actions)
    const finish = (value) => {
      if (settled) return
      settled = true
      modal.close({ force: true })
      resolve(value)
    }
    const modal = openModal({
      title: 'Confirmar asignación',
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
  const head = 'bg-slate-50 text-xs font-medium uppercase tracking-wide text-slate-500 dark:bg-slate-800 dark:text-slate-400'
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
        ${canWrite ? `<div role="columnheader" class="${CELL} text-right ${head}">Acción</div>` : ''}
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
  const form = turnoForm(turno, { canAssign: puedeAdministrarTurnos(getCurrentUser()) })
  const error = form.querySelector('[data-error]')
  const modal = openFormModal({
    title: turno ? 'Editar turno' : 'Nuevo turno',
    content: form,
    dialogClass: 'max-w-[45rem]',
    scrollBody: false,
    onClose: () => {
      form.querySelector('[data-asignados]')?.limpiar?.()
      form.querySelectorAll('[data-turno-hora]').forEach((field) => field.destroy?.())
    },
  })
  let deleting = false
  let saving = false
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
    if (saving) return
    const body = form.collect()
    if (!body) return
    saving = true
    const submit = form.querySelector('[type="submit"]')
    submit.disabled = true
    submit.setAttribute('aria-busy', 'true')
    try {
      const saved = turno?.id
        ? (await updateTurno(turno.id, body), { ...turno, ...body, id: turno.id })
        : await createTurno(body)
      const row = saved?.id
        ? { ...saved, ...body, id: saved.id, dias: saved.dias?.length ? saved.dias : body.dias }
        : { ...body, cantidadEmpleadosAsignados: 0 }
      showToast({ message: turno?.id ? 'Turno actualizado.' : 'Turno creado.', tone: 'success' })
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
        submit.removeAttribute('aria-busy')
      }
    }
  })
}

export function createTurnosPanel() {
  const root = document.createElement('section')
  root.className = 'w-full min-w-0 max-w-[min(100%,65rem)] space-y-2 overflow-x-hidden'
  const actions = document.createElement('div')
  actions.className = 'flex flex-wrap items-center justify-end gap-2'
  const host = document.createElement('div')
  host.className = 'min-w-0 overflow-x-hidden'
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
