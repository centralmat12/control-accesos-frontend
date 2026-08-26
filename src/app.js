import { DEFAULT_VIEW, NAV_ITEMS } from './config/navigation.js'
import { getCurrentUser, logout } from './api/auth.js'
import { createLayout } from './components/layout.js'
import { setSidebarOpen } from './components/sidebar.js'
import { renderDashboard } from './views/dashboard.js'
import { renderEmpleados } from './views/empleados.js'
import { renderLogin } from './views/login.js'

const views = {
  dashboard: renderDashboard,
  usuarios: renderEmpleados,
}

export function bootstrap(root) {
  let currentView = DEFAULT_VIEW

  const mount = () => {
    const user = getCurrentUser()

    if (!user) {
      renderLogin(root, { onSuccess: mount })
      return
    }

    const { root: layout, main } = createLayout({
      currentView,
      user,
      onNavigate: (viewId) => {
        if (viewId === currentView) {
          setSidebarOpen(false)
          return
        }

        currentView = viewId
        setSidebarOpen(false)
        mount()
      },
      onLogout: async () => {
        await logout()
        currentView = DEFAULT_VIEW
        mount()
      },
    })

    root.replaceChildren(layout)
    renderView(main, currentView)
  }

  mount()
}

async function renderView(main, viewId) {
  const render = views[viewId]

  if (!render) {
    const item = NAV_ITEMS.find((nav) => nav.id === viewId)
    main.innerHTML = `
      <div class="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
        <h2 class="text-lg font-semibold text-slate-900">${item?.label ?? 'Vista'}</h2>
        <p class="mt-2 text-sm text-slate-500">Esta pantalla se desarrollará en una próxima etapa.</p>
      </div>
    `
    return
  }

  main.innerHTML = `
    <div class="flex items-center justify-center py-16 text-sm text-slate-500">Cargando...</div>
  `
  await render(main)
}
