import { departamentoOptionLabel, getDepartamentosBySucursal, uniqueDepartamentosById } from '../api/departamentos.js'

export const SUCURSAL_ALL = 'todos'
export const DEPARTAMENTO_ALL = 'todos'
export const HINT_SELECT_SUCURSAL = 'Seleccione una sucursal'

function addOption(select, value, label) {
  const option = document.createElement('option')
  option.value = value
  option.textContent = label
  select.append(option)
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
  const wanted = currentId != null ? String(currentId) : null
  select.replaceChildren()

  if (includeAll) addOption(select, SUCURSAL_ALL, 'Todas')
  else addOption(select, '', placeholder)

  sortByNombre(sucursales).forEach((item) => addOption(select, String(item.id), item.nombre || `Sucursal ${item.id}`))

  const valid = wanted && [...select.options].some((option) => option.value === wanted)
  select.value = valid ? wanted : includeAll ? SUCURSAL_ALL : ''
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
  if (hintEl) {
    hintEl.textContent = message || HINT_SELECT_SUCURSAL
    hintEl.classList.remove('hidden')
  }
}

function setDepartamentoLoading(select, hintEl) {
  select.disabled = true
  select.replaceChildren()
  addOption(select, '', 'Cargando...')
  select.value = ''
  if (hintEl) {
    hintEl.textContent = ''
    hintEl.classList.add('hidden')
  }
}

export function fillDepartamentoOptions(
  select,
  departamentos,
  hintEl,
  { includeAll = false, currentId = null, sucursalNames } = {},
) {
  const unique = uniqueDepartamentosById(departamentos)
  const nameCounts = new Map()
  unique.forEach((item) => {
    const key = String(item.nombre ?? '')
      .trim()
      .toLowerCase()
    nameCounts.set(key, (nameCounts.get(key) || 0) + 1)
  })

  const wanted = currentId != null ? String(currentId) : null
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

  const valid = wanted && [...select.options].some((option) => option.value === wanted)
  select.value = valid ? wanted : includeAll ? DEPARTAMENTO_ALL : ''

  if (hintEl) {
    hintEl.textContent = ''
    hintEl.classList.add('hidden')
  }
}

function clearDepartamentoAfterError(select, hintEl, { includeAll = false, message } = {}) {
  select.disabled = true
  select.replaceChildren()
  addOption(select, includeAll ? DEPARTAMENTO_ALL : '', HINT_SELECT_SUCURSAL)
  select.value = includeAll ? DEPARTAMENTO_ALL : ''
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

    setDepartamentoLoading(departamentoSelect, hintEl)
    onChange?.()

    try {
      const departamentos = await getDepartamentosBySucursal(sucursalId)
      if (current !== generation) return
      fillDepartamentoOptions(departamentoSelect, departamentos, hintEl, {
        includeAll,
        currentId: preserveDepartamentoId,
      })
    } catch (error) {
      if (current !== generation) return
      clearDepartamentoAfterError(departamentoSelect, hintEl, {
        includeAll,
        message: error.message || 'No se pudieron cargar los departamentos.',
      })
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
