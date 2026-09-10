import { escapeHtml } from '../utils/format.js'
import {
  DROPDOWN_ARROW,
  DROPDOWN_OPTION_ACTIVE_CLASS,
  DROPDOWN_OPTION_CLASS,
  DROPDOWN_OPTION_SELECTED_CLASS,
  DROPDOWN_PANEL_CLASS,
  DROPDOWN_TRIGGER_CLASS,
  NATIVE_SELECT_HIDE_CLASS,
  addClassTokens,
  removeClassTokens,
} from './dropdown-styles.js'

let openInstance = null

function closeActive(except) {
  if (openInstance && openInstance !== except) openInstance.close()
}

export function closeOpenDropdown() {
  closeActive(null)
}

export function claimOpenDropdown(api) {
  closeActive(api)
  openInstance = api
}

export function releaseOpenDropdown(api) {
  if (openInstance === api) openInstance = null
}

export function positionDropdownPanel(trigger, panel) {
  const rect = trigger.getBoundingClientRect()
  const width = Math.max(rect.width, 180)
  panel.style.position = 'fixed'
  panel.style.minWidth = `${width}px`
  panel.style.width = `${Math.min(width, window.innerWidth - 16)}px`
  panel.style.maxHeight = `${Math.min(288, Math.max(120, window.innerHeight - 24))}px`

  const panelHeight = Math.min(panel.scrollHeight || 200, 288)
  const spaceBelow = window.innerHeight - rect.bottom - 8
  const openUp = spaceBelow < Math.min(160, panelHeight) && rect.top > spaceBelow
  let left = rect.left
  const panelWidth = panel.getBoundingClientRect().width || width
  if (left + panelWidth > window.innerWidth - 8) left = window.innerWidth - panelWidth - 8
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

export function createDropdownBase({
  id = 'ca-dropdown',
  label = 'Seleccionar',
  labelledBy,
  disabled = false,
  onOpenChange,
} = {}) {
  const abort = new AbortController()
  const root = document.createElement('div')
  root.className = 'relative min-w-0'
  root.dataset.caDropdown = 'true'

  const buttonId = `${id}-button`
  const panelId = `${id}-panel`
  const trigger = document.createElement('button')
  trigger.type = 'button'
  trigger.id = buttonId
  trigger.className = DROPDOWN_TRIGGER_CLASS
  trigger.setAttribute('aria-haspopup', 'listbox')
  trigger.setAttribute('aria-expanded', 'false')
  trigger.setAttribute('aria-controls', panelId)
  if (labelledBy) trigger.setAttribute('aria-labelledby', labelledBy)
  trigger.disabled = disabled
  trigger.innerHTML = `<span data-ca-summary class="min-w-0 truncate">${escapeHtml(label)}</span>${DROPDOWN_ARROW}`

  const panel = document.createElement('div')
  panel.id = panelId
  panel.className = DROPDOWN_PANEL_CLASS
  panel.hidden = true
  panel.setAttribute('role', 'listbox')
  panel.setAttribute('tabindex', '-1')

  root.append(trigger)
  document.body.append(panel)

  const summary = trigger.querySelector('[data-ca-summary]')
  let open = false

  function setOpen(next) {
    if (trigger.disabled && next) return
    if (open === next) {
      if (next) positionDropdownPanel(trigger, panel)
      return
    }
    open = next
    if (open) claimOpenDropdown(api)
    else releaseOpenDropdown(api)
    panel.hidden = !open
    trigger.setAttribute('aria-expanded', String(open))
    if (open) positionDropdownPanel(trigger, panel)
    onOpenChange?.(open)
  }

  function onReposition() {
    if (open) positionDropdownPanel(trigger, panel)
  }

  trigger.addEventListener('click', (event) => {
    event.stopPropagation()
    setOpen(!open)
  }, { signal: abort.signal })

  document.addEventListener('pointerdown', (event) => {
    if (!open) return
    if (root.contains(event.target) || panel.contains(event.target)) return
    setOpen(false)
    trigger.focus()
  }, { signal: abort.signal })

  document.addEventListener('keydown', (event) => {
    if (!open) return
    if (event.key !== 'Escape') return
    event.preventDefault()
    event.stopPropagation()
    setOpen(false)
    trigger.focus()
  }, { signal: abort.signal })

  window.addEventListener('resize', onReposition, { signal: abort.signal })
  window.addEventListener('scroll', onReposition, { capture: true, signal: abort.signal })

  const api = {
    root,
    trigger,
    panel,
    summary,
    get open() {
      return open
    },
    setOpen,
    close() {
      setOpen(false)
    },
    setDisabled(next) {
      trigger.disabled = Boolean(next)
      if (trigger.disabled) setOpen(false)
    },
    setSummary(text) {
      summary.textContent = text
    },
    destroy() {
      setOpen(false)
      releaseOpenDropdown(api)
      abort.abort()
      panel.remove()
      root.remove()
    },
  }

  return api
}

function optionElements(select) {
  return [...select.options].map((option, index) => ({
    value: option.value,
    label: option.textContent ?? '',
    disabled: option.disabled,
    index,
  }))
}

const boundSelects = new Set()

export function refreshEnhancedSelect(select) {
  select?._caSelect?.refresh?.()
}

export function enhanceSelect(select, { wrapClass = 'relative min-w-0 w-full' } = {}) {
  if (!select || select.multiple) return null
  if (select.dataset.caSelectBound === 'true') {
    if (select._caSelect) return select._caSelect
    delete select.dataset.caSelectBound
  }

  const wrap = document.createElement('div')
  wrap.className = wrapClass
  select.parentNode?.insertBefore(wrap, select)
  wrap.append(select)
  addClassTokens(select, NATIVE_SELECT_HIDE_CLASS)
  select.tabIndex = -1
  select.setAttribute('aria-hidden', 'true')

  const dropdown = createDropdownBase({
    id: select.id || `select-${Math.random().toString(36).slice(2, 8)}`,
    label: select.selectedOptions[0]?.textContent || 'Seleccionar',
    disabled: select.disabled,
  })
  wrap.append(dropdown.root)
  dropdown.panel.setAttribute('aria-labelledby', dropdown.trigger.id)
  const selectLabel = select.getAttribute('aria-label')
  if (selectLabel) dropdown.trigger.setAttribute('aria-label', selectLabel)
  const describedBy = select.getAttribute('aria-describedby')
  if (describedBy) dropdown.trigger.setAttribute('aria-describedby', describedBy)
  if (select.required) dropdown.trigger.setAttribute('aria-required', 'true')

  let activeIndex = Math.max(0, select.selectedIndex)
  const localAbort = new AbortController()

  function paint() {
    const items = optionElements(select)
    dropdown.panel.replaceChildren()
    items.forEach((item, index) => {
      const button = document.createElement('button')
      button.type = 'button'
      button.className = DROPDOWN_OPTION_CLASS
      button.setAttribute('role', 'option')
      button.setAttribute('aria-selected', String(select.value === item.value))
      button.dataset.index = String(index)
      button.disabled = item.disabled
      button.textContent = item.label
      if (select.value === item.value) button.classList.add(...DROPDOWN_OPTION_SELECTED_CLASS.split(' '))
      if (index === activeIndex) button.classList.add(...DROPDOWN_OPTION_ACTIVE_CLASS.split(' '))
      button.addEventListener('click', () => {
        if (item.disabled) return
        select.value = item.value
        select.dispatchEvent(new Event('change', { bubbles: true }))
        dropdown.close()
        dropdown.trigger.focus()
      })
      dropdown.panel.append(button)
    })
    const selectedLabel = select.selectedOptions[0]?.textContent || items[0]?.label || 'Seleccionar'
    dropdown.setSummary(selectedLabel)
    dropdown.setDisabled(select.disabled)
    const describedBy = select.getAttribute('aria-describedby')
    if (describedBy) dropdown.trigger.setAttribute('aria-describedby', describedBy)
    else dropdown.trigger.removeAttribute('aria-describedby')
    if (select.getAttribute('aria-invalid') === 'true') dropdown.trigger.setAttribute('aria-invalid', 'true')
    else dropdown.trigger.removeAttribute('aria-invalid')
    if (dropdown.open) {
      dropdown.panel.querySelector(`[data-index="${activeIndex}"]`)?.scrollIntoView({ block: 'nearest' })
    }
  }

  function move(delta) {
    const items = optionElements(select).filter((item) => !item.disabled)
    if (!items.length) return
    const current = items.findIndex((item) => item.index === activeIndex)
    const next = items[(current + delta + items.length) % items.length]
    activeIndex = next.index
    paint()
  }

  dropdown.trigger.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (!dropdown.open) dropdown.setOpen(true)
      move(event.key === 'ArrowDown' ? 1 : -1)
      return
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      if (!dropdown.open) {
        dropdown.setOpen(true)
        return
      }
      const option = select.options[activeIndex]
      if (!option || option.disabled) return
      select.value = option.value
      select.dispatchEvent(new Event('change', { bubbles: true }))
      dropdown.close()
      dropdown.trigger.focus()
      return
    }
    if (!dropdown.open) return
    if (event.key === 'Home') {
      event.preventDefault()
      const first = optionElements(select).find((item) => !item.disabled)
      if (!first) return
      activeIndex = first.index
      paint()
    }
    if (event.key === 'End') {
      event.preventDefault()
      const enabled = optionElements(select).filter((item) => !item.disabled)
      const last = enabled.at(-1)
      if (!last) return
      activeIndex = last.index
      paint()
    }
  }, { signal: localAbort.signal })

  select.addEventListener('focus', () => dropdown.trigger.focus(), { signal: localAbort.signal })
  select.addEventListener('change', () => {
    activeIndex = Math.max(0, select.selectedIndex)
    paint()
  }, { signal: localAbort.signal })

  const observer = new MutationObserver(() => paint())
  observer.observe(select, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['disabled', 'aria-describedby', 'aria-invalid', 'aria-label', 'required'],
  })

  paint()

  const api = {
    refresh: paint,
    destroy() {
      observer.disconnect()
      localAbort.abort()
      dropdown.destroy()
      boundSelects.delete(api)
      if (wrap.isConnected && select.isConnected) {
        wrap.parentNode?.insertBefore(select, wrap)
      }
      wrap.remove()
      removeClassTokens(select, NATIVE_SELECT_HIDE_CLASS)
      select.removeAttribute('aria-hidden')
      select.tabIndex = 0
      delete select.dataset.caSelectBound
      delete select._caSelect
    },
  }
  api.select = select
  boundSelects.add(api)
  select._caSelect = api
  select.dataset.caSelectBound = 'true'
  return api
}

