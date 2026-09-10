import {
  EMPRESAS_CATALOG_STATUS,
  empresaDisplayName,
  getEmpresas,
  setEmpresasCatalogState,
} from '../api/empresas.js'
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
import { logInfo } from '../utils/activity-log.js'
import { enhanceSelect, refreshEnhancedSelect } from './dropdown.js'

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
    'sticky top-0 z-20 flex min-h-16 items-center justify-between gap-2 border-b border-slate-200 bg-white/90 px-3 py-2 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90 sm:gap-3 sm:px-4 lg:px-8'

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
      ${superadmin ? '<div id="header-empresa" class="relative w-[min(16rem,42vw)] min-w-[10rem] max-w-[16rem] shrink-0 overflow-visible"></div>' : ''}
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

function fillDisabledOption(select, label) {
  select.replaceChildren(new Option(label, ''))
  select.value = ''
  select.disabled = true
  select.removeAttribute('title')
}

function setSelectorTooltip(wrap, tooltip, message) {
  tooltip.textContent = message || ''
  tooltip.classList.add('hidden')

  if (!message) {
    wrap.classList.remove('cursor-help')
    wrap.removeAttribute('aria-describedby')
    return
  }

  wrap.classList.add('cursor-help')
  wrap.setAttribute('aria-describedby', tooltip.id)
}

function bindSelectorTooltip(wrap, tooltip) {
  wrap.addEventListener('pointerenter', () => {
    if (!tooltip.textContent) return
    tooltip.classList.remove('hidden')
  })
  wrap.addEventListener('pointerleave', () => {
    tooltip.classList.add('hidden')
  })
}

async function renderSuperadminSelector(slot) {
  const wrap = document.createElement('div')
  wrap.className = 'relative overflow-visible'

  const select = document.createElement('select')
  select.id = 'header-empresa-select'
  select.className =
    'max-w-[7rem] rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 sm:max-w-[12rem] sm:px-2.5 lg:max-w-[16rem]'
  select.setAttribute('aria-label', 'Empresa de contexto')

  const tooltip = document.createElement('div')
  tooltip.id = 'header-empresa-tooltip'
  tooltip.setAttribute('role', 'tooltip')
  tooltip.className =
    'pointer-events-none absolute right-0 top-[calc(100%+0.4rem)] z-[60] hidden w-64 max-w-[min(16rem,calc(100vw-1.5rem))] rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs leading-snug text-slate-600 shadow-lg dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'

  wrap.append(select, tooltip)
  slot.replaceChildren(wrap)
  bindSelectorTooltip(wrap, tooltip)
  enhanceSelect(select, {
    wrapClass: 'relative w-full min-w-0 overflow-visible',
  })
  refreshEnhancedSelect(select)

  fillDisabledOption(select, 'Cargando empresas...')
  refreshEnhancedSelect(select)
  setSelectorTooltip(wrap, tooltip, '')
  setEmpresasCatalogState({ status: EMPRESAS_CATALOG_STATUS.loading })

  let empresas = []

  try {
    empresas = sortEmpresas(await getEmpresas())
    const selectedId = String(getEmpresaContexto()?.id ?? '')

    if (empresas.length === 0) {
      fillDisabledOption(select, 'No hay empresas disponibles')
      refreshEnhancedSelect(select)
      setSelectorTooltip(wrap, tooltip, '')
      if (getEmpresaContexto()) clearEmpresaContexto()
      setEmpresasCatalogState({ status: EMPRESAS_CATALOG_STATUS.empty })
      return
    }

    select.disabled = false
    select.title = 'Empresa de contexto'
    select.replaceChildren(new Option('Seleccioná una empresa', ''))
    empresas.forEach((empresa) => {
      const label = empresaDisplayName(empresa)
      if (!label) return
      select.append(new Option(label, String(empresa.id)))
    })
    select.value = empresas.some((empresa) => String(empresa.id) === selectedId) ? selectedId : ''
    refreshEnhancedSelect(select)
    if (selectedId && select.value !== selectedId) {
      clearEmpresaContexto()
    }
    setSelectorTooltip(wrap, tooltip, '')
    setEmpresasCatalogState({ status: EMPRESAS_CATALOG_STATUS.ready })
  } catch (error) {
    if (error.message === 'Sesión expirada o no autorizada.') return

    const isForbidden = Number(error.status) === 403
    fillDisabledOption(select, 'Empresas no disponibles')
    refreshEnhancedSelect(select)
    setSelectorTooltip(
      wrap,
      tooltip,
      isForbidden
        ? 'No fue posible obtener el listado de empresas. Posible problema de permisos o autorización.'
        : 'No fue posible obtener el listado de empresas.',
    )
    setEmpresasCatalogState({
      status: EMPRESAS_CATALOG_STATUS.error,
      message: error.message || 'No fue posible obtener el listado de empresas.',
      statusCode: Number(error.status) || 0,
    })
    return
  }

  select.addEventListener('change', () => {
    const id = Number(select.value)
    if (!id) {
      clearEmpresaContexto()
      logInfo('Empresas', 'Se quitó la empresa de contexto.')
      return
    }

    const selected = empresas.find((empresa) => Number(empresa.id) === id)
    const option = select.selectedOptions[0]
    const nombre = empresaDisplayName(selected) || (option?.textContent || '').trim()
    setEmpresaContexto(selected ?? { id, nombre })
    logInfo('Empresas', 'Empresa de contexto seleccionada.')
  })
}
