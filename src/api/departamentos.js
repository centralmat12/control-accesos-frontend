/**
 * Departamentos de la empresa operativa.
 *
 * GET /api/departamentos — scoped por EmpresaId del JWT / X-Empresa-Id.
 * La API no acepta sucursalId como query; cada ítem trae sucursalId y se filtra en el cliente.
 * POST /api/departamentos — modelo Departamento: nombre, sucursalId.
 * Autorización de lectura: PuedeLeerDepartamentos (SuperAdmin, ADMIN, RRHH, token_use=web).
 * Escritura: PuedeAdministrarDepartamentos (SuperAdmin, ADMIN). El listado sigue acotado a la empresa.
 */
import { puedeCrearDepartamentos } from '../config/administracion.js'
import { pick } from '../utils/pick.js'
import { getCurrentUser } from './auth.js'
import { getOperativeEmpresaId } from './empresa-context.js'
import { apiFetch, createApiError, readErrorMessage } from './http.js'

export const DEPARTAMENTO_NOMBRE_MAX = 100

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

  const mapped = {
    id,
    nombre: String(pick(item, 'nombre', 'Nombre') ?? '').trim(),
    sucursalId: parseId(pick(item, 'sucursalId', 'SucursalId')) ?? parseId(pick(sucursal, 'id', 'Id')),
    sucursalNombre: String(
      pick(item, 'sucursalNombre', 'SucursalNombre') ?? pick(sucursal, 'nombre', 'Nombre') ?? '',
    ).trim(),
  }

  const cantidadEmpleados = parseCount(
    pick(item, 'cantidadEmpleadosAsignados', 'CantidadEmpleadosAsignados', 'cantidadEmpleados', 'CantidadEmpleados'),
  )
  const empleadosActivos = parseCount(pick(item, 'empleadosActivos', 'EmpleadosActivos'))
  const empleadosInactivos = parseCount(pick(item, 'empleadosInactivos', 'EmpleadosInactivos'))
  if (cantidadEmpleados != null) mapped.cantidadEmpleados = cantidadEmpleados
  if (empleadosActivos != null) mapped.empleadosActivos = empleadosActivos
  if (empleadosInactivos != null) mapped.empleadosInactivos = empleadosInactivos
  return mapped
}

