import { pick } from '../utils/pick.js'
import { getCurrentUser, getToken } from './auth.js'
import { getEmpresaContexto } from './empresa-context.js'
import { apiFetch } from './http.js'
import { isSuperadmin } from '../config/roles.js'

export const EMPRESAS_CATALOG_EVENT = 'ca:empresas-catalog'

export const EMPRESAS_CATALOG_STATUS = {
  idle: 'idle',
  loading: 'loading',
  ready: 'ready',
  empty: 'empty',
  error: 'error',
}

let catalogState = { status: EMPRESAS_CATALOG_STATUS.idle, message: '', statusCode: 0 }

export function getEmpresasCatalogState() {
  return catalogState
}

export function setEmpresasCatalogState({ status, message = '', statusCode = 0 }) {
  catalogState = {
    status,
    message: String(message ?? ''),
    statusCode: Number(statusCode) || 0,
  }
  window.dispatchEvent(new CustomEvent(EMPRESAS_CATALOG_EVENT, { detail: catalogState }))
}

function pickText(item, ...keys) {
  for (const key of keys) {
    const value = pick(item, key)
    if (value === undefined || value === null) continue
    const text = String(value).trim()
    if (text) return text
  }

  return ''
}

export function mapEmpresa(item) {
  const nombre = pickText(item, 'nombre', 'Nombre', 'nombreFantasia', 'NombreFantasia', 'razonSocial', 'RazonSocial')
  const direccion = pickText(item, 'direccion', 'Direccion', 'razonSocial', 'RazonSocial')
  const nombreFantasia = pickText(item, 'nombreFantasia', 'NombreFantasia') || nombre
  const razonSocial = pickText(item, 'razonSocial', 'RazonSocial') || direccion

  return {
    id: pick(item, 'id', 'Id'),
    nombre,
    cuit: pickText(item, 'cuit', 'CUIT', 'Cuit'),
    direccion,
    nombreFantasia,
    razonSocial,
  }
}

export function empresaDisplayName(empresa) {
  return String(empresa?.nombre || empresa?.nombreFantasia || empresa?.razonSocial || '').trim()
}

let displayNameCache = { key: '', nombre: '' }

function displayNameCacheKey(user = getCurrentUser()) {
  if (!user) return ''
  return `${user.email ?? ''}|${user.rol ?? ''}|${user.empresaId ?? ''}`
}

export function getCachedEmpresaNombre(user) {
  const key = displayNameCacheKey(user)
  if (!key || displayNameCache.key !== key) return ''
  return displayNameCache.nombre
}

function rememberEmpresaNombre(empresa, user) {
  const nombre = empresaDisplayName(empresa)
  const key = displayNameCacheKey(user)
  if (nombre && key) {
    displayNameCache = { key, nombre }
  }
  return nombre
}

function normalizeEmpresas(payload) {
  if (Array.isArray(payload)) return payload.map(mapEmpresa)
  if (payload && typeof payload === 'object') return [mapEmpresa(payload)]
  return []
}

function createStatusError(message, status) {
  const error = new Error(message)
  error.status = status
  return error
}

export async function getEmpresas() {
  const { url, response } = await apiFetch('/api/empresas', {
    skipEmpresaContext: true,
    missingAuthMessage: 'No hay sesión activa. Iniciá sesión para consultar empresas.',
    logLabel: 'Empresas',
  })

  if (response.status === 403) {
    throw createStatusError('No tenés permiso para ver las empresas.', 403)
  }

  if (!response.ok) {
    console.error('Empresas: respuesta HTTP no exitosa', { url, status: response.status })
    throw createStatusError(`No se pudieron cargar las empresas (${response.status}).`, response.status)
  }

  return normalizeEmpresas(await response.json()).filter((empresa) => Number(empresa.id) > 0)
}

export async function getEmpresaActual() {
  const user = getCurrentUser()

  if (isSuperadmin(user)) {
    return getEmpresaContexto()
  }

  if (!getToken()) return null

  try {
    const empresas = await getEmpresas()
    const actual = empresas[0] ?? null
    if (actual) rememberEmpresaNombre(actual, user)
    return actual
  } catch (error) {
    if (error.message === 'Sesión expirada o no autorizada.') {
      throw error
    }

    return null
  }
}
