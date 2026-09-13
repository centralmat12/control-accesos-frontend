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
import { destroyDisconnectedAccountMenus } from './components/account-menu.js'
import { hideTooltip } from './components/tooltip.js'
import { createViewSkeleton } from './components/skeleton.js'
import { renderAdministracion } from './views/administracion.js'
import { renderDashboard } from './views/dashboard.js'
import { renderEmpleados } from './views/empleados.js'
import { renderFichadas } from './views/fichadas.js'
import { openCambiarPasswordModal, renderCambioPasswordObligatorio } from './views/cambiar-password.js'
import { renderLogin } from './views/login.js'
import { renderRegistros } from './views/registros.js'
import { logInfo } from './utils/activity-log.js'
import { assignViewHash, parseHashView, viewHash, writeViewHash } from './utils/hash-route.js'

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
  destroyDisconnectedAccountMenus()
  hideTooltip()
  activeViewCleanup?.()
  activeViewCleanup = null
}

export function bootstrap(root) {
  let currentView = DEFAULT_VIEW
  let pendingViewOptions = {}
  let mainEl = null
  let viewExtras = {}
  let historyLock = false

  const refreshActiveView = () => {
    if (!mainEl || !isAuthenticated()) return
    void renderView(mainEl, currentView, viewExtras)
  }

  function resolvedHashView(user = getCurrentUser()) {
    const parsed = parseHashView(globalThis.location?.hash)
    const viewId = resolveAccessibleView(user, parsed.viewId)
    return { parsed, viewId }
  }

  function canonicalizeHash(viewId, { valid = true } = {}) {
    const expected = viewHash(viewId)
    if (valid && expected === viewHash(parseHashView(globalThis.location?.hash).viewId) && !parseHashView(globalThis.location?.hash).empty) {
      if ((globalThis.location?.hash || '') === expected) return
    }
    writeViewHash(viewId, { replace: true })
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
          writeViewHash(DEFAULT_VIEW, { replace: true })
          mount()
        },
        onCompleted: () => {
          currentView = DEFAULT_VIEW
          pendingViewOptions = {}
          writeViewHash(DEFAULT_VIEW, { replace: true })
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
      historyLock = true
      assignViewHash(viewId)
      mount()
      queueMicrotask(() => {
        historyLock = false
      })
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
        writeViewHash(DEFAULT_VIEW, { replace: true })
        mount()
      },
      onChangePassword: () => {
        openCambiarPasswordModal({
          onCompleted: () => {
            clearActiveView()
            mainEl = null
            currentView = DEFAULT_VIEW
            pendingViewOptions = {}
            writeViewHash(DEFAULT_VIEW, { replace: true })
            mount()
          },
        })
      },
    })

    root.replaceChildren(layout)
    destroyDisconnectedAccountMenus()
    mainEl = main
    const fromHash = resolvedHashView(user)
    if (!fromHash.parsed.valid || fromHash.parsed.empty || fromHash.viewId !== fromHash.parsed.viewId) {
      canonicalizeHash(fromHash.viewId, { valid: fromHash.parsed.valid && !fromHash.parsed.empty })
    } else if ((globalThis.location?.hash || '') !== viewHash(fromHash.viewId)) {
      writeViewHash(fromHash.viewId, { replace: true })
    }
    currentView = fromHash.viewId
    viewExtras = { onNavigate: navigate, ...pendingViewOptions }
    pendingViewOptions = {}
    if (openingLayout) {
      const label = NAV_ITEMS.find((item) => item.id === currentView)?.label ?? currentView
      logInfo('Navegación', `Usuario abrió la sección ${label}.`)
    }
    void renderView(main, currentView, viewExtras)
  }

  function onHistoryNavigation() {
    if (historyLock) return
    historyLock = true
    queueMicrotask(() => {
      historyLock = false
    })

    if (!isAuthenticated()) {
      clearActiveView()
      mainEl = null
      passwordChangeViewActive = false
      currentView = DEFAULT_VIEW
      pendingViewOptions = {}
      mount()
      return
    }

    if (requiresPasswordChange(getCurrentUser())) {
      if (!passwordChangeViewActive) mount()
      return
    }

    const { parsed, viewId } = resolvedHashView()
    if (!parsed.valid || parsed.empty || viewId !== parsed.viewId || (globalThis.location?.hash || '') !== viewHash(viewId)) {
      writeViewHash(viewId, { replace: true })
    }

    if (viewId === currentView && Object.keys(pendingViewOptions).length === 0 && mainEl) {
      setSidebarOpen(false)
      return
    }

    currentView = viewId
    pendingViewOptions = {}
    setSidebarOpen(false)
    mount()
  }

  window.addEventListener('ca:unauthorized', () => {
    clearActiveView()
    mainEl = null
    passwordChangeViewActive = false
    currentView = DEFAULT_VIEW
    pendingViewOptions = {}
    writeViewHash(DEFAULT_VIEW, { replace: true })
    mount()
  })

  window.addEventListener('ca:password-change-required', () => {
    if (passwordChangeViewActive) return
    clearActiveView()
    mainEl = null
    currentView = DEFAULT_VIEW
    pendingViewOptions = {}
    writeViewHash(DEFAULT_VIEW, { replace: true })
    mount()
  })

  window.addEventListener(EMPRESA_CONTEXTO_EVENT, refreshActiveView)
  window.addEventListener('hashchange', onHistoryNavigation)
  window.addEventListener('popstate', onHistoryNavigation)

  if (isAuthenticated() && !requiresPasswordChange(getCurrentUser())) {
    const initial = resolvedHashView()
    currentView = initial.viewId
    if (!initial.parsed.valid || initial.parsed.empty) {
      writeViewHash(initial.viewId, { replace: true })
    }
  }

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
  destroyDisconnectedAccountMenus()
  const cleanup = await render(main, extras)
  enhanceSelectsIn(main)
  if (typeof cleanup === 'function') activeViewCleanup = cleanup
}
