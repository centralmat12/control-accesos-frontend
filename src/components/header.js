import { getEmpresaActual, getEmpresas, empresaDisplayName } from '../api/empresas.js'
import {
  getEmpresaContexto,
  setEmpresaContexto,
  clearEmpresaContexto,
} from '../api/empresa-context.js'
import { isSuperadmin } from '../config/roles.js'
import { NAV_ITEMS } from '../config/navigation.js'
import { iconLogout, iconMenu } from './icons.js'
import { setSidebarOpen } from './sidebar.js'
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
    empresaDisplayName(a, a.id).localeCompare(empresaDisplayName(b, b.id), 'es', {
      sensitivity: 'base',
    }),
  )
}

export function createHeader({ currentView, user, onLogout }) {
  const item = NAV_ITEMS.find((nav) => nav.id === currentView)
  const header = document.createElement('header')
  header.className =
    'sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur lg:px-8'

  const superadmin = isSuperadmin(user)

  header.innerHTML = `
    <div class="flex min-w-0 items-center gap-3">
      <button
        type="button"
        id="sidebar-toggle"
        class="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
        aria-label="Abrir menú"
      >
        ${iconMenu()}
      </button>
      <div class="min-w-0">
        <p class="text-xs font-medium uppercase tracking-wide text-slate-400">Panel</p>
        <h1 class="truncate text-lg font-semibold text-slate-900">${escapeHtml(item?.label ?? '')}</h1>
      </div>
    </div>
    <div class="flex min-w-0 items-center gap-3">
      <div id="header-empresa" class="min-w-0"></div>
      <div class="hidden text-right sm:block">
        <p class="text-sm font-medium text-slate-800">${escapeHtml(user.nombre)}</p>
        <p class="text-xs text-slate-500">${escapeHtml(user.rol)}</p>
      </div>
      <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">${escapeHtml(initials(user.nombre))}</span>
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

  const empresaSlot = header.querySelector('#header-empresa')

  header.querySelector('#sidebar-toggle')?.addEventListener('click', () => {
    setSidebarOpen(true)
  })

  header.querySelector('#logout-button')?.addEventListener('click', () => {
    onLogout()
  })

  if (superadmin) {
    void renderSuperadminSelector(empresaSlot)
  } else {
    void renderEmpresaLabel(empresaSlot, user)
  }

  return header
}

async function renderEmpresaLabel(slot, user) {
  const label = document.createElement('p')
  label.className = 'hidden max-w-[14rem] truncate text-right text-xs text-slate-500 sm:block'
  label.textContent = user.empresaId ? `Empresa ${user.empresaId}` : ''
  slot.replaceChildren(label)

  try {
    const empresa = await getEmpresaActual()
    const name = empresaDisplayName(empresa, empresa?.id ?? user.empresaId)
    if (name) label.textContent = name
  } catch (error) {
    if (error.message === 'Sesión expirada o no autorizada.') return
  }
}

async function renderSuperadminSelector(slot) {
  const select = document.createElement('select')
  select.id = 'header-empresa-select'
  select.className =
    'max-w-[16rem] rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
  select.setAttribute('aria-label', 'Empresa de contexto')
  select.innerHTML = `<option value="">Seleccioná una empresa</option>`
  slot.replaceChildren(select)

  const contexto = getEmpresaContexto()
  if (contexto?.id) {
    select.append(new Option(empresaDisplayName(contexto, contexto.id), String(contexto.id), true, true))
  }

  try {
    const empresas = sortEmpresas(await getEmpresas())
    const selectedId = String(getEmpresaContexto()?.id ?? '')
    select.replaceChildren(new Option('Seleccioná una empresa', ''))
    empresas.forEach((empresa) => {
      const option = new Option(empresaDisplayName(empresa, empresa.id), String(empresa.id))
      select.append(option)
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

    const option = select.selectedOptions[0]
    setEmpresaContexto({
      id,
      nombre: option?.textContent ?? `Empresa ${id}`,
    })
  })
}
