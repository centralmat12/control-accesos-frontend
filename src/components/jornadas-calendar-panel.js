import { CAPABILITY, CAPABILITY_STATUS, resolveCapability } from '../api/capabilities.js'
import { getFichadas } from '../api/fichadas.js'
import { getCalendario, getReposiciones, getResumen } from '../api/jornadas.js'
import { BTN_SECONDARY_CLASS } from './button-styles.js'
import { panelForCapability } from './maintenance-panel.js'
import { construirJornadasSegunFuente } from '../utils/classification-source.js'
import { aplicarHorarioDelDia } from '../utils/movimientos.js'
import { businessNow, escapeHtml, formatFichadaFecha } from '../utils/format.js'
import {
  ariaCeldaCalendario,
  claseCeldaCalendario,
  estadoCeldaCalendario,
  AYUDA_RESUMEN_MENSUAL,
  detalleIncidencias,
  filasDesgloseMensual,
  formatMinutosInformados,
  grillaMensual,
  marcaVisibleCelda,
  shiftMonth,
  textoHorasTrabajadas,
  textoSaldoPeriodo,
  totalIncidencias,
  turnoHabitual,
} from '../utils/labor-format.js'
import { createFichadasEmptyState } from './fichadas-empty-state.js'
import { iconCalendar, iconList } from './icons.js'
import { bindTooltipRoot, infoHelpButton } from './tooltip.js'

const VACIO_TITULO = 'Seleccioná un empleado'
const VACIO_DETALLE = 'Elegí un empleado en el buscador superior para consultar su calendario.'

function empleadoNombre(empleado) {
  return [empleado?.nombre, empleado?.apellido].filter(Boolean).join(' ') || empleado?.empleado || 'Empleado'
}

export function empleadosDeFiltro(empleados, { sucursalId = '', departamentoId = '' } = {}) {
  return empleados.filter((empleado) => {
    if (sucursalId && String(empleado.sucursalId ?? '') !== String(sucursalId)) return false
    if (departamentoId && String(empleado.departamentoId ?? '') !== String(departamentoId)) return false
    return true
  })
}

export function textoCalendarioEmpleado(empleado) {
  const nombre = empleadoNombre(empleado)
  const legajo = String(empleado?.legajo ?? '').trim()
  return legajo ? `Calendario de ${nombre} · Legajo ${legajo}` : `Calendario de ${nombre}`
}

function mesLabel(year, monthIndex) {
  return new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(year, monthIndex, 1)))
}

export function periodoNegocio(now = new Date()) {
  const clock = businessNow(now)
  const [year, month, day] = String(clock?.dateKey ?? '').split('-').map(Number)
  if (!year || !month || !day) return null
  return { year, monthIndex: month - 1, dateKey: clock.dateKey }
}

export function mesPermitido(year, monthIndex, now = new Date()) {
  const actual = periodoNegocio(now)
  if (!actual) return false
  return year < actual.year || (year === actual.year && monthIndex <= actual.monthIndex)
}

