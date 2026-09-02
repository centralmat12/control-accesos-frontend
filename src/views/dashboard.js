import { getDashboardData } from '../api/dashboard.js'
import { FICHADAS_LIMITE } from '../api/fichadas.js'
import { createDashboardAlerts } from '../components/dashboard-alerts.js'
import { createFeedbackState, createLoadingState } from '../components/feedback-state.js'
import { createRecentPunchesTable } from '../components/recent-punches-table.js'
import { createStatCard } from '../components/stat-card.js'
import { iconClock, iconLogin, iconLogout, iconUsers } from '../components/icons.js'
import { formatClockTime } from '../utils/format.js'

const REFRESH_INTERVAL_MS = 60_000

export function renderDashboard(container, { onNavigate } = {}) {
  const view = document.createElement('div')
  view.className = 'space-y-6'

  view.innerHTML = `
    <section class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p id="dashboard-updated" class="mt-1 text-sm text-slate-500">Última actualización: —</p>
        <p class="mt-1 text-xs text-slate-400">Hora de la última consulta de este panel a la API. No indica conexión del agente ni del lector.</p>
      </div>
      <button
        type="button"
        id="dashboard-refresh"
        class="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        Actualizar
      </button>
    </section>
    <div id="dashboard-banner"></div>
    <div id="dashboard-content"></div>
  `

  const updatedLabel = view.querySelector('#dashboard-updated')
  const refreshButton = view.querySelector('#dashboard-refresh')
  const banner = view.querySelector('#dashboard-banner')
  const content = view.querySelector('#dashboard-content')

  let cancelled = false
  let inFlight = false
  let loadSeq = 0
  let hasSuccessfulData = false
  let timerId = null

  function setUpdatedAt(date) {
    updatedLabel.textContent = `Última actualización: ${formatClockTime(date)}`
  }

  function setRefreshing(active) {
    refreshButton.disabled = active
    refreshButton.textContent = active ? 'Actualizando...' : 'Actualizar'
  }

  function showRefreshError(message) {
    const wrap = document.createElement('div')
    wrap.className =
      'flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 sm:flex-row sm:items-center sm:justify-between'

    const text = document.createElement('div')
    const title = document.createElement('p')
    title.className = 'font-semibold'
    title.textContent = 'No se pudo actualizar el dashboard'
    const detail = document.createElement('p')
    detail.className = 'mt-1 text-red-800'
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

  function renderData(data) {
    const cards = document.createElement('div')
    cards.className = 'grid gap-4 sm:grid-cols-2 xl:grid-cols-4'

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

    const body = document.createElement('div')
    body.className = 'space-y-8'
    body.append(cards)

    if (data.alcanzoLimite) {
      const note = document.createElement('p')
      note.className = 'rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900'
      note.textContent = `Las fichadas de hoy alcanzaron el límite máximo de ${FICHADAS_LIMITE} registros de la API. Los contadores de fichadas, entradas y salidas pueden estar incompletos.`
      body.append(note)
    }

    body.append(
      createDashboardAlerts(data.alertas, {
        onOpenEmpleados: (initialQuery) => onNavigate?.('empleados', initialQuery ? { initialQuery } : {}),
      }),
      createRecentPunchesTable(data.ultimasFichadas),
    )

    content.replaceChildren(body)
  }

  async function load() {
    if (cancelled || inFlight) return

    inFlight = true
    const seq = ++loadSeq
    setRefreshing(true)
    if (!hasSuccessfulData) {
      banner.replaceChildren()
      content.replaceChildren(createLoadingState('Cargando dashboard...'))
    }

    try {
      const data = await getDashboardData()
      if (cancelled || seq !== loadSeq) return

      hasSuccessfulData = true
      banner.replaceChildren()
      setUpdatedAt(new Date())
      renderData(data)
    } catch (error) {
      if (cancelled || seq !== loadSeq) return

      if (error.message === 'Sesión expirada o no autorizada.') {
        return
      }

      const errorState = createFeedbackState({
        title: 'No se pudo cargar el dashboard',
        message: error.message || 'Ocurrió un error al consultar la API.',
        tone: 'error',
        actionLabel: 'Reintentar',
        onAction: () => {
          void load()
        },
      })

      if (hasSuccessfulData) {
        showRefreshError(error.message || 'Ocurrió un error al consultar la API.')
      } else {
        banner.replaceChildren()
        content.replaceChildren(errorState)
      }
    } finally {
      if (seq === loadSeq) {
        inFlight = false
        if (!cancelled) setRefreshing(false)
      }
    }
  }

  function startAutoRefresh() {
    stopAutoRefresh()
    timerId = window.setInterval(() => {
      if (document.visibilityState === 'hidden') return
      void load()
    }, REFRESH_INTERVAL_MS)
  }

  function stopAutoRefresh() {
    if (timerId != null) {
      window.clearInterval(timerId)
      timerId = null
    }
  }

  refreshButton.addEventListener('click', () => {
    void load()
  })

  container.replaceChildren(view)
  void load()
  startAutoRefresh()

  return () => {
    cancelled = true
    stopAutoRefresh()
  }
}
