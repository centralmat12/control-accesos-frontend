import { getEmpleados } from '../api/empleados.js'
import { getCurrentUser } from '../api/auth.js'
import { canLoadTenantData } from '../api/empresa-context.js'
import { empresaDisplayName, getEmpresaActual } from '../api/empresas.js'
import { FICHADAS_LIMITE, getFichadas } from '../api/fichadas.js'
import { createEmpleadoCombobox } from '../components/empleado-combobox.js'
import { createColumnPicker } from '../components/column-picker.js'
import { BTN_SECONDARY_CLASS } from '../components/button-styles.js'
import { createFichadasTable } from '../components/fichadas-table.js'
import { createFeedbackState, createSelectEmpresaState } from '../components/feedback-state.js'
import { printReport } from '../components/fichadas-print.js'
import { openJornadaDetalle } from '../components/jornada-detalle.js'
import { createJornadasTable } from '../components/jornadas-table.js'
import { createPagination } from '../components/pagination.js'
import { createTableSkeleton } from '../components/skeleton.js'
import { createStatCard } from '../components/stat-card.js'
import { iconAlertTriangle, iconCalendar, iconClock, iconLogin, iconLogout } from '../components/icons.js'
import { buildCsv, downloadCsv } from '../utils/csv.js'
import {
  displayMetodoLabel,
  displayTipoLabel,
  formatDate,
  formatDateTime,
  formatTime,
  todayDateKey,
} from '../utils/format.js'
import { buildJornadas, buildJornadasCsvRows, summarizeJornadasVista } from '../utils/jornadas.js'
import {
  JORNADAS_EXPORT_HEADERS,
  JORNADAS_PRINT_HEADERS,
  MOVIMIENTOS_EXPORT_HEADERS,
  isMobileColumnViewport,
  loadColumnIds,
  saveColumnIds,
  visibleColumnCount,
} from '../utils/fichadas-columns.js'
import {
  annotateMovimientos,
  filterMovimientosOriginales,
  summarizeMovimientosVista,
} from '../utils/movimientos.js'
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS, paginateItems } from '../utils/paginate.js'
import { describePeriodo, resolvePeriodRange } from '../utils/period.js'

const CONTROL_CLASS =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100'

/**
 * Decisión de filtros:
 * Tipo y Método filtran solo la auditoría de movimientos originales, en el cliente.
 * El resumen de jornadas se calcula sobre el conjunto de la API filtrado por empleado y período.
 * Así el filtro visual de Tipo no oculta el ingreso o el egreso calculados.
 * Antes, Tipo y Método iban en la consulta y el resumen podía quedar parcial.
 */
const FILTER_HELP =
  'Tipo y Método filtran los movimientos originales. El resumen de jornadas usa empleado y período, sin perder ingreso o egreso por el filtro de Tipo.'

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

