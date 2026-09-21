import { getCurrentUser } from '../api/auth.js'
import { canLoadTenantData, getOperativeEmpresaId } from '../api/empresa-context.js'
import {
  EMPRESAS_CATALOG_EVENT,
  EMPRESAS_CATALOG_STATUS,
  getEmpresasCatalogState,
} from '../api/empresas.js'
import { listAgentesCatalog } from '../api/agentes.js'
import { getSucursales } from '../api/sucursales.js'
import { buildDashboardData, dashboardFichadasFilters, getDashboardUsuariosGestion } from '../api/dashboard.js'
import { getEmpleados } from '../api/empleados.js'
import { getHealthReady, isHealthReadyEnabled } from '../api/health.js'
import { FICHADAS_LIMITE, getFichadas } from '../api/fichadas.js'
import { isSuperadmin } from '../config/roles.js'
import { empleadoAlertLabel, empleadoEstaActivo, empleadoPerteneceAEmpresaActiva } from '../utils/empleado-alerts.js'
import { openEnrolarHuellaModal } from '../components/enrolar-huella-modal.js'
import {
  createDashboardAlerts,
  dashboardContentLayout,
  dashboardHasAlertas,
  focusDashboardAlertasPanel,
} from '../components/dashboard-alerts.js'
import { formatDashboardLastUpdate } from '../utils/format.js'
import { BTN_SECONDARY_CLASS } from '../components/button-styles.js'
import { createFeedbackState, createSelectEmpresaState } from '../components/feedback-state.js'
import { createRecentPunchesTable } from '../components/recent-punches-table.js'
import { pageHeadingMarkup } from '../components/page-heading.js'
import { createDashboardSkeleton } from '../components/skeleton.js'
import { createStatCard } from '../components/stat-card.js'
import { iconClock, iconLogin, iconLogout, iconUsers } from '../components/icons.js'
import {
  baseDatosStatus,
  createSystemStatusCard,
  sistemaOperativoStatus,
} from '../components/system-status.js'
import { alertasPendientesStatus, buildDashboardAlertas } from '../utils/dashboard-alertas.js'
import {
  baseDatosEvidenceSource,
  deriveBaseDatosConnected,
  deriveSistemaKind,
  interpretHealthResponse,
  queryFromSettled,
} from '../utils/dashboard-sistema.js'
import {
  attachSucursalNombres,
  dispositivosResumenStatus,
  filterAgentesPorEmpresa,
  puedeVerFilaDispositivos,
  resumenDispositivosDesdeAgentes,
} from '../utils/dashboard-dispositivos.js'
import { logInfo } from '../utils/activity-log.js'

const REFRESH_INTERVAL_MS = 5 * 60_000
const LABEL_INTERVAL_MS = 30_000

