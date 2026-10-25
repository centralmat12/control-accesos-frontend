import { claimOpenDropdown, releaseOpenDropdown } from './dropdown.js'
import { iconCalendar, iconClock, iconPlus } from './icons.js'

const BUTTON_CLASS = 'inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto'
const ITEM_CLASS = 'flex w-full cursor-pointer items-start gap-2 rounded-md px-2.5 py-2 text-left text-sm text-slate-800 hover:bg-slate-50 focus:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-slate-200 dark:hover:bg-slate-800 dark:focus:bg-slate-800'

const ICONS = {
  'fichada-manual': () => iconClock(),
  'dia-libre': () => iconCalendar(),
}

let activeMenu = null

function viewport() {
  if (typeof window === 'undefined') return { width: 1280, height: 800 }
  return { width: window.innerWidth || 1280, height: window.innerHeight || 800 }
}

function positionMenu(trigger, panel) {
  if (!trigger?.getBoundingClientRect) return
  const rect = trigger.getBoundingClientRect()
  const view = viewport()
  const width = Math.min(320, Math.max(rect.width || 220, 240), view.width - 16)
  panel.style.position = 'fixed'
  panel.style.width = `${width}px`
  panel.style.maxWidth = 'calc(100vw - 16px)'
  panel.style.zIndex = '90'
  let left = rect.right - width
  if (left + width > view.width - 8) left = view.width - width - 8
  if (left < 8) left = 8
  panel.style.left = `${left}px`
  const panelHeight = Math.min(panel.scrollHeight || 160, view.height - 16)
  const spaceBelow = view.height - rect.bottom - 8
  if (spaceBelow < Math.min(140, panelHeight) && rect.top > spaceBelow) {
    panel.style.top = 'auto'
    panel.style.bottom = `${view.height - rect.top + 4}px`
  } else {
    panel.style.bottom = 'auto'
    panel.style.top = `${rect.bottom + 4}px`
  }
}

