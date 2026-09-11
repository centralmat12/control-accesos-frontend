import { DEFAULT_VIEW, NAV_ITEMS, canAccessView, resolveAccessibleView } from './config/navigation.js'
import {
  getCurrentUser,
  isAuthenticated,
  logout,
  requiresPasswordChange,
} from './api/auth.js'
import { EMPRESA_CONTEXTO_EVENT } from './api/empresa-context.js'
import { createLayout } from './components/layout.js'
import { setSidebarOpen } from './components/sidebar.js'
import { createFeedbackState } from './components/feedback-state.js'
import { enhanceSelectsIn, destroyDisconnectedSelects, closeOpenDropdown } from './components/dropdown.js'
import { hideTooltip } from './components/tooltip.js'
import { createViewSkeleton } from './components/skeleton.js'
import { renderAdministracion } from './views/administracion.js'
import { renderDashboard } from './views/dashboard.js'
import { renderEmpleados } from './views/empleados.js'
import { renderFichadas } from './views/fichadas.js'
import { renderCambioPasswordObligatorio } from './views/cambiar-password.js'
import { renderLogin } from './views/login.js'
import { renderRegistros } from './views/registros.js'
import { logInfo } from './utils/activity-log.js'

const views = {
  dashboard: renderDashboard,
  fichadas: renderFichadas,
  empleados: renderEmpleados,
  registros: renderRegistros,
  administracion: renderAdministracion,
}

let activeViewCleanup = null
let passwordChangeViewActive = false

function clearActiveView() {
  closeOpenDropdown()
  hideTooltip()
  activeViewCleanup?.()
  activeViewCleanup = null
}

export function bootstrap(root) {
  let currentView = DEFAULT_VIEW
  let pendingViewOptions = {}
  let mainEl = null
  let viewExtras = {}

  const refreshActiveView = () => {
    if (!mainEl || !isAuthenticated()) return
    void renderView(mainEl, currentView, viewExtras)
  }

  const mount = () => {
    const user = getCurrentUser()

    if (!user || !isAuthenticated()) {
      clearActiveView()
      mainEl = null
      passwordChangeViewActive = false
      renderLogin(root, { onSuccess: mount })
      return
    }

    if (requiresPasswordChange(user)) {
      clearActiveView()
      mainEl = null
      passwordChangeViewActive = true
      renderCambioPasswordObligatorio(root, {
        onLogout: () => {
          currentView = DEFAULT_VIEW
          pendingViewOptions = {}
          mount()
        },
        onCompleted: () => {
          currentView = DEFAULT_VIEW
          pendingViewOptions = {}
          mount()
        },
      })
      return
    }

    passwordChangeViewActive = false

    const openingLayout = !mainEl

    const navigate = (viewId, options = {}) => {
      const userNow = getCurrentUser()
      const requested = viewId
      viewId = resolveAccessibleView(userNow, viewId)
      if (requested !== viewId && !canAccessView(userNow, requested)) {
        if (viewId === currentView && Object.keys(options).length === 0) {
          setSidebarOpen(false)
          return
        }
      }

      const changed = viewId !== currentView || Object.keys(options).length > 0
      if (viewId === currentView && Object.keys(options).length === 0) {
        setSidebarOpen(false)
        return
      }

      if (changed) {
        const label = NAV_ITEMS.find((item) => item.id === viewId)?.label ?? viewId
        logInfo('Navegación', `Usuario abrió la sección ${label}.`)
      }

      currentView = viewId
      pendingViewOptions = options
      setSidebarOpen(false)
      mount()
    }

    const { root: layout, main } = createLayout({
      currentView,
      user,
      onNavigate: navigate,
      onLogout: () => {
        clearActiveView()
        logout()
        currentView = DEFAULT_VIEW
        pendingViewOptions = {}
        mount()
      },
    })

    root.replaceChildren(layout)
    mainEl = main
    currentView = resolveAccessibleView(user, currentView)
    viewExtras = { onNavigate: navigate, ...pendingViewOptions }
    pendingViewOptions = {}
    if (openingLayout) {
      const label = NAV_ITEMS.find((item) => item.id === currentView)?.label ?? currentView
      logInfo('Navegación', `Usuario abrió la sección ${label}.`)
    }
    void renderView(main, currentView, viewExtras)
  }

  window.addEventListener('ca:unauthorized', () => {
    clearActiveView()
    mainEl = null
    passwordChangeViewActive = false
    currentView = DEFAULT_VIEW
    pendingViewOptions = {}
    mount()
  })

  window.addEventListener('ca:password-change-required', () => {
    if (passwordChangeViewActive) return
    clearActiveView()
    mainEl = null
    currentView = DEFAULT_VIEW
    pendingViewOptions = {}
    mount()
  })

  window.addEventListener(EMPRESA_CONTEXTO_EVENT, refreshActiveView)

  mount()
}

async function renderView(main, viewId, extras = {}) {
  clearActiveView()
  const user = getCurrentUser()
  viewId = resolveAccessibleView(user, viewId)

  if (!canAccessView(user, viewId)) {
    const message =
      viewId === 'administracion'
        ? 'No tenés permisos para acceder a Administración'
        : 'No tenés permisos para acceder a esta sección.'
    main.replaceChildren(
      createFeedbackState({
        title: 'Acceso denegado',
        message,
        tone: 'error',
      }),
    )
    return
  }

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

  main.replaceChildren(createViewSkeleton())
  destroyDisconnectedSelects()
  const cleanup = await render(main, extras)
  enhanceSelectsIn(main)
  if (typeof cleanup === 'function') activeViewCleanup = cleanup
}
