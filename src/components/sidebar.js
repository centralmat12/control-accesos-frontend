import { EMPRESA_CONTEXTO_EVENT, getEmpresaContexto } from '../api/empresa-context.js'
import { empresaDisplayName, getCachedEmpresaNombre, getEmpresaActual } from '../api/empresas.js'
import { APP_NAME, getNavItemsForUser } from '../config/navigation.js'
import { isSuperadmin } from '../config/roles.js'
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
  el.textContent = text
  el.title = text
}

export function createSidebar({ currentView, user, onNavigate }) {
  const navItems = getNavItemsForUser(user)
  const aside = document.createElement('aside')
  aside.id = 'app-sidebar'
  aside.className =
    'fixed inset-y-0 left-0 z-40 flex w-72 -translate-x-full flex-col border-r border-slate-800 bg-slate-950 text-slate-300 transition-transform duration-200 lg:translate-x-0'

  aside.innerHTML = `
    <div class="flex h-16 min-w-0 items-center gap-3 overflow-hidden border-b border-slate-800 px-6">
      <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-sm font-bold text-white">CA</span>
      <span id="sidebar-brand" class="min-w-0 truncate text-sm font-semibold tracking-tight text-white"></span>
    </div>
    <nav class="flex-1 space-y-1 overflow-y-auto p-4" aria-label="Navegación principal">
      ${navItems.map((item) => {
        const active = item.id === currentView
        const classes = active
          ? 'bg-blue-600 text-white shadow-sm'
          : 'text-slate-300 hover:bg-slate-800 hover:text-white'
        return `
          <button
            type="button"
            data-view="${item.id}"
            class="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${classes}"
            ${active ? 'aria-current="page"' : ''}
          >
            ${NAV_ICONS[item.id]()}
            <span>${item.label}</span>
          </button>
        `
      }).join('')}
    </nav>
    <div class="border-t border-slate-800 p-4 text-xs text-slate-500">
      Panel de administración
    </div>
  `

  const brandEl = aside.querySelector('#sidebar-brand')
  applyBrand(brandEl, immediateEmpresaNombre(user))

  aside.querySelectorAll('[data-view]').forEach((button) => {
    button.addEventListener('click', () => onNavigate(button.dataset.view))
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
