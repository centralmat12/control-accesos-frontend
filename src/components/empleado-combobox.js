import { escapeHtml, normalizarFiltro } from '../utils/format.js'

const TODOS_VALUE = ''
const TODOS_LABEL = 'Todos los empleados'
const CONTROL_CLASS =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'

export function empleadoDisplayLabel(empleado) {
  const name = [empleado?.nombre, empleado?.apellido].filter(Boolean).join(' ')
  if (!name) return empleado?.legajo ? String(empleado.legajo) : ''
  return empleado.legajo ? `${name} (${empleado.legajo})` : name
}

export function matchesEmpleadoQuery(empleado, query) {
  const needle = normalizarFiltro(query)
  if (!needle) return true

  const nombre = normalizarFiltro(empleado.nombre)
  const apellido = normalizarFiltro(empleado.apellido)
  const full = normalizarFiltro([empleado.nombre, empleado.apellido].filter(Boolean).join(' '))
  const reverse = normalizarFiltro([empleado.apellido, empleado.nombre].filter(Boolean).join(' '))
  const legajo = normalizarFiltro(empleado.legajo)

  return (
    nombre.includes(needle) ||
    apellido.includes(needle) ||
    full.includes(needle) ||
    reverse.includes(needle) ||
    legajo.includes(needle)
  )
}

function sortEmpleados(empleados) {
  return empleados
    .slice()
    .sort((a, b) => empleadoDisplayLabel(a).localeCompare(empleadoDisplayLabel(b), 'es'))
}

export function createEmpleadoCombobox({ id = 'fichadas-empleado', onChange } = {}) {
  const listId = `${id}-list`
  let empleados = []
  let selectedId = TODOS_VALUE
  let highlightedIndex = 0
  let open = false
  let options = []

  const root = document.createElement('div')
  root.className = 'relative min-w-0'

  root.innerHTML = `
    <label for="${id}" class="mb-1.5 block text-sm font-medium text-slate-700">Empleado</label>
    <input
      id="${id}"
      type="text"
      role="combobox"
      autocomplete="off"
      spellcheck="false"
      aria-autocomplete="list"
      aria-expanded="false"
      aria-controls="${listId}"
      placeholder="${TODOS_LABEL}"
      class="${CONTROL_CLASS}"
    />
    <ul
      id="${listId}"
      role="listbox"
      hidden
      class="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
    ></ul>
  `

  const input = root.querySelector('input')
  const list = root.querySelector('ul')

  function selectedLabel() {
    if (!selectedId) return TODOS_LABEL
    const empleado = empleados.find((item) => String(item.id) === String(selectedId))
    return empleado ? empleadoDisplayLabel(empleado) : TODOS_LABEL
  }

  function listQuery() {
    const current = selectedId ? selectedLabel() : ''
    return input.value === current ? '' : input.value
  }

  function visibleEmpleados() {
    return sortEmpleados(empleados.filter((empleado) => matchesEmpleadoQuery(empleado, listQuery())))
  }

  function optionClass(active) {
    return active
      ? 'cursor-pointer px-3 py-2 text-sm bg-blue-50 text-slate-900'
      : 'cursor-pointer px-3 py-2 text-sm text-slate-700 hover:bg-slate-50'
  }

  function renderList() {
    const matches = visibleEmpleados()
    options = [{ id: TODOS_VALUE, label: TODOS_LABEL }, ...matches.map((empleado) => ({
      id: String(empleado.id),
      label: empleadoDisplayLabel(empleado),
    }))]

    if (highlightedIndex >= options.length) highlightedIndex = Math.max(0, options.length - 1)

    list.replaceChildren()
    options.forEach((option, index) => {
      const item = document.createElement('li')
      item.id = `${id}-option-${index}`
      item.setAttribute('role', 'option')
      item.setAttribute('aria-selected', String(index === highlightedIndex))
      item.dataset.id = option.id
      item.className = optionClass(index === highlightedIndex)
      item.innerHTML =
        option.id === TODOS_VALUE
          ? escapeHtml(option.label)
          : `${escapeHtml(option.label)}`
      item.addEventListener('mousedown', (event) => {
        event.preventDefault()
        choose(option.id)
      })
      list.append(item)
    })

    const active = options[highlightedIndex]
    input.setAttribute('aria-activedescendant', active ? `${id}-option-${highlightedIndex}` : '')
  }

  function setOpen(nextOpen) {
    open = nextOpen
    list.hidden = !open
    input.setAttribute('aria-expanded', String(open))
    if (open) {
      renderList()
      document.addEventListener('mousedown', onDocumentMouseDown)
    } else {
      input.removeAttribute('aria-activedescendant')
      document.removeEventListener('mousedown', onDocumentMouseDown)
    }
  }

  function onDocumentMouseDown(event) {
    if (!root.isConnected) {
      document.removeEventListener('mousedown', onDocumentMouseDown)
      return
    }
    if (!root.contains(event.target)) {
      cancelPending()
    }
  }

  function choose(idValue, { silent = false } = {}) {
    const previous = selectedId
    selectedId = idValue ? String(idValue) : TODOS_VALUE
    input.value = selectedId ? selectedLabel() : ''
    input.placeholder = TODOS_LABEL
    setOpen(false)
    if (!silent && previous !== selectedId) onChange?.(selectedId)
  }

  function cancelPending() {
    input.value = selectedId ? selectedLabel() : ''
    setOpen(false)
  }

  input.addEventListener('focus', () => {
    setOpen(true)
    highlightedIndex = Math.max(
      0,
      options.findIndex((option) => option.id === String(selectedId)),
    )
    renderList()
  })

  input.addEventListener('input', () => {
    highlightedIndex = 0
    setOpen(true)
    renderList()
  })

  input.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      if (!open) setOpen(true)
      highlightedIndex = Math.min(highlightedIndex + 1, options.length - 1)
      renderList()
      list.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' })
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      if (!open) setOpen(true)
      highlightedIndex = Math.max(highlightedIndex - 1, 0)
      renderList()
      list.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' })
      return
    }

    if (event.key === 'Enter') {
      event.preventDefault()
      if (open && options[highlightedIndex]) choose(options[highlightedIndex].id)
      return
    }

    if (event.key === 'Escape') {
      event.preventDefault()
      cancelPending()
      return
    }

    if (event.key === 'Tab') {
      cancelPending()
    }
  })

  input.addEventListener('blur', () => {
    window.setTimeout(() => {
      if (!root.contains(document.activeElement)) cancelPending()
    }, 0)
  })

  return {
    root,
    getEmpleadoId() {
      return selectedId
    },
    getSelectedLabel() {
      return selectedId ? selectedLabel() : ''
    },
    setEmpleados(nextEmpleados) {
      empleados = Array.isArray(nextEmpleados) ? nextEmpleados : []
      if (selectedId && !empleados.some((item) => String(item.id) === String(selectedId))) {
        choose(TODOS_VALUE, { silent: true })
      } else {
        input.value = selectedId ? selectedLabel() : ''
      }
    },
    reset() {
      choose(TODOS_VALUE, { silent: true })
    },
  }
}
