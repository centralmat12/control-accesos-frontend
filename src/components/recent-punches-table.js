import {
  displayMetodoLabel,
  displayValue,
  formatDate,
  formatTime,
} from '../utils/format.js'
import { movementBadge } from './badge.js'
import { iconClock } from './icons.js'

const PAGE_SIZE = 10

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
  const pageCount = Math.max(1, Math.ceil(sortedFichadas.length / PAGE_SIZE))
  let currentPage = 1

  const section = document.createElement('section')
  section.className =
    'flex min-w-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900'

  section.innerHTML = `
    <div class="border-b border-slate-200 px-5 py-4 dark:border-slate-700">
      <h2 class="text-base font-semibold text-slate-900 dark:text-slate-100">Últimas fichadas</h2>
      <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">Movimientos más recientes del día.</p>
    </div>
    ${
      sortedFichadas.length
        ? `
        <div class="max-h-[30rem] overflow-auto lg:max-h-none lg:overflow-x-auto lg:overflow-y-visible">
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
            <tbody data-recent-rows class="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-900"></tbody>
          </table>
        </div>
      `
        : `
        <div class="px-5 py-8 text-center">
          <span class="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300" aria-hidden="true">${iconClock()}</span>
          <p class="mt-3 text-sm font-medium text-slate-700 dark:text-slate-200">No hay fichadas registradas hoy.</p>
          <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">Los movimientos aparecerán aquí cuando se registren.</p>
        </div>
      `
    }
    <div class="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-5 py-3 dark:border-slate-700">
      <button type="button" data-view-all class="text-sm font-medium text-blue-700 hover:text-blue-600 hover:underline dark:text-blue-300 dark:hover:text-blue-200">
        Ver todas
      </button>
      ${
        pageCount > 1
          ? `
          <nav data-recent-pagination class="flex items-center gap-3" aria-label="Paginación de últimas fichadas">
            <button type="button" data-previous-page aria-label="Página anterior" class="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-lg text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">‹</button>
            <span data-page-label class="min-w-28 text-center text-sm text-slate-600 dark:text-slate-300" aria-live="polite"></span>
            <button type="button" data-next-page aria-label="Página siguiente" class="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-lg text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">›</button>
          </nav>
        `
          : ''
      }
    </div>
  `

  section.querySelector('[data-view-all]').addEventListener('click', () => onViewAll?.())

  if (!sortedFichadas.length) {
    return section
  }

  const rows = section.querySelector('[data-recent-rows]')
  const previous = section.querySelector('[data-previous-page]')
  const next = section.querySelector('[data-next-page]')
  const pageLabel = section.querySelector('[data-page-label]')

  function renderPage() {
    const start = (currentPage - 1) * PAGE_SIZE
    rows.innerHTML = sortedFichadas
      .slice(start, start + PAGE_SIZE)
      .map(rowTemplate)
      .join('')

    if (!pageLabel) return
    pageLabel.textContent = `Página ${currentPage} de ${pageCount}`
    previous.disabled = currentPage === 1
    next.disabled = currentPage === pageCount
  }

  previous?.addEventListener('click', () => {
    if (currentPage === 1) return
    currentPage -= 1
    renderPage()
  })

  next?.addEventListener('click', () => {
    if (currentPage === pageCount) return
    currentPage += 1
    renderPage()
  })

  renderPage()
  return section
}
