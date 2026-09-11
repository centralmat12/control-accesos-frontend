import {
  displayMetodoLabel,
  displayValue,
  formatDate,
  formatTime,
} from '../utils/format.js'
import { movementBadge } from './badge.js'
import { iconClock } from './icons.js'

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
      <td class="whitespace-nowrap px-4 py-3 text-sm text-slate-600 dark:text-slate-300">${item.fechaHora ? formatDate(item.fechaHora) : '—'}</td>
      <td class="whitespace-nowrap px-4 py-3 text-sm text-slate-600 dark:text-slate-300">${item.fechaHora ? formatTime(item.fechaHora) : '—'}</td>
      <td class="whitespace-nowrap px-4 py-3">${movementBadge(item.tipo)}</td>
      <td class="whitespace-nowrap px-4 py-3 text-sm text-slate-600 dark:text-slate-300">${displayValue(displayMetodoLabel(item.metodo))}</td>
    </tr>
  `
}

export function createRecentPunchesTable(fichadas, { onViewAll } = {}) {
  const sortedFichadas = sortByNewest(fichadas ?? [])

  const section = document.createElement('section')
  section.className =
    'flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900'

  section.innerHTML = `
    <div class="shrink-0 border-b border-slate-200 px-5 py-4 dark:border-slate-700">
      <h2 class="text-base font-semibold text-slate-900 dark:text-slate-100">Últimas fichadas</h2>
      <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">Movimientos más recientes del día.</p>
    </div>
    ${
      sortedFichadas.length
        ? `
        <div class="min-h-0 flex-1 overflow-auto">
          <table class="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
            <thead class="sticky top-0 z-10 bg-slate-50 dark:bg-slate-800">
              <tr>
                <th scope="col" class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Empleado</th>
                <th scope="col" class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Legajo</th>
                <th scope="col" class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Fecha</th>
                <th scope="col" class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Hora</th>
                <th scope="col" class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Tipo</th>
                <th scope="col" class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Método</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-900">
              ${sortedFichadas.map(rowTemplate).join('')}
            </tbody>
          </table>
        </div>
      `
        : `
        <div class="flex min-h-0 flex-1 flex-col items-center justify-center px-5 py-8 text-center">
          <span class="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300" aria-hidden="true">${iconClock()}</span>
          <p class="mt-3 text-sm font-medium text-slate-700 dark:text-slate-200">No hay fichadas registradas hoy.</p>
          <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">Los movimientos aparecerán aquí cuando se registren.</p>
        </div>
      `
    }
    <div class="mt-auto shrink-0 border-t border-slate-200 px-5 py-3 dark:border-slate-700">
      <button type="button" data-view-all class="text-sm font-medium text-blue-700 hover:text-blue-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-blue-300 dark:hover:text-blue-200">
        Ver todas
      </button>
    </div>
  `

  section.querySelector('[data-view-all]').addEventListener('click', () => onViewAll?.())
  return section
}
