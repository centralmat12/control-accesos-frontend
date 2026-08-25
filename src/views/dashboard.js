import { getDashboardSummary, getUltimasFichadas } from '../api/dashboard.js'
import { createStatCard } from '../components/stat-card.js'
import { createRecentPunchesTable } from '../components/recent-punches-table.js'
import { iconUsers, iconClock, iconLogin, iconLogout } from '../components/icons.js'

export async function renderDashboard(container) {
  const [summary, fichadas] = await Promise.all([
    getDashboardSummary(),
    getUltimasFichadas(),
  ])

  const view = document.createElement('div')
  view.className = 'space-y-8'

  const cards = document.createElement('div')
  cards.className = 'grid gap-4 sm:grid-cols-2 xl:grid-cols-4'

  cards.append(
    createStatCard({
      label: 'Empleados activos',
      value: summary.empleadosActivos,
      icon: iconUsers(),
      accent: 'blue',
    }),
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
  )

  view.append(cards, createRecentPunchesTable(fichadas))
  container.replaceChildren(view)
}