export function renderDashboard(container, { onNavigate } = {}) {
  const view = document.createElement('div')
  view.className = 'space-y-6'

  view.innerHTML = `
    <section class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      ${pageHeadingMarkup({
        title: 'Dashboard',
        description: 'Resumen general del sistema y la actividad de hoy.',
      })}
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
  let deviceState = {
    loaded: false,
    reason: '',
    total: 0,
    conectados: 0,
    desconectados: 0,
    dispositivos: [],
    error: '',
    status: 0,
  }
  let sistemaState = {
    loaded: false,
    kind: 'unknown',
    error: '',
  }
  let healthState = {
    loaded: false,
    verdict: 'inconclusive',
    connected: null,
    reachable: false,
    error: '',
    status: 0,
  }
  let dbEvidence = []
  let usuariosState = []

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

  function currentDbConnected() {
    return deriveBaseDatosConnected({
      health: healthState.loaded ? healthState : null,
      evidence: dbEvidence,
      sistemaKind: sistemaState.kind,
    })
  }

  function currentSystemCard() {
    const user = getCurrentUser()
    const detailed = isSuperadmin(user)
    const connected = currentDbConnected()
    const alertas = currentAlertas()
    return createSystemStatusCard({
      sistema: sistemaOperativoStatus({
        kind: sistemaState.loaded ? sistemaState.kind : 'unknown',
        errorMessage: sistemaState.error,
        detailed,
      }),
      baseDatos: baseDatosStatus({
        connected,
        errorMessage: healthState.error,
        detailed,
        source: baseDatosEvidenceSource({ health: healthState, evidence: dbEvidence }),
      }),
      dispositivos: puedeVerFilaDispositivos(user) ? dispositivosResumenStatus(deviceState) : null,
      alertas: currentAlertasStatus(alertas),
      lastUpdateLabel: formatDashboardLastUpdate(lastSuccessAt),
      onAlertasAction: () => {
        focusDashboardAlertasPanel()
      },
    })
  }

  function currentAlertasStatus(alertas = currentAlertas()) {
    const hasCatalog = Array.isArray(lastData?.empleadosCatalog)
    const pendingCount = Number(alertas?.pendingCount) || 0
    const hasAlertas = dashboardHasAlertas(alertas)
    const failed = !hasCatalog && Boolean(lastRequestError)
    return alertasPendientesStatus({
      catalogReady: hasCatalog,
      empleadosConsultaOk: hasCatalog,
      hasAlertas,
      pendingCount: pendingCount || (hasAlertas ? alertas.items.length : 0),
      loading: !hasCatalog && !failed && inFlight,
      failed,
      worst: alertas?.worst,
    })
  }

  function currentAlertas() {
    const user = getCurrentUser()
    return buildDashboardAlertas({
      user,
      empleados: lastData?.empleados ?? [],
      empleadosCatalog: lastData?.empleadosCatalog,
      usuarios: usuariosState,
      dispositivos: deviceState.dispositivos,
      dispositivosConsultaOk:
        isSuperadmin(user) && deviceState.loaded && !deviceState.error && !deviceState.reason,
      sistema: {
        baseDatosConectada: currentDbConnected(),
        detail: healthState.error,
      },
      isSuperadminViewer: isSuperadmin(user),
      catalogReady: lastData?.catalogReady === true && lastData?.empleadosConsultaOk === true,
    })
  }

  function paintSystemCard() {
    if (!systemHost) return
    const card = currentSystemCard()
    card.classList.add('h-full')
    systemHost.replaceChildren(card)
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
    cards.className =
      'grid gap-4 sm:grid-cols-2 lg:h-full lg:min-h-0 lg:flex-1 lg:grid-rows-[repeat(2,minmax(0,1fr))]'
    const metrics = [
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
    ]
    for (const card of metrics) {
      card.classList.add('h-full', 'min-h-0')
      cards.append(card)
    }
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
    const alertas = currentAlertas()
    const layout = dashboardContentLayout({
      hasDataError: showDataError,
      alertas,
    })
    layoutMode = layout

    const grid = document.createElement('div')
    grid.setAttribute('data-dashboard-layout', layout)

    systemHost = document.createElement('div')
    systemHost.className = 'order-1 min-w-0 shrink-0 lg:h-full'
    paintSystemCard()

    const statsCol = document.createElement('div')
    statsCol.className = 'order-2 min-w-0 shrink-0 space-y-4 lg:flex lg:h-full lg:min-h-0 lg:flex-col'

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
        'flex flex-col gap-6 lg:grid lg:h-[calc(100dvh-11rem)] lg:min-h-[32rem] lg:grid-cols-[minmax(16rem,32%)_minmax(0,1fr)] lg:grid-rows-[auto_minmax(0,1fr)] lg:items-stretch'

      const leftCol = document.createElement('div')
      leftCol.className = 'contents'

      const rightCol = document.createElement('div')
      rightCol.className = 'contents'

      const alerts = createDashboardAlerts(alertas, {
        onAction: (action) => {
          if (action?.kind === 'enroll-help') {
            openEnrollHelp(action)
            return
          }
          if (!action?.view) return
          const options = {}
          if (action.empleadoId != null) options.empleadoId = action.empleadoId
          if (action.openEdit) options.openEdit = true
          if (action.estadoDatos) options.estadoDatos = action.estadoDatos
          if (action.initialQuery) options.initialQuery = action.initialQuery
          onNavigate?.(action.view, options)
        },
      })
      if (alerts) {
        alerts.classList.add(
          'order-3',
          'min-h-0',
          'min-w-0',
          'lg:col-start-1',
          'lg:row-start-2',
          'lg:self-start',
        )
      }

      recentPunches.classList.add(
        'order-4',
        'max-h-[min(24rem,70vh)]',
        'lg:col-start-2',
        'lg:row-start-2',
        'lg:h-full',
        'lg:min-h-0',
        'lg:max-h-none',
      )

      systemHost.classList.add('lg:col-start-1', 'lg:row-start-1', 'lg:h-full')
      statsCol.classList.add('lg:col-start-2', 'lg:row-start-1', 'lg:h-full', 'lg:min-h-0')

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
    systemHost.classList.add('lg:col-start-1', 'lg:row-start-1', 'lg:h-full')
    statsCol.classList.add('lg:col-start-2', 'lg:row-start-1', 'lg:h-full', 'lg:min-h-0')
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

  async function loadDispositivos(user) {
    if (!puedeVerFilaDispositivos(user)) {
      deviceState = {
        hidden: true,
        loaded: false,
        reason: 'unsupported',
        total: null,
        conectados: null,
        desconectados: null,
        dispositivos: [],
        error: '',
        status: 0,
      }
      return
    }

    const empresaId = getOperativeEmpresaId(user)
    if (!empresaId) {
      deviceState = {
        loaded: true,
        reason: 'empresa',
        total: 0,
        conectados: 0,
        desconectados: 0,
        dispositivos: [],
        error: '',
        status: 0,
      }
      return
    }

    try {
      const agentes = filterAgentesPorEmpresa(await listAgentesCatalog({ empresaId }), empresaId)
      let sucursales = []
      try {
        sucursales = await getSucursales({ empresaId })
      } catch {
        sucursales = []
      }
      deviceState = {
        loaded: true,
        reason: '',
        error: '',
        status: 0,
        hidden: false,
        ...resumenDispositivosDesdeAgentes(attachSucursalNombres(agentes, sucursales)),
      }
    } catch (error) {
      deviceState = {
        loaded: true,
        reason: '',
        total: 0,
        conectados: 0,
        desconectados: 0,
        dispositivos: [],
        error: error.message || 'No se pudieron consultar los dispositivos.',
        status: Number(error.status) || 0,
      }
      throw error
    }
  }

  async function loadHealth() {
    if (!isHealthReadyEnabled()) {
      return interpretHealthResponse({ skipped: true })
    }
    return getHealthReady()
  }

  async function loadUsuariosGestion() {
    return getDashboardUsuariosGestion()
  }

  function applyQueryOutcomes({
    empleadosResult,
    fichadasResult,
    dispositivosResult,
    health,
    usuariosResult,
    usuariosSkipped,
    agentesSkipped,
  }) {
    const empleadosQuery = queryFromSettled('empleados', empleadosResult)
    const fichadasQuery = queryFromSettled('fichadas', fichadasResult)
    const usuariosQuery = queryFromSettled('usuarios', usuariosResult, { skipped: usuariosSkipped })
    const agentesQuery = queryFromSettled('agentes', dispositivosResult, {
      skipped: agentesSkipped || Boolean(deviceState.hidden) || deviceState.reason === 'empresa',
    })
    const healthQuery =
      health?.verdict === 'skipped'
        ? { name: 'health', outcome: 'skipped', status: 0, reachable: false }
        : health?.verdict === 'healthy'
          ? { name: 'health', outcome: 'success', status: health.status, reachable: true }
          : health?.verdict === 'unhealthy'
            ? { name: 'health', outcome: 'success', status: health.status, reachable: true }
            : { name: 'health', outcome: health?.reachable ? 'skipped' : 'network', status: health?.status || 0, reachable: Boolean(health?.reachable) }

    const queries = [empleadosQuery, fichadasQuery, usuariosQuery, agentesQuery, healthQuery]
    sistemaState = {
      loaded: true,
      kind: deriveSistemaKind(queries, { settled: true }),
      error: [empleadosResult, fichadasResult].find((item) => item.status === 'rejected')?.reason?.message || '',
    }

    dbEvidence = [empleadosQuery, fichadasQuery, usuariosQuery, agentesQuery]
    healthState = {
      loaded: true,
      verdict: health?.verdict ?? 'inconclusive',
      connected: health?.connected ?? null,
      reachable: Boolean(health?.reachable),
      error: health?.verdict === 'unhealthy' ? 'El chequeo opcional de disponibilidad indicó que la base no está accesible.' : '',
      status: health?.status || 0,
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
      const [empleadosResult, fichadasResult, dispositivosResult, healthResult, usuariosResult] = await Promise.allSettled([
        getEmpleados({ incluirInactivos: true }),
        getFichadas(dashboardFichadasFilters()),
        loadDispositivos(user),
        loadHealth(),
        loadUsuariosGestion(),
      ])
      if (cancelled || seq !== loadSeq) return

      const sessionExpired = [empleadosResult, fichadasResult, dispositivosResult, usuariosResult].some(
        (result) => result.status === 'rejected' && result.reason?.message === 'Sesión expirada o no autorizada.',
      )
      if (sessionExpired) return

      const usuariosValue = usuariosResult.status === 'fulfilled' ? usuariosResult.value : null
      const usuariosSkipped = Boolean(usuariosValue && usuariosValue.attempted === false)
      if (usuariosResult.status === 'fulfilled') {
        usuariosState = Array.isArray(usuariosValue?.usuarios) ? usuariosValue.usuarios : []
      } else {
        usuariosState = []
      }

      const health = healthResult.status === 'fulfilled' ? healthResult.value : { verdict: 'inconclusive', connected: null, reachable: false, status: 0 }
      applyQueryOutcomes({
        empleadosResult,
        fichadasResult,
        dispositivosResult,
        health,
        usuariosResult: usuariosSkipped
          ? { status: 'fulfilled', value: [] }
          : usuariosResult.status === 'fulfilled'
            ? { status: 'fulfilled', value: usuariosValue.usuarios }
            : usuariosResult,
        usuariosSkipped,
        agentesSkipped: !isSuperadmin(user),
      })

      const empleadosOk = empleadosResult.status === 'fulfilled'
      const fichadasOk = fichadasResult.status === 'fulfilled'
      const catalog = empleadosOk ? empleadosResult.value : lastData?.empleadosCatalog
      const catalogReady = empleadosOk ? Array.isArray(catalog) : lastData?.catalogReady === true
      const activos = Array.isArray(catalog)
        ? catalog.filter(empleadoEstaActivo)
        : lastData?.empleados ?? []
      const snapshot = buildDashboardData(
        activos,
        fichadasOk ? fichadasResult.value : lastData?.ultimasFichadas ?? [],
      )
      snapshot.empleadosCatalog = catalogReady ? catalog : null
      snapshot.catalogReady = catalogReady
      snapshot.empleadosConsultaOk = empleadosOk

      if (empleadosOk || fichadasOk) {
        hasSuccessfulData = true
        lastRequestError = ''
        lastSuccessAt = new Date()
        if (empleadosOk && fichadasOk) {
          banner.replaceChildren()
        } else {
          const failed = empleadosOk ? fichadasResult.reason : empleadosResult.reason
          lastRequestError = failed?.message || 'Ocurrió un error al consultar la API.'
          showRefreshError(lastRequestError)
        }
        renderData(snapshot)
        return
      }

      lastRequestError =
        empleadosResult.reason?.message ||
        fichadasResult.reason?.message ||
        'Ocurrió un error al consultar la API.'

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

  function refreshDashboard() {
    logInfo('Dashboard', 'Actualización manual del panel.')
    void load()
  }

  function openEnrollHelp(action) {
    const empresaId = getOperativeEmpresaId(getCurrentUser())
    const catalog = lastData?.empleadosCatalog
    const fromCatalog = Array.isArray(catalog)
      ? catalog.find((item) => Number(item.id) === Number(action.empleadoId))
      : null
    const empleado = fromCatalog || {
      id: action.empleadoId,
      empresaId: action.empresaId,
      nombre: action.empleadoNombre,
    }
    if (!empleadoPerteneceAEmpresaActiva(empleado, empresaId)) return
    openEnrolarHuellaModal({
      empleado,
      empleadoId: action.empleadoId,
      empleadoNombre: fromCatalog ? empleadoAlertLabel(fromCatalog) : action.empleadoNombre,
      empresaId,
      onRefresh: refreshDashboard,
    })
  }

  refreshButton.addEventListener('click', () => {
    refreshDashboard()
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
