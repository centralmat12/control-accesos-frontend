import { cuentaRolLabel } from '../config/roles.js'
import { escapeHtml } from '../utils/format.js'
import {
  claimOpenDropdown,
  releaseOpenDropdown,
} from './dropdown.js'
import { DROPDOWN_ARROW } from './dropdown-styles.js'
import { iconLock, iconLogout } from './icons.js'

const instances = new Set()

export function destroyDisconnectedAccountMenus() {
  for (const api of [...instances]) {
    if (!api.trigger?.isConnected) api.destroy()
  }
}

function positionAccountMenu(trigger, panel) {
  const rect = trigger.getBoundingClientRect()
  const width = Math.min(288, Math.max(220, window.innerWidth - 16))
  panel.style.position = 'fixed'
  panel.style.width = `${width}px`
  panel.style.maxWidth = 'calc(100vw - 16px)'
  panel.style.minWidth = '0'
  panel.style.zIndex = '90'

  const panelHeight = Math.min(panel.scrollHeight || 200, window.innerHeight - 16)
  const spaceBelow = window.innerHeight - rect.bottom - 8
  const openUp = spaceBelow < Math.min(160, panelHeight) && rect.top > spaceBelow

  let left = rect.right - width
  if (left + width > window.innerWidth - 8) left = window.innerWidth - width - 8
  if (left < 8) left = 8
  panel.style.left = `${left}px`

  if (openUp) {
    panel.style.top = 'auto'
    panel.style.bottom = `${window.innerHeight - rect.top + 4}px`
  } else {
    panel.style.bottom = 'auto'
    panel.style.top = `${rect.bottom + 4}px`
  }
}

