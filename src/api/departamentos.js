/**
 * Departamentos de la empresa operativa.
 *
 * GET /api/departamentos — scoped por EmpresaId del JWT / X-Empresa-Id.
 * La API no acepta sucursalId como query; cada ítem trae sucursalId y se filtra en el cliente.
 */
import { pick } from '../utils/pick.js'
import { apiFetch, readErrorMessage } from './http.js'

function parseId(value) {
  const id = Number(value)
  return Number.isFinite(id) && id > 0 ? id : null
}

function nestedSucursal(item) {
  return item?.sucursal ?? item?.Sucursal ?? null
}

export function mapDepartamento(item) {
  const id = parseId(pick(item, 'id', 'Id'))
  if (!id) return null

  const sucursal = nestedSucursal(item)

  return {
    id,
    nombre: String(pick(item, 'nombre', 'Nombre') ?? '').trim(),
    sucursalId: parseId(pick(item, 'sucursalId', 'SucursalId')) ?? parseId(pick(sucursal, 'id', 'Id')),
  }
}

function normalizeDepartamentos(payload) {
  const items = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.items)
      ? payload.items
      : Array.isArray(payload?.data)
        ? payload.data
        : []

  return uniqueDepartamentosById(items.map(mapDepartamento).filter(Boolean))
}

export function uniqueDepartamentosById(departamentos) {
  const seen = new Map()

  for (const item of departamentos ?? []) {
    const id = Number(item?.id)
    if (!Number.isFinite(id) || id <= 0) continue
    if (seen.has(id)) continue
    seen.set(id, item)
  }

  return [...seen.values()].sort((a, b) =>
    String(a.nombre ?? '').localeCompare(String(b.nombre ?? ''), 'es'),
  )
}

/**
 * GET /api/departamentos incluye sucursalId. Una sucursal filtra por ese ID;
 * varias sucursales unen departamentos; “todas” usa el catálogo completo.
 * “Sin sucursal asignada” no inventa departamentos (la entidad exige SucursalId).
 */
export function filterDepartamentosForSucursalSelection(
  departamentos,
  { sucursalIds = [], includeUnassigned = false } = {},
) {
  const unique = uniqueDepartamentosById(departamentos)
  const ids = [
    ...new Set(
      (sucursalIds ?? [])
        .map((value) => Number(value))
        .filter((id) => Number.isFinite(id) && id > 0),
    ),
  ]

  if (ids.length === 0 && includeUnassigned) return []
  if (ids.length === 0) return unique

  return unique.filter((item) => ids.includes(Number(item.sucursalId)))
}

export function departamentoOptionLabel(item, { sucursalNames, duplicateName = false } = {}) {
  const base = String(item?.nombre ?? '').trim() || `Departamento ${item.id}`
  if (!duplicateName) return base

  const sucursalNombre = sucursalNames?.get(Number(item.sucursalId))
  if (sucursalNombre) return `${base} (${sucursalNombre})`
  return `${base} (${item.id})`
}

export async function getDepartamentos() {
  const { url, response } = await apiFetch('/api/departamentos', {
    missingAuthMessage: 'No hay sesión activa. Iniciá sesión para consultar departamentos.',
    logLabel: 'Departamentos',
  })

  if (response.status === 403) {
    throw new Error('No tenés permiso para ver los departamentos.')
  }

  if (!response.ok) {
    console.error('Departamentos: respuesta HTTP no exitosa', { url, status: response.status })
    throw new Error(await readErrorMessage(response, `No se pudieron cargar los departamentos (${response.status}).`))
  }

  return normalizeDepartamentos(await response.json())
}

export async function getDepartamentosBySucursal(sucursalId) {
  const id = parseId(sucursalId)
  if (!id) return []

  const departamentos = await getDepartamentos()
  return filterDepartamentosForSucursalSelection(departamentos, { sucursalIds: [id] })
}
