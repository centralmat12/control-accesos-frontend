import { EMPRESA_CONTEXTO_EVENT, getEmpresaContexto } from '../api/empresa-context.js'
import { empresaDisplayName, getCachedEmpresaNombre, getEmpresaActual } from '../api/empresas.js'
import { APP_NAME, getNavItemsForUser } from '../config/navigation.js'
import { APP_VERSION_LABEL } from '../config/version.js'
import { isSuperadmin } from '../config/roles.js'
import { getSidebarCollapsed, setSidebarCollapsed } from '../config/sidebar.js'
import { brandLogoHorizontalMarkup, brandLogoMarkMarkup } from './brand-logo.js'
import { NAV_ICONS } from './icons.js'

function brandLabel(empresaNombre) {
  const name = String(empresaNombre ?? '').trim()
  return name ? `${APP_NAME} - ${name}` : APP_NAME
}

function immediateEmpresaNombre(user) {
  if (isSuperadmin(user)) {
    return empresaDisplayName(getEmpresaContexto())
  }

  return getCachedEmpresaNombre(user)
}

function applyBrand(el, empresaNombre) {
  const text = brandLabel(empresaNombre)
  el.title = text
}

function brandVisibilityClasses(collapsed) {
  return {
    horizontal: collapsed ? 'min-w-0 lg:hidden' : 'min-w-0',
    mark: collapsed ? 'hidden lg:block' : 'hidden',
  }
}

export function createSidebar({ currentView, user, onNavigate }) {
  const navItems = getNavItemsForUser(user)
  const collapsed = getSidebarCollapsed()
  const aside = document.createElement('aside')
  aside.id = 'app-sidebar'
  aside.className = `fixed inset-y-0 left-0 z-40 flex w-72 -translate-x-full flex-col border-r border-slate-800 bg-slate-950 text-slate-300 transition-[width,transform] duration-200 lg:translate-x-0 ${
    collapsed ? 'lg:w-20' : 'lg:w-72'
  }`
  const visibility = brandVisibilityClasses(collapsed)

  aside.innerHTML = `
    <div data-sidebar-brand-row class="flex min-w-0 items-center border-b border-slate-800 px-4 py-3 ${collapsed ? 'lg:h-16 lg:justify-center lg:px-3 lg:py-0' : ''}">
      <div id="sidebar-brand" class="min-w-0">
        <div data-brand-horizontal class="${visibility.horizontal}">
          ${brandLogoHorizontalMarkup({ variant: 'sidebar', alt: APP_NAME })}
        </div>
        ${brandLogoMarkMarkup({ alt: APP_NAME, extraClass: visibility.mark })}
      </div>
    </div>
    <nav data-sidebar-nav class="flex-1 space-y-1 overflow-y-auto p-4 ${collapsed ? 'lg:px-3' : ''}" aria-label="Navegación principal">
      ${navItems.map((item) => {
        const active = item.id === currentView
        const classes = active
          ? 'bg-blue-600 text-white shadow-sm'
          : 'text-slate-300 hover:bg-slate-800 hover:text-white'
        return `
          <a
            href="#/${item.id}"
            data-view="${item.id}"
            data-label="${item.label}"
            title="${collapsed ? item.label : ''}"
            aria-label="${item.label}"
            class="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${collapsed ? 'lg:justify-center lg:px-0' : ''} ${classes}"
            ${active ? 'aria-current="page"' : ''}
          >
            ${NAV_ICONS[item.id]()}
            <span data-sidebar-label class="${collapsed ? 'lg:hidden' : ''}">${item.label}</span>
          </a>
        `
      }).join('')}
    </nav>
    <div class="border-t border-slate-800 p-4 text-xs text-slate-500">
      <button
        type="button"
        data-sidebar-collapse
        class="hidden w-full items-center justify-center rounded-lg px-2 py-2 text-2xl font-semibold text-slate-400 hover:bg-slate-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 lg:inline-flex"
        aria-label="${collapsed ? 'Expandir barra lateral' : 'Contraer barra lateral'}"
        aria-controls="app-sidebar"
        aria-expanded="${String(!collapsed)}"
        title="${collapsed ? 'Expandir barra lateral' : 'Contraer barra lateral'}"
      >
        ${collapsed ? '»' : '«'}
      </button>
      <span data-sidebar-footer class="mt-2 block text-center ${collapsed ? 'lg:hidden' : ''}">${APP_VERSION_LABEL}</span>
    </div>
  `

  const brandEl = aside.querySelector('#sidebar-brand')
  applyBrand(brandEl, immediateEmpresaNombre(user))

  aside.querySelectorAll('[data-view]').forEach((link) => {
    link.addEventListener('click', () => setSidebarOpen(false))
  })
  aside.querySelector('[data-sidebar-collapse]')?.addEventListener('click', () => {
    applySidebarCollapsed(setSidebarCollapsed(!getSidebarCollapsed()))
  })

  const syncSuperadminBrand = () => {
    if (!aside.isConnected) {
      window.removeEventListener(EMPRESA_CONTEXTO_EVENT, syncSuperadminBrand)
      return
    }

    if (!isSuperadmin(user)) return
    applyBrand(brandEl, empresaDisplayName(getEmpresaContexto()))
  }

  window.addEventListener(EMPRESA_CONTEXTO_EVENT, syncSuperadminBrand)
  void resolveSidebarBrand(aside, brandEl, user)

  return aside
}

