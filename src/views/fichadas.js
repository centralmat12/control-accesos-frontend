import { getEmpleados } from '../api/empleados.js'
import { getEmpresaActual } from '../api/empresas.js'
import { FICHADAS_LIMITE, getFichadas } from '../api/fichadas.js'
import { createFichadasTable } from '../components/fichadas-table.js'
import { createFeedbackState, createLoadingState } from '../components/feedback-state.js'
import { printReport } from '../components/fichadas-print.js'
import { createJornadasTable } from '../components/jornadas-table.js'
import { createStatCard } from '../components/stat-card.js'
import { iconCalendar, iconClock, iconLogin, iconLogout } from '../components/icons.js'
import { buildCsv, downloadCsv } from '../utils/csv.js'
import {
  displayMetodoLabel,
  displayTipoLabel,
  esTipoEntrada,
  esTipoSalida,
  formatDate,
  formatDateTime,
  formatTime,
  normalizarFiltro,
  todayDateKey,
  toDateKey,
} from '../utils/format.js'
import { buildJornadas } from '../utils/jornadas.js'

const CONTROL_CLASS =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'

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

function matchesNormalized(actual, expected) {
  if (expected === 'todos') return true
  return normalizarFiltro(actual) === normalizarFiltro(expected)
}

function inDateRange(fechaHora, desde, hasta) {
  if (!fechaHora) return false
  const key = toDateKey(fechaHora)
  if (desde && key < desde) return false
  if (hasta && key > hasta) return false
  return true
}

function filterFichadas(fichadas, { query, tipo, metodo, desde, hasta }) {
  const normalizedQuery = query.trim().toLowerCase()

  return fichadas.filter((fichada) => {
    if (!matchesSearch(fichada, normalizedQuery)) return false
    if (!matchesNormalized(fichada.tipo, tipo)) return false
    if (!matchesNormalized(fichada.metodo, metodo)) return false
    if (!inDateRange(fichada.fechaHora, desde, hasta)) return false
    return true
  })
}

function summarizeMovimientos(fichadas) {
  return {
    total: fichadas.length,
    entradas: fichadas.filter((item) => esTipoEntrada(item.tipo)).length,
    salidas: fichadas.filter((item) => esTipoSalida(item.tipo)).length,
  }
}

function describeFilters({ query, tipo, metodo, desde, hasta }) {
  const parts = []
  if (query.trim()) parts.push(`Búsqueda: ${query.trim()}`)
  parts.push(`Tipo: ${tipo === 'todos' ? 'Todos' : displayTipoLabel(tipo)}`)
  parts.push(`Método: ${metodo === 'todos' ? 'Todos' : displayMetodoLabel(metodo)}`)
  if (desde && hasta) parts.push(`Período: ${desde} a ${hasta}`)
  else if (desde) parts.push(`Desde: ${desde}`)
  else if (hasta) parts.push(`Hasta: ${hasta}`)
  else parts.push('Período: todos los registros cargados')
  return parts.join(' · ')
}

function empresaLabel(empresa) {
  if (!empresa) return ''
  return empresa.nombreFantasia || empresa.razonSocial || ''
}

