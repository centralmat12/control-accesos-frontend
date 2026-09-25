import {
  displayMetodoLabel,
  displayValue,
  formatFichadaFecha,
  formatFichadaHora,
} from '../utils/format.js'
import { buildJornadas } from '../utils/jornadas.js'
import { fichadaDateKey } from '../utils/format.js'
import { movementBadge } from './badge.js'
import { createFichadasTimeline } from './fichadas-timeline.js'
import { iconClock } from './icons.js'

let dashboardActividadVista = 'fichadas'

function sortByNewest(fichadas) {
  return [...fichadas].sort((a, b) => {
    const aTime = new Date(a.fechaHora).getTime()
    const bTime = new Date(b.fechaHora).getTime()

    if (Number.isNaN(aTime) && Number.isNaN(bTime)) return 0
    if (Number.isNaN(aTime)) return 1
    if (Number.isNaN(bTime)) return -1
    return bTime - aTime
  })
}

function rowTemplate(item) {
  return `
    <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/70">
      <td class="whitespace-nowrap px-4 py-3 text-sm font-medium text-slate-900 dark:text-slate-100">${displayValue(item.empleado)}</td>
      <td class="whitespace-nowrap px-4 py-3 text-sm text-slate-600 dark:text-slate-300">${displayValue(item.legajo)}</td>
      <td class="whitespace-nowrap px-4 py-3 text-sm text-slate-600 dark:text-slate-300">${item.fechaHora ? formatFichadaFecha(item.fechaHora) : '—'}</td>
      <td class="whitespace-nowrap px-4 py-3 text-sm text-slate-600 dark:text-slate-300">${item.fechaHora ? formatFichadaHora(item.fechaHora) : '—'}</td>
      <td class="whitespace-nowrap px-4 py-3">${movementBadge(item.tipo)}</td>
      <td class="whitespace-nowrap px-4 py-3 text-sm text-slate-600 dark:text-slate-300">${displayValue(displayMetodoLabel(item.metodo))}</td>
    </tr>
  `
}

export function createRecentPunchesTable(fichadas, { onViewAll, onViewTimeline, empleados = [] } = {}) {
  const sortedFichadas = sortByNewest(fichadas ?? [])
  const todayKey = fichadaDateKey(new Date())
  const empleadoById = new Map(empleados.map((empleado) => [Number(empleado.id), empleado]))
  const now = new Date()
  const jornadasHoy = buildJornadas(fichadas ?? [], empleadoById, { now }).filter((item) => item.fecha === todayKey)

  const section = document.createElement('section')
  section.className =
    'flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900'

  section.innerHTML = `
    <div class="flex shrink-0 flex-col gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-700 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 class="text-base font-semibold text-slate-900 dark:text-slate-100">Actividad de hoy</h2>
        <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">Movimientos y jornadas recientes.</p>
      </div>
      <div class="inline-flex rounded-lg border border-slate-200 p-0.5 dark:border-slate-700" role="tablist" aria-label="Actividad de hoy">
        <button type="button" data-actividad="fichadas" role="tab" class="rounded-md px-2.5 py-1 text-xs font-medium">Últimas fichadas</button>
        <button type="button" data-actividad="jornadas" role="tab" class="rounded-md px-2.5 py-1 text-xs font-medium">Jornadas de hoy</button>
      </div>
    </div>
    <div data-actividad-viewport class="min-h-0 flex-1 overflow-auto pb-2"></div>
    <div class="mt-auto shrink-0 border-t border-slate-200 px-5 py-3 dark:border-slate-700">
      <button type="button" data-view-all class="text-sm font-medium text-blue-700 hover:text-blue-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-blue-300 dark:hover:text-blue-200">
        Ver todas
      </button>
    </div>
  `

  const body = section.querySelector('[data-actividad-viewport]')
  const link = section.querySelector('[data-view-all]')
  const tabs = [...section.querySelectorAll('[data-actividad]')]

  function paint() {
    const jornadas = dashboardActividadVista === 'jornadas'
    tabs.forEach((tab) => {
      const selected = tab.dataset.actividad === dashboardActividadVista
      tab.setAttribute('aria-selected', String(selected))
      tab.className = selected
        ? 'rounded-md bg-blue-600 px-2.5 py-1 text-xs font-medium text-white'
        : 'rounded-md px-2.5 py-1 text-xs font-medium text-slate-600 dark:text-slate-300'
    })
    link.textContent = jornadas ? 'Ver línea de tiempo completa' : 'Ver todas'
    if (jornadas) {
      body.replaceChildren(
        createFichadasTimeline(jornadasHoy, {
          now,
          includesToday: true,
          variant: 'compact',
          franja: { mode: 'office' },
          bodyClass: '',
        }),
      )
      return
    }
    body.innerHTML = sortedFichadas.length
      ? `<table class="min-w-full divide-y divide-slate-200 dark:divide-slate-700"><thead class="sticky top-0 z-10 bg-slate-50 dark:bg-slate-800"><tr>
          <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Empleado</th>
          <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Legajo</th>
          <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Fecha</th>
          <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Hora</th>
          <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Tipo</th>
          <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Método</th>
        </tr></thead><tbody class="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-900">${sortedFichadas.map(rowTemplate).join('')}</tbody></table>`
      : `<div class="flex min-h-0 flex-1 flex-col items-center justify-center px-5 py-8 text-center"><span class="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800" aria-hidden="true">${iconClock()}</span><p class="mt-3 text-sm font-medium text-slate-700 dark:text-slate-100">No hay fichadas registradas hoy.</p></div>`
  }

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      dashboardActividadVista = tab.dataset.actividad
      paint()
      body.scrollTop = 0
      body.scrollLeft = 0
    })
  })
  link.addEventListener('click', () => {
    if (dashboardActividadVista === 'jornadas') onViewTimeline?.()
    else onViewAll?.()
  })
  paint()
  return section
}
