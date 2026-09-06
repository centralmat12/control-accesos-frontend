import { getEmpresas, empresaDisplayName } from '../api/empresas.js'
import {
  getEmpresaContexto,
  setEmpresaContexto,
  clearEmpresaContexto,
} from '../api/empresa-context.js'
import { isSuperadmin } from '../config/roles.js'
import { NAV_ITEMS } from '../config/navigation.js'
import { iconLogout, iconMenu } from './icons.js'
import { setSidebarOpen } from './sidebar.js'
import { createThemeToggle } from './theme-toggle.js'
import { escapeHtml } from '../utils/format.js'

function initials(nombre) {
  return nombre
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}

function sortEmpresas(empresas) {
  return [...empresas].sort((a, b) =>
    empresaDisplayName(a).localeCompare(empresaDisplayName(b), 'es', {
      sensitivity: 'base',
    }),
  )
}

export function createHeader({ currentView, user, onLogout }) {
  const item = NAV_ITEMS.find((nav) => nav.id === currentView)
  const header = document.createElement('header')
  header.className =
    'sticky top-0 z-20 flex h-16 items-center justify-between gap-2 border-b border-slate-200 bg-white/90 px-3 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90 sm:gap-3 sm:px-4 lg:px-8'

  const superadmin = isSuperadmin(user)

  header.innerHTML = `
    <div class="flex min-w-0 items-center gap-2 sm:gap-3">
      <button
        type="button"
        id="sidebar-toggle"
        class="rounded-lg p-2 text-slate-600 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-slate-300 dark:hover:bg-slate-800 lg:hidden"
        aria-label="Abrir menú"
      >
        ${iconMenu()}
      </button>
      <div class="min-w-0">
        <p class="hidden text-xs font-medium uppercase tracking-wide text-slate-400 sm:block">Panel</p>
        <h1 class="truncate text-base font-semibold text-slate-900 dark:text-slate-100 sm:text-lg">${escapeHtml(item?.label ?? '')}</h1>
      </div>
    </div>
    <div class="flex min-w-0 shrink-0 items-center gap-1.5 sm:gap-3">
      ${superadmin ? '<div id="header-empresa" class="min-w-0"></div>' : ''}
      <div class="hidden min-w-0 text-right sm:block">
        <p class="truncate text-sm font-medium text-slate-800 dark:text-slate-200">${escapeHtml(user.nombre)}</p>
        <p class="truncate text-xs text-slate-500 dark:text-slate-400">${escapeHtml(user.rol)}</p>
      </div>
      <div id="header-theme-toggle"></div>
      <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">${escapeHtml(initials(user.nombre))}</span>
      <button
        type="button"
        id="logout-button"
        class="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-2 text-sm font-medium text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 sm:px-3"
      >
        ${iconLogout()}
        <span class="hidden sm:inline">Cerrar sesión</span>
      </button>
    </div>
  `

  header.querySelector('#header-theme-toggle')?.replaceChildren(createThemeToggle())

  header.querySelector('#sidebar-toggle')?.addEventListener('click', () => {
    setSidebarOpen(true)
  })

  header.querySelector('#logout-button')?.addEventListener('click', () => {
    onLogout()
  })

  if (superadmin) {
    void renderSuperadminSelector(header.querySelector('#header-empresa'))
  }

  return header
}

async function renderSuperadminSelector(slot) {
  const select = document.createElement('select')
  select.id = 'header-empresa-select'
  select.className =
    'max-w-[7rem] rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 sm:max-w-[12rem] sm:px-2.5 lg:max-w-[16rem]'
  select.setAttribute('aria-label', 'Empresa de contexto')
  select.innerHTML = `<option value="">Seleccioná una empresa</option>`
  slot.replaceChildren(select)

  let empresas = []
  const contexto = getEmpresaContexto()
  const contextoNombre = empresaDisplayName(contexto)
  if (contexto?.id && contextoNombre) {
    select.append(new Option(contextoNombre, String(contexto.id), true, true))
  }

  try {
    empresas = sortEmpresas(await getEmpresas())
    const selectedId = String(getEmpresaContexto()?.id ?? '')
    select.replaceChildren(new Option('Seleccioná una empresa', ''))
    empresas.forEach((empresa) => {
      const label = empresaDisplayName(empresa)
      if (!label) return
      select.append(new Option(label, String(empresa.id)))
    })
    select.value = empresas.some((empresa) => String(empresa.id) === selectedId) ? selectedId : ''
    if (selectedId && select.value !== selectedId) {
      clearEmpresaContexto()
    }
  } catch (error) {
    if (error.message === 'Sesión expirada o no autorizada.') return
    select.disabled = true
  }

  select.addEventListener('change', () => {
    const id = Number(select.value)
    if (!id) {
      clearEmpresaContexto()
      return
    }

    const selected = empresas.find((empresa) => Number(empresa.id) === id)
    const option = select.selectedOptions[0]
    const nombre = empresaDisplayName(selected) || (option?.textContent || '').trim()
    setEmpresaContexto(selected ?? { id, nombre })
  })
}
