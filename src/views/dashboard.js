import { getDashboardData } from '../api/dashboard.js'
import { FICHADAS_LIMITE } from '../api/fichadas.js'
import { createDashboardAlerts } from '../components/dashboard-alerts.js'
import { createFeedbackState, createLoadingState } from '../components/feedback-state.js'
import { createRecentPunchesTable } from '../components/recent-punches-table.js'
import { createStatCard } from '../components/stat-card.js'
import { iconClock, iconLogin, iconLogout, iconUsers } from '../components/icons.js'

export async function renderDashboard(container, { onNavigate } = {}) {
  const view = document.createElement('div')
  view.className = 'space-y-8'
  container.replaceChildren(view)

  async function load() {
    view.replaceChildren(createLoadingState('Cargando dashboard...'))

    try {
      const data = await getDashboardData()

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

      const content = document.createElement('div')
      content.className = 'space-y-8'
      content.append(cards)

      if (data.alcanzoLimite) {
        const note = document.createElement('p')
        note.className = 'rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900'
        note.textContent = `Las fichadas de hoy alcanzaron el límite máximo de ${FICHADAS_LIMITE} registros de la API. Los contadores de fichadas, entradas y salidas pueden estar incompletos.`
        content.append(note)
      }

      content.append(
        createDashboardAlerts(data.alertas, {
          onOpenEmpleados: (initialQuery) => onNavigate?.('empleados', initialQuery ? { initialQuery } : {}),
        }),
        createRecentPunchesTable(data.ultimasFichadas),
      )
      view.replaceChildren(content)
    } catch (error) {
      if (error.message === 'Sesión expirada o no autorizada.') {
        return
      }

      view.replaceChildren(
        createFeedbackState({
          title: 'No se pudo cargar el dashboard',
          message: error.message || 'Ocurrió un error al consultar la API.',
          tone: 'error',
          actionLabel: 'Reintentar',
          onAction: load,
        }),
      )
    }
  }

  await load()
}