function applySidebarCollapsed(collapsed) {
  const sidebar = document.getElementById('app-sidebar')
  const shell = document.getElementById('app-shell')
  if (!sidebar || !shell) return

  sidebar.classList.toggle('lg:w-20', collapsed)
  sidebar.classList.toggle('lg:w-72', !collapsed)
  shell.classList.toggle('lg:pl-20', collapsed)
  shell.classList.toggle('lg:pl-72', !collapsed)

  const brandRow = sidebar.querySelector('[data-sidebar-brand-row]')
  brandRow?.classList.toggle('lg:justify-center', collapsed)
  brandRow?.classList.toggle('lg:px-3', collapsed)
  brandRow?.classList.toggle('lg:h-16', collapsed)
  brandRow?.classList.toggle('lg:py-0', collapsed)
  sidebar.querySelector('[data-brand-horizontal]')?.classList.toggle('lg:hidden', collapsed)
  const mark = sidebar.querySelector('[data-brand-mark]')
  if (mark) {
    mark.classList.add('hidden')
    mark.classList.toggle('lg:block', collapsed)
  }

  const nav = sidebar.querySelector('[data-sidebar-nav]')
  nav?.classList.toggle('lg:px-3', collapsed)
  sidebar.querySelectorAll('[data-view]').forEach((button) => {
    button.classList.toggle('lg:justify-center', collapsed)
    button.classList.toggle('lg:px-0', collapsed)
    button.title = collapsed ? button.dataset.label : ''
  })
  sidebar.querySelectorAll('[data-sidebar-label]').forEach((label) => {
    label.classList.toggle('lg:hidden', collapsed)
  })
  sidebar.querySelector('[data-sidebar-footer]')?.classList.toggle('lg:hidden', collapsed)

  const toggle = sidebar.querySelector('[data-sidebar-collapse]')
  const label = collapsed ? 'Expandir barra lateral' : 'Contraer barra lateral'
  if (toggle) {
    toggle.textContent = collapsed ? '»' : '«'
    toggle.setAttribute('aria-label', label)
    toggle.setAttribute('aria-expanded', String(!collapsed))
    toggle.title = label
  }
}

async function resolveSidebarBrand(aside, brandEl, user) {
  if (isSuperadmin(user)) {
    applyBrand(brandEl, empresaDisplayName(getEmpresaContexto()))
    return
  }

  applyBrand(brandEl, getCachedEmpresaNombre(user))

  try {
    const empresa = await getEmpresaActual()
    if (!aside.isConnected) return
    applyBrand(brandEl, empresaDisplayName(empresa))
  } catch (error) {
    if (error.message === 'Sesión expirada o no autorizada.') return
  }
}

export function setSidebarOpen(open) {
  const sidebar = document.getElementById('app-sidebar')
  const overlay = document.getElementById('sidebar-overlay')
  if (!sidebar || !overlay) return

  sidebar.classList.toggle('-translate-x-full', !open)
  overlay.classList.toggle('hidden', !open)
  overlay.classList.toggle('opacity-0', !open)
}