export function createRegistrarMenu({ actions = [], onSelect, document: doc = globalThis.document } = {}) {
  if (!actions.length || !doc) return null
  activeMenu?.destroy()

  const abort = new AbortController()
  const signal = abort.signal
  const root = doc.createElement('div')
  root.className = 'w-full sm:w-auto'
  const trigger = doc.createElement('button')
  trigger.type = 'button'
  trigger.id = 'fichadas-registrar-button'
  trigger.className = BUTTON_CLASS
  trigger.setAttribute('aria-haspopup', 'menu')
  trigger.setAttribute('aria-expanded', 'false')
  trigger.setAttribute('aria-controls', 'fichadas-registrar-menu')
  const plus = doc.createElement('span')
  plus.setAttribute('aria-hidden', 'true')
  plus.innerHTML = iconPlus('h-4 w-4')
  const label = doc.createElement('span')
  label.textContent = 'Registrar'
  trigger.append(plus, label)

  const panel = doc.createElement('div')
  panel.id = 'fichadas-registrar-menu'
  panel.hidden = true
  panel.setAttribute('role', 'menu')
  panel.setAttribute('aria-labelledby', trigger.id)
  panel.className = 'z-[90] overflow-auto rounded-lg border border-slate-200 bg-white p-1.5 shadow-lg dark:border-slate-600 dark:bg-slate-900'
  if (panel.style == null) panel.style = {}

  const items = actions.map((action, index) => {
    const item = doc.createElement('button')
    item.type = 'button'
    item.className = ITEM_CLASS
    item.setAttribute('role', 'menuitem')
    item.dataset.action = action.id
    item.tabIndex = index === 0 ? 0 : -1
    const icon = doc.createElement('span')
    icon.setAttribute('aria-hidden', 'true')
    icon.className = 'mt-0.5 [&_svg]:h-4 [&_svg]:w-4'
    icon.innerHTML = (ICONS[action.id] || iconClock)()
    const text = doc.createElement('span')
    text.className = 'min-w-0'
    const title = doc.createElement('span')
    title.className = 'block font-medium'
    title.textContent = action.label
    const description = doc.createElement('span')
    description.className = 'block text-xs text-slate-500 dark:text-slate-400'
    description.textContent = action.description
    text.append(title, description)
    item.append(icon, text)
    panel.append(item)
    return item
  })

  root.append(trigger)
  doc.body.append(panel)

  let open = false
  let activeIndex = 0
  let destroyed = false

  function listen(target, type, fn) {
    target.addEventListener(type, fn, { signal })
  }

  function focusItem(index) {
    if (!items.length) return
    activeIndex = (index + items.length) % items.length
    items.forEach((item, itemIndex) => {
      item.tabIndex = itemIndex === activeIndex ? 0 : -1
    })
    items[activeIndex].focus()
  }

  function setOpen(next, { restoreFocus = false, focusItem: shouldFocus = false } = {}) {
    if (destroyed) return
    open = Boolean(next)
    panel.hidden = !open
    trigger.setAttribute('aria-expanded', open ? 'true' : 'false')
    if (open) {
      claimOpenDropdown(api)
      positionMenu(trigger, panel)
      if (shouldFocus) focusItem(0)
    } else {
      releaseOpenDropdown(api)
      if (restoreFocus) trigger.focus()
    }
  }

  function select(action) {
    setOpen(false, { restoreFocus: true })
    onSelect?.(action)
  }

  listen(trigger, 'click', (event) => {
    event.stopPropagation?.()
    setOpen(!open, { focusItem: !open })
  })
  listen(trigger, 'keydown', (event) => {
    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      if (event.key === 'Enter' || event.key === ' ') return
      event.preventDefault?.()
      setOpen(true, { focusItem: true })
    } else if (event.key === 'Escape' && open) {
      event.preventDefault?.()
      event.stopPropagation?.()
      setOpen(false, { restoreFocus: true })
    }
  })
  items.forEach((item, index) => {
    listen(item, 'click', () => select(actions[index]))
    listen(item, 'keydown', (event) => {
      if (event.key === 'ArrowDown') {
        event.preventDefault?.()
        focusItem(activeIndex + 1)
      } else if (event.key === 'ArrowUp') {
        event.preventDefault?.()
        focusItem(activeIndex - 1)
      } else if (event.key === 'Home') {
        event.preventDefault?.()
        focusItem(0)
      } else if (event.key === 'End') {
        event.preventDefault?.()
        focusItem(items.length - 1)
      } else if (event.key === 'Escape') {
        event.preventDefault?.()
        event.stopPropagation?.()
        setOpen(false, { restoreFocus: true })
      } else if (event.key === 'Tab') {
        setOpen(false)
      }
    })
  })
  listen(doc, 'pointerdown', (event) => {
    if (!open) return
    const target = event.target
    if (trigger.contains?.(target) || panel.contains?.(target)) return
    setOpen(false)
  })
  listen(doc, 'keydown', (event) => {
    if (!open || event.key !== 'Escape') return
    event.preventDefault?.()
    event.stopPropagation?.()
    event.stopImmediatePropagation?.()
    setOpen(false, { restoreFocus: true })
  })
  if (typeof window !== 'undefined') {
    listen(window, 'resize', () => {
      if (open) positionMenu(trigger, panel)
    })
  }

  const api = {
    root,
    trigger,
    panel,
    items,
    get expanded() {
      return open
    },
    expand() {
      setOpen(true, { focusItem: true })
    },
    collapse() {
      setOpen(false, { restoreFocus: true })
    },
    destroy() {
      if (destroyed) return
      destroyed = true
      setOpen(false)
      abort.abort()
      panel.remove?.()
      releaseOpenDropdown(api)
      if (activeMenu === api) activeMenu = null
    },
  }
  activeMenu = api
  return api
}
