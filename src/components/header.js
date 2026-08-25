import { NAV_ITEMS } from '../config/navigation.js'
import { iconLogout, iconMenu } from './icons.js'
import { setSidebarOpen } from './sidebar.js'

function initials(nombre) {
  return nombre
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}

export function createHeader({ currentView, user, onLogout }) {
  const item = NAV_ITEMS.find((nav) => nav.id === currentView)
  const header = document.createElement('header')
  header.className =
    'sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 bg-white/90 px-4 backdrop-blur lg:px-8'

  header.innerHTML = `
    <div class="flex items-center gap-3">
      <button
        type="button"
        id="sidebar-toggle"
        class="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
        aria-label="Abrir menú"
      >
        ${iconMenu()}
      </button>
      <div>
        <p class="text-xs font-medium uppercase tracking-wide text-slate-400">Panel</p>
        <h1 class="text-lg font-semibold text-slate-900">${item?.label ?? ''}</h1>
      </div>
    </div>
    <div class="flex items-center gap-3">
      <div class="hidden text-right sm:block">
        <p class="text-sm font-medium text-slate-800">${user.nombre}</p>
        <p class="text-xs text-slate-500">${user.rol}</p>
      </div>
      <span class="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">${initials(user.nombre)}</span>
      <button
        type="button"
        id="logout-button"
        class="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
      >
        ${iconLogout()}
        <span class="hidden sm:inline">Cerrar sesión</span>
      </button>
    </div>
  `

  header.querySelector('#sidebar-toggle')?.addEventListener('click', () => {
    setSidebarOpen(true)
  })

  header.querySelector('#logout-button')?.addEventListener('click', () => {
    onLogout()
  })

  return header
}
