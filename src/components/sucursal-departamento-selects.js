import { departamentoOptionLabel, getDepartamentosBySucursal, uniqueDepartamentosById } from '../api/departamentos.js'
import { refreshEnhancedSelect } from './dropdown.js'

export const SUCURSAL_ALL = 'todos'
export const DEPARTAMENTO_ALL = 'todos'
export const HINT_SELECT_SUCURSAL = 'Seleccioná una sucursal'

function addOption(select, value, label) {
  const option = document.createElement('option')
  option.value = value
  option.textContent = label
  select.append(option)
}

function syncSelect(select) {
  refreshEnhancedSelect(select)
}

function sortByNombre(items) {
  return [...(items ?? [])].sort((a, b) => String(a.nombre ?? '').localeCompare(String(b.nombre ?? ''), 'es'))
}

export function parseEntityId(value) {
  if (value == null || value === '' || value === SUCURSAL_ALL || value === DEPARTAMENTO_ALL) return null
  const id = Number(value)
  return Number.isFinite(id) && id > 0 ? id : null
}

export function selectedOptionLabel(select) {
  const option = select?.selectedOptions?.[0]
  if (!option || !option.value || option.value === SUCURSAL_ALL || option.value === DEPARTAMENTO_ALL) return null
  const label = String(option.textContent ?? '').trim()
  return label || null
}

export function fillSucursalOptions(
  select,
  sucursales,
  { includeAll = false, currentId = null, placeholder = 'Seleccionar...' } = {},
) {
  const wanted = parseEntityId(currentId)
  select.replaceChildren()

  if (includeAll) addOption(select, SUCURSAL_ALL, 'Todas')
  else addOption(select, '', placeholder)

  sortByNombre(sucursales).forEach((item) => addOption(select, String(item.id), item.nombre || `Sucursal ${item.id}`))

  const valid = wanted && [...select.options].some((option) => parseEntityId(option.value) === wanted)
  select.value = valid ? String(wanted) : includeAll ? SUCURSAL_ALL : ''
  syncSelect(select)
}

export function setDepartamentoIdle(
  select,
  hintEl,
  { includeAll = false, message = HINT_SELECT_SUCURSAL } = {},
) {
  select.disabled = true
  select.replaceChildren()
  addOption(select, includeAll ? DEPARTAMENTO_ALL : '', HINT_SELECT_SUCURSAL)
  select.value = includeAll ? DEPARTAMENTO_ALL : ''
  syncSelect(select)
  if (hintEl) {
    hintEl.textContent = message || HINT_SELECT_SUCURSAL
    hintEl.classList.remove('hidden')
  }
}

function setDepartamentoLoading(select, hintEl, { preserveId = null } = {}) {
  const currentLabel = String(select.selectedOptions?.[0]?.textContent ?? '').trim()
  const keep = preserveId != null ? String(preserveId) : ''
  select.disabled = true
  select.replaceChildren()
  if (keep) {
    addOption(select, keep, currentLabel && currentLabel !== 'Cargando...' ? currentLabel : 'Departamento actual')
    select.value = keep
  } else {
    addOption(select, '', 'Cargando...')
    select.value = ''
  }
  syncSelect(select)
  if (hintEl) {
    hintEl.textContent = ''
    hintEl.classList.add('hidden')
  }
}

export function fillDepartamentoOptions(
  select,
  departamentos,
  hintEl,
  { includeAll = false, currentId = null, currentLabel = '', sucursalNames } = {},
) {
  const unique = uniqueDepartamentosById(departamentos)
  const nameCounts = new Map()
  unique.forEach((item) => {
    const key = String(item.nombre ?? '')
      .trim()
      .toLowerCase()
    nameCounts.set(key, (nameCounts.get(key) || 0) + 1)
  })

  const wanted = parseEntityId(currentId)
  select.disabled = false
  select.replaceChildren()

  if (includeAll) addOption(select, DEPARTAMENTO_ALL, 'Todos')
  else addOption(select, '', 'Seleccionar...')

  unique.forEach((item) => {
    const key = String(item.nombre ?? '')
      .trim()
      .toLowerCase()
    addOption(
      select,
      String(item.id),
      departamentoOptionLabel(item, {
        sucursalNames,
        duplicateName: (nameCounts.get(key) || 0) > 1,
      }),
    )
  })

  const valid = wanted && [...select.options].some((option) => parseEntityId(option.value) === wanted)
  if (wanted && !valid && !includeAll) {
    addOption(select, String(wanted), currentLabel || 'Departamento actual')
  }
  select.value = wanted && (valid || !includeAll) ? String(wanted) : includeAll ? DEPARTAMENTO_ALL : ''
  syncSelect(select)

  if (hintEl) {
    hintEl.textContent = ''
    hintEl.classList.add('hidden')
  }
}

