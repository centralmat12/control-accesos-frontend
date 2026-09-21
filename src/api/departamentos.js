/**
 * Departamentos de la empresa operativa.
 *
 * GET /api/departamentos — scoped por EmpresaId del JWT / X-Empresa-Id.
 * La API no acepta sucursalId como query; cada ítem trae sucursalId y se filtra en el cliente.
 * POST /api/departamentos — modelo Departamento: nombre, sucursalId.
 * Autorización: [Authorize] (token_use=web) + PerteneceAUsuario(sucursal.EmpresaId).
 * SuperAdmin: X-Empresa-Id; ADMIN/RRHH: claim empresa_id. No hay policy SoloSuperadmin.
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
    throw createApiError('No tenés permiso para crear departamentos en esta empresa.', 403)
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
    throw createApiError('No tenés permiso para crear departamentos en esta sucursal.', 403)
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