export function createJornadasCalendarPanel({
  empleados = [],
  sucursales = [],
  departamentos = [],
  empleadoId: empleadoInicial = '',
  year: yearInicial = null,
  monthIndex: monthInicial = null,
  onEmpleadoChange = null,
  onCursor = null,
  onVerPeriodo = null,
  puedeCompletar = null,
  puedeCompletarEntrada = null,
  puedeAgregar = null,
  onCompletarSalida = null,
  onCompletarEntrada = null,
  onAgregarFichada = null,
} = {}) {
  const root = document.createElement('section')
  root.className = 'min-w-0 max-w-full space-y-2 overflow-x-hidden'
  const clock = businessNow()
  const inicial = clock?.dateKey?.split('-').map(Number) ?? [1970, 1]
  let year = Number.isInteger(yearInicial) ? yearInicial : inicial[0]
  let monthIndex = Number.isInteger(monthInicial) ? monthInicial : inicial[1] - 1
  if (!mesPermitido(year, monthIndex)) {
    const actual = periodoNegocio()
    year = actual?.year ?? year
    monthIndex = actual?.monthIndex ?? monthIndex
  }
  let empleadoId = String(empleadoInicial ?? '')
  let desgloseAbierto = false

  root.innerHTML = `
    <div class="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div data-identidad class="hidden min-w-0 w-full max-w-[32.5rem]">
        <p data-nombre class="truncate text-sm font-semibold text-slate-900 dark:text-slate-100"></p>
        <p data-legajo class="truncate text-xs text-slate-500 dark:text-slate-400"></p>
      </div>
      <div class="flex min-w-0 flex-wrap items-center gap-2 sm:ml-auto sm:justify-end">
        <div class="flex items-center gap-1">
          <button type="button" data-prev class="${BTN_SECONDARY_CLASS} h-9 w-9 px-0" aria-label="Ver mes anterior">‹</button>
          <p data-month class="w-44 shrink-0 text-center text-sm font-semibold capitalize text-slate-800 dark:text-slate-100"></p>
          <button type="button" data-next class="${BTN_SECONDARY_CLASS} h-9 w-9 px-0" aria-label="Ver mes siguiente">›</button>
        </div>
        <button type="button" data-ver class="${BTN_SECONDARY_CLASS} h-9 gap-1.5 px-3">${iconList()}<span>Ver fichadas</span></button>
        <p id="calendario-futuro-help" class="hidden basis-full text-xs text-slate-500 dark:text-slate-400 sm:text-right">No hay períodos futuros disponibles.</p>
      </div>
    </div>
    <div data-host class="min-w-0 max-w-full overflow-x-hidden"></div>
  `
  bindTooltipRoot(root)
  const host = root.querySelector('[data-host]')
  const identidadNode = root.querySelector('[data-identidad]')
  const nombreNode = root.querySelector('[data-nombre]')
  const legajoNode = root.querySelector('[data-legajo]')
  const verButton = root.querySelector('[data-ver]')

  function syncFilters() {
    const compatibles = Array.isArray(empleados) ? empleados : []
    const elegido = compatibles.find((item) => String(item.id) === empleadoId)
    if (empleadoId && !elegido) empleadoId = ''
    const legajo = String(elegido?.legajo ?? '').trim()
    nombreNode.textContent = elegido ? empleadoNombre(elegido) : ''
    legajoNode.textContent = legajo ? `Legajo ${legajo}` : ''
    legajoNode.classList.toggle('hidden', !legajo)
    identidadNode.classList.toggle('hidden', !elegido)
    verButton.disabled = !empleadoId || typeof onVerPeriodo !== 'function'
    verButton.classList.toggle('hidden', !empleadoId || typeof onVerPeriodo !== 'function')
  }

  function renderDetail({ fecha, dia, jornada, estado, resumenDia }) {
    const detail = document.createElement('section')
    if (estado?.codigo === 'futuro') return detail
    detail.className = 'rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-700 dark:bg-slate-800/60'
    const rows = [['Fecha', formatFichadaFecha(fecha) || fecha]]
    const estadoTexto = estado.codigo === 'vacaciones'
      ? 'Vacaciones / día libre'
      : estado.etiqueta
    if (estadoTexto) rows.push(['Estado', estadoTexto])
    if (dia?.horaEntrada && dia?.horaSalida) rows.push(['Horario previsto', `${dia.horaEntrada}–${dia.horaSalida}`])
    if (jornada?.ingresoHora && jornada.ingresoHora !== 'Sin ingreso') rows.push(['Primera fichada', jornada.ingresoHora])
    if (jornada && estado.codigo !== 'enCurso' && (jornada.egresoHora || estado.codigo === 'incompleta')) {
      rows.push(['Última fichada', jornada.egresoHora && jornada.egresoHora !== 'En curso' ? jornada.egresoHora : 'Sin salida'])
    }
    const actividad = typeof resumenDia?.actividadRegistrada === 'number'
      ? formatMinutosInformados(resumenDia.actividadRegistrada)
      : (jornada?.actividadRegistrada && jornada.actividadRegistrada !== '—' ? jornada.actividadRegistrada : '')
    if (actividad) rows.push(['Actividad registrada', actividad])
    if (typeof resumenDia?.minutosTrabajados === 'number') {
      const netos = formatMinutosInformados(resumenDia.minutosTrabajados)
      if (netos) rows.push(['Minutos netos', netos])
    }
    if (dia?.esDiaLibre) rows.push(['Día libre', 'Vacaciones / día libre'])
    if (estado.excepcion) rows.push(['Excepción', 'Excepción horaria'])
    if (estado.fichadasEnLibre) rows.push(['Movimientos', 'Hay movimientos registrados'])
    if ((estado.codigo === 'revisar' || estado.codigo === 'incompleta') && jornada?.motivo) rows.push(['Motivo', jornada.motivo])
    detail.innerHTML = `<dl class="grid gap-2 sm:grid-cols-2">${rows.map(([label, value]) => `<div><dt class="text-slate-500">${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join('')}</dl>`
    const jornadaHorario = aplicarHorarioDelDia(jornada, dia)
    const completarTexto = typeof puedeAgregar === 'function' && puedeAgregar(jornadaHorario)
      ? 'Agregar fichada'
      : typeof puedeCompletarEntrada === 'function' && puedeCompletarEntrada(jornadaHorario)
        ? 'Completar entrada'
        : typeof puedeCompletar === 'function' && puedeCompletar(jornadaHorario)
          ? 'Completar salida'
          : ''
    if (completarTexto) {
      const button = document.createElement('button')
      button.type = 'button'
      button.className = `${BTN_SECONDARY_CLASS} mt-3`
      button.textContent = completarTexto
      button.addEventListener('click', () => {
        if (completarTexto === 'Agregar fichada') onAgregarFichada?.(jornadaHorario, button)
        else if (completarTexto === 'Completar entrada') onCompletarEntrada?.(jornadaHorario, button)
        else onCompletarSalida?.(jornadaHorario, button)
      })
      detail.append(button)
    }
    return detail
  }

  function renderSummary(resumen, reposiciones) {
    const box = document.createElement('section')
    box.className = 'space-y-2'
    const heading = document.createElement('div')
    heading.className = 'flex items-center gap-1'
    const title = document.createElement('h3')
    title.className = 'text-sm font-semibold text-slate-800 dark:text-slate-100'
    title.textContent = 'Resumen mensual'
    heading.innerHTML = `${title.outerHTML}${infoHelpButton(AYUDA_RESUMEN_MENSUAL)}`
    box.append(heading)

    const saldo = textoSaldoPeriodo(resumen)
    const incidencias = totalIncidencias(resumen)
    const detalle = detalleIncidencias(resumen)
    const tonoSaldo = saldo.tono === 'deuda'
      ? 'border-orange-300 text-orange-800 dark:border-orange-400/40 dark:text-orange-200'
      : saldo.tono === 'favor'
        ? 'border-emerald-300 text-emerald-800 dark:border-emerald-400/40 dark:text-emerald-200'
        : 'border-slate-200 text-slate-900 dark:border-slate-700 dark:text-slate-100'
    const tonoIncidencia = Number.isInteger(incidencias) && incidencias > 0
      ? 'border-amber-300 dark:border-amber-400/40'
      : 'border-slate-200 dark:border-slate-700'
    const textoIncidencias = !Number.isInteger(incidencias)
      ? '—'
      : incidencias === 0
        ? 'Sin incidencias'
        : `${incidencias} requieren atención`
    const cards = [
      ['Horas programadas', formatMinutosInformados(resumen?.minutosProgramados) ?? '—', 'border-slate-200 dark:border-slate-700', ''],
      ['Horas trabajadas', textoHorasTrabajadas(resumen), 'border-slate-200 dark:border-slate-700', ''],
      ['Saldo del período', saldo.texto, tonoSaldo, ''],
      ['Incidencias', textoIncidencias, tonoIncidencia, detalle],
    ]
    const grid = document.createElement('div')
    grid.className = 'grid grid-cols-2 gap-2 lg:grid-cols-4'
    cards.forEach(([etiqueta, texto, tono, sub]) => {
      const card = document.createElement('article')
      card.className = `min-w-0 rounded-lg border bg-white px-2.5 py-2 dark:bg-slate-900 ${tono}`
      card.innerHTML = `<p class="text-xs text-slate-500 dark:text-slate-400">${escapeHtml(etiqueta)}</p><p class="mt-0.5 text-sm font-semibold tabular-nums">${escapeHtml(texto)}</p>${sub ? `<p class="mt-0.5 line-clamp-2 text-[11px] leading-4 text-slate-500 dark:text-slate-400">${escapeHtml(sub)}</p>` : ''}`
      grid.append(card)
    })
    box.append(grid)

    const toggle = document.createElement('button')
    toggle.type = 'button'
    toggle.className = 'text-xs font-medium text-slate-600 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-slate-300'
    const desglose = document.createElement('div')
    desglose.className = 'grid grid-cols-1 gap-x-6 sm:grid-cols-2'
    filasDesgloseMensual(resumen).forEach((fila) => {
      const row = document.createElement('div')
      row.className = 'flex items-baseline justify-between gap-3 border-b border-slate-100 py-1 text-sm dark:border-slate-800'
      row.innerHTML = `<span class="text-slate-500 dark:text-slate-400">${escapeHtml(fila.etiqueta)}</span><span class="tabular-nums font-medium">${escapeHtml(fila.texto)}</span>`
      desglose.append(row)
    })
    if (Array.isArray(reposiciones) && reposiciones.length) {
      const list = document.createElement('ul')
      list.className = 'col-span-full space-y-1 pt-1 text-sm text-slate-600 dark:text-slate-300'
      reposiciones.forEach((item) => {
        const li = document.createElement('li')
        li.textContent = `${item.fecha}: ${formatMinutosInformados(item.minutos) ?? '—'} · ${item.detalle || 'Sin detalle'}`
        list.append(li)
      })
      desglose.append(list)
    }
    function paintDesglose() {
      toggle.textContent = desgloseAbierto ? 'Ocultar desglose' : 'Ver desglose mensual'
      toggle.setAttribute('aria-expanded', String(desgloseAbierto))
      desglose.classList.toggle('hidden', !desgloseAbierto)
    }
    toggle.addEventListener('click', () => {
      desgloseAbierto = !desgloseAbierto
      paintDesglose()
    })
    paintDesglose()
    box.append(toggle, desglose)
    return box
  }

  function renderGrid(dias, jornadas, { fichadasConocidas = true, resumenDias = [] } = {}) {
    const habitual = turnoHabitual(dias)
    const grilla = grillaMensual(year, monthIndex)
    const hoy = businessNow()?.dateKey ?? ''
    const porFecha = new Map((Array.isArray(dias) ? dias : []).map((dia) => [dia.fecha, dia]))
    const porJornada = new Map((Array.isArray(jornadas) ? jornadas : []).filter((item) => String(item.empleadoId ?? empleadoId) === String(empleadoId)).map((item) => [item.fecha, item]))
    const porResumen = new Map((Array.isArray(resumenDias) ? resumenDias : []).map((dia) => [dia.fecha, dia]))
    const grid = document.createElement('div')
    grid.className = 'min-w-0 rounded-xl border border-slate-200 bg-white p-2 shadow-sm dark:border-slate-700 dark:bg-slate-900'
    const legend = document.createElement('ul')
    legend.className = 'mb-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-600 dark:text-slate-300'
    legend.innerHTML = [
      ['bg-emerald-500', 'Completa'],
      ['bg-amber-500', 'Requiere atención'],
      ['bg-slate-400', 'Sin registros'],
    ].map(([dot, label]) => `<li class="inline-flex items-center gap-1.5"><span class="h-2 w-2 rounded-full ${dot}" aria-hidden="true"></span>${label}</li>`).join('')
    const week = document.createElement('div')
    week.className = 'grid grid-cols-7 gap-0.5 text-center text-[11px] font-medium text-slate-500'
    grilla.headers.forEach((header) => {
      const cell = document.createElement('div')
      cell.textContent = header
      week.append(cell)
    })
    const cells = document.createElement('div')
    cells.className = 'mt-1 grid grid-cols-7 gap-0.5'
    const detailHost = document.createElement('div')
    detailHost.className = 'mt-2'
    grilla.cells.forEach((fecha) => {
      if (!fecha) {
        const empty = document.createElement('div')
        empty.className = 'min-h-8'
        empty.setAttribute('aria-hidden', 'true')
        cells.append(empty)
        return
      }
      const dia = porFecha.get(fecha) ?? null
      const jornada = porJornada.get(fecha) ?? null
      const resumenDia = porResumen.get(fecha) ?? null
      const estado = estadoCeldaCalendario({ dia, jornada, fecha, hoy, habitual, fichadasConocidas })
      const numero = fecha.slice(-2)
      const marca = marcaVisibleCelda(estado, resumenDia)
      const marcaHtml = !marca
        ? ''
        : marca === '✓' || marca === '—'
          ? `<span aria-hidden="true" class="text-[11px] leading-none">${marca}</span>`
          : `<span class="min-w-0 truncate text-[10px] leading-tight">· ${escapeHtml(marca)}</span>`
      const contenido = `<span class="flex min-w-0 items-baseline gap-0.5"><span class="font-semibold tabular-nums">${escapeHtml(numero)}</span>${marcaHtml}</span>`
      const codigoClase = marca === 'Llegada tarde' ? 'revisar' : estado.codigo
      if (estado.codigo === 'futuro') {
        const futura = document.createElement('div')
        futura.className = `flex min-h-8 min-w-0 items-center rounded-md border px-1 py-0.5 text-left text-xs ${claseCeldaCalendario('futuro')}`
        futura.innerHTML = contenido
        futura.setAttribute('aria-label', ariaCeldaCalendario(fecha, estado))
        cells.append(futura)
        return
      }
      const button = document.createElement('button')
      button.type = 'button'
      const today = fecha === hoy
      button.className = `flex min-h-8 min-w-0 items-center rounded-md border px-1 py-0.5 text-left text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${claseCeldaCalendario(codigoClase)} ${today ? 'ring-1 ring-blue-400' : ''}`
      button.innerHTML = contenido
      const completo = ariaCeldaCalendario(fecha, estado)
      button.setAttribute('aria-label', completo)
      button.setAttribute('data-tooltip', completo)
      button.addEventListener('click', () => {
        detailHost.replaceChildren(renderDetail({ fecha, dia, jornada, estado, resumenDia }))
      })
      cells.append(button)
    })
    grid.append(legend, week, cells)
    return { grid, detailHost }
  }

  function syncMes() {
    if (!mesPermitido(year, monthIndex)) {
      const actual = periodoNegocio()
      year = actual?.year ?? year
      monthIndex = actual?.monthIndex ?? monthIndex
    }
    const actual = periodoNegocio()
    const bloqueado = actual && year === actual.year && monthIndex === actual.monthIndex
    const next = root.querySelector('[data-next]')
    const ayuda = root.querySelector('#calendario-futuro-help')
    next.disabled = bloqueado
    next.setAttribute('aria-disabled', bloqueado ? 'true' : 'false')
    if (bloqueado) next.setAttribute('aria-describedby', 'calendario-futuro-help')
    else next.removeAttribute('aria-describedby')
    ayuda.classList.toggle('hidden', !bloqueado)
    root.querySelector('[data-month]').textContent = mesLabel(year, monthIndex)
  }

  function irMes(delta) {
    const destino = shiftMonth(year, monthIndex, delta)
    if (!mesPermitido(destino.year, destino.monthIndex)) return
    year = destino.year
    monthIndex = destino.monthIndex
    void load(false)
  }

  async function load(force = false) {
    syncFilters()
    syncMes()
    onCursor?.({ year, monthIndex })
    if (!empleadoId) {
      host.replaceChildren(createFichadasEmptyState({
        title: VACIO_TITULO,
        description: VACIO_DETALLE,
        icon: iconCalendar(),
      }))
      return
    }
    if (!mesPermitido(year, monthIndex)) return
    host.textContent = 'Cargando calendario...'
    const { desde, hasta } = grillaMensual(year, monthIndex)
    const context = { empleadoId: Number(empleadoId), desde, hasta }
    const calendarCapability = await resolveCapability(CAPABILITY.jornadasCalendar, { force, context })
    if (calendarCapability.status !== CAPABILITY_STATUS.available) {
      host.replaceChildren(panelForCapability(calendarCapability, { onRetry: () => load(true) }))
      return
    }
    try {
      const resumenCapability = await resolveCapability(CAPABILITY.jornadasSummary, { context })
      const [dias, fichadasResult, resumenPack] = await Promise.all([
        getCalendario(empleadoId, desde, hasta),
        getFichadas({ empleadoId, desde, hasta }).then((list) => ({ list, error: null })).catch((error) => ({ list: null, error })),
        resumenCapability.status === CAPABILITY_STATUS.available
          ? Promise.all([
              getResumen(empleadoId, desde, hasta),
              getReposiciones(empleadoId, desde, hasta).catch(() => []),
            ]).then(([resumen, reposiciones]) => ({ resumen, reposiciones, error: null })).catch((error) => ({ resumen: null, reposiciones: [], error }))
          : Promise.resolve(null),
      ])
      if (fichadasResult.error?.status === 401 || resumenPack?.error?.status === 401) return
      const empleado = empleados.find((item) => String(item.id) === empleadoId)
      const empleadoById = new Map(empleado ? [[Number(empleado.id), empleado]] : [])
      const fichadasConocidas = Array.isArray(fichadasResult.list)
      const jornadas = fichadasConocidas && fichadasResult.list.length
        ? construirJornadasSegunFuente(fichadasResult.list, empleadoById, { now: new Date() })
        : []
      if (fichadasConocidas && !dias?.length && !jornadas.length && !resumenPack?.resumen) {
        host.replaceChildren(createFichadasEmptyState({
          title: 'Sin información de jornada',
          description: 'No hay información disponible para el empleado y mes seleccionados.',
          icon: iconCalendar(),
        }))
        return
      }
      const wrap = document.createElement('div')
      wrap.className = 'space-y-2'
      const { grid, detailHost } = renderGrid(dias, jornadas, {
        fichadasConocidas,
        resumenDias: resumenPack?.resumen?.dias ?? [],
      })
      wrap.append(grid, detailHost)
      if (!fichadasConocidas) {
        const aviso = document.createElement('p')
        aviso.className = 'text-xs text-amber-800 dark:text-amber-200'
        aviso.setAttribute('role', 'status')
        aviso.textContent = fichadasResult.error?.status === 403
          ? 'No tenés permiso para ver las fichadas de este período.'
          : 'No se pudieron cargar las fichadas del período. Los estados de jornada no están disponibles.'
        wrap.append(aviso)
      }
      if (resumenPack?.resumen) {
        wrap.append(renderSummary(resumenPack.resumen, resumenPack.reposiciones))
      } else if (resumenCapability.status !== CAPABILITY_STATUS.available) {
        wrap.append(panelForCapability(resumenCapability, { onRetry: () => load(true) }))
      } else {
        wrap.append(panelForCapability(
          { status: CAPABILITY_STATUS.temporarilyUnavailable, reason: resumenPack?.error?.status ? 'server' : 'network' },
          { onRetry: () => load(true) },
        ))
      }
      host.replaceChildren(wrap)
    } catch (error) {
      if (error.status === 401) return
      host.replaceChildren(panelForCapability(
        { status: error.status === 403 ? CAPABILITY_STATUS.forbidden : CAPABILITY_STATUS.temporarilyUnavailable, reason: error.status ? 'server' : 'network' },
        { onRetry: () => load(true) },
      ))
    }
  }

  root.querySelector('[data-prev]').addEventListener('click', () => irMes(-1))
  verButton.addEventListener('click', () => {
    if (!empleadoId || typeof onVerPeriodo !== 'function') return
    const { desde, hasta } = grillaMensual(year, monthIndex)
    onVerPeriodo({ empleadoId, desde, hasta, year, monthIndex })
  })
  const nextMonth = root.querySelector('[data-next]')
  const bloquearFuturo = (event) => {
    const destino = shiftMonth(year, monthIndex, 1)
    if (mesPermitido(destino.year, destino.monthIndex)) return
    event.preventDefault()
    event.stopPropagation()
  }
  nextMonth.addEventListener('click', (event) => {
    bloquearFuturo(event)
    if (event.defaultPrevented) return
    irMes(1)
  })
  nextMonth.addEventListener('keydown', bloquearFuturo)
  load(false)
  root.reload = () => load(true)
  root.setEmpleadoId = (id) => {
    const next = String(id ?? '')
    if (next === empleadoId) return
    empleadoId = next
    return load(false)
  }
  root.destroy = () => {}
  return root
}
