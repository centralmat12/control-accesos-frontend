import { badgeHtml } from '../components/badge.js'
import { BTN_SECONDARY_CLASS } from '../components/button-styles.js'
import { createFeedbackState } from '../components/feedback-state.js'
import { showToast } from '../components/toast.js'
import {
  ACTIVITY_LOG_EVENT,
  LOG_LEVELS,
  clearActivityLogs,
  countActivityByLevel,
  getActivityLogs,
} from '../utils/activity-log.js'
import { escapeHtml, formatClockTime, formatDate } from '../utils/format.js'

const CONTROL_CLASS =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-60'

function levelTone(level) {
  if (level === LOG_LEVELS.OK) return 'success'
  if (level === LOG_LEVELS.WARNING) return 'warning'
  if (level === LOG_LEVELS.ERROR) return 'danger'
  return 'info'
}

function matchesQuery(entry, query) {
  if (!query) return true
  const haystack = [entry.action, entry.detail, entry.level].join(' ').toLowerCase()
  return haystack.includes(query)
}

export function renderRegistros(container) {
  const view = document.createElement('div')
  view.className = 'space-y-6'

  view.innerHTML = `
    <section class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p class="mt-1 text-sm text-slate-500">
          Actividad de esta pestaña. Se guarda solo en la sesión del navegador y se borra al cerrarla.
        </p>
      </div>
      <button
        type="button"
        id="registros-clear"
        class="${BTN_SECONDARY_CLASS}"
      >
        Limpiar registros
      </button>
    </section>
    <div id="registros-summary" class="grid gap-3 sm:grid-cols-2"></div>
    <section class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 xl:items-end">
        <div class="min-w-0 sm:col-span-2">
          <label for="registros-search" class="mb-1.5 block text-sm font-medium text-slate-700">Buscar</label>
          <input
            id="registros-search"
            type="search"
            placeholder="Acción o detalle"
            class="${CONTROL_CLASS}"
          />
        </div>
        <div class="min-w-0">
          <label for="registros-nivel" class="mb-1.5 block text-sm font-medium text-slate-700">Nivel</label>
          <select id="registros-nivel" class="${CONTROL_CLASS}">
            <option value="todos">Todos</option>
            <option value="INFO">INFO</option>
            <option value="OK">OK</option>
            <option value="WARNING">WARNING</option>
            <option value="ERROR">ERROR</option>
          </select>
        </div>
      </div>
    </section>
    <p id="registros-count" class="text-sm text-slate-500"></p>
    <div id="registros-results"></div>
  `

  const summary = view.querySelector('#registros-summary')
  const results = view.querySelector('#registros-results')
  const countLabel = view.querySelector('#registros-count')
  const searchInput = view.querySelector('#registros-search')
  const levelSelect = view.querySelector('#registros-nivel')
  const clearButton = view.querySelector('#registros-clear')

  function visibleLogs() {
    const query = String(searchInput.value ?? '').trim().toLowerCase()
    const level = levelSelect.value
    return getActivityLogs().filter(
      (entry) => (level === 'todos' || entry.level === level) && matchesQuery(entry, query),
    )
  }

  function renderSummary(all) {
    const counts = countActivityByLevel(all)
    summary.innerHTML = `
      <article class="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <p class="text-sm font-medium text-slate-500">Errores en esta sesión</p>
        <p class="mt-1 text-2xl font-semibold tracking-tight text-slate-900">${counts.error}</p>
      </article>
      <article class="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <p class="text-sm font-medium text-slate-500">Advertencias en esta sesión</p>
        <p class="mt-1 text-2xl font-semibold tracking-tight text-slate-900">${counts.warning}</p>
      </article>
    `
  }

  function renderResults() {
    const all = getActivityLogs()
    const items = visibleLogs()
    renderSummary(all)
    countLabel.textContent = items.length ? `${items.length} registro${items.length === 1 ? '' : 's'}` : ''

    if (all.length === 0) {
      results.replaceChildren(
        createFeedbackState({
          title: 'Sin registros',
          message: 'Todavía no hay actividad en esta sesión.',
        }),
      )
      return
    }

    if (items.length === 0) {
      results.replaceChildren(
        createFeedbackState({
          title: 'Sin resultados',
          message: 'No hay registros que coincidan con la búsqueda o el filtro.',
        }),
      )
      return
    }

    const section = document.createElement('section')
    section.className = 'overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm'
    section.innerHTML = `
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-slate-200">
          <thead class="bg-slate-50">
            <tr>
              <th scope="col" class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Fecha/Hora</th>
              <th scope="col" class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Nivel</th>
              <th scope="col" class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Acción</th>
              <th scope="col" class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Detalle</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            ${items
              .map((entry) => {
                const date = new Date(entry.at)
                const timeLabel = Number.isNaN(date.getTime())
                  ? '—'
                  : `${formatDate(date)} ${formatClockTime(date)}`
                return `
                  <tr class="align-top">
                    <td class="whitespace-nowrap px-4 py-3 text-sm text-slate-600">${escapeHtml(timeLabel)}</td>
                    <td class="whitespace-nowrap px-4 py-3">${badgeHtml(entry.level, levelTone(entry.level))}</td>
                    <td class="whitespace-nowrap px-4 py-3 text-sm font-medium text-slate-800">${escapeHtml(entry.action)}</td>
                    <td class="px-4 py-3 text-sm text-slate-600">${escapeHtml(entry.detail || '—')}</td>
                  </tr>
                `
              })
              .join('')}
          </tbody>
        </table>
      </div>
    `
    results.replaceChildren(section)
  }

  searchInput.addEventListener('input', renderResults)
  levelSelect.addEventListener('change', renderResults)
  clearButton.addEventListener('click', () => {
    clearActivityLogs()
    showToast({ message: 'Registros de esta sesión eliminados.', tone: 'success' })
    renderResults()
  })

  function onLogChange() {
    if (!view.isConnected) {
      window.removeEventListener(ACTIVITY_LOG_EVENT, onLogChange)
      return
    }
    renderResults()
  }

  window.addEventListener(ACTIVITY_LOG_EVENT, onLogChange)
  container.replaceChildren(view)
  renderResults()

  return () => {
    window.removeEventListener(ACTIVITY_LOG_EVENT, onLogChange)
  }
}