function clearDepartamentoAfterError(select, hintEl, { includeAll = false, message, optionLabel } = {}) {
  select.disabled = true
  select.replaceChildren()
  addOption(select, includeAll ? DEPARTAMENTO_ALL : '', optionLabel || HINT_SELECT_SUCURSAL)
  select.value = includeAll ? DEPARTAMENTO_ALL : ''
  syncSelect(select)
  if (hintEl) {
    hintEl.textContent = message || 'No se pudieron cargar los departamentos.'
    hintEl.classList.remove('hidden')
  }
}

/**
 * Cascada Sucursal → Departamento.
 * Al cambiar sucursal limpia el departamento y vuelve a consultar la API.
 * Si la consulta falla, no conserva departamentos de otra sucursal.
 */
export function bindSucursalDepartamentoCascade({
  sucursalSelect,
  departamentoSelect,
  hintEl,
  includeAll = false,
  onChange,
  onDepartamentosError,
} = {}) {
  let generation = 0

  async function reloadDepartamentos({ preserveDepartamentoId = null } = {}) {
    const sucursalId = parseEntityId(sucursalSelect.value)
    generation += 1
    const current = generation

    if (!sucursalId) {
      setDepartamentoIdle(departamentoSelect, hintEl, { includeAll })
      onChange?.()
      return
    }

    const previous = [...departamentoSelect.options].map((option) => ({
      value: option.value,
      label: option.textContent,
      selected: option.selected,
    }))
    setDepartamentoLoading(departamentoSelect, hintEl, { preserveId: preserveDepartamentoId })
    onChange?.()

    try {
      const departamentos = await getDepartamentosBySucursal(sucursalId)
      if (current !== generation) return
      const preserved = previous.find((option) => parseEntityId(option.value) === parseEntityId(preserveDepartamentoId))
      fillDepartamentoOptions(departamentoSelect, departamentos, hintEl, {
        includeAll,
        currentId: preserveDepartamentoId,
        currentLabel: preserved?.label || '',
      })
    } catch (error) {
      if (current !== generation) return
      const keepId = parseEntityId(preserveDepartamentoId)
      const keepSelection =
        (error.status === 401 || error.status === 403) &&
        (keepId || previous.some((option) => parseEntityId(option.value)))
      if (keepSelection) {
        departamentoSelect.disabled = error.status === 401 || error.status === 403
        departamentoSelect.replaceChildren()
        previous.forEach((option) => addOption(departamentoSelect, option.value, option.label))
        if (keepId && !previous.some((option) => parseEntityId(option.value) === keepId)) {
          addOption(departamentoSelect, String(keepId), 'Departamento actual')
        }
        const selected = previous.find((option) => option.selected)
        departamentoSelect.value = selected?.value || (keepId ? String(keepId) : '')
        syncSelect(departamentoSelect)
      } else {
        clearDepartamentoAfterError(departamentoSelect, hintEl, {
          includeAll,
          message: error.message || 'No se pudieron cargar los departamentos.',
          optionLabel: error.message || 'No se pudieron cargar los departamentos.',
        })
      }
      onDepartamentosError?.(error)
    }

    onChange?.()
  }

  sucursalSelect.addEventListener('change', () => {
    reloadDepartamentos()
  })
  departamentoSelect.addEventListener('change', () => onChange?.())

  return { reloadDepartamentos }
}
