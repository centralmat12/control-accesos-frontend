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
  formatMinutosInformados,
  grillaMensual,
  mesSinAtencion,
  presentarSaldo,
  shiftMonth,
  turnoHabitual,
} from '../utils/labor-format.js'
import { bindTooltipRoot } from './tooltip.js'

const CONTROL = 'rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-900'
const VACIO = 'Seleccioná un empleado para consultar su calendario.'

function empleadoNombre(empleado) {
  return [empleado?.nombre, empleado?.apellido].filter(Boolean).join(' ') || empleado?.empleado || 'Empleado'
}

function mesLabel(year, monthIndex) {
  return new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(year, monthIndex, 1)))
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
  root.className = 'space-y-3'
  const clock = businessNow()
  const inicial = clock?.dateKey?.split('-').map(Number) ?? [1970, 1]
  let year = Number.isInteger(yearInicial) ? yearInicial : inicial[0]
  let monthIndex = Number.isInteger(monthInicial) ? monthInicial : inicial[1] - 1
  let empleadoId = String(empleadoInicial ?? '')
  let sucursalId = ''
  let departamentoId = ''

  root.innerHTML = `
    <div class="flex flex-wrap items-end gap-2">
      <label class="text-xs text-slate-600 dark:text-slate-300">Sucursal
        <select data-sucursal class="${CONTROL} mt-1 block max-w-full"></select>
      </label>
      <label class="text-xs text-slate-600 dark:text-slate-300">Departamento
        <select data-departamento class="${CONTROL} mt-1 block max-w-full"></select>
      </label>
      <label class="text-xs text-slate-600 dark:text-slate-300">Empleado
        <select data-empleado class="${CONTROL} mt-1 block min-w-40 max-w-full"></select>
      </label>
      <div class="ml-auto flex items-center gap-1">
        <button type="button" data-prev class="${BTN_SECONDARY_CLASS}" aria-label="Mes anterior">←</button>
        <p data-month class="min-w-32 text-center text-sm font-semibold capitalize"></p>
        <button type="button" data-next class="${BTN_SECONDARY_CLASS}" aria-label="Mes siguiente">→</button>
      </div>
    </div>
    <p data-habitual class="hidden text-sm text-slate-600 dark:text-slate-300"></p>
    <div data-host></div>
  `
  bindTooltipRoot(root)
  const host = root.querySelector('[data-host]')
  const sucursalSelect = root.querySelector('[data-sucursal]')
  const departamentoSelect = root.querySelector('[data-departamento]')
  const empleadoSelect = root.querySelector('[data-empleado]')
  const habitualNode = root.querySelector('[data-habitual]')

  function fillSelect(select, options, placeholder) {
    select.replaceChildren()
    const empty = document.createElement('option')
    empty.value = ''
    empty.textContent = placeholder
    select.append(empty)
    options.forEach((option) => {
      const node = document.createElement('option')
      node.value = String(option.id)
      node.textContent = option.label
      select.append(node)
    })
  }

  function filteredEmpleados() {
    return empleados.filter((empleado) => {
      if (sucursalId && String(empleado.sucursalId ?? '') !== sucursalId) return false
      if (departamentoId && String(empleado.departamentoId ?? '') !== departamentoId) return false
      return true
    })
  }

  function syncFilters() {
    fillSelect(sucursalSelect, sucursales.map((item) => ({ id: item.id, label: item.nombre })), 'Todas')
    fillSelect(departamentoSelect, departamentos.map((item) => ({ id: item.id, label: item.nombre })), 'Todos')
    sucursalSelect.value = sucursalId
    departamentoSelect.value = departamentoId
    const options = filteredEmpleados().map((item) => ({ id: item.id, label: empleadoNombre(item) }))
    const selected = empleados.find((item) => String(item.id) === empleadoId)
    if (selected && !options.some((item) => String(item.id) === empleadoId)) {
      options.unshift({ id: selected.id, label: empleadoNombre(selected) })
    }
    fillSelect(empleadoSelect, options, 'Seleccioná un empleado')
    empleadoSelect.value = options.some((item) => String(item.id) === empleadoId) ? empleadoId : ''
  }

  function renderDetail({ fecha, dia, jornada, estado, resumenDia }) {
    const detail = document.createElement('section')
    detail.className = 'rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-700 dark:bg-slate-800/60'
    const rows = [['Fecha', formatFichadaFecha(fecha) || fecha]]
    const estadoTexto = estado.codigo === 'vacaciones'
      ? 'Vacaciones / día libre'
      : estado.codigo === 'futuro'
        ? 'Jornada prevista'
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

  function renderSummary(resumen, reposiciones, nombre) {
    const box = document.createElement('section')
    box.className = 'space-y-2'
    const title = document.createElement('h3')
    title.className = 'text-sm font-semibold capitalize'
    title.textContent = `Resumen de ${nombre} · ${mesLabel(year, monthIndex)}`
    box.append(title)
    const grid = document.createElement('div')
    grid.className = 'grid gap-2 sm:grid-cols-2 xl:grid-cols-5'
    const minutos = (value) => formatMinutosInformados(value) ?? '—'
    const saldoInfo = presentarSaldo(resumen)
    const saldo = saldoInfo.valor
    const items = [
      ['Actividad registrada', minutos(resumen?.actividadRegistrada)],
      ['Minutos trabajados', minutos(resumen?.minutosTrabajados)],
      ['Horas programadas', minutos(resumen?.minutosProgramados)],
      ['Repuestos', minutos(resumen?.minutosRepuestos)],
      ['Saldo', saldo],
    ]
    items.forEach(([label, value]) => {
      const card = document.createElement('article')
      card.className = 'rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900'
      card.innerHTML = `<p class="text-xs font-medium text-slate-500">${escapeHtml(label)}</p><p class="mt-0.5 text-sm font-semibold">${escapeHtml(value ?? '—')}</p>`
      grid.append(card)
    })
    box.append(grid)
    const note = document.createElement('p')
    note.className = 'text-xs text-slate-500'
    note.textContent = saldoInfo.detalle
      || (saldo === 'Al día' || saldo.startsWith('Debe ') || saldo.startsWith('A favor ')
        ? 'La actividad registrada es la presencia entre la primera y la última fichada. Los minutos trabajados ya descuentan el almuerzo informado por la API.'
        : '')
    if (note.textContent) box.append(note)
    if (Array.isArray(reposiciones) && reposiciones.length) {
      const list = document.createElement('ul')
      list.className = 'space-y-1 text-sm'
      reposiciones.forEach((item) => {
        const li = document.createElement('li')
        li.textContent = `${item.fecha}: ${formatMinutosInformados(item.minutos) ?? '—'} · ${item.detalle || 'Sin detalle'}`
        list.append(li)
      })
      box.append(list)
    }
    return box
  }

  function renderGrid(dias, jornadas, { fichadasConocidas = true, resumenDias = [] } = {}) {
    const habitual = turnoHabitual(dias)
    habitualNode.textContent = habitual?.texto ?? ''
    habitualNode.classList.toggle('hidden', !habitual)
    const grilla = grillaMensual(year, monthIndex)
    const hoy = businessNow()?.dateKey ?? ''
    const porFecha = new Map((Array.isArray(dias) ? dias : []).map((dia) => [dia.fecha, dia]))
    const porJornada = new Map((Array.isArray(jornadas) ? jornadas : []).filter((item) => String(item.empleadoId ?? empleadoId) === String(empleadoId)).map((item) => [item.fecha, item]))
    const porResumen = new Map((Array.isArray(resumenDias) ? resumenDias : []).map((dia) => [dia.fecha, dia]))
    const grid = document.createElement('div')
    grid.className = 'rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900'
    const legend = document.createElement('ul')
    legend.className = 'mb-2 flex flex-wrap gap-1 text-[11px] text-slate-600 dark:text-slate-300'
    const info = document.createElement('button')
    info.type = 'button'
    info.className = 'mb-2 rounded-md px-1 text-xs text-slate-500 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500'
    info.textContent = 'Información de estados'
    info.setAttribute('data-tooltip', 'Completa, en curso, incompleta, revisar, vacaciones o día libre, sin registros y sin jornada prevista. El color acompaña al texto.')
    info.setAttribute('aria-label', 'Información de los estados del calendario')
    const week = document.createElement('div')
    week.className = 'grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase text-slate-500'
    grilla.headers.forEach((header) => {
      const cell = document.createElement('div')
      cell.textContent = header
      week.append(cell)
    })
    const cells = document.createElement('div')
    cells.className = 'mt-1 grid grid-cols-7 gap-1'
    const detailHost = document.createElement('div')
    detailHost.className = 'mt-3'
    const presentes = new Set()
    const evaluadas = []
    grilla.cells.forEach((fecha) => {
      if (!fecha) {
        const empty = document.createElement('div')
        empty.className = 'min-h-9'
        empty.setAttribute('aria-hidden', 'true')
        cells.append(empty)
        return
      }
      const dia = porFecha.get(fecha) ?? null
      const jornada = porJornada.get(fecha) ?? null
      const estado = estadoCeldaCalendario({ dia, jornada, fecha, hoy, habitual, fichadasConocidas })
      if (estado.codigo) presentes.add(estado.codigo)
      evaluadas.push(estado)
      const button = document.createElement('button')
      button.type = 'button'
      const today = fecha === hoy
      button.className = `min-h-9 min-w-0 rounded-md border px-1 py-1 text-left text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${claseCeldaCalendario(estado.codigo)} ${today ? 'ring-1 ring-blue-400' : ''}`
      const numero = fecha.slice(-2)
      const lineas = [estado.etiqueta, estado.sub, estado.excepcion ? 'Excepción' : '', estado.fichadasEnLibre ? 'Hay fichadas' : ''].filter(Boolean)
      button.innerHTML = `<span class="block font-semibold">${escapeHtml(numero)}</span>${lineas.map((linea) => `<span class="mt-0.5 block truncate text-[10px] leading-tight">${escapeHtml(linea)}</span>`).join('')}`
      const completo = ariaCeldaCalendario(fecha, estado)
      button.setAttribute('aria-label', completo)
      button.setAttribute('data-tooltip', completo)
      button.addEventListener('click', () => {
        detailHost.replaceChildren(renderDetail({
          fecha,
          dia,
          jornada,
          estado,
          resumenDia: porResumen.get(fecha) ?? null,
        }))
      })
      cells.append(button)
    })
    const nombres = {
      completa: 'Completa',
      enCurso: 'En curso',
      incompleta: 'Incompleta',
      revisar: 'Revisar',
      vacaciones: 'Vacaciones / día libre',
      sinRegistros: 'Sin registros',
      sinPrevista: 'Sin jornada prevista',
    }
    ;['completa', 'enCurso', 'incompleta', 'revisar', 'vacaciones', 'sinRegistros', 'sinPrevista'].forEach((codigo) => {
      if (!presentes.has(codigo)) return
      const li = document.createElement('li')
      li.className = `rounded px-1.5 py-0.5 ${claseCeldaCalendario(codigo)}`
      li.textContent = nombres[codigo]
      legend.append(li)
    })
    grid.append(legend, info, week, cells)
    if (mesSinAtencion(evaluadas, hoy)) {
      const quieto = document.createElement('p')
      quieto.className = 'mt-2 text-xs text-slate-500'
      quieto.setAttribute('role', 'status')
      quieto.textContent = 'Sin jornadas que requieran atención en este período.'
      grid.append(quieto)
    }
    return { grid, detailHost }
  }

  async function load(force = false) {
    syncFilters()
    const label = mesLabel(year, monthIndex)
    root.querySelector('[data-month]').textContent = label
    onCursor?.({ year, monthIndex })
    if (!empleadoId) {
      habitualNode.classList.add('hidden')
      host.innerHTML = `<p class="rounded-xl border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500 shadow-sm dark:border-slate-700 dark:bg-slate-900">${VACIO}</p>`
      return
    }
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
      const wrap = document.createElement('div')
      wrap.className = 'space-y-3'
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
      const nombre = empleadoNombre(empleado)
      if (resumenPack?.resumen) {
        wrap.append(renderSummary(resumenPack.resumen, resumenPack.reposiciones, nombre))
      } else if (resumenCapability.status !== CAPABILITY_STATUS.available) {
        wrap.append(panelForCapability(resumenCapability, { onRetry: () => load(true) }))
      } else {
        wrap.append(panelForCapability(
          { status: CAPABILITY_STATUS.temporarilyUnavailable, reason: resumenPack?.error?.status ? 'server' : 'network' },
          { onRetry: () => load(true) },
        ))
      }
      if (onVerPeriodo) {
        const review = document.createElement('button')
        review.type = 'button'
        review.className = BTN_SECONDARY_CLASS
        review.textContent = 'Ver fichadas del período'
        review.addEventListener('click', () => onVerPeriodo({ empleadoId, desde, hasta, year, monthIndex }))
        wrap.append(review)
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

  sucursalSelect.addEventListener('change', () => {
    sucursalId = sucursalSelect.value
    load(false)
  })
  departamentoSelect.addEventListener('change', () => {
    departamentoId = departamentoSelect.value
    load(false)
  })
  empleadoSelect.addEventListener('change', () => {
    empleadoId = empleadoSelect.value
    onEmpleadoChange?.(empleadoId)
    load(false)
  })
  root.querySelector('[data-prev]').addEventListener('click', () => {
    const next = shiftMonth(year, monthIndex, -1)
    year = next.year
    monthIndex = next.monthIndex
    load(false)
  })
  root.querySelector('[data-next]').addEventListener('click', () => {
    const next = shiftMonth(year, monthIndex, 1)
    year = next.year
    monthIndex = next.monthIndex
    load(false)
  })
  load(false)
  root.reload = () => load(true)
  root.setEmpleadoId = (id) => {
    empleadoId = String(id ?? '')
    return load(false)
  }
  return root
}
