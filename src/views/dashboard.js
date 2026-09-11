import { getCurrentUser } from '../api/auth.js'
import { listAgentesCatalog } from '../api/agentes.js'
import { canLoadTenantData, getOperativeEmpresaId } from '../api/empresa-context.js'
import {
  EMPRESAS_CATALOG_EVENT,
  EMPRESAS_CATALOG_STATUS,
  getEmpresasCatalogState,
} from '../api/empresas.js'
import { getDashboardData } from '../api/dashboard.js'
import { FICHADAS_LIMITE } from '../api/fichadas.js'
import { puedeListarAgentes } from '../config/administracion.js'
import { isSuperadmin } from '../config/roles.js'
import {
  createDashboardAlerts,
  dashboardContentLayout,
} from '../components/dashboard-alerts.js'
import { BTN_SECONDARY_CLASS } from '../components/button-styles.js'
import { createFeedbackState, createSelectEmpresaState } from '../components/feedback-state.js'
import { createRecentPunchesTable } from '../components/recent-punches-table.js'
import { createDashboardSkeleton } from '../components/skeleton.js'
import { createStatCard } from '../components/stat-card.js'
import { iconClock, iconLogin, iconLogout, iconUsers } from '../components/icons.js'
import {
  agenteSinPermisoStatus,
  apiConsultaStatus,
  createSystemStatusCard,
  datosCargaStatus,
} from '../components/system-status.js'
import { formatClockTime } from '../utils/format.js'
import { resumenAgentesConectividad } from '../utils/agente-conectividad.js'
import { logInfo } from '../utils/activity-log.js'

const REFRESH_INTERVAL_MS = 5 * 60_000
const LABEL_INTERVAL_MS = 30_000

