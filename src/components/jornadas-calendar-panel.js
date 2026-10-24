import { CAPABILITY, CAPABILITY_STATUS, resolveCapability } from '../api/capabilities.js'
import { etiquetaDiaCalendario, getCalendario, getReposiciones, getResumen } from '../api/jornadas.js'
import { BTN_SECONDARY_CLASS } from './button-styles.js'
import { panelForCapability, createMaintenancePanel } from './maintenance-panel.js'
import { escapeHtml, formatFichadaFecha } from '../utils/format.js'
import { formatMinutosInformados, monthBounds, shiftMonth } from '../utils/labor-format.js'
import { bindTooltipRoot } from './tooltip.js'

const CONTROL = 'rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-900'

function empleadoNombre(empleado) {
  return [empleado?.nombre, empleado?.apellido].filter(Boolean).join(' ') || empleado?.empleado || 'Empleado'
}

export function createJornadasCalendarPanel({ empleados = [], sucursales = [], departamentos = [], onRevisar = null } = {}) {
  const root = document.createElement('section')
  root.className = 'space-y-4'
  const now = new Date()
  let year = now.getFullYear()
  let monthIndex = now.getMonth()
  let empleadoId = ''
  let sucursalId = ''
  let departamentoId = ''

  root.innerHTML = `
    <div class="flex flex-wrap items-end gap-2">
      <label class="text-sm text-slate-600 dark:text-slate-300">Sucursal
        <select data-sucursal class="${CONTROL} mt-1 block max-w-full"></select>
      </label>
      <label class="text-sm text-slate-600 dark:text-slate-300">Departamento
        <select data-departamento class="${CONTROL} mt-1 block max-w-full"></select>
      </label>
      <label class="text-sm text-slate-600 dark:text-slate-300">Empleado
        <select data-empleado class="${CONTROL} mt-1 block min-w-40 max-w-full"></select>
      </label>
      <div class="ml-auto flex items-center gap-1">
        <button type="button" data-prev class="${BTN_SECONDARY_CLASS}" aria-label="Mes anterior">←</button>
        <p data-month class="min-w-32 text-center text-sm font-semibold"></p>
        <button type="button" data-next class="${BTN_SECONDARY_CLASS}" aria-label="Mes siguiente">→</button>
      </div>
    </div>
    <div data-host></div>
  `
  bindTooltipRoot(root)
  const host = root.querySelector('[data-host]')
  const sucursalSelect = root.querySelector('[data-sucursal]')
  const departamentoSelect = root.querySelector('[data-departamento]')
  const empleadoSelect = root.querySelector('[data-empleado]')

  function fillSelect(select, options, placeholder) {
    const current = select.value
    select.innerHTML = `<option value="">${escapeHtml(placeholder)}</option>`
    options.forEach((option) => {
      const node = document.createElement('option')
      node.value = String(option.id)
      node.textContent = option.label
      select.append(node)
    })
    if ([...select.options].some((option) => option.value === current)) select.value = current
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
    fillSelect(empleadoSelect, filteredEmpleados().map((item) => ({ id: item.id, label: empleadoNombre(item) })), 'Seleccioná un empleado')
    if (filteredEmpleados().some((item) => String(item.id) === empleadoId)) empleadoSelect.value = empleadoId
    else empleadoId = empleadoSelect.value
  }

  function renderDetail(dia) {
    const detail = document.createElement('section')
    detail.className = 'rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm dark:border-slate-700 dark:bg-slate-800/60'
    detail.innerHTML = `
      <h3 class="font-semibold">${escapeHtml(formatFichadaFecha(dia.fecha) || dia.fecha)}</h3>
      <dl class="mt-2 grid gap-2 sm:grid-cols-2">
        <div><dt class="text-slate-500">Estado informado</dt><dd>${escapeHtml(etiquetaDiaCalendario(dia))}</dd></div>
        <div><dt class="text-slate-500">Turno previsto</dt><dd>${escapeHtml(dia.horaEntrada && dia.horaSalida ? `${dia.horaEntrada}–${dia.horaSalida}` : '—')}</dd></div>
        <div><dt class="text-slate-500">Horas previstas</dt><dd>${escapeHtml(formatMinutosInformados(dia.minutosProgramados) ?? '—')}</dd></div>
        <div><dt class="text-slate-500">Descanso informado</dt><dd>${escapeHtml(formatMinutosInformados(dia.minutosAlmuerzo) ?? '—')}</dd></div>
      </dl>
      <p class="mt-3 text-slate-500">La primera fichada, la última y las observaciones se ven en Resumen de jornadas. Este calendario muestra el horario que informa la API.</p>
    `
    return detail
  }

  function renderSummary(resumen, reposiciones) {
    const box = document.createElement('section')
    box.className = 'grid gap-3 sm:grid-cols-2 xl:grid-cols-4'
    const minutos = (value) => formatMinutosInformados(value) ?? '—'
    const items = [
      ['Actividad registrada', minutos(resumen?.actividadRegistrada)],
      ['Minutos trabajados', minutos(resumen?.minutosTrabajados)],
      ['Horas programadas', minutos(resumen?.minutosProgramados)],
      ['Repuestos', minutos(resumen?.minutosRepuestos)],
      ['Saldo', minutos(resumen?.saldoMinutos)],
    ]
    items.forEach(([label, value]) => {
      const card = document.createElement('article')
      card.className = 'rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900'
      card.innerHTML = `<p class="text-xs font-medium text-slate-500">${escapeHtml(label)}</p><p class="mt-1 text-lg font-semibold">${escapeHtml(value ?? '—')}</p>`
      box.append(card)
    })
    const note = document.createElement('p')
    note.className = 'text-xs text-slate-500 sm:col-span-2 xl:col-span-4'
    note.textContent = 'La actividad registrada es la presencia entre la primera y la última fichada. Los minutos trabajados ya descuentan el almuerzo informado por la API.'
    box.append(note)
    const missing = createMaintenancePanel({ compact: true })
    const missingTitle = missing.querySelector('h2')
    if (missingTitle) missingTitle.textContent = 'Funcionalidad aún en mantenimiento'
    const missingText = missing.querySelector('p')
    if (missingText) {
      missingText.textContent = 'Horas justificadas, horas pendientes y horas a favor se mostrarán cuando la API las informe. Esta sección se habilitará automáticamente cuando la API esté disponible.'
    }
    box.append(missing)
    if (Array.isArray(reposiciones) && reposiciones.length) {
      const list = document.createElement('ul')
      list.className = 'space-y-1 text-sm sm:col-span-2 xl:col-span-4'
      reposiciones.forEach((item) => {
        const li = document.createElement('li')
        li.textContent = `${item.fecha}: ${formatMinutosInformados(item.minutos) ?? '—'} · ${item.detalle || 'Sin detalle'}`
        list.append(li)
      })
      box.append(list)
    }
    return box
  }

  async function load(force = false) {
    syncFilters()
    const label = new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(year, monthIndex, 1)))
    root.querySelector('[data-month]').textContent = label
    if (!empleadoId) {
      host.innerHTML = '<p class="rounded-xl border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500 shadow-sm dark:border-slate-700 dark:bg-slate-900">Seleccioná un empleado para ver su calendario.</p>'
      return
    }
    host.textContent = 'Cargando calendario...'
    const { desde, hasta } = monthBounds(year, monthIndex)
    const context = { empleadoId: Number(empleadoId), desde, hasta }
    const calendarCapability = await resolveCapability(CAPABILITY.jornadasCalendar, { force, context })
    if (calendarCapability.status !== CAPABILITY_STATUS.available) {
      host.replaceChildren(panelForCapability(calendarCapability, { onRetry: () => load(true) }))
      return
    }
    try {
      const [dias, resumenCapability] = await Promise.all([
        getCalendario(empleadoId, desde, hasta),
        resolveCapability(CAPABILITY.jornadasSummary, { context }),
      ])
      const wrap = document.createElement('div')
      wrap.className = 'space-y-4'
      const grid = document.createElement('div')
      grid.className = 'max-h-[65vh] overflow-auto rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900'
      grid.innerHTML = `<p class="mb-2 text-xs text-slate-500">Leyenda: Sin jornada prevista, Día libre, Excepción, Horario configurado. Los estados Completa, En curso, Incompleta y A revisar siguen en Resumen de jornadas.</p>`
      const cells = document.createElement('div')
      cells.className = 'grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7'
      const detailHost = document.createElement('div')
      dias.forEach((dia) => {
        const button = document.createElement('button')
        button.type = 'button'
        button.className = 'rounded-lg border border-slate-200 px-2 py-2 text-left text-xs hover:border-blue-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-700'
        const etiqueta = etiquetaDiaCalendario(dia)
        button.innerHTML = `<span class="block font-semibold">${escapeHtml(dia.fecha.slice(-2))}</span><span class="mt-1 block truncate text-slate-500">${escapeHtml(etiqueta)}</span>`
        button.setAttribute('aria-label', `${dia.fecha} ${etiqueta}`)
        button.addEventListener('click', () => {
          detailHost.replaceChildren(renderDetail(dia))
        })
        cells.append(button)
      })
      grid.append(cells)
      wrap.append(grid, detailHost)
      if (resumenCapability.status === CAPABILITY_STATUS.available) {
        const [resumen, reposiciones] = await Promise.all([
          getResumen(empleadoId, desde, hasta),
          getReposiciones(empleadoId, desde, hasta).catch(() => []),
        ])
        wrap.append(renderSummary(resumen, reposiciones))
      } else {
        wrap.append(panelForCapability(resumenCapability, { onRetry: () => load(true) }))
      }
      if (onRevisar) {
        const review = document.createElement('button')
        review.type = 'button'
        review.className = BTN_SECONDARY_CLASS
        review.textContent = 'Revisar en fichadas'
        review.addEventListener('click', () => onRevisar(empleadoId))
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
    empleadoId = ''
    load(false)
  })
  departamentoSelect.addEventListener('change', () => {
    departamentoId = departamentoSelect.value
    empleadoId = ''
    load(false)
  })
  empleadoSelect.addEventListener('change', () => {
    empleadoId = empleadoSelect.value
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
  return root
}
