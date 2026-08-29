import { getFichadas } from '../api/fichadas.js'
import { createFichadasTable } from '../components/fichadas-table.js'
import { createFeedbackState, createLoadingState } from '../components/feedback-state.js'
import { createStatCard } from '../components/stat-card.js'
import { iconClock, iconLogin, iconLogout, iconCalendar } from '../components/icons.js'
import { todayDateKey, toDateKey } from '../utils/format.js'

function matchesSearch(fichada, query) {
  if (!query) return true

  const haystack = [
    fichada.nombre,
    fichada.apellido,
    fichada.empleado,
    fichada.legajo,
  ]
    .join(' ')
    .toLowerCase()

  return haystack.includes(query)
}

function filterFichadas(fichadas, { query, tipo, metodo, fecha }) {
  const normalizedQuery = query.trim().toLowerCase()

  return fichadas.filter((fichada) => {
    if (!matchesSearch(fichada, normalizedQuery)) return false
    if (tipo !== 'todos' && fichada.tipo !== tipo) return false
    if (metodo !== 'todos' && fichada.metodo !== metodo) return false
    if (fecha && toDateKey(fichada.fechaHora) !== fecha) return false
    return true
  })
}

function summarizeFichadas(fichadas) {
  const today = todayDateKey()
  const ofToday = fichadas.filter((item) => toDateKey(item.fechaHora) === today)

  return {
    fichadasHoy: ofToday.length,
    entradas: ofToday.filter((item) => item.tipo === 'Entrada').length,
    salidas: ofToday.filter((item) => item.tipo === 'Salida').length,
    registrosManuales: ofToday.filter((item) => item.metodo === 'Manual').length,
  }
}

function createSummaryCards(summary) {
  const cards = document.createElement('div')
  cards.className = 'grid gap-4 sm:grid-cols-2 xl:grid-cols-4'

  cards.append(
    createStatCard({
      label: 'Fichadas de hoy',
      value: summary.fichadasHoy,
      icon: iconClock(),
      accent: 'indigo',
    }),
    createStatCard({
      label: 'Entradas',
      value: summary.entradas,
      icon: iconLogin(),
      accent: 'emerald',
    }),
    createStatCard({
      label: 'Salidas',
      value: summary.salidas,
      icon: iconLogout(),
      accent: 'amber',
    }),
    createStatCard({
      label: 'Registros manuales',
      value: summary.registrosManuales,
      icon: iconCalendar(),
      accent: 'blue',
    }),
  )

  return cards
}

export async function renderFichadas(container) {
  const view = document.createElement('div')
  view.className = 'space-y-6'

  view.innerHTML = `
    <section>
      <h2 class="text-xl font-semibold tracking-tight text-slate-900">Fichadas</h2>
      <p class="mt-1 text-sm text-slate-500">Consultá los registros de asistencia de los empleados.</p>
    </section>
    <div id="fichadas-summary"></div>
    <section class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-5 xl:items-end">
        <div class="min-w-0 sm:col-span-2">
          <label for="fichadas-search" class="mb-1.5 block text-sm font-medium text-slate-700">Buscar</label>
          <input
            id="fichadas-search"
            type="search"
            placeholder="Nombre, apellido o legajo"
            class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
        <div>
          <label for="fichadas-tipo" class="mb-1.5 block text-sm font-medium text-slate-700">Tipo</label>
          <select
            id="fichadas-tipo"
            class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="todos">Todos</option>
            <option value="Entrada">Entrada</option>
            <option value="Salida">Salida</option>
          </select>
        </div>
        <div>
          <label for="fichadas-metodo" class="mb-1.5 block text-sm font-medium text-slate-700">Método</label>
          <select
            id="fichadas-metodo"
            class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="todos">Todos</option>
            <option value="Biométrico">Biométrico</option>
            <option value="Manual">Manual</option>
          </select>
        </div>
        <div>
          <label for="fichadas-fecha" class="mb-1.5 block text-sm font-medium text-slate-700">Fecha</label>
          <input
            id="fichadas-fecha"
            type="date"
            class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
      </div>
      <div class="mt-4 flex justify-end">
        <button
          type="button"
          id="fichadas-clear"
          class="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
        >
          Limpiar filtros
        </button>
      </div>
    </section>
    <div id="fichadas-results"></div>
  `

  const summaryContainer = view.querySelector('#fichadas-summary')
  const results = view.querySelector('#fichadas-results')
  const searchInput = view.querySelector('#fichadas-search')
  const tipoSelect = view.querySelector('#fichadas-tipo')
  const metodoSelect = view.querySelector('#fichadas-metodo')
  const fechaInput = view.querySelector('#fichadas-fecha')
  const clearButton = view.querySelector('#fichadas-clear')

  let fichadas = []
  let loaded = false

  function getFilters() {
    return {
      query: searchInput.value,
      tipo: tipoSelect.value,
      metodo: metodoSelect.value,
      fecha: fechaInput.value,
    }
  }

  function renderSummary() {
    summaryContainer.replaceChildren(createSummaryCards(summarizeFichadas(fichadas)))
  }

  function renderResults() {
    if (!loaded) return

    const filtered = filterFichadas(fichadas, getFilters())

    if (filtered.length === 0) {
      results.replaceChildren(
        createFeedbackState({
          title: 'Sin resultados',
          message: 'No hay fichadas que coincidan con la búsqueda o los filtros seleccionados.',
        }),
      )
      return
    }

    results.replaceChildren(createFichadasTable(filtered))
  }

  async function loadFichadas() {
    loaded = false
    summaryContainer.replaceChildren()
    results.replaceChildren(createLoadingState('Cargando fichadas...'))

    try {
      fichadas = await getFichadas()
      loaded = true
      renderSummary()
      renderResults()
    } catch (error) {
      loaded = false

      if (error.message === 'Sesión expirada o no autorizada.') {
        return
      }

      results.replaceChildren(
        createFeedbackState({
          title: 'No se pudo cargar la lista',
          message: error.message || 'Ocurrió un error al consultar las fichadas.',
          tone: 'error',
          actionLabel: 'Reintentar',
          onAction: loadFichadas,
        }),
      )
    }
  }

  function clearFilters() {
    searchInput.value = ''
    tipoSelect.value = 'todos'
    metodoSelect.value = 'todos'
    fechaInput.value = ''
    renderResults()
  }

  searchInput.addEventListener('input', renderResults)
  tipoSelect.addEventListener('change', renderResults)
  metodoSelect.addEventListener('change', renderResults)
  fechaInput.addEventListener('change', renderResults)
  clearButton.addEventListener('click', clearFilters)

  container.replaceChildren(view)
  await loadFichadas()
}