export function destroyDisconnectedSelects() {
  for (const instance of [...boundSelects]) {
    if (!instance.select?.isConnected) instance.destroy()
  }
}

export function enhanceSelectsIn(root) {
  destroyDisconnectedSelects()
  if (!root?.querySelectorAll) return
  root.querySelectorAll('select:not([multiple])').forEach((select) => {
    if (select.dataset.caSelectBound === 'true' && !select._caSelect) {
      delete select.dataset.caSelectBound
    }
    if (select.dataset.caSelectBound === 'true') return
    enhanceSelect(select)
  })
}

export function createMultiSelectDropdown({
  id = 'ca-multi',
  labelledBy,
  options = [],
  selectedValues = [],
  summaryText = 'Seleccionar',
  showSelectAll = true,
  onChange,
} = {}) {
  const selected = new Set(selectedValues.map(String))
  let currentOptions = options
  const dropdown = createDropdownBase({
    id,
    label: summaryText,
    labelledBy,
  })
  dropdown.panel.setAttribute('role', 'group')
  dropdown.trigger.setAttribute('aria-haspopup', 'true')

  function emit() {
    onChange?.([...selected])
    paint()
  }

  function paint() {
    dropdown.panel.replaceChildren()
    if (showSelectAll) {
      const actions = document.createElement('div')
      actions.className = 'mb-1 flex flex-wrap gap-1 border-b border-slate-100 pb-2 dark:border-slate-700'
      const selectAll = document.createElement('button')
      selectAll.type = 'button'
      selectAll.className = 'rounded-md px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50 dark:text-blue-300'
      selectAll.textContent = 'Seleccionar todas'
      selectAll.addEventListener('click', () => {
        currentOptions.forEach((option) => selected.add(String(option.value)))
        emit()
      })
      const clear = document.createElement('button')
      clear.type = 'button'
      clear.className = 'rounded-md px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:text-slate-300'
      clear.textContent = 'Limpiar selección'
      clear.addEventListener('click', () => {
        selected.clear()
        emit()
      })
      actions.append(selectAll, clear)
      dropdown.panel.append(actions)
    }

    currentOptions.forEach((option) => {
      const row = document.createElement('label')
      row.className = `${DROPDOWN_OPTION_CLASS} cursor-pointer`
      const input = document.createElement('input')
      input.type = 'checkbox'
      input.className = 'h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500'
      input.value = String(option.value)
      input.checked = selected.has(String(option.value))
      input.addEventListener('change', () => {
        if (input.checked) selected.add(String(option.value))
        else selected.delete(String(option.value))
        emit()
      })
      const text = document.createElement('span')
      text.textContent = option.label
      row.append(input, text)
      dropdown.panel.append(row)
    })
  }

  paint()

  return {
    element: dropdown.root,
    panel: dropdown.panel,
    dropdown,
    getSelected: () => [...selected],
    setOptions(nextOptions, nextSelected) {
      currentOptions = nextOptions
      if (nextSelected) {
        selected.clear()
        nextSelected.forEach((value) => selected.add(String(value)))
      }
      paint()
    },
    setSummary(text) {
      dropdown.setSummary(text)
    },
    close: () => dropdown.close(),
    destroy: () => dropdown.destroy(),
  }
}

export const createSelectDropdown = enhanceSelect
export { createDropdownBase as createDropdown }
