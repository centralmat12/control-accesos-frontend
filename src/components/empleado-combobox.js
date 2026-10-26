import { escapeHtml, normalizarFiltro } from '../utils/format.js'
import { claimOpenDropdown, positionDropdownPanel, releaseOpenDropdown } from './dropdown.js'
import { DROPDOWN_PANEL_CLASS, DROPDOWN_OPTION_CLASS, DROPDOWN_OPTION_ACTIVE_CLASS } from './dropdown-styles.js'
import { FORM_HELP_CLASS } from './form-field.js'
import { helpText, infoHelpButton } from './tooltip.js'

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

export function nombreEmpleado(empleado) {
  return [empleado?.nombre, empleado?.apellido].filter(Boolean).join(' ') || String(empleado?.empleado ?? '').trim()
}

export function departamentosParaDistinguir(empleados) {
  const counts = new Map()
  empleados.forEach((empleado) => {
    const key = normalizarFiltro(nombreEmpleado(empleado))
    if (!key) return
    counts.set(key, (counts.get(key) ?? 0) + 1)
  })
  return counts
}

export function textoOpcionCalendario(empleado) {
  const nombre = nombreEmpleado(empleado) || 'Empleado'
  const legajo = String(empleado?.legajo ?? '').trim()
  const principal = legajo ? `${nombre} · Legajo ${legajo}` : nombre
  const sucursal = String(empleado?.sucursalNombre ?? empleado?.sucursal ?? '').trim()
  const departamento = String(empleado?.departamento ?? empleado?.departamentoNombre ?? '').trim()
  return {
    principal,
    secundaria: [sucursal, departamento].filter(Boolean).join(' · '),
  }
}

export function opcionEmpleado(empleado, duplicados = new Map()) {
  const nombre = nombreEmpleado(empleado) || 'Empleado'
  const legajo = String(empleado?.legajo ?? '').trim()
  const departamento = String(empleado?.departamento ?? '').trim()
  const repetido = (duplicados.get(normalizarFiltro(nombre)) ?? 0) > 1
  return {
    id: String(empleado?.id ?? ''),
    nombre,
    legajo,
    departamento: repetido ? departamento : '',
  }
}