function parseCount(value) {
  if (value == null || value === '') return null
  const count = Number(value)
  return Number.isInteger(count) && count >= 0 ? count : null
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

export const MENSAJE_DEPARTAMENTOS_401 = 'La sesión venció. Iniciá sesión nuevamente.'
export const MENSAJE_DEPARTAMENTOS_403 = 'No tenés permiso para consultar los departamentos.'
export const MENSAJE_DEPARTAMENTOS_CARGA = 'No se pudieron cargar los departamentos.'

let inflightDepartamentos = null
let ultimoAvisoCarga = { message: '', at: 0 }

export function mensajeCargaDepartamentos(error) {
  if (error?.status === 401) return MENSAJE_DEPARTAMENTOS_401
  if (error?.status === 403) return MENSAJE_DEPARTAMENTOS_403
  return MENSAJE_DEPARTAMENTOS_CARGA
}

export function notifyDepartamentosLoadError(notify, error) {
  const message = mensajeCargaDepartamentos(error)
  const now = Date.now()
  if (message === ultimoAvisoCarga.message && now - ultimoAvisoCarga.at < 2000) return
  ultimoAvisoCarga = { message, at: now }
  notify?.({ message, tone: 'error' })
}

export async function getDepartamentos() {
  if (!inflightDepartamentos) {
    inflightDepartamentos = fetchDepartamentos().finally(() => {
      inflightDepartamentos = null
    })
  }
  return inflightDepartamentos
}

async function fetchDepartamentos() {
  let url = '/api/departamentos'
  let response
  try {
    const result = await apiFetch('/api/departamentos', {
      missingAuthMessage: MENSAJE_DEPARTAMENTOS_401,
      logLabel: 'Departamentos',
    })
    url = result.url
    response = result.response
  } catch (error) {
    if (error?.status === 401) throw createApiError(MENSAJE_DEPARTAMENTOS_401, 401)
    console.error('Departamentos: no se pudo consultar el listado', { url, status: error?.status || 0 })
    throw createApiError(MENSAJE_DEPARTAMENTOS_CARGA, error?.status || 0)
  }

  if (response.status === 401) {
    throw createApiError(MENSAJE_DEPARTAMENTOS_401, 401)
  }

  if (response.status === 403) {
    console.error('Departamentos: lectura HTTP no exitosa', { url, status: response.status })
    throw createApiError(MENSAJE_DEPARTAMENTOS_403, 403)
  }

  if (!response.ok) {
    console.error('Departamentos: respuesta HTTP no exitosa', { url, status: response.status })
    throw createApiError(MENSAJE_DEPARTAMENTOS_CARGA, response.status)
  }

  return normalizeDepartamentos(await response.json())
}

export async function getDepartamentosBySucursal(sucursalId) {
  const id = parseId(sucursalId)
  if (!id) return []

  const departamentos = await getDepartamentos()
  return filterDepartamentosForSucursalSelection(departamentos, { sucursalIds: [id] })
}

export function normalizeDepartamentoNombre(value) {
  return String(value ?? '').trim()
}

export function validateDepartamentoAlta({ nombre, sucursalId } = {}) {
  const errors = {}
  const trimmed = normalizeDepartamentoNombre(nombre)
  if (!trimmed) {
    errors.nombre = 'Ingresá el nombre del departamento.'
  } else if (trimmed.length > DEPARTAMENTO_NOMBRE_MAX) {
    errors.nombre = `El nombre no puede superar ${DEPARTAMENTO_NOMBRE_MAX} caracteres.`
  }

  const sucursal = parseId(sucursalId)
  if (!sucursal) {
    errors.sucursalId = 'Seleccioná una sucursal.'
  }

  return {
    nombre: trimmed,
    sucursalId: sucursal,
    errors,
    hasErrors: Object.keys(errors).length > 0,
  }
}

const MENSAJE_SIN_PERMISO_ADMIN = 'No tenés permiso para administrar departamentos.'

function looksLikeDuplicateDepartamento(message) {
  return /duplicate|duplicad|unique|1062|nombre.*sucursal/i.test(String(message ?? ''))
}

/**
 * POST /api/departamentos. SuperAdmin: X-Empresa-Id de la empresa operativa.
 * El body es el modelo Departamento (camelCase): { nombre, sucursalId }.
 * 201 CreatedAtAction con el departamento creado.
 */
export async function createDepartamento({ nombre, sucursalId, empresaId } = {}) {
  const validated = validateDepartamentoAlta({ nombre, sucursalId })
  if (validated.hasErrors) {
    throw createApiError(validated.errors.nombre || validated.errors.sucursalId, 400)
  }

  const empresa = parseId(empresaId) ?? getOperativeEmpresaId(getCurrentUser())
  if (!puedeCrearDepartamentos(getCurrentUser(), empresa)) {
    throw createApiError(MENSAJE_SIN_PERMISO_ADMIN, 403)
  }

  const dto = {
    nombre: validated.nombre,
    sucursalId: validated.sucursalId,
  }

  const { url, response } = await apiFetch('/api/departamentos', {
    method: 'POST',
    empresaId: empresa,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dto),
    missingAuthMessage: 'No hay sesión activa. Iniciá sesión para crear departamentos.',
    logLabel: 'Departamentos',
  })

  if (response.status === 403) {
    throw createApiError(MENSAJE_SIN_PERMISO_ADMIN, 403)
  }

  if (response.status === 400) {
    throw createApiError(await readErrorMessage(response, 'Los datos del departamento no son válidos.'), 400)
  }

  if (response.status === 404) {
    throw createApiError(await readErrorMessage(response, 'No se encontró la sucursal indicada.'), 404)
  }

  const conflictFallback = 'Ya existe un departamento con ese nombre en esa sucursal.'
  if (response.status === 409) {
    throw createApiError(await readErrorMessage(response, conflictFallback), 409)
  }

  if (!response.ok) {
    const serverMessage = await readErrorMessage(response, '')
    if (looksLikeDuplicateDepartamento(serverMessage)) {
      throw createApiError(conflictFallback, response.status)
    }
    console.error('Departamentos: alta HTTP no exitosa', { url, status: response.status })
    throw createApiError(
      serverMessage || `No se pudo crear el departamento (${response.status}).`,
      response.status,
    )
  }

  const created = mapDepartamento(await response.json())
  if (!created) {
    throw createApiError('La API creó el departamento pero devolvió una respuesta incompleta.', 500)
  }

  return created
}

export const DEPARTAMENTO_ELIMINACION_BLOQUEADA =
  'No se puede eliminar el departamento porque tiene empleados asignados. Reasigná esos empleados antes de eliminarlo.'

export const MENSAJE_ELIMINACION_GENERICO = 'No se pudo eliminar el departamento. Intentá nuevamente.'

function mensajeJson(payload) {
  const message = payload?.mensaje ?? payload?.Mensaje
  if (typeof message !== 'string') return ''
  const text = message.replace(/\s+/g, ' ').trim()
  if (!text || /^bad request$/i.test(text)) return ''
  return text
}

