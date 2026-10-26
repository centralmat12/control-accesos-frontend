import { claimOpenDropdown, positionDropdownPanel, releaseOpenDropdown } from './dropdown.js'
import {
  DROPDOWN_OPTION_ACTIVE_CLASS,
  DROPDOWN_OPTION_CLASS,
  DROPDOWN_OPTION_SELECTED_CLASS,
  DROPDOWN_PANEL_CLASS,
  DROPDOWN_TRIGGER_CLASS,
} from './dropdown-styles.js'

export function normalizeHora(value) {
  const match = String(value ?? '').trim().match(/^(\d{1,2}):(\d{2})$/)
  if (!match) return null
  const hour = Number(match[1])
  const minute = Number(match[2])
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour > 23 || minute > 59) return null
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

function pad(value) {
  return String(value).padStart(2, '0')
}

export function createTimeSelect({
  name,
  value = '',
  ariaLabel = 'Hora',
  required = false,
  onChange = null,
} = {}) {
  const root = document.createElement('div')
  root.className = 'relative min-w-0'
  const listId = `${name}-opciones`
  let committed = normalizeHora(value) || ''
  let hour = committed ? Number(committed.slice(0, 2)) : 0
  let minute = committed ? Number(committed.slice(3, 5)) : 0
  let column = 'hour'
  let open = false
  const abort = new AbortController()

  const input = document.createElement('input')
  input.name = name
  input.type = 'text'
  input.inputMode = 'numeric'
  input.autocomplete = 'off'
  input.spellcheck = false
  input.required = required
  input.placeholder = 'HH:mm'
  input.setAttribute('aria-label', ariaLabel)
  input.setAttribute('role', 'combobox')
  input.setAttribute('aria-autocomplete', 'list')
  input.setAttribute('aria-expanded', 'false')
  input.setAttribute('aria-controls', listId)
  input.setAttribute('aria-haspopup', 'listbox')
  input.className = DROPDOWN_TRIGGER_CLASS
  input.value = committed

  const panel = document.createElement('div')
  panel.id = listId
  panel.hidden = true
  panel.className = `${DROPDOWN_PANEL_CLASS} grid grid-cols-2 gap-1`
  panel.setAttribute('role', 'listbox')
  panel.setAttribute('aria-label', ariaLabel)
  document.body.append(panel)

  const overlay = {
    close() {
      setOpen(false)
    },
  }

  function paint() {
    panel.replaceChildren()
    ;[
      ['hour', 24, hour],
      ['minute', 60, minute],
    ].forEach(([key, total, selected]) => {
      const columnList = document.createElement('div')
      columnList.className = 'max-h-56 overflow-auto'
      columnList.setAttribute('role', 'presentation')
      for (let index = 0; index < total; index += 1) {
        const option = document.createElement('button')
        option.type = 'button'
        option.className = `${DROPDOWN_OPTION_CLASS} min-h-9 justify-center${index === selected ? ` ${DROPDOWN_OPTION_SELECTED_CLASS}` : ''}${column === key && index === selected ? ` ${DROPDOWN_OPTION_ACTIVE_CLASS}` : ''}`
        option.setAttribute('role', 'option')
        option.setAttribute('aria-selected', String(index === selected))
        option.tabIndex = -1
        option.textContent = pad(index)
        option.addEventListener('mousedown', (event) => {
          event.preventDefault()
          if (key === 'hour') hour = index
          else minute = index
          column = key
          commit(`${pad(hour)}:${pad(minute)}`, { close: false })
          paint()
        })
        columnList.append(option)
      }
      panel.append(columnList)
    })
    panel.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' })
  }

  function commit(next, { close = true } = {}) {
    const normalized = normalizeHora(next)
    if (!normalized) return false
    committed = normalized
    hour = Number(normalized.slice(0, 2))
    minute = Number(normalized.slice(3, 5))
    input.value = committed
    if (close) setOpen(false)
    onChange?.(committed)
    return true
  }

  function setOpen(nextOpen) {
    if (open === nextOpen) {
      if (nextOpen) positionDropdownPanel(input, panel)
      return
    }
    open = nextOpen
    panel.hidden = !open
    input.setAttribute('aria-expanded', String(open))
    if (open) {
      const parsed = normalizeHora(input.value)
      if (parsed) {
        hour = Number(parsed.slice(0, 2))
        minute = Number(parsed.slice(3, 5))
      }
      claimOpenDropdown(overlay)
      paint()
      positionDropdownPanel(input, panel)
    } else {
      releaseOpenDropdown(overlay)
    }
  }

  function move(delta) {
    if (column === 'hour') hour = (hour + delta + 24) % 24
    else minute = (minute + delta + 60) % 60
    commit(`${pad(hour)}:${pad(minute)}`, { close: false })
    if (open) paint()
  }

  input.addEventListener('focus', () => setOpen(true), { signal: abort.signal })
  input.addEventListener('input', () => {
    const digits = input.value.replace(/[^\d]/g, '').slice(0, 4)
    const next = digits.length <= 2 ? digits : `${digits.slice(0, 2)}:${digits.slice(2)}`
    input.value = next
    if (normalizeHora(next)) {
      hour = Number(next.slice(0, 2))
      minute = Number(next.slice(3, 5))
      committed = normalizeHora(next)
    }
    onChange?.(input.value)
    setOpen(true)
    paint()
  }, { signal: abort.signal })
  input.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (!open) setOpen(true)
      move(event.key === 'ArrowDown' ? 1 : -1)
      return
    }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      if (!open) return
      event.preventDefault()
      column = event.key === 'ArrowLeft' ? 'hour' : 'minute'
      paint()
      return
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      if (!commit(input.value)) {
        input.value = committed
        onChange?.(input.value)
      }
      setOpen(false)
      return
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      input.value = committed
      onChange?.(input.value)
      setOpen(false)
    }
  }, { signal: abort.signal })
  input.addEventListener('blur', () => {
    window.setTimeout(() => {
      if (panel.contains(document.activeElement)) return
      if (!commit(input.value)) {
        input.value = committed
        onChange?.(input.value)
      }
      setOpen(false)
    }, 0)
  }, { signal: abort.signal })

  document.addEventListener('mousedown', (event) => {
    if (!open) return
    if (root.contains(event.target) || panel.contains(event.target)) return
    if (!commit(input.value)) {
      input.value = committed
      onChange?.(input.value)
    }
    setOpen(false)
  }, { signal: abort.signal })
  window.addEventListener('resize', () => {
    if (open) positionDropdownPanel(input, panel)
  }, { signal: abort.signal })
  window.addEventListener('scroll', () => {
    if (open) setOpen(false)
  }, { capture: true, signal: abort.signal })

  root.append(input)
  root.destroy = () => {
    setOpen(false)
    abort.abort()
    panel.remove()
  }
  queueMicrotask(() => {
    if (!root.isConnected) return
    const observer = new MutationObserver(() => {
      if (!root.isConnected) {
        observer.disconnect()
        root.destroy()
      }
    })
    observer.observe(document.body, { childList: true })
  })
  return root
}
