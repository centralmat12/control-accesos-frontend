import { escapeHtml } from '../utils/format.js'

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
  const wrapper = document.createElement('div')
  wrapper.className = 'relative'
  wrapper.dataset.sucursalMulti = 'true'

  const catalog = uniqueSortedSucursales(sucursales)
  const selected = new Set()
  let includeUnassigned = false
  let open = false

  const buttonId = `${id}-button`
  const panelId = `${id}-panel`

  wrapper.innerHTML = `
    <button
      type="button"
      id="${escapeHtml(buttonId)}"
      class="flex w-full items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-left text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
      aria-haspopup="listbox"
      aria-expanded="false"
      aria-controls="${escapeHtml(panelId)}"
    >
      <span data-summary>Todas las sucursales</span>
      <span aria-hidden="true" class="text-slate-400">▾</span>
    </button>
    <div
      id="${escapeHtml(panelId)}"
      hidden
      role="listbox"
      aria-multiselectable="true"
      aria-labelledby="${escapeHtml(buttonId)}"
      class="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-slate-200 bg-white p-2 shadow-lg"
    ></div>
  `

  const button = wrapper.querySelector('button')
  const summaryEl = wrapper.querySelector('[data-summary]')
  const panel = wrapper.querySelector('[role="listbox"]')
  const abort = new AbortController()
  if (labelledBy) button.setAttribute('aria-labelledby', labelledBy)

  function getValue() {
    return {
      sucursalIds: [...selected].sort((a, b) => a - b),
      includeUnassigned,
    }
  }

  function paintSummary() {
    const text = sucursalFilterSummary(getValue())
    summaryEl.textContent = text
    button.setAttribute('aria-label', `Sucursal: ${text}`)
  }

  function optionRow({ value, label, checked }) {
    const row = document.createElement('label')
    row.className =
      'flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-slate-800 hover:bg-slate-50'
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
    row.prepend(input)
    row.append(text)
    return row
  }

  function paintPanel() {
    panel.replaceChildren()

    const actions = document.createElement('div')
    actions.className = 'mb-2 flex flex-wrap gap-2 border-b border-slate-100 pb-2'

    const selectAll = document.createElement('button')
    selectAll.type = 'button'
    selectAll.className = 'rounded-md px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50'
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
    clear.className = 'rounded-md px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50'
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

  function setOpen(next) {
    open = next
    panel.hidden = !open
    button.setAttribute('aria-expanded', String(open))
    if (open) paintPanel()
  }

  function setSucursales(nextSucursales) {
    const nextCatalog = uniqueSortedSucursales(nextSucursales)
    catalog.splice(0, catalog.length, ...nextCatalog)
    for (const id of [...selected]) {
      if (!catalog.some((item) => item.id === id)) selected.delete(id)
    }
    paintSummary()
    if (open) paintPanel()
  }

  function clearSelection() {
    selected.clear()
    includeUnassigned = false
    paintSummary()
    if (open) paintPanel()
  }

  button.addEventListener(
    'click',
    (event) => {
      event.stopPropagation()
      setOpen(!open)
    },
    { signal: abort.signal },
  )

  document.addEventListener(
    'click',
    (event) => {
      if (!open) return
      if (wrapper.contains(event.target)) return
      setOpen(false)
    },
    { signal: abort.signal },
  )

  document.addEventListener(
    'keydown',
    (event) => {
      if (!open) return
      if (event.key !== 'Escape') return
      event.preventDefault()
      setOpen(false)
      button.focus()
    },
    { signal: abort.signal },
  )

  paintSummary()

  return {
    element: wrapper,
    getValue,
    setSucursales,
    clear: clearSelection,
    destroy() {
      setOpen(false)
      abort.abort()
    },
  }
}
