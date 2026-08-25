import { DEFAULT_VIEW, NAV_ITEMS } from './config/navigation.js'
import { createLayout } from './components/layout.js'
import { setSidebarOpen } from './components/sidebar.js'
import { renderDashboard } from './views/dashboard.js'

const views = {
  dashboard: renderDashboard,
}

export function bootstrap(root) {
  let currentView = DEFAULT_VIEW

  const mount = () => {
    const { root: layout, main } = createLayout({
      currentView,
      onNavigate: (viewId) => {
        if (viewId === currentView) {
          setSidebarOpen(false)
          return
        }

        currentView = viewId
        setSidebarOpen(false)
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
