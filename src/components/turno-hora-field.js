import { claimOpenDropdown, releaseOpenDropdown } from './dropdown.js'
import {
  DROPDOWN_ARROW,
  DROPDOWN_OPTION_ACTIVE_CLASS,
  DROPDOWN_OPTION_CLASS,
  DROPDOWN_OPTION_SELECTED_CLASS,
  DROPDOWN_TRIGGER_CLASS,
  NATIVE_SELECT_HIDE_CLASS,
} from './dropdown-styles.js'
import { normalizeHora } from './time-field.js'

export const HORAS_TURNO = Object.freeze(Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, '0')))
export const MINUTOS_TURNO = Object.freeze(Array.from({ length: 60 }, (_, minute) => String(minute).padStart(2, '0')))

let secuencia = 0

export function partesHora(value) {
  const text = normalizeHora(value) || ''
  if (!text) return { text: '', hour: 0, minute: 0 }
  return { text, hour: Number(text.slice(0, 2)), minute: Number(text.slice(3, 5)) }
}

export function textoHora(hour, minute) {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

export function moverIndice(actual, delta, total) {
  return (actual + delta + total) % total
}

export function reducirTeclaHora(state, key) {
  const total = state.column === 'hour' ? HORAS_TURNO.length : MINUTOS_TURNO.length
  const activeKey = state.column === 'hour' ? 'activeHour' : 'activeMinute'
  if (key === 'ArrowDown' || key === 'ArrowUp') {
    return {
      ...state,
      [activeKey]: moverIndice(state[activeKey], key === 'ArrowDown' ? 1 : -1, total),
      handled: true,
      commit: false,
      close: false,
    }
  }
  if (key === 'Enter') {
    return {
      ...state,
      hour: state.column === 'hour' ? state.activeHour : state.hour,
      minute: state.column === 'minute' ? state.activeMinute : state.minute,
      handled: true,
      commit: true,
      close: false,
    }
  }
  if (key === 'Escape') return { ...state, handled: true, commit: false, close: true }
  return { ...state, handled: false, commit: false, close: false }
}

export function posicionPopoverHora({
  trigger,
  panelWidth = 184,
  panelHeight = 220,
  viewportWidth,
  viewportHeight,
  margin = 8,
}) {
  const width = Math.min(panelWidth, Math.max(0, viewportWidth - margin * 2))
  let left = trigger.left
  if (left + width > viewportWidth - margin) left = viewportWidth - margin - width
  if (left < margin) left = margin
  const spaceBelow = viewportHeight - trigger.bottom - margin
  const spaceAbove = trigger.top - margin
  const openUp = spaceBelow < Math.min(panelHeight, 180) && spaceAbove > spaceBelow
  const available = Math.max(96, (openUp ? spaceAbove : spaceBelow) - 4)
  return {
    openUp,
    width,
    left,
    top: openUp ? null : trigger.bottom + 4,
    bottom: openUp ? viewportHeight - trigger.top + 4 : null,
    maxHeight: Math.min(panelHeight, available),
    overflowsX: left < margin || left + width > viewportWidth - margin + 0.5,
  }
}

export function createTurnoHoraField({
  name,
  value = '',
  ariaLabel = 'Seleccionar hora',
  required = false,
  onChange = null,
} = {}) {
  const root = document.createElement('div')
  root.className = 'relative min-w-0'
  root.dataset.turnoHora = name
  const id = `turno-hora-${++secuencia}`
  const initial = partesHora(value)
  let committed = initial.text
  let hour = initial.hour
  let minute = initial.minute
  let activeHour = hour
  let activeMinute = minute
  let column = 'hour'
  let open = false
  const abort = new AbortController()

  const input = document.createElement('input')
  input.type = 'text'
  input.name = name
  input.value = committed
  input.required = required
  input.tabIndex = -1
  input.readOnly = true
  input.autocomplete = 'off'
  input.className = NATIVE_SELECT_HIDE_CLASS
  input.setAttribute('aria-hidden', 'true')

  const trigger = document.createElement('button')
  trigger.type = 'button'
  trigger.className = DROPDOWN_TRIGGER_CLASS
  trigger.setAttribute('aria-label', ariaLabel)
  trigger.setAttribute('aria-haspopup', 'dialog')
  trigger.setAttribute('aria-expanded', 'false')
  trigger.setAttribute('aria-controls', id)

  const valueNode = document.createElement('span')
  valueNode.className = 'min-w-0 truncate'
  const arrow = document.createElement('span')
  arrow.innerHTML = DROPDOWN_ARROW
  trigger.append(valueNode, arrow.firstElementChild ?? arrow)

  const panel = document.createElement('div')
  panel.id = id
  panel.hidden = true
  panel.className = 'fixed z-[80] flex w-[11.5rem] max-w-[calc(100vw-1rem)] flex-col overflow-hidden rounded-lg border border-slate-200 bg-white p-2 text-slate-900 shadow-lg dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100'
  panel.setAttribute('role', 'dialog')
  panel.setAttribute('aria-label', ariaLabel)

  const columns = document.createElement('div')
  columns.className = 'grid min-h-0 flex-1 grid-cols-2 gap-1'
  const hourColumn = crearColumna('Horas', 'hour')
  const minuteColumn = crearColumna('Minutos', 'minute')
  columns.append(hourColumn.wrap, minuteColumn.wrap)

  const accept = document.createElement('button')
  accept.type = 'button'
  accept.className = 'mt-2 h-8 w-full rounded-lg bg-blue-600 text-sm font-semibold text-white hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500'
  accept.textContent = 'Aceptar'

  panel.append(columns, accept)
  document.body.append(panel)

  const overlay = { close: () => setOpen(false) }

  function crearColumna(titulo, key) {
    const wrap = document.createElement('div')
    wrap.className = 'flex min-h-0 min-w-0 flex-col'
    const heading = document.createElement('p')
    heading.className = 'px-1 pb-1 text-xs font-medium text-slate-500 dark:text-slate-400'
    heading.textContent = titulo
    const list = document.createElement('div')
    list.className = 'max-h-40 min-h-0 flex-1 overflow-x-hidden overflow-y-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500'
    list.id = `${id}-${key}`
    list.tabIndex = 0
    list.setAttribute('role', 'listbox')
    list.setAttribute('aria-label', titulo)
    list.dataset.column = key
    list.addEventListener('keydown', (event) => onKey(event, key), { signal: abort.signal })
    wrap.append(heading, list)
    return { wrap, list }
  }

  function pintarValor() {
    valueNode.textContent = committed || 'HH:mm'
    valueNode.classList.toggle('text-slate-400', !committed)
  }

  function pintarColumna(list, opciones, selected, active) {
    list.replaceChildren()
    opciones.forEach((label, index) => {
      const option = document.createElement('button')
      option.type = 'button'
      option.id = `${list.id}-${index}`
      option.dataset.index = String(index)
      option.className = `${DROPDOWN_OPTION_CLASS} min-h-8 justify-center px-1 py-1`
      option.setAttribute('role', 'option')
      option.setAttribute('aria-selected', String(index === selected))
      option.tabIndex = -1
      option.textContent = label
      if (index === selected) option.className += ` ${DROPDOWN_OPTION_SELECTED_CLASS} ring-1 ring-inset ring-blue-600`
      if (index === active) {
        option.className += ` ${DROPDOWN_OPTION_ACTIVE_CLASS}`
        list.setAttribute('aria-activedescendant', option.id)
      }
      option.addEventListener('click', () => {
        if (list.dataset.column === 'hour') hour = index
        else minute = index
        if (list.dataset.column === 'hour') activeHour = index
        else activeMinute = index
        commit(textoHora(hour, minute), { close: false })
        pintar()
      })
      list.append(option)
    })
  }

  function pintar() {
    pintarColumna(hourColumn.list, HORAS_TURNO, hour, activeHour)
    pintarColumna(minuteColumn.list, MINUTOS_TURNO, minute, activeMinute)
    pintarValor()
  }

  function commit(next, { close = false } = {}) {
    const normalized = normalizeHora(next)
    if (!normalized) return false
    committed = normalized
    hour = Number(normalized.slice(0, 2))
    minute = Number(normalized.slice(3, 5))
    input.value = committed
    pintarValor()
    input.dispatchEvent(new Event('change', { bubbles: true }))
    onChange?.(committed)
    if (close) setOpen(false)
    return true
  }

  function place() {
    const rect = trigger.getBoundingClientRect()
    const box = posicionPopoverHora({
      trigger: rect,
      panelWidth: 184,
      panelHeight: 248,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
    })
    panel.style.width = `${box.width}px`
    panel.style.left = `${box.left}px`
    panel.style.height = `${box.maxHeight}px`
    panel.style.maxHeight = `${box.maxHeight}px`
    if (box.openUp) {
      panel.style.top = 'auto'
      panel.style.bottom = `${box.bottom}px`
    } else {
      panel.style.bottom = 'auto'
      panel.style.top = `${box.top}px`
    }
  }

  function reveal() {
    const selectedHour = hourColumn.list.querySelector('[aria-selected="true"]')
    const selectedMinute = minuteColumn.list.querySelector('[aria-selected="true"]')
    selectedHour?.scrollIntoView({ block: 'center' })
    selectedMinute?.scrollIntoView({ block: 'center' })
  }

  function setOpen(nextOpen) {
    if (open === nextOpen) {
      if (nextOpen) place()
      return
    }
    open = nextOpen
    panel.hidden = !open
    trigger.setAttribute('aria-expanded', String(open))
    if (open) {
      activeHour = hour
      activeMinute = minute
      column = 'hour'
      claimOpenDropdown(overlay)
      pintar()
      place()
      reveal()
      hourColumn.list.focus()
    } else {
      releaseOpenDropdown(overlay)
    }
  }

  function onKey(event, key) {
    column = key
    const next = reducirTeclaHora({
      column,
      hour,
      minute,
      activeHour,
      activeMinute,
    }, event.key)
    if (!next.handled) return
    event.preventDefault()
    event.stopPropagation()
    activeHour = next.activeHour
    activeMinute = next.activeMinute
    if (next.close) {
      setOpen(false)
      trigger.focus()
      return
    }
    if (next.commit) {
      hour = next.hour
      minute = next.minute
      commit(textoHora(hour, minute), { close: false })
    }
    pintar()
    const list = key === 'hour' ? hourColumn.list : minuteColumn.list
    list.querySelector(`[data-index="${key === 'hour' ? activeHour : activeMinute}"]`)?.scrollIntoView({ block: 'nearest' })
    if (next.commit && key === 'hour') minuteColumn.list.focus()
  }

  trigger.addEventListener('click', () => setOpen(!open), { signal: abort.signal })
  trigger.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      setOpen(true)
    }
    if (event.key === 'Escape' && open) {
      event.preventDefault()
      event.stopPropagation()
      setOpen(false)
    }
  }, { signal: abort.signal })
  accept.addEventListener('click', () => {
    commit(textoHora(activeHour, activeMinute), { close: true })
    trigger.focus()
  }, { signal: abort.signal })
  input.addEventListener('focus', () => trigger.focus(), { signal: abort.signal })

  document.addEventListener('mousedown', (event) => {
    if (!open) return
    if (root.contains(event.target) || panel.contains(event.target)) return
    setOpen(false)
  }, { signal: abort.signal })
  document.addEventListener('keydown', (event) => {
    if (!open || event.key !== 'Escape') return
    event.preventDefault()
    event.stopPropagation()
    setOpen(false)
    trigger.focus()
  }, { capture: true, signal: abort.signal })
  window.addEventListener('resize', () => {
    if (open) place()
  }, { signal: abort.signal })
  document.addEventListener('scroll', (event) => {
    if (!open || panel.contains(event.target)) return
    place()
  }, { capture: true, signal: abort.signal })

  const observer = new MutationObserver(() => {
    trigger.setAttribute('aria-invalid', input.getAttribute('aria-invalid') || 'false')
  })
  observer.observe(input, { attributes: true, attributeFilter: ['aria-invalid'] })

  root.append(trigger, input)
  root.destroy = () => {
    setOpen(false)
    observer.disconnect()
    abort.abort()
    panel.remove()
  }
  pintar()
  return root
}