export function renderDashboard(container, { onNavigate } = {}) {
  const view = document.createElement('div')
  view.className = 'space-y-6'

  view.innerHTML = `
    <section class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
      <div class="flex flex-col items-stretch gap-1.5 sm:items-end">
        <button
          type="button"
          id="dashboard-refresh"
          class="${BTN_SECONDARY_CLASS}"
        >
          Actualizar
        </button>
        <p id="dashboard-refresh-hint" class="hidden max-w-xs text-xs text-slate-500 sm:text-right"></p>
      </div>
    </section>
    <div id="dashboard-banner"></div>
    <div id="dashboard-content"></div>
  `

  const refreshButton = view.querySelector('#dashboard-refresh')
  const refreshHint = view.querySelector('#dashboard-refresh-hint')
  const banner = view.querySelector('#dashboard-banner')
  const content = view.querySelector('#dashboard-content')

  let cancelled = false
  let inFlight = false
  let loadSeq = 0
  let hasSuccessfulData = false
  let lastData = null
  let lastSuccessAt = null
  let lastRequestError = ''
  let timerId = null
  let labelTimerId = null
  let refreshBlocked = false
  let systemHost = null
  let layoutMode = null
  let agentState = {
    loaded: false,
    permitted: false,
    agentes: [],
    error: '',
  }

  function setRefreshHint(message) {
    if (!message) {
      refreshHint.textContent = ''
      refreshHint.classList.add('hidden')
      refreshButton.removeAttribute('aria-describedby')
      return
    }

    refreshHint.textContent = message
    refreshHint.classList.remove('hidden')
    refreshButton.setAttribute('aria-describedby', 'dashboard-refresh-hint')
  }

  function setRefreshing(active, { silent = false } = {}) {
    if (silent && hasSuccessfulData) {
      refreshButton.disabled = refreshBlocked
      return
    }
    refreshButton.disabled = refreshBlocked || active
    refreshButton.textContent = active ? 'Actualizando...' : 'Actualizar'
  }

  function currentAgentStatus(now = new Date()) {
    if (!agentState.permitted) return agenteSinPermisoStatus()
    if (agentState.error) {
      return {
        tone: 'error',
        label: 'Error',
        detail: agentState.error,
        items: [],
      }
    }
    if (!agentState.loaded) {
      return {
        tone: 'neutral',
        label: 'Sin información',
        detail: 'Todavía no se consultaron los agentes.',
        items: [],
      }
    }
    return resumenAgentesConectividad(agentState.agentes, now)
  }

  function currentSystemCard() {
    return createSystemStatusCard({
      api: apiConsultaStatus({
        ok: hasSuccessfulData && !lastRequestError,
        errorMessage: lastRequestError,
      }),
      datos: datosCargaStatus({
        lastSuccessAt,
        clockLabel: lastSuccessAt ? formatClockTime(lastSuccessAt) : '',
      }),
      agente: currentAgentStatus(),
    })
  }

  function paintSystemCard() {
    if (!systemHost) return
    systemHost.replaceChildren(currentSystemCard())
  }

  function showUnavailablePanel() {
    hasSuccessfulData = false
    lastData = null
    refreshBlocked = true
    systemHost = null
    layoutMode = null
    stopLabelClock()
    setRefreshing(false)
    banner.replaceChildren()

    const catalog = getEmpresasCatalogState()

    if (
      catalog.status === EMPRESAS_CATALOG_STATUS.loading ||
      catalog.status === EMPRESAS_CATALOG_STATUS.idle
    ) {
      content.replaceChildren(
        createFeedbackState({
          title: 'Cargando empresas',
          message: 'Cargando empresas...',
        }),
      )
      setRefreshHint('Esperá a que se cargue el listado de empresas.')
      return
    }

    if (catalog.status === EMPRESAS_CATALOG_STATUS.empty) {
      content.replaceChildren(
        createFeedbackState({
          title: 'No hay empresas disponibles',
          message: 'No hay empresas disponibles para consultar.',
        }),
      )
      setRefreshHint('No hay una empresa para consultar.')
      return
    }

    if (catalog.status === EMPRESAS_CATALOG_STATUS.error) {
      const block = createFeedbackState({
        title: 'No se puede cargar el panel',
        message: 'No fue posible obtener una empresa válida para consultar la información.',
        tone: 'error',
      })
      if (catalog.statusCode === 403) {
        const note = document.createElement('p')
        note.className = 'mt-2 text-sm text-red-700 dark:text-red-300'
        note.textContent = 'La cuenta actual no tiene permisos suficientes para consultar empresas.'
        block.append(note)
      }
      content.replaceChildren(block)
      setRefreshHint('El panel no se puede actualizar en este estado.')
      return
    }

    content.replaceChildren(createSelectEmpresaState())
    setRefreshHint('Elegí una empresa en el encabezado.')
  }

  function showRefreshError(message) {
    const wrap = document.createElement('div')
    wrap.className =
      'flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 sm:flex-row sm:items-center sm:justify-between dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-100'

    const text = document.createElement('div')
    const title = document.createElement('p')
    title.className = 'font-semibold'
    title.textContent = 'No se pudo actualizar el dashboard'
    const detail = document.createElement('p')
    detail.className = 'mt-1 text-red-800 dark:text-red-200'
    detail.textContent = message
    text.append(title, detail)

    const retry = document.createElement('button')
    retry.type = 'button'
    retry.className = 'shrink-0 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-500'
    retry.textContent = 'Reintentar'
    retry.addEventListener('click', () => {
      void load()
    })

    wrap.append(text, retry)
    banner.replaceChildren(wrap)
  }

  function appendStatCards(statsCol, data) {
    const cards = document.createElement('div')
    cards.className = 'grid gap-4 sm:grid-cols-2'
    cards.append(
      createStatCard({
        label: 'Empleados activos',
        value: data.empleadosActivos,
        icon: iconUsers(),
        accent: 'blue',
      }),
      createStatCard({
        label: 'Fichadas de hoy',
        value: data.fichadasHoy,
        icon: iconClock(),
        accent: 'indigo',
      }),
      createStatCard({
        label: 'Entradas',
        value: data.entradas,
        icon: iconLogin(),
        accent: 'emerald',
      }),
      createStatCard({
        label: 'Salidas',
        value: data.salidas,
        icon: iconLogout(),
        accent: 'amber',
      }),
    )
    statsCol.append(cards)

    if (data.alcanzoLimite) {
      const note = document.createElement('p')
      note.className =
        'rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100'
      note.textContent = `Las fichadas de hoy alcanzaron el límite máximo de ${FICHADAS_LIMITE} registros de la API. Los contadores de fichadas, entradas y salidas pueden estar incompletos.`
      statsCol.append(note)
    }
  }

  function renderOperationalLayout(data, { showDataError = false, errorMessage = '' } = {}) {
    const layout = dashboardContentLayout({
      hasDataError: showDataError,
      alertas: data?.alertas,
    })
    layoutMode = layout

    const grid = document.createElement('div')
    grid.setAttribute('data-dashboard-layout', layout)

    systemHost = document.createElement('div')
    systemHost.className = 'order-1 min-w-0 shrink-0'
    systemHost.replaceChildren(currentSystemCard())

    const statsCol = document.createElement('div')
    statsCol.className = 'order-2 min-w-0 shrink-0 space-y-4'

    if (showDataError) {
      statsCol.append(
        createFeedbackState({
          title: 'No se pudo cargar el dashboard',
          message: errorMessage || 'Ocurrió un error al consultar la API.',
          tone: 'error',
          actionLabel: 'Reintentar',
          onAction: () => {
            void load()
          },
        }),
      )
      grid.className =
        'flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(16rem,32%)_minmax(0,1fr)] lg:items-start'
      grid.append(systemHost, statsCol)
      content.replaceChildren(grid)
      startLabelClock()
      return
    }

    if (data) appendStatCards(statsCol, data)

    const recentPunches = createRecentPunchesTable(data?.ultimasFichadas ?? [], {
      onViewAll: () => onNavigate?.('fichadas'),
    })

    if (layout === 'split') {
      grid.className =
        'flex flex-col gap-6 lg:grid lg:h-[calc(100dvh-11rem)] lg:min-h-[32rem] lg:grid-cols-[minmax(16rem,32%)_minmax(0,1fr)] lg:items-stretch'

      const leftCol = document.createElement('div')
      leftCol.className = 'contents lg:flex lg:min-h-0 lg:flex-col lg:gap-6'

      const rightCol = document.createElement('div')
      rightCol.className = 'contents lg:flex lg:min-h-0 lg:flex-col lg:gap-6'

      const alerts = createDashboardAlerts(data?.alertas, {
        onOpenEmpleados: (initialQuery) => onNavigate?.('empleados', initialQuery ? { initialQuery } : {}),
      })
      if (alerts) alerts.classList.add('order-3', 'min-h-0', 'min-w-0', 'lg:flex-1')

      recentPunches.classList.add('order-4', 'max-h-[min(24rem,70vh)]', 'lg:max-h-none')

      leftCol.append(systemHost)
      if (alerts) leftCol.append(alerts)
      rightCol.append(statsCol, recentPunches)
      grid.append(leftCol, rightCol)
      content.replaceChildren(grid)
      startLabelClock()
      return
    }

    grid.className =
      'flex flex-col gap-6 lg:grid lg:h-[calc(100dvh-11rem)] lg:min-h-[32rem] lg:grid-cols-[minmax(16rem,32%)_minmax(0,1fr)] lg:grid-rows-[auto_minmax(0,1fr)] lg:items-stretch'
    systemHost.classList.add('lg:col-start-1', 'lg:row-start-1')
    statsCol.classList.add('lg:col-start-2', 'lg:row-start-1')
    recentPunches.classList.add(
      'order-3',
      'max-h-[min(24rem,70vh)]',
      'lg:col-span-2',
      'lg:row-start-2',
      'lg:h-full',
      'lg:min-h-0',
      'lg:max-h-none',
    )
    grid.append(systemHost, statsCol, recentPunches)
    content.replaceChildren(grid)
    startLabelClock()
  }

  function renderData(data) {
    lastData = data
    renderOperationalLayout(data)
  }

  async function loadAgents(user) {
    const empresaId = getOperativeEmpresaId(user)
    const permitted = puedeListarAgentes(user, empresaId)
    if (!permitted) {
      agentState = { loaded: true, permitted: false, agentes: [], error: '' }
      return
    }

    try {
      const agentes = await listAgentesCatalog({ empresaId })
      agentState = { loaded: true, permitted: true, agentes, error: '' }
    } catch (error) {
      if (error.message === 'Sesión expirada o no autorizada.') throw error
      agentState = {
        loaded: true,
        permitted: true,
        agentes: [],
        error: error.message || 'No se pudieron consultar los agentes.',
      }
    }
  }

  async function load({ silent = false } = {}) {
    if (cancelled || inFlight) return

    if (!canLoadTenantData(getCurrentUser())) {
      showUnavailablePanel()
      return
    }

    refreshBlocked = false
    setRefreshHint('')
    refreshButton.disabled = false

    inFlight = true
    const seq = ++loadSeq
    setRefreshing(true, { silent })
    if (!hasSuccessfulData) {
      banner.replaceChildren()
      content.replaceChildren(createDashboardSkeleton())
    }

    const user = getCurrentUser()

    try {
      const [dashboardResult, agentResult] = await Promise.allSettled([getDashboardData(), loadAgents(user)])
      if (cancelled || seq !== loadSeq) return

      if (agentResult.status === 'rejected') {
        if (agentResult.reason?.message === 'Sesión expirada o no autorizada.') return
        agentState = {
          loaded: true,
          permitted: puedeListarAgentes(user, getOperativeEmpresaId(user)),
          agentes: [],
          error: agentResult.reason?.message || 'No se pudieron consultar los agentes.',
        }
      }

      if (dashboardResult.status === 'fulfilled') {
        hasSuccessfulData = true
        lastRequestError = ''
        lastSuccessAt = new Date()
        banner.replaceChildren()
        renderData(dashboardResult.value)
        return
      }

      const error = dashboardResult.reason
      if (error?.message === 'Sesión expirada o no autorizada.') return

      lastRequestError = error?.message || 'Ocurrió un error al consultar la API.'

      if (hasSuccessfulData && lastData) {
        showRefreshError(lastRequestError)
        paintSystemCard()
        return
      }

      banner.replaceChildren()
      renderOperationalLayout(null, { showDataError: true, errorMessage: lastRequestError })
    } finally {
      if (seq === loadSeq) {
        inFlight = false
        if (!cancelled) setRefreshing(false, { silent })
      }
    }
  }

  function startAutoRefresh() {
    stopAutoRefresh()
    timerId = window.setInterval(() => {
      if (document.visibilityState === 'hidden') return
      if (isSuperadmin(getCurrentUser()) && !canLoadTenantData(getCurrentUser())) return
      void load({ silent: true })
    }, REFRESH_INTERVAL_MS)
  }

  function stopAutoRefresh() {
    if (timerId != null) {
      window.clearInterval(timerId)
      timerId = null
    }
  }

  function startLabelClock() {
    stopLabelClock()
    labelTimerId = window.setInterval(() => {
      if (document.visibilityState === 'hidden') return
      paintSystemCard()
    }, LABEL_INTERVAL_MS)
  }

  function stopLabelClock() {
    if (labelTimerId != null) {
      window.clearInterval(labelTimerId)
      labelTimerId = null
    }
  }

  refreshButton.addEventListener('click', () => {
    logInfo('Dashboard', 'Actualización manual del panel.')
    void load()
  })

  function onEmpresasCatalogChange() {
    if (cancelled) return
    if (!canLoadTenantData(getCurrentUser())) {
      showUnavailablePanel()
    }
  }

  window.addEventListener(EMPRESAS_CATALOG_EVENT, onEmpresasCatalogChange)

  container.replaceChildren(view)
  void load()
  startAutoRefresh()

  return () => {
    cancelled = true
    stopAutoRefresh()
    stopLabelClock()
    window.removeEventListener(EMPRESAS_CATALOG_EVENT, onEmpresasCatalogChange)
  }
}