export function validateDepartamentoNombre(nombre) {
  const trimmed = normalizeDepartamentoNombre(nombre)
  if (!trimmed) return 'Ingresá el nombre del departamento.'
  if (trimmed.length > DEPARTAMENTO_NOMBRE_MAX) {
    return `El nombre no puede superar ${DEPARTAMENTO_NOMBRE_MAX} caracteres.`
  }
  return ''
}

async function readJsonBody(response) {
  try {
    return JSON.parse(await response.clone().text())
  } catch {
    return null
  }
}

/**
 * PUT /api/departamentos/{id}. Body: { nombre, sucursalId }. 204 No Content.
 * sucursalId es el original del departamento. La API todavía debe impedir
 * por sí misma un cambio de sucursal durante un renombrado; este cliente no reemplaza esa validación.
 * SuperAdmin y ADMIN. RRHH recibe 403.
 */
export async function updateDepartamento({ id, nombre, sucursalId, empresaId } = {}) {
  const departamentoId = parseId(id)
  const sucursalOriginalId = parseId(sucursalId)
  const error = validateDepartamentoNombre(nombre)
  if (!departamentoId) throw createApiError('No se encontró el departamento.', 404)
  if (!sucursalOriginalId) throw createApiError('No se encontró la sucursal del departamento.', 400)
  if (error) throw createApiError(error, 400)

  const empresa = parseId(empresaId) ?? getOperativeEmpresaId(getCurrentUser())
  if (!puedeCrearDepartamentos(getCurrentUser(), empresa)) {
    throw createApiError(MENSAJE_SIN_PERMISO_ADMIN, 403)
  }

  const { url, response } = await apiFetch(`/api/departamentos/${departamentoId}`, {
    method: 'PUT',
    empresaId: empresa,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      nombre: normalizeDepartamentoNombre(nombre),
      sucursalId: sucursalOriginalId,
    }),
    missingAuthMessage: 'No hay sesión activa. Iniciá sesión para editar departamentos.',
    logLabel: 'Departamentos',
  })

  if (response.status === 403) {
    throw createApiError(MENSAJE_SIN_PERMISO_ADMIN, 403)
  }
  if (response.status === 404) {
    throw createApiError('El departamento ya no existe.', 404)
  }
  if (response.status === 400) {
    throw createApiError(await readErrorMessage(response, 'Los datos del departamento no son válidos.'), 400)
  }
  if (response.status === 409) {
    throw createApiError(await readErrorMessage(response, 'Ya existe un departamento con ese nombre en la sucursal.'), 409)
  }
  if (response.status === 204) {
    return { id: departamentoId, nombre: normalizeDepartamentoNombre(nombre) }
  }
  if (!response.ok) {
    console.error('Departamentos: edición HTTP no exitosa', { url, status: response.status })
    throw createApiError(await readErrorMessage(response, `No se pudo editar el departamento (${response.status}).`), response.status)
  }

  const updated = mapDepartamento(await response.json())
  if (!updated) throw createApiError('La API editó el departamento pero devolvió una respuesta incompleta.', 500)
  return updated
}

/**
 * DELETE /api/departamentos/{id}. 204 si no hay empleados. 409 si hay asignaciones.
 */
export async function deleteDepartamento({ id, empresaId } = {}) {
  const departamentoId = parseId(id)
  if (!departamentoId) throw createApiError('No se encontró el departamento.', 404)

  const empresa = parseId(empresaId) ?? getOperativeEmpresaId(getCurrentUser())
  if (!puedeCrearDepartamentos(getCurrentUser(), empresa)) {
    throw createApiError(MENSAJE_SIN_PERMISO_ADMIN, 403)
  }

  const { url, response } = await apiFetch(`/api/departamentos/${departamentoId}`, {
    method: 'DELETE',
    empresaId: empresa,
    missingAuthMessage: 'No hay sesión activa. Iniciá sesión para eliminar departamentos.',
    logLabel: 'Departamentos',
  })

  if (response.status === 204) return

  const payload = await readJsonBody(response)
  const mensaje = mensajeJson(payload)

  if (response.status === 409) {
    throw createApiError(mensaje || DEPARTAMENTO_ELIMINACION_BLOQUEADA, 409)
  }

  if (response.status === 403) {
    throw createApiError(MENSAJE_SIN_PERMISO_ADMIN, 403)
  }
  if (response.status === 404) {
    throw createApiError('El departamento ya no existe o fue eliminado.', 404)
  }

  console.error('Departamentos: eliminación HTTP no exitosa', { url, status: response.status })
  throw createApiError(mensaje || MENSAJE_ELIMINACION_GENERICO, response.status)
}