function createSummaryCards(summary) {
  const cards = document.createElement('div')
  cards.className = 'grid gap-4 sm:grid-cols-2 xl:grid-cols-4'

  cards.append(
    createStatCard({
      label: 'Resultados filtrados',
      value: summary.total,
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
      label: 'Jornadas',
      value: summary.jornadas,
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
      <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-6 xl:items-end">
        <div class="min-w-0 sm:col-span-2">
          <label for="fichadas-search" class="mb-1.5 block text-sm font-medium text-slate-700">Buscar</label>
          <input id="fichadas-search" type="search" placeholder="Nombre, apellido o legajo" class="${CONTROL_CLASS}" />
        </div>
        <div>
          <label for="fichadas-tipo" class="mb-1.5 block text-sm font-medium text-slate-700">Tipo</label>
          <select id="fichadas-tipo" class="${CONTROL_CLASS}">
            <option value="todos">Todos</option>
            <option value="Entrada">Entrada</option>
            <option value="Salida">Salida</option>
          </select>
        </div>
        <div>
          <label for="fichadas-metodo" class="mb-1.5 block text-sm font-medium text-slate-700">Método</label>
          <select id="fichadas-metodo" class="${CONTROL_CLASS}">
            <option value="todos">Todos</option>
            <option value="Biometrico">Biométrico</option>
            <option value="Manual">Manual</option>
          </select>
        </div>
        <div>
          <label for="fichadas-desde" class="mb-1.5 block text-sm font-medium text-slate-700">Desde</label>
          <input id="fichadas-desde" type="date" class="${CONTROL_CLASS}" />
        </div>
        <div>
          <label for="fichadas-hasta" class="mb-1.5 block text-sm font-medium text-slate-700">Hasta</label>
          <input id="fichadas-hasta" type="date" class="${CONTROL_CLASS}" />
        </div>
      </div>
      <p id="fichadas-date-error" class="mt-3 hidden text-sm text-red-600"></p>
      <div class="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
        <button type="button" id="fichadas-clear" class="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
          Limpiar filtros
        </button>
        <button type="button" id="fichadas-csv" class="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50">
          Exportar CSV
        </button>
        <button type="button" id="fichadas-print" class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50">
          Imprimir / Guardar PDF
        </button>
      </div>
    </section>
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div class="inline-flex rounded-lg border border-slate-200 bg-white p-1 shadow-sm" role="tablist" aria-label="Vista de fichadas">
        <button type="button" id="fichadas-tab-movimientos" role="tab" aria-selected="true" class="rounded-md px-3 py-2 text-sm font-medium bg-blue-600 text-white">
          Movimientos
        </button>
        <button type="button" id="fichadas-tab-jornadas" role="tab" aria-selected="false" class="rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">
          Resumen de jornadas
        </button>
      </div>
      <p id="fichadas-count" class="text-sm text-slate-500"></p>
    </div>
    <p id="fichadas-limit-note" class="text-xs text-slate-500"></p>
    <div id="fichadas-results"></div>
  `

  const summaryContainer = view.querySelector('#fichadas-summary')
  const results = view.querySelector('#fichadas-results')
  const searchInput = view.querySelector('#fichadas-search')
  const tipoSelect = view.querySelector('#fichadas-tipo')
  const metodoSelect = view.querySelector('#fichadas-metodo')
  const desdeInput = view.querySelector('#fichadas-desde')
  const hastaInput = view.querySelector('#fichadas-hasta')
  const dateError = view.querySelector('#fichadas-date-error')
  const clearButton = view.querySelector('#fichadas-clear')
  const csvButton = view.querySelector('#fichadas-csv')
  const printButton = view.querySelector('#fichadas-print')
  const tabMovimientos = view.querySelector('#fichadas-tab-movimientos')
  const tabJornadas = view.querySelector('#fichadas-tab-jornadas')
  const countLabel = view.querySelector('#fichadas-count')
  const limitNote = view.querySelector('#fichadas-limit-note')

  let fichadas = []
  let empleadoById = new Map()
  let empresa = null
  let loaded = false
  let activeView = 'movimientos'

  function getFilters() {
    return {
      query: searchInput.value,
      tipo: tipoSelect.value,
      metodo: metodoSelect.value,
      desde: desdeInput.value,
      hasta: hastaInput.value,
    }
  }

  function dateRangeError(filters) {
    if (filters.desde && hastaInput.value && filters.desde > filters.hasta) {
      return 'La fecha Desde no puede ser posterior a Hasta.'
    }
    return ''
  }

  function setTabStyles() {
    const active = 'rounded-md px-3 py-2 text-sm font-medium bg-blue-600 text-white'
    const idle = 'rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100'
    tabMovimientos.className = activeView === 'movimientos' ? active : idle
    tabJornadas.className = activeView === 'jornadas' ? active : idle
    tabMovimientos.setAttribute('aria-selected', String(activeView === 'movimientos'))
    tabJornadas.setAttribute('aria-selected', String(activeView === 'jornadas'))
  }

  function setExportEnabled(enabled) {
    csvButton.disabled = !enabled
    printButton.disabled = !enabled
  }

  function currentDataset(filters) {
    const error = dateRangeError(filters)
    const filtered = error ? [] : filterFichadas(fichadas, filters)
    const jornadas = buildJornadas(filtered, empleadoById)
    const totals = summarizeMovimientos(filtered)
    return { error, filtered, jornadas, totals }
  }

  function renderSummary(dataset) {
    summaryContainer.replaceChildren(
      createSummaryCards({
        ...dataset.totals,
        jornadas: dataset.jornadas.length,
      }),
    )
  }

  function renderResults() {
    if (!loaded) return

    const filters = getFilters()
    const error = dateRangeError(filters)
    dateError.textContent = error
    dateError.classList.toggle('hidden', !error)

    if (error) {
      setExportEnabled(false)
      countLabel.textContent = ''
      results.replaceChildren(
        createFeedbackState({
          title: 'Período inválido',
          message: error,
          tone: 'error',
        }),
      )
      renderSummary({ totals: { total: 0, entradas: 0, salidas: 0 }, jornadas: [] })
      return
    }

    const dataset = currentDataset(filters)
    renderSummary(dataset)
    const rows = activeView === 'movimientos' ? dataset.filtered : dataset.jornadas
    const noun = activeView === 'movimientos' ? 'movimientos' : 'jornadas'
    countLabel.textContent = `${rows.length} ${noun}`
    setExportEnabled(rows.length > 0)

    if (rows.length === 0) {
      results.replaceChildren(
        createFeedbackState({
          title: 'Sin resultados',
          message:
            activeView === 'movimientos'
              ? 'No hay fichadas que coincidan con la búsqueda o los filtros seleccionados.'
              : 'No hay jornadas para los filtros seleccionados.',
        }),
      )
      return
    }

    results.replaceChildren(
      activeView === 'movimientos' ? createFichadasTable(dataset.filtered) : createJornadasTable(dataset.jornadas),
    )
  }

  async function loadFichadas() {
    loaded = false
    summaryContainer.replaceChildren()
    countLabel.textContent = ''
    setExportEnabled(false)
    results.replaceChildren(createLoadingState('Cargando fichadas...'))

    try {
      const [fichadasResult, empleadosResult, empresaResult] = await Promise.allSettled([
        getFichadas(),
        getEmpleados(),
        getEmpresaActual(),
      ])

      if (fichadasResult.status === 'rejected') {
        throw fichadasResult.reason
      }

      if (
        empleadosResult.status === 'rejected' &&
        empleadosResult.reason?.message === 'Sesión expirada o no autorizada.'
      ) {
        return
      }

      if (
        empresaResult.status === 'rejected' &&
        empresaResult.reason?.message === 'Sesión expirada o no autorizada.'
      ) {
        return
      }

      fichadas = fichadasResult.value
      const empleados = empleadosResult.status === 'fulfilled' ? empleadosResult.value : []
      empleadoById = new Map(empleados.map((empleado) => [Number(empleado.id), empleado]))
      empresa = empresaResult.status === 'fulfilled' ? empresaResult.value : null
      loaded = true

      const capped = fichadas.length >= FICHADAS_LIMITE
      limitNote.textContent = capped
        ? `La API entrega como máximo ${FICHADAS_LIMITE} fichadas recientes. Esta vista, el CSV y el PDF no son el histórico completo.`
        : `Se consultaron hasta ${FICHADAS_LIMITE} fichadas recientes (límite de la API). El CSV y el PDF exportan solo este conjunto filtrado.`

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
    desdeInput.value = ''
    hastaInput.value = ''
    renderResults()
  }

  function setView(nextView) {
    activeView = nextView
    setTabStyles()
    renderResults()
  }

  function exportCsv() {
    const filters = getFilters()
    if (dateRangeError(filters)) return
    const dataset = currentDataset(filters)
    const stamp = todayDateKey()

    if (activeView === 'movimientos') {
      if (dataset.filtered.length === 0) return
      const csv = buildCsv(
        ['Empleado', 'Legajo', 'Fecha', 'Hora', 'Tipo', 'Método'],
        dataset.filtered.map((item) => [
          item.empleado ?? '',
          item.legajo ?? '',
          item.fechaHora ? formatDate(item.fechaHora) : '',
          item.fechaHora ? formatTime(item.fechaHora) : '',
          displayTipoLabel(item.tipo),
          displayMetodoLabel(item.metodo),
        ]),
      )
      downloadCsv(`fichadas-${stamp}.csv`, csv)
      return
    }

    if (dataset.jornadas.length === 0) return
    const csv = buildCsv(
      [
        'Empleado',
        'Legajo',
        'Fecha',
        'Horario previsto',
        'Hora de ingreso',
        'Hora de egreso',
        'Método de ingreso',
        'Método de egreso',
      ],
      dataset.jornadas.map((item) => [
        item.empleado ?? '',
        item.legajo ?? '',
        item.fecha,
        item.horarioPrevisto,
        item.ingresoHora,
        item.egresoHora,
        item.metodoIngreso,
        item.metodoEgreso,
      ]),
    )
    downloadCsv(`jornadas-${stamp}.csv`, csv)
  }

  function exportPrint() {
    const filters = getFilters()
    if (dateRangeError(filters)) return
    const dataset = currentDataset(filters)
    const notes = [
      'El horario previsto es el horario actual del empleado, no un historial de la fecha de la fichada.',
      'Los turnos que cruzan medianoche se agrupan por fecha calendario; no se reasignan automáticamente.',
      `La API limita la consulta a ${FICHADAS_LIMITE} fichadas recientes.`,
    ]

    if (activeView === 'movimientos') {
      if (dataset.filtered.length === 0) return
      printReport({
        title: 'Reporte de movimientos',
        empresa: empresaLabel(empresa),
        generatedAt: formatDateTime(new Date().toISOString()),
        filters: describeFilters(filters),
        totals: dataset.totals,
        columns: ['Empleado', 'Legajo', 'Fecha', 'Hora', 'Tipo', 'Método'],
        rows: dataset.filtered.map((item) => [
          item.empleado ?? '',
          item.legajo ?? '',
          item.fechaHora ? formatDate(item.fechaHora) : '',
          item.fechaHora ? formatTime(item.fechaHora) : '',
          displayTipoLabel(item.tipo),
          displayMetodoLabel(item.metodo),
        ]),
        notes,
      })
      return
    }

    if (dataset.jornadas.length === 0) return
    printReport({
      title: 'Reporte de jornadas',
      empresa: empresaLabel(empresa),
      generatedAt: formatDateTime(new Date().toISOString()),
      filters: describeFilters(filters),
      totals: dataset.totals,
      columns: [
        'Empleado',
        'Legajo',
        'Fecha',
        'Horario previsto',
        'Hora de ingreso',
        'Hora de egreso',
        'Método de ingreso',
        'Método de egreso',
      ],
      rows: dataset.jornadas.map((item) => [
        item.empleado ?? '',
        item.legajo ?? '',
        item.fecha,
        item.horarioPrevisto,
        item.ingresoHora,
        item.egresoHora,
        item.metodoIngreso,
        item.metodoEgreso,
      ]),
      notes,
    })
  }

  searchInput.addEventListener('input', renderResults)
  tipoSelect.addEventListener('change', renderResults)
  metodoSelect.addEventListener('change', renderResults)
  desdeInput.addEventListener('change', renderResults)
  hastaInput.addEventListener('change', renderResults)
  clearButton.addEventListener('click', clearFilters)
  csvButton.addEventListener('click', exportCsv)
  printButton.addEventListener('click', () => {
    try {
      exportPrint()
    } catch (error) {
      results.prepend(
        createFeedbackState({
          title: 'No se pudo abrir la impresión',
          message: error.message,
          tone: 'error',
        }),
      )
    }
  })
  tabMovimientos.addEventListener('click', () => setView('movimientos'))
  tabJornadas.addEventListener('click', () => setView('jornadas'))

  setTabStyles()
  setExportEnabled(false)
  container.replaceChildren(view)
  await loadFichadas()
}
