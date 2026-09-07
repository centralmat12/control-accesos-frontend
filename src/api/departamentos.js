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

  return items.map(mapDepartamento).filter(Boolean)
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
  return departamentos.filter((departamento) => departamento.sucursalId === id)
}