function createSummaryCards(activeView, dataset) {
  const cards = document.createElement('div')
  cards.className = 'grid gap-4 sm:grid-cols-2 xl:grid-cols-4'

  if (activeView === 'jornadas') {
    const summary = summarizeJornadasVista(dataset.jornadas)
    cards.append(
      createStatCard({
        label: 'Jornadas',
        value: summary.total,
        icon: iconCalendar(),
        accent: 'blue',
      }),
      createStatCard({
        label: 'Completas',
        value: summary.completas,
        icon: iconClock(),
        accent: 'emerald',
      }),
      createStatCard({
        label: 'En curso',
        value: summary.enCurso,
        icon: iconLogin(),
        accent: 'indigo',
      }),
      createStatCard({
        label: 'Pendientes',
        value: summary.pendientes,
        icon: iconLogout(),
        accent: 'amber',
      }),
    )
    return cards
  }

  const summary = dataset.movimientoTotals
  cards.append(
    createStatCard({
      label: 'Movimientos totales',
      value: summary.total,
      icon: iconClock(),
      accent: 'indigo',
    }),
    createStatCard({
      label: 'Entradas informadas',
      value: summary.entradas,
      icon: iconLogin(),
      accent: 'emerald',
    }),
    createStatCard({
      label: 'Salidas informadas',
      value: summary.salidas,
      icon: iconLogout(),
      accent: 'amber',
    }),
    createStatCard({
      label: 'Posibles duplicados',
      value: summary.posiblesDuplicados,
      icon: iconAlertTriangle(),
      accent: 'amber',
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
      <h2 class="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">Fichadas</h2>
      <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">Consultá los registros de asistencia de los empleados.</p>
    </section>
    <div id="fichadas-summary"></div>
    <section class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-5">
      <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-5 xl:items-end">
        <div id="fichadas-empleado-wrap" class="min-w-0 sm:col-span-2"></div>
        <div>
          <label for="fichadas-periodo" class="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Período</label>
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
          <label for="fichadas-tipo" class="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Tipo</label>
          <select id="fichadas-tipo" class="${CONTROL_CLASS}" aria-describedby="fichadas-filter-help">
            <option value="todos">Todos</option>
            <option value="Entrada">Entrada</option>
            <option value="Salida">Salida</option>
          </select>
        </div>
        <div>
          <label for="fichadas-metodo" class="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Método</label>
          <select id="fichadas-metodo" class="${CONTROL_CLASS}" aria-describedby="fichadas-filter-help">
            <option value="todos">Todos</option>
            <option value="Biometrico">Biométrico</option>
            <option value="Manual">Manual</option>
          </select>
        </div>
      </div>
      <p id="fichadas-filter-help" class="mt-3 text-xs leading-5 text-slate-500 dark:text-slate-400">${FILTER_HELP}</p>
      <div id="fichadas-custom-dates" class="mt-4 hidden grid gap-4 sm:grid-cols-2">
        <div>
          <label for="fichadas-desde" class="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Desde</label>
          <input id="fichadas-desde" type="date" class="${CONTROL_CLASS}" />
        </div>
        <div>
          <label for="fichadas-hasta" class="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Hasta</label>
          <input id="fichadas-hasta" type="date" class="${CONTROL_CLASS}" />
        </div>
      </div>
      <p id="fichadas-date-error" class="mt-3 hidden text-sm text-red-600"></p>
      <div class="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
        <button type="button" id="fichadas-clear" class="${BTN_SECONDARY_CLASS}">
          Limpiar filtros
        </button>
        <button type="button" id="fichadas-csv" class="${BTN_SECONDARY_CLASS}">
          Exportar CSV
        </button>
        <button type="button" id="fichadas-print" class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50">
          Imprimir / Guardar PDF
        </button>
      </div>
    </section>
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div class="inline-flex rounded-lg border border-slate-200 bg-white p-1 shadow-sm dark:border-slate-700 dark:bg-slate-900" role="tablist" aria-label="Vista de fichadas">
        <button type="button" id="fichadas-tab-movimientos" role="tab" aria-selected="true" class="rounded-md px-3 py-2 text-sm font-medium bg-blue-600 text-white">
          Movimientos registrados
        </button>
        <button type="button" id="fichadas-tab-jornadas" role="tab" aria-selected="false" class="rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">
          Resumen de jornadas
        </button>
      </div>
      <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
        <label for="fichadas-page-size" class="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
          <span>Mostrar</span>
          <select id="fichadas-page-size" class="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100">
            ${PAGE_SIZE_OPTIONS.map((size) => `<option value="${size}" ${size === DEFAULT_PAGE_SIZE ? 'selected' : ''}>${size}</option>`).join('')}
          </select>
        </label>
        <div id="fichadas-columnas-wrap"></div>
        <p id="fichadas-count" class="text-sm text-slate-500 dark:text-slate-400"></p>
      </div>
    </div>
    <p id="fichadas-limit-note" class="hidden rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200"></p>
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
  const columnasWrap = view.querySelector('#fichadas-columnas-wrap')
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
  let jornadaDetalleModal = null
  const columnStorage = window.localStorage
  const isMobileColumns = isMobileColumnViewport(window.innerWidth)
  const columnPrefs = {
    movimientos: loadColumnIds('movimientos', { storage: columnStorage, isMobile: isMobileColumns }).ids,
    jornadas: loadColumnIds('jornadas', { storage: columnStorage, isMobile: isMobileColumns }).ids,
  }
  const columnPicker = createColumnPicker({
    id: 'fichadas-columnas',
    view: 'movimientos',
    selectedIds: columnPrefs.movimientos,
    isMobile: isMobileColumns,
    onChange: (viewId, ids) => {
      columnPrefs[viewId] = ids
      saveColumnIds(viewId, ids, { storage: columnStorage })
      renderResults()
    },
  })
  columnasWrap.replaceChildren(columnPicker.element)
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
      empleadoId: filters.empleadoId || undefined,
    }
  }

  function setTabStyles() {
    const active = 'rounded-md px-3 py-2 text-sm font-medium bg-blue-600 text-white'
    const idle =
      'rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
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
    const periodSet = error ? [] : annotateMovimientos(fichadas)
    const movimientos = filterMovimientosOriginales(periodSet, {
      tipo: filters.tipo,
      metodo: filters.metodo,
    })
    const jornadas = error ? [] : buildJornadas(fichadas, empleadoById)
    return {
      error,
      periodSet,
      movimientos,
      jornadas,
      movimientoTotals: summarizeMovimientosVista(movimientos),
      jornadaTotals: summarizeJornadasVista(jornadas),
    }
  }

  function updateLimitNote() {
    const capped = fichadas.length >= FICHADAS_LIMITE
    limitNote.textContent = capped
      ? `La consulta alcanzó el límite máximo de ${FICHADAS_LIMITE} registros de la API. El listado y el resumen pueden estar incompletos.`
      : ''
    limitNote.classList.toggle('hidden', !capped)
  }

  function renderSummary(dataset) {
    summaryContainer.replaceChildren(createSummaryCards(activeView, dataset))
  }

  function renderTablePlaceholder(placeholder, { onPlaceholderAction } = {}) {
    if (activeView === 'jornadas') {
      return createJornadasTable([], {
        visibleColumnIds: columnPrefs.jornadas,
        placeholder,
        onPlaceholderAction,
      })
    }
    return createFichadasTable([], {
      visibleColumnIds: columnPrefs.movimientos,
      placeholder,
      onPlaceholderAction,
    })
  }

  function openDetalle(jornada) {
    jornadaDetalleModal?.close({ force: true })
    jornadaDetalleModal = openJornadaDetalle(jornada)
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
        renderTablePlaceholder({
          title: 'Período inválido',
          message: error,
        }),
      )
      renderSummary({
        movimientos: [],
        jornadas: [],
        movimientoTotals: summarizeMovimientosVista([]),
      })
      return
    }

    const dataset = currentDataset(filters)
    renderSummary(dataset)

    const isMovimientos = activeView === 'movimientos'
    const rows = isMovimientos ? dataset.movimientos : dataset.jornadas
    const noun = isMovimientos ? 'movimientos' : 'jornadas'
    const page = isMovimientos ? movimientosPage : jornadasPage
    const paged = paginateItems(rows, page, pageSize)

    if (isMovimientos) movimientosPage = paged.page
    else jornadasPage = paged.page

    setExportEnabled(rows.length > 0)

    if (rows.length === 0) {
      countLabel.textContent = `0 ${noun}`
      results.replaceChildren(
        renderTablePlaceholder({
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
      isMovimientos
        ? createFichadasTable(paged.items, { visibleColumnIds: columnPrefs.movimientos })
        : createJornadasTable(paged.items, {
            visibleColumnIds: columnPrefs.jornadas,
            onVerMovimientos: openDetalle,
          }),
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
    results.replaceChildren(
      createTableSkeleton({
        rows: 8,
        columns: visibleColumnCount(activeView, columnPrefs[activeView]),
        label: 'Cargando fichadas',
      }),
    )

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
        renderTablePlaceholder(
          {
            title: 'No se pudo cargar la lista',
            message: error.message || 'Ocurrió un error al consultar las fichadas.',
            actionLabel: 'Reintentar',
          },
          { onPlaceholderAction: loadFichadas },
        ),
      )
    }
  }

  function onServerFilterChange() {
    syncCustomDates()
    resetPages()
    loadFichadas()
  }

  function onClientFilterChange() {
    movimientosPage = 1
    renderResults()
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
    columnPicker.close()
    columnPicker.setState({
      view: nextView,
      selectedIds: columnPrefs[nextView],
      isMobile: isMobileColumns,
    })
    renderResults()
  }

  function exportNotes(capped, filters) {
    const notes = [
      'El ingreso y el egreso del resumen se calculan usando la primera y la última marcación válida del día. Los movimientos originales permanecen disponibles para auditoría.',
      'El horario previsto es el horario actual del empleado, no un historial de la fecha de la fichada.',
      'Las jornadas que atraviesan medianoche pueden requerir una regla adicional basada en el turno asignado.',
      'Tipo y Método filtran movimientos originales. El resumen de jornadas usa empleado y período.',
    ]

    if (filters.tipo !== 'todos' || filters.metodo !== 'todos') {
      notes.push(
        'Los filtros de Tipo y Método se aplican a la auditoría de movimientos y no recortan el cálculo de ingreso y egreso del resumen.',
      )
    }

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
      if (dataset.movimientos.length === 0) return
      const csv = buildCsv(
        MOVIMIENTOS_EXPORT_HEADERS,
        dataset.movimientos.map((item) => [
          item.empleado ?? '',
          item.legajo ?? '',
          item.fechaHora ? formatDate(item.fechaHora) : '',
          item.fechaHora ? formatTime(item.fechaHora) : '',
          displayTipoLabel(item.tipo),
          displayMetodoLabel(item.metodo),
          item.observacionLabel ?? '',
        ]),
      )
      downloadCsv(`fichadas-${stamp}.csv`, csv)
      return
    }

    if (dataset.jornadas.length === 0) return
    const csv = buildCsv(
      JORNADAS_EXPORT_HEADERS,
      buildJornadasCsvRows(dataset.jornadas),
    )
    downloadCsv(`jornadas-${stamp}.csv`, csv)
  }

  function exportPrint() {
    const filters = getFilters()
    if (dateRangeError(filters)) return
    const dataset = currentDataset(filters)
    const notes = exportNotes(fichadas.length >= FICHADAS_LIMITE, filters)
    const filterText = describeFilters(filters, selectedEmpleadoLabel())

    if (activeView === 'movimientos') {
      if (dataset.movimientos.length === 0) return
      const totals = dataset.movimientoTotals
      printReport({
        title: 'Reporte de movimientos registrados',
        empresa: empresaLabel(empresa),
        generatedAt: formatDateTime(new Date().toISOString()),
        filters: filterText,
        totals,
        summaryLines: [
          `<p><strong>Movimientos totales:</strong> ${totals.total}</p>`,
          `<p><strong>Entradas informadas:</strong> ${totals.entradas} · <strong>Salidas informadas:</strong> ${totals.salidas} · <strong>Posibles duplicados:</strong> ${totals.posiblesDuplicados}</p>`,
        ],
        columns: MOVIMIENTOS_EXPORT_HEADERS,
        rows: dataset.movimientos.map((item) => [
          item.empleado ?? '',
          item.legajo ?? '',
          item.fechaHora ? formatDate(item.fechaHora) : '',
          item.fechaHora ? formatTime(item.fechaHora) : '',
          displayTipoLabel(item.tipo),
          displayMetodoLabel(item.metodo),
          item.observacionLabel ?? '',
        ]),
        notes,
      })
      return
    }

    if (dataset.jornadas.length === 0) return
    const totals = dataset.jornadaTotals
    printReport({
      title: 'Reporte de resumen de jornadas',
      empresa: empresaLabel(empresa),
      generatedAt: formatDateTime(new Date().toISOString()),
      filters: filterText,
      totals,
      summaryLines: [
        `<p><strong>Jornadas:</strong> ${totals.total}</p>`,
        `<p><strong>Completas:</strong> ${totals.completas} · <strong>En curso:</strong> ${totals.enCurso} · <strong>Pendientes:</strong> ${totals.pendientes}</p>`,
      ],
      columns: JORNADAS_PRINT_HEADERS,
      rows: dataset.jornadas.map((item) => [
        item.empleado ?? '',
        item.legajo ?? '',
        item.fecha,
        item.horarioPrevisto,
        item.ingresoHora,
        item.egresoHora,
        item.fichadasIntermediasLabel,
        String(item.posiblesDuplicados ?? 0),
        item.estado,
      ]),
      notes,
    })
  }

  periodoSelect.addEventListener('change', onServerFilterChange)
  tipoSelect.addEventListener('change', onClientFilterChange)
  metodoSelect.addEventListener('change', onClientFilterChange)
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
  return () => {
    columnPicker.destroy()
    empleadoCombobox.destroy()
    jornadaDetalleModal?.close({ force: true })
  }
}
