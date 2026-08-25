import { APP_NAME, NAV_ITEMS } from '../config/navigation.js'
import { NAV_ICONS } from './icons.js'

export function createSidebar({ currentView, onNavigate }) {
  const aside = document.createElement('aside')
  aside.id = 'app-sidebar'
  aside.className =
    'fixed inset-y-0 left-0 z-40 flex w-72 -translate-x-full flex-col border-r border-slate-800 bg-slate-950 text-slate-300 transition-transform duration-200 lg:translate-x-0'

  aside.innerHTML = `
    <div class="flex h-16 items-center gap-3 border-b border-slate-800 px-6">
      <span class="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-sm font-bold text-white">CA</span>
      <span class="text-sm font-semibold tracking-tight text-white">${APP_NAME}</span>
    </div>
    <nav class="flex-1 space-y-1 overflow-y-auto p-4" aria-label="Navegación principal">
      ${NAV_ITEMS.map((item) => {
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

  aside.querySelectorAll('[data-view]').forEach((button) => {
    button.addEventListener('click', () => onNavigate(button.dataset.view))
  })

  return aside
}

export function setSidebarOpen(open) {
  const sidebar = document.getElementById('app-sidebar')
  const overlay = document.getElementById('sidebar-overlay')
  if (!sidebar || !overlay) return

  sidebar.classList.toggle('-translate-x-full', !open)
  overlay.classList.toggle('hidden', !open)
  overlay.classList.toggle('opacity-0', !open)
}
