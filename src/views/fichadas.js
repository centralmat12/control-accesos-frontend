import { getEmpleados } from '../api/empleados.js'
import { getCurrentUser } from '../api/auth.js'
import { canLoadTenantData } from '../api/empresa-context.js'
import { empresaDisplayName, getEmpresaActual } from '../api/empresas.js'
import { FICHADAS_LIMITE, getFichadas } from '../api/fichadas.js'
import { createEmpleadoCombobox } from '../components/empleado-combobox.js'
import { createFichadasTable } from '../components/fichadas-table.js'
import { createFeedbackState, createLoadingState, createSelectEmpresaState } from '../components/feedback-state.js'
import { printReport } from '../components/fichadas-print.js'
import { createJornadasTable } from '../components/jornadas-table.js'
import { createPagination } from '../components/pagination.js'
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
  todayDateKey,
} from '../utils/format.js'
import { buildJornadas } from '../utils/jornadas.js'
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS, paginateItems } from '../utils/paginate.js'
import { describePeriodo, resolvePeriodRange } from '../utils/period.js'

const CONTROL_CLASS =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'

function summarizeMovimientos(fichadas) {
  return {
    total: fichadas.length,
    entradas: fichadas.filter((item) => esTipoEntrada(item.tipo)).length,
    salidas: fichadas.filter((item) => esTipoSalida(item.tipo)).length,
  }
}

function describeFilters(filters, empleadoLabel) {
  const parts = []
  parts.push(`Tipo: ${filters.tipo === 'todos' ? 'Todos' : displayTipoLabel(filters.tipo)}`)
  parts.push(`Método: ${filters.metodo === 'todos' ? 'Todos' : displayMetodoLabel(filters.metodo)}`)
  parts.push(describePeriodo(filters.periodo, filters.desde, filters.hasta))
  if (empleadoLabel) parts.push(`Empleado: ${empleadoLabel}`)
  return parts.join(' · ')
}

