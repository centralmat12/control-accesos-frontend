import { getEmpleados } from '../api/empleados.js'
import { createJornadasCalendarPanel } from '../components/jornadas-calendar-panel.js'
import { createAlertasPanel, presentarConteoJornadasIncompletas } from '../components/jornadas-alertas-panel.js'
import { getAlertasIncompletas } from '../api/jornadas.js'
import { openFichadaManual } from '../components/fichada-manual-panel.js'
import { openDiaLibre } from '../components/dia-libre-panel.js'
import { createRegistrarMenu } from '../components/registrar-menu.js'
import { closeFichadasOverlays } from '../components/modal.js'
import { puedeRegistrarFichadaManual, puedeVerAlertasJornada, puedeVerInformeAsistencia, registrarMenuActions } from '../config/labor-access.js'
import { getCurrentUser } from '../api/auth.js'
import { canLoadTenantData, getOperativeEmpresaId } from '../api/empresa-context.js'
import { empresaDisplayName, getEmpresaActual } from '../api/empresas.js'
import { FICHADAS_LIMITE, getFichadas } from '../api/fichadas.js'
import { pageHeadingMarkup } from '../components/page-heading.js'
import { createEmpleadoCombobox, empleadoDisplayLabel } from '../components/empleado-combobox.js'
import { createColumnPicker } from '../components/column-picker.js'
import { BTN_SECONDARY_CLASS } from '../components/button-styles.js'
import { FORM_LABEL_CLASS } from '../components/form-field.js'
import { createFichadasTable } from '../components/fichadas-table.js'
import { createFichadasTimeline, cruzaMedianoche } from '../components/fichadas-timeline.js'
import { closeObservacionesJornada } from '../components/jornada-observaciones.js'
import { FICHADAS_FRAME_CLASS } from '../components/fichadas-frame.js'
import { openFichadaObservacionModal } from '../components/fichada-observacion-form.js'
import { createFeedbackState, createSelectEmpresaState } from '../components/feedback-state.js'
import { printReport } from '../components/fichadas-print.js'
import { showToast } from '../components/toast.js'
import { bindTooltipRoot, hideTooltip, unbindTooltipRoot } from '../components/tooltip.js'
import { openJornadaDetalle } from '../components/jornada-detalle.js'
import { createJornadasTable } from '../components/jornadas-table.js'
import { createPagination } from '../components/pagination.js'
import { createTableSkeleton } from '../components/skeleton.js'
import { createFichadasEmptyState } from '../components/fichadas-empty-state.js'
import { createInformeAsistenciaPanel } from '../components/informe-asistencia-panel.js'
import { obtenerContextoInforme } from '../api/informe-asistencia.js'
import { iconAlertTriangle, iconCalendar, iconClock, iconInfo, iconLogin, iconLogout } from '../components/icons.js'
import { createExportMenu } from '../components/export-menu.js'
import { readHashParam } from '../utils/hash-route.js'
import { downloadCsv } from '../utils/csv.js'
import {
  escapeHtml,
  formatDateTime,
  todayDateKey,
} from '../utils/format.js'
import {
  filtrosMovimientosDeAlerta,
  presetAgregarFichada,
  presetCompletarEntrada,
  presetCompletarSalida,
  presetSalidaManual,
  puedeAgregarFichada,
  puedeCompletarEntrada,
  puedeCompletarSalida,
  resultadoSalidaManual,
} from '../utils/jornada-alerta.js'
import { buildJornadas, summarizeJornadasVista } from '../utils/jornadas.js'
import {
  CLASSIFICATION_SOURCE,
  applyClassificationDeclaration,
  clasificarSegunFuente,
  classificationSource,
  construirJornadasSegunFuente,
} from '../utils/classification-source.js'
import { CAPABILITY, CAPABILITY_STATUS, noteExtendedMetadata, resolveCapability } from '../api/capabilities.js'
import { CLASIFICACION_JORNADA_AYUDA } from '../utils/movimientos.js'
import {
  FICHADAS_TIPO_METODO_TOOLTIP,
  isMobileColumnViewport,
  loadColumnIds,
  saveColumnIds,
  visibleColumnCount,
} from '../utils/fichadas-columns.js'
import {
  FICHADAS_EXPORT_EMPTY_MESSAGE,
  FICHADAS_EXPORT_NO_COLUMNS_MESSAGE,
  buildFichadasCsvPayload,
  buildFichadasExportSnapshot,
  buildFichadasViewSelection,
  JORNADA_PRINT_COLUMNS,
  JORNADA_PRINT_NOTE,
} from '../utils/fichadas-export.js'

const FICHADAS_VIEW_IDS = {
  timeline: 'timeline',
  summary: 'jornadas',
  jornadas: 'jornadas',
  movements: 'movimientos',
  movimientos: 'movimientos',
}

export function resolveFichadasView(value) {
  return FICHADAS_VIEW_IDS[value] ?? 'timeline'
}
import {
  annotateMovimientos,
  filterMovimientosOriginales,
  matchesMetodoFiltro,
  summarizeMovimientosVista,
} from '../utils/movimientos.js'
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS, paginateItems } from '../utils/paginate.js'
import {
  FICHADAS_PERIODO_HOY,
  FICHADAS_PERIODO_INICIAL,
  FICHADAS_PERIODO_TODOS,
  resolvePeriodRange,
} from '../utils/period.js'
import {
  puedeEditarObservacionFichada,
  replaceFichadaObservacionInList,
  shouldApplyObservacionResponse,
} from '../utils/fichada-observacion.js'

const CONTROL_CLASS =
  'h-11 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100'

const INFO_BUTTON_CLASS =
  'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:hover:bg-slate-800 dark:hover:text-slate-200'

/**
 * Decisión de filtros:
 * Tipo y Método filtran solo la auditoría de movimientos originales, en el cliente.
 * El resumen de jornadas se calcula sobre el conjunto de la API filtrado por empleado y período.
 * Así el filtro visual de Tipo no oculta el ingreso o el egreso calculados.
 * Antes, Tipo y Método iban en la consulta y el resumen podía quedar parcial.
 */
function infoButtonMarkup({ id, tooltip, ariaLabel }) {
  return `<button type="button" id="${escapeHtml(id)}" class="${INFO_BUTTON_CLASS}" data-tooltip="${escapeHtml(tooltip)}" aria-label="${escapeHtml(ariaLabel)}">${iconInfo()}</button>`
}

function empresaLabel(empresa) {
  return empresaDisplayName(empresa, empresa?.id)
}

const EMPLEADO_SESION_PREFIX = 'ca.fichadas.empleado.'
const PENDIENTES_TOOLTIP = 'Fichadas incompletas que requieren revisión.'

export function claveEmpleadoFichadas(empresaId) {
  const id = Number(empresaId)
  return Number.isInteger(id) && id > 0 ? `${EMPLEADO_SESION_PREFIX}${id}` : ''
}

export function empleadoInicialFichadas(empleados, { stored = null } = {}) {
  const activos = (Array.isArray(empleados) ? empleados : [])
    .filter((empleado) => empleado?.activo !== false && Number(empleado?.id) > 0)
    .slice()
    .sort((a, b) => empleadoDisplayLabel(a).localeCompare(empleadoDisplayLabel(b), 'es', { sensitivity: 'base' }))
  if (stored != null) {
    if (stored === '') return ''
    if (activos.some((empleado) => String(empleado.id) === String(stored))) return String(stored)
  }
  return activos[0] ? String(activos[0].id) : ''
}

function summaryGridClass(count) {
  const columns = count >= 4 ? 'xl:grid-cols-4' : 'xl:grid-cols-3'
  return `grid min-w-0 items-stretch grid-cols-1 gap-4 overflow-x-hidden sm:grid-cols-2 ${columns}`
}

