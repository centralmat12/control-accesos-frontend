import {
  applyColumnPreset,
  columnCatalog,
  FICHADAS_COLUMNS_INFO_TOOLTIP,
  optionalColumnIds,
  sanitizeColumnIds,
} from '../utils/fichadas-columns.js'
import { createDropdownBase } from './dropdown.js'
import { DROPDOWN_OPTION_CLASS } from './dropdown-styles.js'
import { iconInfo, iconLock } from './icons.js'
import { bindTooltipRoot, unbindTooltipRoot } from './tooltip.js'

function presetButtonClass() {
  return 'rounded-md px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-blue-300 dark:hover:bg-slate-800'
}

function infoButtonClass() {
  return 'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:hover:bg-slate-800 dark:hover:text-slate-200'
}

export function createColumnPicker({
  id = 'fichadas-columnas',
  view = 'movimientos',
  selectedIds = [],
  isMobile = false,
  onChange,
} = {}) {
  let currentView = view
  let currentIds = sanitizeColumnIds(view, selectedIds)
  let currentMobile = Boolean(isMobile)

  const dropdown = createDropdownBase({
    id,
    label: 'Columnas',
  })
  dropdown.trigger.setAttribute('aria-haspopup', 'true')
  dropdown.panel.classList.add('w-72')
  dropdown.panel.setAttribute('role', 'group')
  dropdown.panel.setAttribute('aria-label', 'Columnas')

  const shell = document.createElement('div')
  shell.className = 'flex items-center gap-1'
  const infoButton = document.createElement('button')
  infoButton.type = 'button'
  infoButton.className = infoButtonClass()
  infoButton.id = `${id}-info`
  infoButton.innerHTML = iconInfo()
  shell.append(dropdown.root, infoButton)
  bindTooltipRoot(shell)

  function syncInfoTooltip() {
    const tooltip = FICHADAS_COLUMNS_INFO_TOOLTIP[currentView] ?? FICHADAS_COLUMNS_INFO_TOOLTIP.movimientos
    infoButton.setAttribute('data-tooltip', tooltip)
    infoButton.setAttribute('aria-label', 'Información sobre columnas visibles')
  }

  function emit(nextIds) {
    currentIds = sanitizeColumnIds(currentView, nextIds)
    onChange?.(currentView, currentIds)
    paintPanel()
  }

  function paintPanel() {
    dropdown.panel.replaceChildren()

    const presets = document.createElement('div')
    presets.className = 'mb-2 flex flex-wrap gap-1 border-b border-slate-100 pb-2 dark:border-slate-700'
    ;[
      ['compact', 'Vista compacta'],
      ['full', 'Vista completa'],
      ['reset', 'Restablecer'],
    ].forEach(([preset, label]) => {
      const presetButton = document.createElement('button')
      presetButton.type = 'button'
      presetButton.className = presetButtonClass()
      presetButton.textContent = label
      presetButton.addEventListener('click', () => {
        emit(applyColumnPreset(currentView, preset, { isMobile: currentMobile }))
      })
      presets.append(presetButton)
    })
    dropdown.panel.append(presets)

    columnCatalog(currentView).forEach((column) => {
      const row = document.createElement('label')
      const input = document.createElement('input')
      input.type = 'checkbox'
      input.className = 'h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500'
      input.value = column.id
      input.checked = currentIds.includes(column.id)

      if (column.required) {
        row.className = `${DROPDOWN_OPTION_CLASS} cursor-not-allowed opacity-90`
        input.disabled = true
        input.checked = true
        input.setAttribute('aria-disabled', 'true')
        const text = document.createElement('span')
        text.className = 'flex min-w-0 flex-1 items-center gap-1.5'
        const lock = document.createElement('span')
        lock.className = 'shrink-0 text-slate-400'
        lock.setAttribute('aria-hidden', 'true')
        lock.innerHTML = iconLock()
        const label = document.createElement('span')
        label.textContent = column.label
        text.append(lock, label)
        row.append(input, text)
        dropdown.panel.append(row)
        return
      }

      row.className = `${DROPDOWN_OPTION_CLASS} cursor-pointer`
      input.checked = currentIds.includes(column.id)
      input.addEventListener('change', () => {
        const next = currentIds.includes(column.id)
          ? currentIds.filter((idValue) => idValue !== column.id)
          : [...currentIds, column.id]
        emit(next)
      })
      const text = document.createElement('span')
      text.textContent = column.label
      row.append(input, text)
      dropdown.panel.append(row)
    })

    const optional = optionalColumnIds(currentView)
    dropdown.trigger.setAttribute(
      'aria-label',
      `Columnas opcionales visibles: ${optional.filter((idValue) => currentIds.includes(idValue)).length} de ${optional.length}`,
    )
    syncInfoTooltip()
  }

  paintPanel()

  return {
    element: shell,
    setState({ view: nextView, selectedIds: nextIds, isMobile: nextMobile } = {}) {
      if (nextView) currentView = nextView
      if (Array.isArray(nextIds)) currentIds = sanitizeColumnIds(currentView, nextIds)
      if (typeof nextMobile === 'boolean') currentMobile = nextMobile
      paintPanel()
    },
    close: () => dropdown.close(),
    destroy: () => {
      unbindTooltipRoot(shell)
      dropdown.destroy()
    },
  }
}
