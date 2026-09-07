/**
 * Sucursales de la empresa operativa.
 *
 * GET /api/sucursales — EmpresaId sale del JWT (ADMIN/RRHH) o de X-Empresa-Id (SUPERADMIN).
 * No enviar EmpresaId por query ni en el body.
 */
import { pick } from '../utils/pick.js'
import { apiFetch, readErrorMessage } from './http.js'

function parseId(value) {
  const id = Number(value)
  return Number.isFinite(id) && id > 0 ? id : null
}

export function mapSucursal(item) {
  const id = parseId(pick(item, 'id', 'Id'))
  if (!id) return null

  return {
    id,
    nombre: String(pick(item, 'nombre', 'Nombre') ?? '').trim(),
    empresaId: parseId(pick(item, 'empresaId', 'EmpresaId')),
  }
}

function normalizeSucursales(payload) {
  const items = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.items)
      ? payload.items
      : Array.isArray(payload?.data)
        ? payload.data
        : []

  return items.map(mapSucursal).filter(Boolean)
}

export async function getSucursales() {
  const { url, response } = await apiFetch('/api/sucursales', {
    missingAuthMessage: 'No hay sesión activa. Iniciá sesión para consultar sucursales.',
    logLabel: 'Sucursales',
  })

  if (response.status === 403) {
    throw new Error('No tenés permiso para ver las sucursales.')
  }

  if (!response.ok) {
    console.error('Sucursales: respuesta HTTP no exitosa', { url, status: response.status })
    throw new Error(await readErrorMessage(response, `No se pudieron cargar las sucursales (${response.status}).`))
  }

  return normalizeSucursales(await response.json())
}
