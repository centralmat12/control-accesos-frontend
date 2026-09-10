import { createDropdownBase } from './dropdown.js'
import { DROPDOWN_OPTION_CLASS } from './dropdown-styles.js'

export const SUCURSAL_UNASSIGNED = '__unassigned__'

export function uniqueSortedSucursales(sucursales) {
  const seen = new Map()

  for (const item of sucursales ?? []) {
    const id = Number(item?.id)
    if (!Number.isFinite(id) || id <= 0) continue
    if (seen.has(id)) continue
    const nombre = String(item.nombre ?? '').trim() || `Sucursal ${id}`
    seen.set(id, { id, nombre })
  }

  return [...seen.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
}

export function sucursalFilterSummary({ sucursalIds = [], includeUnassigned = false } = {}) {
  const count = sucursalIds.length + (includeUnassigned ? 1 : 0)
  if (count === 0) return 'Todas las sucursales'
  if (count === 1) return '1 sucursal seleccionada'
  return `${count} sucursales seleccionadas`
}

function parsePositiveId(value) {
  const id = Number(value)
  return Number.isFinite(id) && id > 0 ? id : null
}

export function createSucursalMultiSelect({
  id = 'empleados-sucursal-multi',
  labelledBy,
  sucursales = [],
  onChange,
} = {}) {
  const catalog = uniqueSortedSucursales(sucursales)
  const selected = new Set()
  let includeUnassigned = false

  const dropdown = createDropdownBase({
    id,
    label: 'Todas las sucursales',
    labelledBy,
    onOpenChange: (open) => {
      if (open) paintPanel()
    },
  })
  dropdown.root.dataset.sucursalMulti = 'true'
  dropdown.trigger.setAttribute('aria-haspopup', 'true')
  dropdown.panel.setAttribute('aria-multiselectable', 'true')

  function getValue() {
    return {
      sucursalIds: [...selected].sort((a, b) => a - b),
      includeUnassigned,
    }
  }

  function paintSummary() {
    const text = sucursalFilterSummary(getValue())
    dropdown.setSummary(text)
    dropdown.trigger.setAttribute('aria-label', `Sucursal: ${text}`)
  }

  function optionRow({ value, label, checked }) {
    const row = document.createElement('label')
    row.className = `${DROPDOWN_OPTION_CLASS} cursor-pointer`
    row.setAttribute('role', 'option')
    row.setAttribute('aria-selected', String(checked))

    const input = document.createElement('input')
    input.type = 'checkbox'
    input.className = 'h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500'
    input.value = value
    input.checked = checked
    input.addEventListener('change', () => {
      if (value === SUCURSAL_UNASSIGNED) {
        includeUnassigned = input.checked
      } else {
        const idValue = parsePositiveId(value)
        if (!idValue) return
        if (input.checked) selected.add(idValue)
        else selected.delete(idValue)
      }
      row.setAttribute('aria-selected', String(input.checked))
      paintSummary()
      onChange?.(getValue())
    })

    const text = document.createElement('span')
    text.textContent = label
    row.append(input, text)
    return row
  }

  function paintPanel() {
    const panel = dropdown.panel
    panel.replaceChildren()

    const actions = document.createElement('div')
    actions.className = 'mb-2 flex flex-wrap gap-2 border-b border-slate-100 px-1 pb-2 dark:border-slate-700'

    const selectAll = document.createElement('button')
    selectAll.type = 'button'
    selectAll.className = 'rounded-md px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50 dark:text-blue-300'
    selectAll.textContent = 'Seleccionar todas'
    selectAll.addEventListener('click', () => {
      catalog.forEach((item) => selected.add(item.id))
      includeUnassigned = true
      paintPanel()
      paintSummary()
      onChange?.(getValue())
    })

    const clear = document.createElement('button')
    clear.type = 'button'
    clear.className = 'rounded-md px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:text-slate-300'
    clear.textContent = 'Limpiar selección'
    clear.addEventListener('click', () => {
      selected.clear()
      includeUnassigned = false
      paintPanel()
      paintSummary()
      onChange?.(getValue())
    })

    actions.append(selectAll, clear)
    panel.append(actions)
    panel.append(
      optionRow({
        value: SUCURSAL_UNASSIGNED,
        label: 'Sin sucursal asignada',
        checked: includeUnassigned,
      }),
    )
    catalog.forEach((item) => {
      panel.append(
        optionRow({
          value: String(item.id),
          label: item.nombre,
          checked: selected.has(item.id),
        }),
      )
    })
  }

  function setSucursales(nextSucursales) {
    const nextCatalog = uniqueSortedSucursales(nextSucursales)
    catalog.splice(0, catalog.length, ...nextCatalog)
    for (const id of [...selected]) {
      if (!catalog.some((item) => item.id === id)) selected.delete(id)
    }
    paintSummary()
    if (dropdown.open) paintPanel()
  }

  function clearSelection() {
    selected.clear()
    includeUnassigned = false
    paintSummary()
    if (dropdown.open) paintPanel()
  }

  paintSummary()

  return {
    element: dropdown.root,
    getValue,
    setSucursales,
    clear: clearSelection,
    destroy() {
      dropdown.destroy()
    },
  }
}
