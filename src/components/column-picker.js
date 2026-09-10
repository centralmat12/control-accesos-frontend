import {
  alwaysVisibleLegend,
  applyColumnPreset,
  columnCatalog,
  optionalColumnIds,
  sanitizeColumnIds,
} from '../utils/fichadas-columns.js'
import { createDropdownBase } from './dropdown.js'
import { DROPDOWN_OPTION_CLASS } from './dropdown-styles.js'

const MENU_HELP =
  'Esta configuración solo modifica la tabla visible. Las exportaciones conservan el reporte completo.'

function presetButtonClass() {
  return 'rounded-md px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-blue-300 dark:hover:bg-slate-800'
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
  dropdown.panel.setAttribute('aria-label', 'Columnas opcionales')

  function emit(nextIds) {
    currentIds = sanitizeColumnIds(currentView, nextIds)
    onChange?.(currentView, currentIds)
    paintPanel()
  }

  function paintPanel() {
    const optional = optionalColumnIds(currentView)
    dropdown.panel.replaceChildren()

    const title = document.createElement('p')
    title.className = 'px-1 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-500'
    title.textContent = 'Columnas opcionales'
    dropdown.panel.append(title)

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

    optional.forEach((columnId) => {
      const column = columnCatalog(currentView).find((item) => item.id === columnId)
      const row = document.createElement('label')
      row.className = `${DROPDOWN_OPTION_CLASS} cursor-pointer`
      const input = document.createElement('input')
      input.type = 'checkbox'
      input.className = 'h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500'
      input.value = columnId
      input.checked = currentIds.includes(columnId)
      input.addEventListener('change', () => {
        const next = currentIds.includes(columnId)
          ? currentIds.filter((idValue) => idValue !== columnId)
          : [...currentIds, columnId]
        emit(next)
      })
      const text = document.createElement('span')
      text.textContent = column?.label || columnId
      row.append(input, text)
      dropdown.panel.append(row)
    })

    const always = document.createElement('p')
    always.className = 'mt-2 px-1 text-xs leading-5 text-slate-500 dark:text-slate-400'
    always.textContent = alwaysVisibleLegend(currentView)
    dropdown.panel.append(always)

    const help = document.createElement('p')
    help.className = 'mt-2 px-1 text-xs leading-5 text-slate-500 dark:text-slate-400'
    help.textContent = MENU_HELP
    dropdown.panel.append(help)

    dropdown.trigger.setAttribute(
      'aria-label',
      `Columnas opcionales visibles: ${optional.filter((idValue) => currentIds.includes(idValue)).length} de ${optional.length}`,
    )
  }

  paintPanel()

  return {
    element: dropdown.root,
    setState({ view: nextView, selectedIds: nextIds, isMobile: nextMobile } = {}) {
      if (nextView) currentView = nextView
      if (Array.isArray(nextIds)) currentIds = sanitizeColumnIds(currentView, nextIds)
      if (typeof nextMobile === 'boolean') currentMobile = nextMobile
      paintPanel()
    },
    close: () => dropdown.close(),
    destroy: () => dropdown.destroy(),
  }
}