const SUMMARY_CARD_CLASS = 'flex h-full min-w-0 w-full cursor-pointer flex-col rounded-xl border p-5 text-left shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500'
const SUMMARY_ICON_CLASS = 'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg'

function summaryIconTone(accent) {
  if (accent === 'emerald') return 'bg-emerald-500/10 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-200'
  if (accent === 'orange') return 'bg-orange-500/10 text-orange-700 dark:bg-orange-400/10 dark:text-orange-200'
  if (accent === 'amber') return 'bg-amber-500/10 text-amber-700 dark:bg-amber-400/10 dark:text-amber-200'
  return 'bg-indigo-500/10 text-indigo-700 dark:bg-indigo-400/10 dark:text-indigo-200'
}

function summaryCardChrome({ active = false, attention = false } = {}) {
  if (active) {
    return 'border-amber-400 bg-amber-50/70 shadow-[inset_3px_0_0_0_var(--color-amber-500)] hover:border-amber-500 dark:border-amber-400 dark:bg-amber-950/30 dark:shadow-[inset_3px_0_0_0_var(--color-amber-400)]'
  }
  if (attention) {
    return 'border-amber-300 bg-white hover:border-amber-400 dark:border-amber-500/60 dark:bg-slate-900'
  }
  return 'border-slate-200 bg-white hover:border-blue-300 dark:border-slate-700 dark:bg-slate-900'
}

function summaryCardMarkup({ label, valueHtml, icon, accent, helper = '' }) {
  return `
    <div class="flex items-start justify-between gap-4">
      <div class="min-w-0">
        <p class="line-clamp-2 min-h-10 text-sm font-medium leading-5 text-slate-500 dark:text-slate-400">${escapeHtml(label)}</p>
        <div class="mt-2 text-3xl font-semibold leading-none tracking-tight text-slate-900 dark:text-slate-100">${valueHtml}</div>
        ${helper}
      </div>
      <span class="${SUMMARY_ICON_CLASS} ${summaryIconTone(accent)}" aria-hidden="true">${icon}</span>
    </div>
  `
}

function bindSummaryCard(button, onOpen) {
  const open = () => onOpen?.()
  button.addEventListener('click', open)
  button.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    open()
  })
}

function createMovimientoCard({ id, label, value, icon, accent, onOpen }) {
  const button = document.createElement('button')
  button.type = 'button'
  button.id = id
  button.className = `${SUMMARY_CARD_CLASS} ${summaryCardChrome()}`
  button.setAttribute('aria-label', `${label}, ${value}. Abrir movimientos registrados.`)
  button.innerHTML = summaryCardMarkup({
    label,
    valueHtml: escapeHtml(String(value)),
    icon,
    accent,
  })
  bindSummaryCard(button, onOpen)
  return button
}

function createPendientesCard({ state, active, onOpen }) {
  const phase = state?.phase === 'ok' ? 'ok' : state?.phase === 'error' ? 'error' : 'cargando'
  const count = phase === 'ok' && Array.isArray(state?.list) ? state.list.length : null
  const conteo = presentarConteoJornadasIncompletas(
    phase === 'ok'
      ? { phase: 'ok', count: count ?? 0 }
      : { phase, message: state?.message },
  )
  const mostrarLeyenda = phase === 'ok' && count > 0
  const atencion = mostrarLeyenda
  const helperText = mostrarLeyenda
    ? 'Requieren revisión'
    : phase === 'error'
      ? (state?.message || 'No se pudieron cargar')
      : ''
  const valueHtml = phase === 'cargando'
    ? '<span class="inline-block h-9 w-16 animate-pulse rounded-md bg-slate-200 dark:bg-slate-700" aria-hidden="true"></span><span class="sr-only">Cargando…</span>'
    : escapeHtml(conteo.value)
  const button = document.createElement('button')
  button.type = 'button'
  button.id = 'fichadas-pendientes-revision'
  button.className = `${SUMMARY_CARD_CLASS} ${summaryCardChrome({ active, attention: atencion && !active })}`
  button.setAttribute('aria-pressed', active ? 'true' : 'false')
  button.setAttribute('aria-busy', phase === 'cargando' ? 'true' : 'false')
  const estado = phase === 'cargando' ? 'cargando' : conteo.value
  button.setAttribute('aria-label', `Fichadas pendientes de revisión, ${estado}${helperText ? `. ${helperText}` : ''}`)
  button.dataset.tooltip = PENDIENTES_TOOLTIP
  button.innerHTML = summaryCardMarkup({
    label: 'Pendientes de revisión',
    valueHtml,
    icon: iconAlertTriangle(),
    accent: 'amber',
    helper: helperText
      ? `<p class="mt-1 text-xs ${mostrarLeyenda ? 'text-amber-800 dark:text-amber-200' : 'text-slate-500 dark:text-slate-400'}">${escapeHtml(helperText)}</p>`
      : '',
  })
  bindSummaryCard(button, onOpen)
  return button
}

function createSummaryCards(dataset, alertas = null) {
  const includeAlertas = Boolean(alertas?.visible)
  const cards = document.createElement('div')
  cards.className = summaryGridClass(includeAlertas ? 4 : 3)
  const summary = dataset.movimientoTotals
  cards.append(
    createMovimientoCard({
      id: 'fichadas-card-totales',
      label: 'Movimientos totales',
      value: summary.total,
      icon: iconClock(),
      accent: 'indigo',
      onOpen: () => alertas?.onMovimientos?.('todos'),
    }),
    createMovimientoCard({
      id: 'fichadas-card-entradas',
      label: 'Entradas',
      value: summary.entradas,
      icon: iconLogin(),
      accent: 'emerald',
      onOpen: () => alertas?.onMovimientos?.('Entrada'),
    }),
    createMovimientoCard({
      id: 'fichadas-card-salidas',
      label: 'Salidas',
      value: summary.salidas,
      icon: iconLogout(),
      accent: 'orange',
      onOpen: () => alertas?.onMovimientos?.('Salida'),
    }),
  )
  if (includeAlertas) cards.append(createPendientesCard(alertas))
  return cards
}