export function createEmpleadoCombobox({
  id = 'fichadas-empleado',
  onChange,
  mode = 'filter',
  placeholder = '',
  emptyMessage = 'No se encontraron empleados.',
  help = '',
  helpClass = FORM_HELP_CLASS,
  helpMode = 'text',
  presentation = 'default',
  rootClass = '',
  labelClass = 'mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200',
  locked = false,
} = {}) {
  const listId = `${id}-list`
  const seleccionar = mode === 'select'
  const placeholderText = placeholder || (seleccionar ? 'Buscar por nombre o legajo' : TODOS_LABEL)
  let empleados = []
  let selectedId = TODOS_VALUE
  let highlightedIndex = 0
  let open = false
  let options = []
  let fijo = locked

  const root = document.createElement('div')
  root.className = `relative min-w-0 ${rootClass}`.trim()
  const abort = new AbortController()
  const overlayApi = {
    close() {
      setOpen(false)
    },
  }
  const helpId = help ? `${id}-help` : ''

  const helpMarkup = help
    ? helpMode === 'icon'
      ? `<span class="inline-flex items-center gap-1">${infoHelpButton(help)}</span>${helpText(helpId, help)}`
      : `<p id="${helpId}" class="${helpClass}">${escapeHtml(help)}</p>`
    : ''
  root.innerHTML = `
    <span class="${labelClass} flex items-center gap-1"><label for="${id}">Empleado</label>${helpMode === 'icon' && help ? infoHelpButton(help) : ''}</span>
    ${helpMode === 'icon' && help ? helpText(helpId, help) : ''}
    <input
      id="${id}"
      type="text"
      role="combobox"
      autocomplete="off"
      spellcheck="false"
      aria-autocomplete="list"
      aria-expanded="false"
      aria-controls="${listId}"
      placeholder="${escapeHtml(placeholderText)}"
      ${helpId ? `aria-describedby="${helpId}"` : ''}
      class="${CONTROL_CLASS} min-h-11 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
    />
    ${helpMode === 'icon' ? '' : helpMarkup}
  `

  const input = root.querySelector('input')
  const list = document.createElement('ul')
  list.id = listId
  list.setAttribute('role', 'listbox')
  list.hidden = true
  list.className = DROPDOWN_PANEL_CLASS
  document.body.append(list)

  function selectedEmpleado() {
    if (!selectedId) return null
    return empleados.find((item) => String(item.id) === String(selectedId)) ?? null
  }

  function selectedLabel() {
    if (!selectedId) return seleccionar ? '' : TODOS_LABEL
    const empleado = selectedEmpleado()
    if (!empleado) return ''
    if (presentation === 'calendario') return textoOpcionCalendario(empleado).principal
    return empleadoDisplayLabel(empleado)
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
      ? `${DROPDOWN_OPTION_CLASS} ${DROPDOWN_OPTION_ACTIVE_CLASS}`
      : DROPDOWN_OPTION_CLASS
  }

  function renderList() {
    const matches = visibleEmpleados()
    const duplicados = departamentosParaDistinguir(empleados)
    const encontrados = matches.map((empleado) => opcionEmpleado(empleado, duplicados))
    options = seleccionar
      ? encontrados
      : [{ id: TODOS_VALUE, nombre: TODOS_LABEL, legajo: '', departamento: '' }, ...encontrados]

    if (!options.length) highlightedIndex = -1
    else if (highlightedIndex >= options.length || highlightedIndex < 0) highlightedIndex = 0

    list.replaceChildren()
    if (!options.length) {
      const vacio = document.createElement('li')
      vacio.className = `${DROPDOWN_OPTION_CLASS} text-slate-500`
      vacio.setAttribute('role', 'presentation')
      vacio.textContent = emptyMessage
      list.append(vacio)
      input.removeAttribute('aria-activedescendant')
      return
    }
    options.forEach((option, index) => {
      const item = document.createElement('li')
      item.id = `${id}-option-${index}`
      item.setAttribute('role', 'option')
      item.setAttribute('aria-selected', String(index === highlightedIndex))
      item.dataset.id = option.id
      item.className = optionClass(index === highlightedIndex)
      const empleado = empleados.find((entry) => String(entry.id) === option.id)
      if (presentation === 'calendario' && empleado) {
        const texto = textoOpcionCalendario(empleado)
        item.innerHTML = `<span class="block truncate">${escapeHtml(texto.principal)}</span>${texto.secundaria ? `<span class="block truncate text-xs font-normal text-slate-500 dark:text-slate-400">${escapeHtml(texto.secundaria)}</span>` : ''}`
      } else if (!seleccionar) {
        item.textContent = empleado ? empleadoDisplayLabel(empleado) : option.nombre
      } else {
        const secundario = [option.legajo, option.departamento].filter(Boolean).join(' · ')
        item.innerHTML = `<span class="block truncate">${escapeHtml(option.nombre)}</span>${secundario ? `<span class="block truncate text-xs font-normal text-slate-500 dark:text-slate-400">${escapeHtml(secundario)}</span>` : ''}`
      }
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
    if (open === nextOpen) {
      if (nextOpen) positionDropdownPanel(input, list)
      return
    }
    open = nextOpen
    list.hidden = !open
    input.setAttribute('aria-expanded', String(open))
    if (open) {
      claimOpenDropdown(overlayApi)
      renderList()
      positionDropdownPanel(input, list)
    } else {
      releaseOpenDropdown(overlayApi)
      input.removeAttribute('aria-activedescendant')
    }
  }

  document.addEventListener('mousedown', (event) => {
    if (!open) return
    if (root.contains(event.target) || list.contains(event.target)) return
    cancelPending()
  }, { signal: abort.signal })

  window.addEventListener('resize', () => {
    if (open) positionDropdownPanel(input, list)
  }, { signal: abort.signal })
  window.addEventListener('scroll', () => {
    if (open) positionDropdownPanel(input, list)
  }, { capture: true, signal: abort.signal })

  function choose(idValue, { silent = false } = {}) {
    const previous = selectedId
    const next = idValue ? String(idValue) : TODOS_VALUE
    if (seleccionar && next && !empleados.some((item) => String(item.id) === next)) return
    selectedId = next
    input.value = selectedId ? selectedLabel() : ''
    input.placeholder = placeholderText
    setOpen(false)
    if (!silent && previous !== selectedId) onChange?.(selectedId)
  }

  function cancelPending() {
    input.value = selectedId ? selectedLabel() : ''
    setOpen(false)
  }

  input.addEventListener('focus', () => {
    if (fijo) return
    setOpen(true)
    highlightedIndex = Math.max(
      0,
      options.findIndex((option) => option.id === String(selectedId)),
    )
    renderList()
  })

  input.addEventListener('input', () => {
    if (fijo) {
      input.value = selectedLabel()
      return
    }
    highlightedIndex = 0
    setOpen(true)
    renderList()
  })

  input.addEventListener('keydown', (event) => {
    if (fijo) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Enter') event.preventDefault()
      return
    }
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
      if (open && options[highlightedIndex]?.id != null && highlightedIndex >= 0) choose(options[highlightedIndex].id)
      return
    }

    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
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

  const api = {
    root,
    input,
    getEmpleadoId() {
      if (seleccionar && !selectedEmpleado()) return ''
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
    setEmpleadoId(id, { silent = false } = {}) {
      choose(id ? String(id) : TODOS_VALUE, { silent })
    },
    setLocked(next = true) {
      fijo = Boolean(next)
      input.readOnly = fijo
      input.setAttribute('aria-readonly', String(fijo))
      if (fijo) setOpen(false)
    },
    destroy() {
      setOpen(false)
      abort.abort()
      list.remove()
    },
  }
  if (fijo) api.setLocked(true)
  return api
}