function empresaLabel(empresa) {
  return empresaDisplayName(empresa, empresa?.id)
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
  if (!canLoadTenantData(getCurrentUser())) {
    const view = document.createElement('div')
    view.className = 'space-y-6'
    view.innerHTML = `
      <section>
        <h2 class="text-xl font-semibold tracking-tight text-slate-900">Fichadas</h2>
        <p class="mt-1 text-sm text-slate-500">Consultá los registros de asistencia de los empleados.</p>
      </section>
    `
    view.append(createSelectEmpresaState())
    container.replaceChildren(view)
    return
  }

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
        <div id="fichadas-empleado-wrap" class="min-w-0 sm:col-span-2"></div>
        <div>
          <label for="fichadas-periodo" class="mb-1.5 block text-sm font-medium text-slate-700">Período</label>
          <select id="fichadas-periodo" class="${CONTROL_CLASS}">
            <option value="todos">Todos / Sin filtro de fecha</option>
            <option value="hoy">Hoy</option>
            <option value="7">Últimos 7 días</option>
            <option value="15">Últimos 15 días</option>
            <option value="30">Últimos 30 días</option>
            <option value="60">Últimos 60 días</option>
            <option value="90">Últimos 90 días</option>
            <option value="personalizado">Personalizado</option>
          </select>
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
      </div>
      <div id="fichadas-custom-dates" class="mt-4 hidden grid gap-4 sm:grid-cols-2">
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
      <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
        <label for="fichadas-page-size" class="flex items-center gap-2 text-sm text-slate-600">
          <span>Mostrar</span>
          <select id="fichadas-page-size" class="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20">
            ${PAGE_SIZE_OPTIONS.map((size) => `<option value="${size}" ${size === DEFAULT_PAGE_SIZE ? 'selected' : ''}>${size}</option>`).join('')}
          </select>
        </label>
        <p id="fichadas-count" class="text-sm text-slate-500"></p>
      </div>
    </div>
    <p id="fichadas-limit-note" class="hidden rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"></p>
    <div id="fichadas-results"></div>
    <div id="fichadas-pagination"></div>
  `

  const summaryContainer = view.querySelector('#fichadas-summary')
  const results = view.querySelector('#fichadas-results')
  const paginationContainer = view.querySelector('#fichadas-pagination')
  const periodoSelect = view.querySelector('#fichadas-periodo')
  const tipoSelect = view.querySelector('#fichadas-tipo')
  const metodoSelect = view.querySelector('#fichadas-metodo')
  const empleadoWrap = view.querySelector('#fichadas-empleado-wrap')
  const customDates = view.querySelector('#fichadas-custom-dates')
  const desdeInput = view.querySelector('#fichadas-desde')
  const hastaInput = view.querySelector('#fichadas-hasta')
  const dateError = view.querySelector('#fichadas-date-error')
  const clearButton = view.querySelector('#fichadas-clear')
  const csvButton = view.querySelector('#fichadas-csv')
  const printButton = view.querySelector('#fichadas-print')
  const tabMovimientos = view.querySelector('#fichadas-tab-movimientos')
  const tabJornadas = view.querySelector('#fichadas-tab-jornadas')
  const pageSizeSelect = view.querySelector('#fichadas-page-size')
  const countLabel = view.querySelector('#fichadas-count')
  const limitNote = view.querySelector('#fichadas-limit-note')

  let fichadas = []
  let empleadoById = new Map()
  let empresa = null
  let empleadosLoaded = false
  let empresaLoaded = false
  let loaded = false
  let activeView = 'movimientos'
  let movimientosPage = 1
  let jornadasPage = 1
  let pageSize = DEFAULT_PAGE_SIZE
  let loadSeq = 0
  const empleadoCombobox = createEmpleadoCombobox({
    id: 'fichadas-empleado',
    onChange: () => onServerFilterChange(),
  })
  empleadoWrap.replaceChildren(empleadoCombobox.root)

  function getFilters() {
    return {
      periodo: periodoSelect.value,
      tipo: tipoSelect.value,
      metodo: metodoSelect.value,
      empleadoId: empleadoCombobox.getEmpleadoId(),
      desde: desdeInput.value,
      hasta: hastaInput.value,
    }
  }

  function syncCustomDates() {
    const isCustom = periodoSelect.value === 'personalizado'
    customDates.classList.toggle('hidden', !isCustom)
    desdeInput.disabled = !isCustom
    hastaInput.disabled = !isCustom
  }

  function dateRangeError(filters) {
    if (filters.periodo !== 'personalizado') return ''
    if (filters.desde && filters.hasta && filters.desde > filters.hasta) {
      return 'La fecha Desde no puede ser posterior a Hasta.'
    }
    return ''
  }

  function apiFilters(filters) {
    const range = resolvePeriodRange(filters.periodo, filters.desde, filters.hasta)
    return {
      ...range,
      tipo: filters.tipo === 'todos' ? undefined : filters.tipo,
      metodo: filters.metodo === 'todos' ? undefined : filters.metodo,
      empleadoId: filters.empleadoId || undefined,
    }
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

  function resetPages() {
    movimientosPage = 1
    jornadasPage = 1
  }

  function selectedEmpleadoLabel() {
    return empleadoCombobox.getSelectedLabel()
  }

  function currentDataset(filters) {
    const error = dateRangeError(filters)
    const filtered = error ? [] : fichadas
    const jornadas = buildJornadas(filtered, empleadoById)
    const totals = summarizeMovimientos(filtered)
    return { error, filtered, jornadas, totals }
  }

  function updateLimitNote() {
    const capped = fichadas.length >= FICHADAS_LIMITE
    limitNote.textContent = capped
      ? `La consulta alcanzó el límite máximo de ${FICHADAS_LIMITE} registros de la API. Pueden existir movimientos adicionales fuera de este resultado.`
      : ''
    limitNote.classList.toggle('hidden', !capped)
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
    paginationContainer.replaceChildren()

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

    const isMovimientos = activeView === 'movimientos'
    const rows = isMovimientos ? dataset.filtered : dataset.jornadas
    const noun = isMovimientos ? 'movimientos' : 'jornadas'
    const page = isMovimientos ? movimientosPage : jornadasPage
    const paged = paginateItems(rows, page, pageSize)

    if (isMovimientos) movimientosPage = paged.page
    else jornadasPage = paged.page

    setExportEnabled(rows.length > 0)

    if (rows.length === 0) {
      countLabel.textContent = `0 ${noun}`
      results.replaceChildren(
        createFeedbackState({
          title: 'Sin resultados',
          message: isMovimientos
            ? 'No hay fichadas que coincidan con los filtros seleccionados.'
            : 'No hay jornadas para los filtros seleccionados.',
        }),
      )
      return
    }

    countLabel.textContent = `Mostrando ${paged.from}–${paged.to} de ${paged.total} ${noun}`
    results.replaceChildren(
      isMovimientos ? createFichadasTable(paged.items) : createJornadasTable(paged.items),
    )

    if (paged.pageCount > 1) {
      paginationContainer.replaceChildren(
        createPagination({
          page: paged.page,
          pageCount: paged.pageCount,
          onPageChange: (nextPage) => {
            if (isMovimientos) movimientosPage = nextPage
            else jornadasPage = nextPage
            renderResults()
          },
        }),
      )
    }
  }

  async function loadFichadas() {
    const filters = getFilters()
    const error = dateRangeError(filters)
    dateError.textContent = error
    dateError.classList.toggle('hidden', !error)

    if (error) {
      loaded = true
      fichadas = []
      renderResults()
      return
    }

    const seq = ++loadSeq
    loaded = false
    summaryContainer.replaceChildren()
    countLabel.textContent = ''
    paginationContainer.replaceChildren()
    setExportEnabled(false)
    results.replaceChildren(createLoadingState('Cargando fichadas...'))

    try {
      const [fichadasResult, empleadosResult, empresaResult] = await Promise.allSettled([
        getFichadas(apiFilters(filters)),
        empleadosLoaded ? Promise.resolve([...empleadoById.values()]) : getEmpleados(),
        empresaLoaded ? Promise.resolve(empresa) : getEmpresaActual(),
      ])

      if (seq !== loadSeq) return

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
      if (empleadosResult.status === 'fulfilled') {
        const empleados = empleadosResult.value
        empleadoById = new Map(empleados.map((empleado) => [Number(empleado.id), empleado]))
        empleadoCombobox.setEmpleados(empleados)
        empleadosLoaded = true
      }
      if (empresaResult.status === 'fulfilled') {
        empresa = empresaResult.value
        empresaLoaded = true
      }
      loaded = true
      updateLimitNote()
      renderResults()
    } catch (error) {
      if (seq !== loadSeq) return
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

  function onServerFilterChange() {
    syncCustomDates()
    resetPages()
    loadFichadas()
  }

  function clearFilters() {
    periodoSelect.value = 'todos'
    tipoSelect.value = 'todos'
    metodoSelect.value = 'todos'
    empleadoCombobox.reset()
    desdeInput.value = ''
    hastaInput.value = ''
    syncCustomDates()
    resetPages()
    loadFichadas()
  }

  function setView(nextView) {
    activeView = nextView
    setTabStyles()
    renderResults()
  }

  function exportNotes(capped) {
    const notes = [
      'El horario previsto es el horario actual del empleado, no un historial de la fecha de la fichada.',
      'Los turnos que cruzan medianoche se agrupan por fecha calendario; no se reasignan automáticamente.',
    ]

    if (capped) {
      notes.push(
        `La consulta alcanzó el límite máximo de ${FICHADAS_LIMITE} registros de la API. Pueden existir movimientos adicionales fuera de este resultado.`,
      )
    }

    return notes
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
    const notes = exportNotes(fichadas.length >= FICHADAS_LIMITE)
    const filterText = describeFilters(filters, selectedEmpleadoLabel())

    if (activeView === 'movimientos') {
      if (dataset.filtered.length === 0) return
      printReport({
        title: 'Reporte de movimientos',
        empresa: empresaLabel(empresa),
        generatedAt: formatDateTime(new Date().toISOString()),
        filters: filterText,
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
      filters: filterText,
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

  periodoSelect.addEventListener('change', onServerFilterChange)
  tipoSelect.addEventListener('change', onServerFilterChange)
  metodoSelect.addEventListener('change', onServerFilterChange)
  desdeInput.addEventListener('change', onServerFilterChange)
  hastaInput.addEventListener('change', onServerFilterChange)
  pageSizeSelect.addEventListener('change', () => {
    pageSize = Number(pageSizeSelect.value) || DEFAULT_PAGE_SIZE
    resetPages()
    renderResults()
  })
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

  syncCustomDates()
  setTabStyles()
  setExportEnabled(false)
  container.replaceChildren(view)
  await loadFichadas()
}
