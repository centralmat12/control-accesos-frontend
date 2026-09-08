/**
 * Sucursales de una empresa.
 *
 * GET /api/sucursales — EmpresaId del JWT (ADMIN/RRHH) o de X-Empresa-Id (SuperAdmin).
 * POST /api/sucursales — modelo Sucursal: nombre, empresaId, serialLector.
 * PUT /api/sucursales/{id} — body completo: id, nombre, empresaId, serialLector.
 * No enviar EmpresaId por query.
 */
import { pick } from '../utils/pick.js'
import { puedeCrearSucursales, puedeEditarSucursales } from '../config/administracion.js'
import { getCurrentUser } from './auth.js'
import { apiFetch, createApiError, readErrorMessage } from './http.js'

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
    serialLector: String(pick(item, 'serialLector', 'SerialLector') ?? '').trim(),
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

export async function getSucursales({ empresaId } = {}) {
  const scopedId = parseId(empresaId)
  const { url, response } = await apiFetch('/api/sucursales', {
    empresaId: scopedId,
    missingAuthMessage: 'No hay sesión activa. Iniciá sesión para consultar sucursales.',
    logLabel: 'Sucursales',
  })

  if (response.status === 403) {
    throw createApiError('No tenés permiso para ver las sucursales.', 403)
  }

  if (!response.ok) {
    console.error('Sucursales: respuesta HTTP no exitosa', { url, status: response.status })
    throw createApiError(
      await readErrorMessage(response, `No se pudieron cargar las sucursales (${response.status}).`),
      response.status,
    )
  }

  const sucursales = normalizeSucursales(await response.json())
  if (!scopedId) return sucursales
  return sucursales.filter((sucursal) => !sucursal.empresaId || sucursal.empresaId === scopedId)
}

/**
 * POST /api/sucursales. SuperAdmin: X-Empresa-Id = empresaId (mismo valor que el body).
 */
export async function createSucursal({ nombre, empresaId, serialLector }) {
  const empresa = parseId(empresaId)
  if (!empresa) {
    throw createApiError('No se puede crear una sucursal sin empresa.', 400)
  }

  if (!puedeCrearSucursales(getCurrentUser(), empresa)) {
    throw createApiError('No tenés permiso para crear sucursales en esta empresa.', 403)
  }

  const dto = {
    nombre: String(nombre ?? '').trim(),
    empresaId: empresa,
    serialLector: String(serialLector ?? '').trim(),
  }

  const { url, response } = await apiFetch('/api/sucursales', {
    method: 'POST',
    empresaId: empresa,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dto),
    missingAuthMessage: 'No hay sesión activa. Iniciá sesión para crear sucursales.',
    logLabel: 'Sucursales',
  })

  if (response.status === 403) {
    throw createApiError('No tenés permiso para crear sucursales en esta empresa.', 403)
  }

  if (response.status === 400) {
    throw createApiError(await readErrorMessage(response, 'Los datos de la sucursal no son válidos.'), 400)
  }

  if (response.status === 409) {
    throw createApiError(await readErrorMessage(response, 'Ya existe una sucursal con ese nombre en la empresa.'), 409)
  }

  if (!response.ok) {
    console.error('Sucursales: alta HTTP no exitosa', { url, status: response.status })
    throw createApiError(
      await readErrorMessage(response, `No se pudo crear la sucursal (${response.status}).`),
      response.status,
    )
  }

  return mapSucursal(await response.json())
}

function normalizeRequiredText(value, label) {
  const text = String(value ?? '').trim()
  if (!text) {
    throw createApiError(`${label} es obligatorio.`, 400)
  }
  if (text.length > 100) {
    throw createApiError(`${label} no puede superar 100 caracteres.`, 400)
  }
  return text
}

/**
 * PUT /api/sucursales/{id}. Conserva el EmpresaId original y espera 204 No Content.
 */
export async function updateSucursal({ id, nombre, empresaId, serialLector }) {
  const sucursalId = parseId(id)
  const empresa = parseId(empresaId)

  if (!sucursalId) {
    throw createApiError('La sucursal no tiene un ID válido.', 400)
  }

  if (!empresa) {
    throw createApiError('La sucursal no tiene una empresa válida.', 400)
  }

  if (!puedeEditarSucursales(getCurrentUser(), empresa)) {
    throw createApiError('No tenés permiso para editar sucursales en esta empresa.', 403)
  }

  const dto = {
    id: sucursalId,
    nombre: normalizeRequiredText(nombre, 'El nombre'),
    empresaId: empresa,
    serialLector: normalizeRequiredText(serialLector, 'El serial del lector'),
  }

  const path = `/api/sucursales/${sucursalId}`
  const { url, response } = await apiFetch(path, {
    method: 'PUT',
    empresaId: empresa,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dto),
    missingAuthMessage: 'No hay sesión activa. Iniciá sesión para editar sucursales.',
    logLabel: 'Sucursales',
  })

  if (response.status === 400) {
    throw createApiError(await readErrorMessage(response, 'Los datos de la sucursal no son válidos.'), 400)
  }

  if (response.status === 403) {
    throw createApiError('No tenés permiso para editar esta sucursal.', 403)
  }

  if (response.status === 404) {
    throw createApiError('La sucursal ya no existe.', 404)
  }

  if (response.status === 409) {
    throw createApiError(
      await readErrorMessage(response, 'No se pudo actualizar la sucursal por un conflicto de datos.'),
      409,
    )
  }

  if (response.status >= 500) {
    console.error('Sucursales: la API no pudo completar la actualización', {
      url,
      status: response.status,
    })
    throw createApiError('La API no pudo actualizar la sucursal. Intentá nuevamente más tarde.', response.status)
  }

  if (response.status !== 204) {
    console.error('Sucursales: respuesta inesperada al actualizar', { url, status: response.status })
    throw createApiError(
      await readErrorMessage(response, `No se pudo actualizar la sucursal (${response.status}).`),
      response.status,
    )
  }
}