export function createAccountMenu({ user, initials, onChangePassword, onLogout }) {
  destroyDisconnectedAccountMenus()

  const abort = new AbortController()
  const wrap = document.createElement('div')
  wrap.className = 'relative shrink-0'
  wrap.dataset.caAccountMenu = 'true'

  const buttonId = 'account-menu-button'
  const panelId = 'account-menu-panel'
  const trigger = document.createElement('button')
  trigger.type = 'button'
  trigger.id = buttonId
  trigger.title = 'Menú de cuenta'
  trigger.setAttribute('aria-label', 'Abrir menú de cuenta')
  trigger.setAttribute('aria-haspopup', 'menu')
  trigger.setAttribute('aria-expanded', 'false')
  trigger.setAttribute('aria-controls', panelId)
  trigger.className =
    'inline-flex h-9 cursor-pointer items-center gap-0.5 rounded-full pr-1 text-white outline-none hover:bg-slate-800/80 hover:ring-2 hover:ring-blue-500/30 focus-visible:ring-2 focus-visible:ring-blue-500 dark:hover:bg-slate-700'
    trigger.innerHTML = `
    <span class="flex h-10 min-w-10 items-center justify-center rounded-full border border-slate-300 bg-slate-100 px-3 text-sm font-bold text-slate-800 transition-colors hover:bg-slate-200 dark:border-slate-500 dark:bg-slate-700 dark:text-white dark:hover:bg-slate-600">
    ${escapeHtml(initials)}</span>
    ${DROPDOWN_ARROW}
  `

  const panel = document.createElement('div')
  panel.id = panelId
  panel.hidden = true
  panel.setAttribute('role', 'menu')
  panel.setAttribute('aria-labelledby', buttonId)
  panel.className =
    'z-[90] max-h-[min(24rem,calc(100vh-1rem))] overflow-auto rounded-lg border border-slate-200 bg-white p-1.5 shadow-lg dark:border-slate-600 dark:bg-slate-900'

  const header = document.createElement('div')
  header.className = 'border-b border-slate-100 px-2.5 py-2 dark:border-slate-800'
  header.innerHTML = `
    <p class="truncate text-sm font-medium text-slate-900 dark:text-slate-100">${escapeHtml(user.nombre || '')}</p>
    <p class="truncate text-xs text-slate-500 dark:text-slate-400">${escapeHtml(user.email || '')}</p>
    <p class="mt-1 truncate text-xs font-medium text-slate-600 dark:text-slate-300">${escapeHtml(cuentaRolLabel(user.rol))}</p>
  `

  const itemClass =
    'flex min-h-10 w-full cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm text-slate-800 hover:bg-slate-50 focus:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-slate-200 dark:hover:bg-slate-800 dark:focus:bg-slate-800 [&_svg]:h-4 [&_svg]:w-4'

  const changeItem = document.createElement('button')
  changeItem.type = 'button'
  changeItem.id = 'account-menu-change-password'
  changeItem.setAttribute('role', 'menuitem')
  changeItem.className = itemClass
  changeItem.innerHTML = `${iconLock()}<span>Cambiar contraseña</span>`

  const logoutItem = document.createElement('button')
  logoutItem.type = 'button'
  logoutItem.id = 'account-menu-logout'
  logoutItem.setAttribute('role', 'menuitem')
  logoutItem.className = itemClass
  logoutItem.innerHTML = `${iconLogout()}<span>Cerrar sesión</span>`

  panel.append(header, changeItem, logoutItem)
  document.body.append(panel)
  wrap.append(trigger)

  const items = [changeItem, logoutItem]
  let open = false
  let activeIndex = 0

  function setActiveItem(index) {
    activeIndex = (index + items.length) % items.length
    items.forEach((item, i) => {
      item.tabIndex = i === activeIndex ? 0 : -1
    })
    items[activeIndex].focus()
  }

  function setOpen(next, { restoreFocus = false, focusItem = false } = {}) {
    if (open === next) {
      if (next) positionAccountMenu(trigger, panel)
      return
    }
    open = next
    if (open) claimOpenDropdown(api)
    else releaseOpenDropdown(api)
    panel.hidden = !open
    trigger.setAttribute('aria-expanded', String(open))
    if (open) {
      positionAccountMenu(trigger, panel)
      items.forEach((item, i) => {
        item.tabIndex = i === 0 ? 0 : -1
      })
      activeIndex = 0
      if (focusItem) items[0].focus()
    } else if (restoreFocus) {
      trigger.focus()
    }
  }

  function choose(action) {
    setOpen(false, { restoreFocus: true })
    action?.()
  }

  trigger.addEventListener('click', (event) => {
    event.stopPropagation()
    setOpen(!open, { focusItem: !open })
  }, { signal: abort.signal })

  trigger.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      if (!open) setOpen(true, { focusItem: true })
      else setActiveItem(0)
    }
  }, { signal: abort.signal })

  panel.addEventListener('keydown', (event) => {
    if (!open) return
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveItem(activeIndex + 1)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveItem(activeIndex - 1)
    } else if (event.key === 'Home') {
      event.preventDefault()
      setActiveItem(0)
    } else if (event.key === 'End') {
      event.preventDefault()
      setActiveItem(items.length - 1)
    } else if (event.key === 'Tab') {
      setOpen(false)
    }
  }, { signal: abort.signal })

  document.addEventListener('pointerdown', (event) => {
    if (!open) return
    if (wrap.contains(event.target) || panel.contains(event.target)) return
    setOpen(false, { restoreFocus: true })
  }, { signal: abort.signal })

  document.addEventListener('keydown', (event) => {
    if (!open) return
    if (event.key !== 'Escape') return
    event.preventDefault()
    event.stopPropagation()
    setOpen(false, { restoreFocus: true })
  }, { signal: abort.signal })

  window.addEventListener('resize', () => {
    if (open) positionAccountMenu(trigger, panel)
  }, { signal: abort.signal })
  window.addEventListener('scroll', () => {
    if (open) positionAccountMenu(trigger, panel)
  }, { capture: true, signal: abort.signal })

  changeItem.addEventListener('click', () => choose(onChangePassword), { signal: abort.signal })
  logoutItem.addEventListener('click', () => choose(onLogout), { signal: abort.signal })

  const api = {
    root: wrap,
    trigger,
    panel,
    get open() {
      return open
    },
    close() {
      setOpen(false)
    },
    destroy() {
      setOpen(false)
      releaseOpenDropdown(api)
      instances.delete(api)
      abort.abort()
      panel.remove()
    },
  }

  instances.add(api)
  return api
}