export async function renderFichadas(container, extras = {}) {
  if (!canLoadTenantData(getCurrentUser())) {
    const view = document.createElement('div')
    view.className = 'space-y-6'
    view.innerHTML = `
      ${pageHeadingMarkup({
        title: 'Consultá las fichadas',
        description: 'Filtrá y revisá los registros de ingreso y egreso.',
      })}
    `
    view.append(createSelectEmpresaState())
    container.replaceChildren(view)
    return
  }

  const registrarActions = registrarMenuActions(getCurrentUser())
  const verInforme = puedeVerInformeAsistencia(getCurrentUser())
  const view = document.createElement('div')
  view.className = 'space-y-6'

  view.innerHTML = `
    <div id="fichadas-secciones" class="inline-flex w-fit max-w-full gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-slate-700 dark:bg-slate-800/60" role="tablist" aria-label="Secciones de fichadas">
      <button type="button" id="fichadas-seccion-consulta" role="tab" aria-selected="true" aria-controls="fichadas-panel-consulta" class="inline-flex h-9 shrink-0 items-center whitespace-nowrap rounded-lg bg-blue-600 px-3 text-sm font-medium text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
        Consulta de fichadas
      </button>
      ${verInforme ? `<button type="button" id="fichadas-seccion-informe" role="tab" aria-selected="false" aria-controls="fichadas-panel-informe" class="inline-flex h-9 shrink-0 items-center whitespace-nowrap rounded-lg px-3 text-sm font-medium text-slate-600 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-slate-300 dark:hover:bg-slate-800">
        Informes de asistencia
      </button>` : ''}
    </div>
    <div id="fichadas-heading"></div>
    <div id="fichadas-panel-consulta" role="tabpanel" aria-labelledby="fichadas-seccion-consulta" class="space-y-6">
    <div id="fichadas-summary"></div>
    <section class="rounded-xl border border-slate-200 bg-white px-3 py-3 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div class="flex flex-col gap-3 lg:flex-row lg:items-end">
        <div id="fichadas-empleado-wrap" class="min-w-0 w-full lg:min-w-[16rem] lg:flex-[2]"></div>
        <div class="w-full lg:w-44 lg:shrink-0">
          <label for="fichadas-periodo" class="${FORM_LABEL_CLASS}">Período</label>
          <select id="fichadas-periodo" class="${CONTROL_CLASS}">
            <option value="${FICHADAS_PERIODO_TODOS}">Todos / Sin filtro de fecha</option>
            <option value="${FICHADAS_PERIODO_HOY}" ${FICHADAS_PERIODO_INICIAL === FICHADAS_PERIODO_HOY ? 'selected' : ''}>Hoy</option>
            <option value="7">Últimos 7 días</option>
            <option value="15">Últimos 15 días</option>
            <option value="30">Últimos 30 días</option>
            <option value="60">Últimos 60 días</option>
            <option value="90">Últimos 90 días</option>
            <option value="personalizado">Personalizado</option>
          </select>
        </div>
        <div class="flex w-full min-w-0 flex-col gap-3 sm:flex-row sm:items-end lg:flex-[1.4]">
          <div class="min-w-0 flex-1">
            <label for="fichadas-tipo" class="${FORM_LABEL_CLASS}">Tipo</label>
            <select id="fichadas-tipo" class="${CONTROL_CLASS}" aria-describedby="fichadas-tipo-metodo-info">
              <option value="todos">Todos</option>
              <option value="Entrada">Entrada</option>
              <option value="Salida">Salida</option>
              <option value="Movimiento intermedio">Movimiento intermedio</option>
            </select>
          </div>
          <div class="min-w-0 flex-1">
            <label for="fichadas-metodo" class="${FORM_LABEL_CLASS}">Método</label>
            <select id="fichadas-metodo" class="${CONTROL_CLASS}" aria-describedby="fichadas-tipo-metodo-info">
              <option value="todos">Todos</option>
              <option value="Biometrico">Biométrico</option>
              <option value="Manual">Manual</option>
            </select>
          </div>
          ${infoButtonMarkup({
            id: 'fichadas-tipo-metodo-info',
            tooltip: FICHADAS_TIPO_METODO_TOOLTIP,
            ariaLabel: 'Información sobre Tipo y Método',
          })}
        </div>
      </div>
      <div id="fichadas-custom-dates" class="mt-3 hidden grid gap-3 sm:grid-cols-2">
        <div>
          <label for="fichadas-desde" class="${FORM_LABEL_CLASS}">Desde</label>
          <input id="fichadas-desde" type="date" class="${CONTROL_CLASS}" />
        </div>
        <div>
          <label for="fichadas-hasta" class="${FORM_LABEL_CLASS}">Hasta</label>
          <input id="fichadas-hasta" type="date" class="${CONTROL_CLASS}" />
        </div>
      </div>
      <p id="fichadas-date-error" class="mt-2 hidden text-sm text-red-600"></p>
      <div id="fichadas-filter-actions" class="mt-2 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
        <button type="button" id="fichadas-clear" class="${BTN_SECONDARY_CLASS}">
          Limpiar filtros
        </button>
        <div id="fichadas-exportar-host"></div>
      </div>
    </section>
    <section class="${FICHADAS_FRAME_CLASS}">
    <div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-slate-200 px-3 py-3 dark:border-slate-700">
      <div class="inline-flex flex-wrap items-center gap-0.5 rounded-lg border border-slate-200 bg-white p-1 shadow-sm dark:border-slate-700 dark:bg-slate-900" role="tablist" aria-label="Vista de fichadas">
        <button type="button" id="fichadas-tab-timeline" role="tab" aria-selected="true" class="inline-flex h-8 items-center rounded-md bg-blue-600 px-2.5 text-xs font-medium text-white">
          Línea de tiempo
        </button>
        <button type="button" id="fichadas-tab-jornadas" role="tab" aria-selected="false" class="inline-flex h-8 items-center rounded-md px-2.5 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">
          Resumen de jornadas
        </button>
        <button type="button" id="fichadas-tab-movimientos" role="tab" aria-selected="false" class="inline-flex h-8 items-center rounded-md px-2.5 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">
          Movimientos registrados
        </button>
        <button type="button" id="fichadas-tab-calendario" role="tab" aria-selected="false" class="inline-flex h-8 items-center rounded-md px-2.5 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">
          Calendario de jornadas
        </button>
      </div>
      <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
        <label for="fichadas-page-size" class="inline-flex items-center gap-2 whitespace-nowrap text-sm text-slate-600 dark:text-slate-300">
          <span>Mostrar</span>
          <select id="fichadas-page-size" class="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100">
            ${PAGE_SIZE_OPTIONS.map((size) => `<option value="${size}" ${size === DEFAULT_PAGE_SIZE ? 'selected' : ''}>${size}</option>`).join('')}
          </select>
        </label>
        <div id="fichadas-columnas-wrap"></div>
        <label id="fichadas-franja-wrap" class="hidden items-center gap-2 whitespace-nowrap text-sm text-slate-600 dark:text-slate-300">
          <span class="whitespace-nowrap">Franja horaria</span>
          <select id="fichadas-franja" class="min-w-[9.5rem] rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100">
            <option value="auto">Automática</option>
            <option value="office">06:00–20:00</option>
            <option value="day">00:00–24:00</option>
            <option value="custom">Personalizada</option>
          </select>
        </label>
        <div id="fichadas-franja-custom" class="hidden items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
          <input id="fichadas-franja-desde" type="time" class="rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-900" aria-label="Hora desde" />
          <input id="fichadas-franja-hasta" type="time" class="rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-900" aria-label="Hora hasta" />
        </div>
        <p id="fichadas-count" class="text-sm text-slate-500 dark:text-slate-400"></p>
      </div>
    </div>
    <p id="fichadas-calculo" class="hidden px-3 pb-2 text-right">
      <button type="button" class="rounded text-xs text-slate-500 underline decoration-slate-300 underline-offset-2 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-slate-400 dark:hover:text-slate-200" data-tooltip="${escapeHtml(CLASIFICACION_JORNADA_AYUDA)}">¿Cómo se calcula?</button>
    </p>
    <p id="fichadas-limit-note" class="hidden border-b border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200"></p>
    <div id="fichadas-labor" class="hidden px-3 py-3"></div>
    <div id="fichadas-results" class="min-h-0"></div>
    <div id="fichadas-pagination" class="border-t border-slate-100 px-3 empty:hidden dark:border-slate-800"></div>
    </section>
    </div>
    <div id="fichadas-panel-informe" role="tabpanel" aria-labelledby="fichadas-seccion-informe" class="hidden space-y-6"></div>
  `
  bindTooltipRoot(view)

  const summaryContainer = view.querySelector('#fichadas-summary')
  const results = view.querySelector('#fichadas-results')
  const paginationContainer = view.querySelector('#fichadas-pagination')
  const periodoSelect = view.querySelector('#fichadas-periodo')
  periodoSelect.value = FICHADAS_PERIODO_INICIAL
  const tipoSelect = view.querySelector('#fichadas-tipo')
  const metodoSelect = view.querySelector('#fichadas-metodo')
  const empleadoWrap = view.querySelector('#fichadas-empleado-wrap')
  const customDates = view.querySelector('#fichadas-custom-dates')
  const desdeInput = view.querySelector('#fichadas-desde')
  const hastaInput = view.querySelector('#fichadas-hasta')
  const dateError = view.querySelector('#fichadas-date-error')
  const clearButton = view.querySelector('#fichadas-clear')
  const consultaExport = createExportMenu({
    id: 'fichadas-exportar',
    onCsv: () => exportConsulta('csv'),
    onPdf: () => exportConsulta('pdf'),
  })
  view.querySelector('#fichadas-exportar-host')?.append(consultaExport.root)
  const tabMovimientos = view.querySelector('#fichadas-tab-movimientos')
  const tabJornadas = view.querySelector('#fichadas-tab-jornadas')
  const tabTimeline = view.querySelector('#fichadas-tab-timeline')
  const tabCalendario = view.querySelector('#fichadas-tab-calendario')
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
  let activeView = resolveFichadasView(extras.fichadasView)
  let franjaMode = 'auto'
  let franjaCustom = { start: null, end: null }
  let franjaError = ''
  let movimientosPage = 1
  let jornadasPage = 1
  let timelinePage = 1
  let pageSize = DEFAULT_PAGE_SIZE
  let loadSeq = 0
  let jornadaDetalleModal = null
  let observacionModal = null
  let observacionModalFichadaId = null
  let observacionSession = 0
  let returnToJornada = null
  let registrarMenu = null
  let calendarRoot = null
  let alertasApi = null
  let laborKind = ''
  let alertasState = { phase: 'cargando', list: null, message: '' }
  let alertasSeq = 0
  let alertasFlight = null
  let lastDataset = null
  let calendarCursor = null
  let manualDisponible = false
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
  let seleccionAplicada = false
  function recordarEmpleado(id = empleadoCombobox.getEmpleadoId()) {
    const key = claveEmpleadoFichadas(getOperativeEmpresaId(getCurrentUser()))
    if (!key) return
    sessionStorage.setItem(key, id ? String(id) : '')
  }
  function aplicarSeleccionInicial(empleados) {
    if (seleccionAplicada) return
    const key = claveEmpleadoFichadas(getOperativeEmpresaId(getCurrentUser()))
    const stored = key ? sessionStorage.getItem(key) : null
    const inicial = empleadoInicialFichadas(empleados, { stored })
    empleadoCombobox.setEmpleadoId(inicial, { silent: true })
    if (key && stored === null) sessionStorage.setItem(key, inicial || '')
    seleccionAplicada = true
  }
  const empleadoCombobox = createEmpleadoCombobox({
    id: 'fichadas-empleado',
    onChange: () => {
      recordarEmpleado()
      if (laborKind === 'calendario' && calendarRoot?.setEmpleadoId) {
        void calendarRoot.setEmpleadoId(empleadoCombobox.getEmpleadoId())
      }
      onServerFilterChange()
      applyLaborChrome()
    },
    placeholder: 'Buscar empleado por nombre o legajo',
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
    const active = 'inline-flex h-8 items-center rounded-md bg-blue-600 px-2.5 text-xs font-medium text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500'
    const idle =
      'inline-flex h-8 items-center rounded-md px-2.5 text-xs font-medium text-slate-600 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-slate-300 dark:hover:bg-slate-800'
    const tabActiva = laborKind === 'calendario' || laborKind === 'alertas' ? '' : activeView
    tabMovimientos.className = tabActiva === 'movimientos' ? active : idle
    tabJornadas.className = tabActiva === 'jornadas' ? active : idle
    tabTimeline.className = tabActiva === 'timeline' ? active : idle
    tabMovimientos.setAttribute('aria-selected', String(tabActiva === 'movimientos'))
    tabJornadas.setAttribute('aria-selected', String(tabActiva === 'jornadas'))
    tabTimeline.setAttribute('aria-selected', String(tabActiva === 'timeline'))
    tabCalendario.className = laborKind === 'calendario' ? active : idle
    tabCalendario.setAttribute('aria-selected', String(laborKind === 'calendario'))
    columnasWrap.classList.toggle('hidden', activeView === 'timeline' || laborKind === 'calendario' || laborKind === 'alertas')
    view.querySelector('#fichadas-franja-wrap')?.classList.toggle('hidden', activeView !== 'timeline')
    view.querySelector('#fichadas-franja-wrap')?.classList.toggle('flex', activeView === 'timeline')
    view.querySelector('#fichadas-franja-custom')?.classList.toggle('hidden', activeView !== 'timeline' || franjaMode !== 'custom')
    view.querySelector('#fichadas-franja-custom')?.classList.toggle('flex', activeView === 'timeline' && franjaMode === 'custom')
    applyLaborChrome()
    renderSummary()
  }

  function filtrosPorLimpiar() {
    return Boolean(empleadoCombobox.getEmpleadoId())
      || periodoSelect.value !== FICHADAS_PERIODO_INICIAL
      || tipoSelect.value !== 'todos'
      || metodoSelect.value !== 'todos'
      || Boolean(desdeInput.value || hastaInput.value)
  }

  function applyLaborChrome() {
    const calendario = laborKind === 'calendario'
    const labor = calendario || laborKind === 'alertas'
    const pageSizeLabel = pageSizeSelect.closest('label')
    const actions = view.querySelector('#fichadas-filter-actions')
    const mostrarAcciones = laborKind === 'alertas' ? false : calendario ? filtrosPorLimpiar() : true
    pageSizeLabel?.classList.toggle('inline-flex', !labor)
    ;[
      pageSizeLabel,
      periodoSelect.closest('div'),
      tipoSelect.closest('div')?.parentElement,
      consultaExport.root,
    ].forEach((node) => node?.classList.toggle('hidden', labor))
    actions?.classList.toggle('hidden', !mostrarAcciones)
    actions?.classList.toggle('mt-2', mostrarAcciones)
    clearButton?.classList.toggle('hidden', !mostrarAcciones || laborKind === 'alertas')
    empleadoWrap.classList.toggle('hidden', false)
    empleadoWrap.classList.toggle('lg:max-w-md', calendario)
    empleadoWrap.classList.toggle('lg:flex-none', calendario)
    empleadoWrap.classList.toggle('lg:flex-[2]', !calendario)
    syncCalculoHelp()
    if (labor) {
      countLabel.classList.add('hidden')
      customDates.classList.add('hidden')
      dateError.classList.add('hidden')
      view.querySelector('#fichadas-franja-wrap')?.classList.add('hidden')
      view.querySelector('#fichadas-franja-wrap')?.classList.remove('flex')
      view.querySelector('#fichadas-franja-custom')?.classList.add('hidden')
      view.querySelector('#fichadas-franja-custom')?.classList.remove('flex')
      return
    }
    countLabel.classList.remove('hidden')
    syncCustomDates()
  }

  function syncCalculoHelp() {
    const labor = laborKind === 'calendario' || laborKind === 'alertas'
    const show = !labor && (activeView === 'timeline' || activeView === 'jornadas')
    view.querySelector('#fichadas-calculo')?.classList.toggle('hidden', !show)
  }

  function setExportEnabled({ canPrint = false, canOpenCsv = false, disableReason = '' } = {}) {
    const enabled = Boolean(canPrint || canOpenCsv)
    consultaExport.setEnabled({
      csv: enabled,
      pdf: enabled,
      reason: enabled ? '' : (disableReason || 'No hay datos para exportar'),
    })
  }

  function currentSelection(now = new Date()) {
    const filters = getFilters()
    const dataset = currentDataset(filters, now)
    const records = activeView === 'movimientos' ? dataset.movimientos : dataset.jornadas
    const selection = buildFichadasViewSelection({
      view: activeView === 'movimientos' ? 'movimientos' : 'jornadas',
      records,
      columnIds: columnPrefs[activeView],
      filters,
      empresa: empresaLabel(empresa),
      empleadoLabel: selectedEmpleadoLabel(),
      generatedAt: formatDateTime(new Date().toISOString()),
    })
    return { filters, dataset, selection }
  }

  function resetPages() {
    movimientosPage = 1
    jornadasPage = 1
    timelinePage = 1
  }

  function selectedEmpleadoLabel() {
    return empleadoCombobox.getSelectedLabel()
  }

  function currentDataset(filters, now = new Date()) {
    const error = dateRangeError(filters)
    const porMetodo = error
      ? []
      : fichadas.filter((item) => matchesMetodoFiltro(item, filters.metodo))
    const periodSet = error
      ? []
      : classificationSource() === CLASSIFICATION_SOURCE.api
        ? clasificarSegunFuente(porMetodo, { now })
        : annotateMovimientos(porMetodo, { now })
    const movimientos = filterMovimientosOriginales(periodSet, {
      tipo: filters.tipo,
      metodo: 'todos',
    })
    const jornadas = error
      ? []
      : classificationSource() === CLASSIFICATION_SOURCE.api
        ? construirJornadasSegunFuente(porMetodo, empleadoById, { now })
        : buildJornadas(porMetodo, empleadoById, { now })
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
      ? `La consulta alcanzó el límite máximo de ${FICHADAS_LIMITE} registros. El listado puede estar incompleto.`
      : ''
    limitNote.classList.toggle('hidden', !capped)
  }

  function renderSummary(dataset = lastDataset) {
    if (!dataset) return
    lastDataset = dataset
    summaryContainer.replaceChildren(createSummaryCards(dataset, {
      visible: puedeVerAlertasJornada(getCurrentUser()),
      state: alertasState,
      active: laborKind === 'alertas',
      onOpen: () => {
        void openLabor('alertas')
      },
      onMovimientos: (tipo) => {
        tipoSelect.value = tipo
        setView('movimientos')
      },
    }))
  }

  async function cargarAlertasPendientes() {
    if (!puedeVerAlertasJornada(getCurrentUser())) {
      alertasState = { phase: 'prohibido', list: null, message: '' }
      return null
    }
    if (alertasFlight) return alertasFlight
    const seq = ++alertasSeq
    if (alertasState.phase !== 'ok') alertasState = { phase: 'cargando', list: null, message: '' }
    alertasFlight = (async () => {
      try {
        const capability = await resolveCapability(CAPABILITY.fichadasIncompleteAlerts)
        if (seq !== alertasSeq) return null
        if (capability.status !== CAPABILITY_STATUS.available) {
          alertasState = { phase: 'error', list: null, message: 'No se pudieron cargar' }
          return null
        }
        const list = await getAlertasIncompletas()
        if (seq !== alertasSeq) return null
        alertasState = { phase: 'ok', list: Array.isArray(list) ? list : [], message: '' }
        return alertasState.list
      } catch (error) {
        if (seq !== alertasSeq || error?.status === 401) return null
        alertasState = { phase: 'error', list: null, message: 'No se pudieron cargar' }
        return null
      } finally {
        alertasFlight = null
        renderSummary()
      }
    })()
    return alertasFlight
  }

  function renderTablePlaceholder(placeholder, { onPlaceholderAction } = {}) {
    if (activeView === 'timeline') {
      return createFichadasTimeline([], { includesToday: false })
    }
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

  function isSameJornada(a, b) {
    if (!a || !b || a.fecha !== b.fecha) return false
    if (a.empleadoId != null && b.empleadoId != null && String(a.empleadoId) === String(b.empleadoId)) {
      return true
    }
    return String(a.empleado ?? '') === String(b.empleado ?? '') && String(a.legajo ?? '') === String(b.legajo ?? '')
  }

  function resolveJornada(ref) {
    if (!ref) return null
    const jornadas = currentDataset(getFilters()).jornadas
    return jornadas.find((item) => isSameJornada(item, ref)) ?? ref
  }

  function openDetalle(jornada) {
    jornadaDetalleModal?.close({ force: true })
    const live = resolveJornada(jornada)
    jornadaDetalleModal = openJornadaDetalle(live, {
      canEditObservacion: puedeEditarObservacionFichada(getCurrentUser()),
      onEditObservacion: (fichada) => {
        returnToJornada = {
          empleadoId: live?.empleadoId,
          empleado: live?.empleado,
          legajo: live?.legajo,
          fecha: live?.fecha,
        }
        jornadaDetalleModal?.close({ force: true })
        jornadaDetalleModal = null
        openObservacion(fichada)
      },
    })
  }

  function openObservacion(fichada) {
    hideTooltip()
    closeObservacionesJornada()
    observacionSession += 1
    const session = observacionSession
    observacionModal?.close({ force: true })
    observacionModalFichadaId = fichada?.id ?? null
    observacionModal = openFichadaObservacionModal({
      fichada,
      canEdit: puedeEditarObservacionFichada(getCurrentUser()),
      onClose: () => {
        if (session !== observacionSession) return
        if (observacionModalFichadaId === fichada?.id) observacionModalFichadaId = null
        const pending = returnToJornada
        returnToJornada = null
        if (pending) openDetalle(pending)
      },
      onSaved: (saved) => {
        const decision = shouldApplyObservacionResponse({
          requestFichadaId: fichada.id,
          responseFichadaId: saved?.fichadaId,
          openFichadaId: observacionModalFichadaId,
          modalOpen: Boolean(observacionModal),
        })
        if (!decision.updateRow) return
        fichadas = replaceFichadaObservacionInList(fichadas, fichada.id, saved)
        renderResults()
      },
    })
  }

  function permisoManual() {
    return {
      permitido: puedeRegistrarFichadaManual(getCurrentUser()),
      manualDisponible,
    }
  }

  function abrirCompletar(preset, opener) {
    void openFichadaManual({
      getEmpleados: () => [...empleadoById.values()],
      preset,
      opener,
      onSaved: savedManual,
    })
  }

  function renderResults() {
    closeObservacionesJornada()
    if (!loaded) return

    const filters = getFilters()
    const error = dateRangeError(filters)
    dateError.textContent = error
    dateError.classList.toggle('hidden', !error)
    paginationContainer.replaceChildren()

    if (error) {
      setExportEnabled({ canPrint: false, canOpenCsv: false, disableReason: error })
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

    const now = new Date()
    const { dataset, selection } = currentSelection(now)
    renderSummary(dataset)

    const isMovimientos = activeView === 'movimientos'
    const isTimeline = activeView === 'timeline'
    const rows = isTimeline ? dataset.jornadas : selection.records
    const noun = isMovimientos ? 'movimientos' : 'jornadas'
    const page = isMovimientos ? movimientosPage : isTimeline ? timelinePage : jornadasPage
    const paged = paginateItems(rows, page, pageSize)

    if (isMovimientos) movimientosPage = paged.page
    else if (isTimeline) timelinePage = paged.page
    else jornadasPage = paged.page

    const viewSnapshot = buildFichadasExportSnapshot(selection, { mode: 'view' })
    setExportEnabled({
      canPrint: viewSnapshot.canExport,
      canOpenCsv: viewSnapshot.canExport,
      disableReason: viewSnapshot.canExport ? '' : 'No hay datos para exportar',
    })

    if (rows.length === 0) {
      countLabel.textContent = ''
      const vacio = isMovimientos
        ? { title: 'No hay movimientos para mostrar', description: 'No encontramos fichadas con los filtros seleccionados.', icon: iconLogout() }
        : isTimeline
          ? null
          : { title: 'No hay jornadas para mostrar', description: 'No encontramos jornadas para el empleado y período seleccionados.', icon: iconCalendar() }
      results.replaceChildren(isTimeline ? createFichadasTimeline([], { includesToday: false }) : createFichadasEmptyState(vacio))
      return
    }

    countLabel.textContent = `Mostrando ${isTimeline ? 1 : paged.from}–${isTimeline ? rows.length : paged.to} de ${isTimeline ? rows.length : paged.total} ${noun}`
    const periodIncludesToday = dataset.jornadas.some((item) => item.fecha === todayDateKey())
    results.replaceChildren(
      isTimeline
        ? createFichadasTimeline(rows, {
            now,
            includesToday: periodIncludesToday,
            franja: { mode: franjaMode, start: franjaCustom.start, end: franjaCustom.end },
            puedeCompletar: (jornada) => puedeCompletarSalida(jornada, permisoManual()),
            puedeCompletarEntrada: (jornada) => puedeCompletarEntrada(jornada, permisoManual()),
            puedeAgregar: (jornada) => puedeAgregarFichada(jornada, permisoManual()),
            onCompletarSalida: (jornada, opener) => abrirCompletar(presetCompletarSalida(jornada), opener),
            onCompletarEntrada: (jornada, opener) => abrirCompletar(presetCompletarEntrada(jornada), opener),
            onAgregarFichada: (jornada, opener) => abrirCompletar(presetAgregarFichada(jornada), opener),
          })
        : isMovimientos
        ? createFichadasTable(paged.items, {
            visibleColumnIds: columnPrefs.movimientos,
            canEditObservacion: puedeEditarObservacionFichada(getCurrentUser()),
            onObservacion: openObservacion,
          })
        : createJornadasTable(paged.items, {
            visibleColumnIds: columnPrefs.jornadas,
            onVerMovimientos: openDetalle,
          }),
    )

    if (!isTimeline && paged.pageCount > 1) {
      paginationContainer.replaceChildren(
        createPagination({
          page: paged.page,
          pageCount: paged.pageCount,
          onPageChange: (nextPage) => {
            if (isMovimientos) movimientosPage = nextPage
            else if (isTimeline) timelinePage = nextPage
            else jornadasPage = nextPage
            renderResults()
          },
        }),
      )
    }
  }

  async function loadFichadas() {
    let filters = getFilters()
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
    setExportEnabled({ canPrint: false, canOpenCsv: false })
    results.replaceChildren(
      createTableSkeleton({
        rows: 8,
        columns: visibleColumnCount(activeView, columnPrefs[activeView]),
        label: 'Cargando fichadas',
      }),
    )

    const alertasPromise = cargarAlertasPendientes()
    try {
      if (!empleadosLoaded) {
        try {
          const empleados = await getEmpleados()
          if (seq !== loadSeq) return
          empleadoById = new Map(empleados.map((empleado) => [Number(empleado.id), empleado]))
          empleadoCombobox.setEmpleados(empleados)
          aplicarSeleccionInicial(empleados)
          empleadosLoaded = true
        } catch (empleadosError) {
          if (empleadosError?.status === 401 || empleadosError?.message === 'Sesión expirada o no autorizada.') return
        }
      }
      filters = getFilters()
      const [fichadasResult, empleadosResult, empresaResult] = await Promise.allSettled([
        getFichadas(apiFilters(filters)),
        empleadosLoaded ? Promise.resolve([...empleadoById.values()]) : getEmpleados(),
        empresaLoaded ? Promise.resolve(empresa) : getEmpresaActual(),
        alertasPromise,
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
      const manual = await resolveCapability(CAPABILITY.fichadasManual)
      manualDisponible = manual.status === CAPABILITY_STATUS.available
      if (empleadosResult.status === 'fulfilled') {
        const empleados = empleadosResult.value
        empleadoById = new Map(empleados.map((empleado) => [Number(empleado.id), empleado]))
        empleadoCombobox.setEmpleados(empleados)
        if (!seleccionAplicada) aplicarSeleccionInicial(empleados)
        empleadosLoaded = true
      }
      if (empresaResult.status === 'fulfilled') {
        empresa = empresaResult.value
        empresaLoaded = true
      }
      loaded = true
      noteExtendedMetadata(fichadas)
      try {
        const declaration = await resolveCapability(CAPABILITY.fichadasServerClassification)
        if (seq !== loadSeq) return
        applyClassificationDeclaration(declaration.declaration, fichadas)
      } catch {
        applyClassificationDeclaration(null, fichadas)
      }
      updateLimitNote()
      await alertasPromise
      if (seq !== loadSeq) return
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
    closeObservacionesJornada()
    syncCustomDates()
    resetPages()
    loadFichadas()
  }

  function onClientFilterChange() {
    movimientosPage = 1
    renderResults()
  }

  function clearFilters() {
    periodoSelect.value = FICHADAS_PERIODO_INICIAL
    tipoSelect.value = 'todos'
    metodoSelect.value = 'todos'
    empleadoCombobox.reset()
    recordarEmpleado('')
    desdeInput.value = ''
    hastaInput.value = ''
    syncCustomDates()
    resetPages()
    applyLaborChrome()
    loadFichadas()
  }

  function setView(nextView) {
    hideTooltip()
    closeObservacionesJornada()
    closeLaborModule()
    activeView = nextView
    setTabStyles()
    columnPicker.close()
    if (nextView !== 'timeline') {
      columnPicker.setState({
        view: nextView,
        selectedIds: columnPrefs[nextView],
        isMobile: isMobileColumns,
      })
    }
    renderResults()
  }

  function exportNotes(capped, filters, records = []) {
    const notes = []
    if (records.some((item) => cruzaMedianoche(item))) {
      notes.push('Hay un turno que cruza la medianoche. Conviene revisarlo.')
    }
    if (filters.tipo !== 'todos' || filters.metodo !== 'todos') {
      notes.push('Se aplicaron los filtros de tipo o método.')
    }
    if (capped) {
      notes.push(`La consulta alcanzó el límite máximo de ${FICHADAS_LIMITE} registros.`)
    }
    return notes
  }

  function exportConsulta(kind) {
    const { filters, dataset, selection } = currentSelection()
    const rangeError = dateRangeError(filters)
    if (rangeError) {
      showToast({ message: rangeError, tone: 'warning' })
      return
    }
    const snapshot = buildFichadasExportSnapshot(selection, { mode: 'view' })
    if (snapshot.columnIds.length === 0) {
      showToast({ message: FICHADAS_EXPORT_NO_COLUMNS_MESSAGE, tone: 'warning' })
      return
    }
    if (!snapshot.recordCount) {
      showToast({ message: FICHADAS_EXPORT_EMPTY_MESSAGE, tone: 'warning' })
      return
    }
    const stamp = todayDateKey()
    if (kind === 'csv') {
      const payload = buildFichadasCsvPayload(snapshot, stamp)
      if (!payload.ok) {
        showToast({ message: payload.message || FICHADAS_EXPORT_EMPTY_MESSAGE, tone: 'warning' })
        return
      }
      downloadCsv(`fichadas-${stamp}.csv`, payload.content)
      return
    }

    const jornadaPrint = selection.view !== 'movimientos'
    const notes = exportNotes(
      fichadas.length >= FICHADAS_LIMITE,
      filters,
      jornadaPrint ? selection.records : [],
    )
    const totals = selection.view === 'movimientos' ? dataset.movimientoTotals : dataset.jornadaTotals
    const summaryItems = selection.view === 'movimientos'
      ? [
          { label: 'Movimientos', value: totals.total },
          { label: 'Entradas', value: totals.entradas },
          { label: 'Salidas', value: totals.salidas },
          { label: 'Posibles duplicados', value: totals.posiblesDuplicados },
        ]
      : [
          { label: 'Completas', value: totals.completas },
          { label: 'En curso', value: totals.enCurso },
          { label: 'Incompletas', value: totals.incompletas },
          { label: 'En revisión', value: totals.revisar },
        ]
    const printColumns = jornadaPrint ? JORNADA_PRINT_COLUMNS : snapshot.columns
    const printRows = jornadaPrint
      ? selection.records.map((item) =>
          printColumns.map((column) => {
            if (column.id === 'actividad') return item.actividadRegistrada ?? '—'
            if (column.id === 'ingreso') return item.ingresoHora ?? ''
            if (column.id === 'egreso') return item.egresoHora ?? ''
            if (column.id === 'horarioPrevisto') return item.horarioPrevisto ?? ''
            return item[column.id] ?? ''
          }),
        )
      : snapshot.printRows
    return printReport({
      filename: `fichadas-${stamp}.pdf`,
      title: 'Consulta de fichadas',
      empresa: snapshot.empresa,
      periodo: snapshot.periodo,
      generatedAt: new Date().toISOString(),
      filters: snapshot.filtersSummary,
      totals,
      summaryItems,
      columns: printColumns.map((column) => column.label ?? column),
      rows: printRows,
      notes: jornadaPrint ? [...notes, JORNADA_PRINT_NOTE] : notes,
      landscape: snapshot.landscape ? snapshot.landscape : jornadaPrint,
    })
  }

  periodoSelect.addEventListener('change', onServerFilterChange)
  tipoSelect.addEventListener('change', onClientFilterChange)
  metodoSelect.addEventListener('change', onClientFilterChange)
  desdeInput.addEventListener('change', onServerFilterChange)
  hastaInput.addEventListener('change', onServerFilterChange)
  const franjaSelect = view.querySelector('#fichadas-franja')
  franjaSelect.addEventListener('change', () => {
    franjaMode = franjaSelect.value
    setTabStyles()
    renderResults()
  })
  function readFranjaTime(id) {
    const match = String(view.querySelector(id)?.value ?? '').match(/^(\d{2}):(\d{2})/)
    return match ? Number(match[1]) * 60 + Number(match[2]) : null
  }
  view.querySelector('#fichadas-franja-desde')?.addEventListener('change', () => {
    franjaCustom.start = readFranjaTime('#fichadas-franja-desde')
    renderResults()
  })
  view.querySelector('#fichadas-franja-hasta')?.addEventListener('change', () => {
    franjaCustom.end = readFranjaTime('#fichadas-franja-hasta')
    renderResults()
  })
  pageSizeSelect.addEventListener('change', () => {
    pageSize = Number(pageSizeSelect.value) || DEFAULT_PAGE_SIZE
    resetPages()
    renderResults()
  })
  clearButton.addEventListener('click', clearFilters)
  const laborHost = view.querySelector('#fichadas-labor')

  function discardLabor() {
    alertasApi?.close?.()
    alertasApi = null
    calendarRoot?.destroy?.()
    calendarRoot = null
    laborHost.replaceChildren()
  }

  function closeLaborModule() {
    discardLabor()
    laborKind = ''
    laborHost.classList.add('hidden')
    results.classList.remove('hidden')
    paginationContainer.classList.remove('hidden')
    setTabStyles()
  }

  async function savedManual(saved) {
    await loadFichadas()
    if (calendarRoot?.isConnected) await calendarRoot.reload()
    if (saved?.origenAlerta) window.dispatchEvent(new CustomEvent('ca:jornadas-incompletas'))
    if (!saved?.origenAlerta || !alertasApi) return null
    try {
      const list = alertasState.phase === 'ok' ? alertasState.list : null
      if (Array.isArray(list)) alertasApi.replace(list)
      if (!Array.isArray(list)) {
        showToast({ message: 'La salida manual se registró, pero no se pudieron actualizar las alertas.', tone: 'warning' })
        return { suppressToast: true }
      }
      const outcome = resultadoSalidaManual(saved.origenAlerta, list)
      showToast({
        message: outcome.message,
        tone: outcome.completa ? 'success' : 'warning',
      })
    } catch (error) {
      if (error?.status !== 401) {
        showToast({ message: error.message || 'No se pudieron actualizar las alertas.', tone: 'warning' })
      }
    }
    return { suppressToast: true }
  }

  function verMovimientosDelDia(alerta) {
    const filtros = filtrosMovimientosDeAlerta(alerta)
    periodoSelect.value = filtros.periodo
    desdeInput.value = filtros.desde
    hastaInput.value = filtros.hasta
    tipoSelect.value = filtros.tipo
    metodoSelect.value = filtros.metodo
    syncCustomDates()
    empleadoCombobox.setEmpleadoId(filtros.empleadoId, { silent: true })
    recordarEmpleado(filtros.empleadoId)
    resetPages()
    setView(filtros.view)
    return loadFichadas()
  }

  let laborSeq = 0
  function verFichadasDelPeriodo({ empleadoId, desde, hasta, year, monthIndex }) {
    calendarCursor = { year, monthIndex }
    empleadoCombobox.setEmpleadoId(empleadoId, { silent: true })
    recordarEmpleado(empleadoId)
    periodoSelect.value = 'personalizado'
    desdeInput.value = desde
    hastaInput.value = hasta
    tipoSelect.value = 'todos'
    metodoSelect.value = 'todos'
    syncCustomDates()
    resetPages()
    setView('jornadas')
    return loadFichadas()
  }

  async function openLabor(kind) {
    if (kind === 'alertas' && laborKind === 'alertas' && alertasApi) return
    if (kind === 'calendario' && laborKind === 'calendario' && calendarRoot) return
    if (kind === 'alertas' && !puedeVerAlertasJornada(getCurrentUser())) return
    const seq = ++laborSeq
    closeObservacionesJornada()
    discardLabor()
    laborKind = kind
    setTabStyles()
    laborHost.classList.remove('hidden')
    results.classList.add('hidden')
    paginationContainer.classList.add('hidden')
    const empleados = [...empleadoById.values()]
    if (kind === 'alertas') {
      if (seq !== laborSeq) return
      if (alertasState.phase !== 'ok') {
        await cargarAlertasPendientes()
        if (seq !== laborSeq) return
      }
      const vigentes = alertasState.phase === 'ok' && Array.isArray(alertasState.list) ? alertasState.list : null
      alertasApi = createAlertasPanel({
        empleados,
        alertasIniciales: vigentes,
        onLoaded: (list) => {
          if (!Array.isArray(list) || vigentes) return
          alertasState = { phase: 'ok', list, message: '' }
          renderSummary()
        },
        onVerMovimientos: (alerta) => {
          void verMovimientosDelDia(alerta)
        },
        onRegistrarSalida: (alerta, opener) => {
          void openFichadaManual({
            getEmpleados: () => [...empleadoById.values()],
            preset: presetSalidaManual(alerta),
            opener,
            onSaved: savedManual,
          })
        },
      })
      laborHost.append(alertasApi.element)
      return
    }
    if (seq !== laborSeq || !laborHost.isConnected) return
    calendarRoot = createJornadasCalendarPanel({
      empleados,
      empleadoId: empleadoCombobox.getEmpleadoId(),
      year: calendarCursor?.year,
      monthIndex: calendarCursor?.monthIndex,
      onEmpleadoChange: (id) => {
        empleadoCombobox.setEmpleadoId(id, { silent: true })
        recordarEmpleado(id)
      },
      onCursor: (cursor) => {
        calendarCursor = cursor
      },
      onVerPeriodo: verFichadasDelPeriodo,
      puedeCompletar: (jornada) => puedeCompletarSalida(jornada, permisoManual()),
      puedeCompletarEntrada: (jornada) => puedeCompletarEntrada(jornada, permisoManual()),
      puedeAgregar: (jornada) => puedeAgregarFichada(jornada, permisoManual()),
      onCompletarSalida: (jornada, opener) => abrirCompletar(presetCompletarSalida(jornada), opener),
      onCompletarEntrada: (jornada, opener) => abrirCompletar(presetCompletarEntrada(jornada), opener),
      onAgregarFichada: (jornada, opener) => abrirCompletar(presetAgregarFichada(jornada), opener),
    })
    laborHost.append(calendarRoot)
  }

  const headingHost = view.querySelector('#fichadas-heading')
  const consultaPanel = view.querySelector('#fichadas-panel-consulta')
  const informeHost = view.querySelector('#fichadas-panel-informe')
  const seccionConsulta = view.querySelector('#fichadas-seccion-consulta')
  const seccionInforme = view.querySelector('#fichadas-seccion-informe')
  let informePanel = null
  let informeCargando = null
  let seccionActual = 'consulta'
  const registrarSlot = registrarActions.length ? document.createElement('div') : null
  if (registrarSlot) registrarSlot.id = 'fichadas-registrar'

  function paintHeading(section) {
    const consulta = section !== 'informe'
    headingHost.innerHTML = pageHeadingMarkup({
      title: consulta ? 'Consultá las fichadas' : 'Informe de asistencia',
      description: consulta
        ? 'Filtrá y revisá los registros de ingreso y egreso.'
        : 'Consultá el cumplimiento horario de la nómina.',
      actionsId: 'fichadas-heading-actions',
    })
    const actions = headingHost.querySelector('#fichadas-heading-actions')
    if (!consulta || !registrarSlot) {
      actions?.remove()
      return
    }
    actions.classList.add('flex', 'flex-wrap', 'items-center', 'justify-end', 'gap-2')
    actions.append(registrarSlot)
  }

  function writeSectionHash(section, historyMode) {
    const next = section === 'informe' ? '#/fichadas?seccion=informe' : '#/fichadas'
    if ((globalThis.location?.hash || '') === next || historyMode === 'none') return
    const state = { view: 'fichadas', seccion: section }
    if (historyMode === 'replace') globalThis.history?.replaceState?.(state, '', next)
    else globalThis.history?.pushState?.(state, '', next)
  }

  async function ensureInforme() {
    if (informePanel || informeCargando) return informeCargando
    informeHost.replaceChildren(createFeedbackState({ title: 'Cargando informe', message: 'Estamos preparando los filtros.' }))
    informeCargando = (async () => {
      try {
        const contexto = await obtenerContextoInforme()
        if (!informeHost.isConnected) return
        informePanel = createInformeAsistenciaPanel({
          contexto,
          empresaNombre: () => empresaLabel(empresa),
        })
        informeHost.replaceChildren(informePanel.root)
      } catch {
        if (!informeHost.isConnected) return
        informeHost.replaceChildren(createFeedbackState({
          title: 'No se pudo cargar el informe',
          message: 'Reintentá en unos segundos.',
          tone: 'error',
          actionLabel: 'Reintentar',
          onAction: () => {
            informeCargando = null
            void ensureInforme()
          },
        }))
      } finally {
        informeCargando = null
      }
    })()
    return informeCargando
  }

  function showSection(section, { historyMode = 'none' } = {}) {
    const next = section === 'informe' && verInforme ? 'informe' : 'consulta'
    seccionActual = next
    consultaPanel.classList.toggle('hidden', next !== 'consulta')
    informeHost.classList.toggle('hidden', next !== 'informe')
    const mainActive = 'inline-flex h-9 shrink-0 items-center whitespace-nowrap rounded-lg bg-blue-600 px-3 text-sm font-medium text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500'
    const mainIdle = 'inline-flex h-9 shrink-0 items-center whitespace-nowrap rounded-lg px-3 text-sm font-medium text-slate-600 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-slate-300 dark:hover:bg-slate-800'
    seccionConsulta.className = next === 'consulta' ? mainActive : mainIdle
    seccionConsulta.setAttribute('aria-selected', String(next === 'consulta'))
    seccionInforme?.classList.toggle('hidden', false)
    if (seccionInforme) {
      seccionInforme.className = next === 'informe' ? mainActive : mainIdle
      seccionInforme.setAttribute('aria-selected', String(next === 'informe'))
    }
    paintHeading(next)
    writeSectionHash(next, historyMode)
    if (next === 'informe') void ensureInforme()
  }

  function onSectionEvent() {
    const requested = readHashParam(globalThis.location?.hash, 'seccion')
    if ((requested === 'informe' ? 'informe' : 'consulta') === seccionActual) return
    showSection(requested, { historyMode: 'none' })
  }
  globalThis.addEventListener?.('ca:fichadas-seccion', onSectionEvent)

  if (registrarSlot && registrarActions.length) {
    registrarMenu = createRegistrarMenu({
      actions: registrarActions,
      onSelect: (action) => {
        const empleados = () => [...empleadoById.values()]
        if (action.id === 'fichada-manual') {
          void openFichadaManual({
            getEmpleados: empleados,
            opener: registrarMenu?.trigger,
            onSaved: savedManual,
          })
        }
        if (action.id === 'dia-libre') {
          void openDiaLibre({
            getEmpleados: empleados,
            opener: registrarMenu?.trigger,
            onChanged: async () => {
              if (calendarRoot?.isConnected) await calendarRoot.reload()
              await loadFichadas()
            },
          })
        }
      },
    })
    registrarMenu?.root && registrarSlot.append(registrarMenu.root)
  }
  const secciones = [seccionConsulta, seccionInforme].filter(Boolean)
  secciones.forEach((tab, index) => {
    tab.addEventListener('click', () => {
      const next = tab === seccionInforme ? 'informe' : 'consulta'
      if (next === seccionActual) return
      showSection(next, { historyMode: 'push' })
    })
    tab.addEventListener('keydown', (event) => {
      if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return
      event.preventDefault()
      const delta = event.key === 'ArrowRight' ? 1 : -1
      const target = secciones[(index + delta + secciones.length) % secciones.length]
      target.focus()
      target.click()
    })
  })
  const hashInforme = readHashParam(globalThis.location?.hash, 'seccion') === 'informe'
  const inicial = verInforme && hashInforme ? 'informe' : 'consulta'
  const historyMode = !verInforme && hashInforme
    ? 'replace'
    : inicial === 'informe' && (globalThis.location?.hash || '') !== '#/fichadas?seccion=informe'
      ? 'replace'
      : 'none'
  showSection(inicial, { historyMode })
  const tabs = [tabTimeline, tabJornadas, tabMovimientos, tabCalendario]
  const tabViews = ['timeline', 'jornadas', 'movimientos']
  function activateTab(index) {
    if (index === 3) {
      void openLabor('calendario')
      return
    }
    setView(tabViews[index])
  }
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => activateTab(index))
    tab.addEventListener('keydown', (event) => {
      if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return
      event.preventDefault()
      const delta = event.key === 'ArrowRight' ? 1 : -1
      const next = (index + delta + tabs.length) % tabs.length
      tabs[next].focus()
      activateTab(next)
    })
  })

  syncCustomDates()
  setTabStyles()
  setExportEnabled({ canPrint: false, canOpenCsv: false })
  container.replaceChildren(view)
  await loadFichadas()
  if (extras.fichadasLabor === 'alertas') {
    await openLabor('alertas')
    if (extras.openAlertaDetalle) await alertasApi?.openFirst?.()
  }
  return () => {
    closeObservacionesJornada()
    unbindTooltipRoot(view)
    columnPicker.destroy()
    empleadoCombobox.destroy()
    registrarMenu?.destroy()
    consultaExport.destroy()
    informePanel?.destroy()
    globalThis.removeEventListener?.('ca:fichadas-seccion', onSectionEvent)
    alertasApi?.close?.()
    closeFichadasOverlays()
    returnToJornada = null
    observacionSession += 1
    jornadaDetalleModal?.close({ force: true })
    observacionModal?.close({ force: true })
  }
}
