import { apiUrl } from '../config/api.js'
import { isSuperadmin } from '../config/roles.js'
import { logApiNetworkError, logApiResponse } from '../utils/activity-log.js'
import {
  AUTH_CAMBIAR_PASSWORD_PATH,
  getCurrentUser,
  getToken,
  notifyPasswordChangeRequired,
  notifyUnauthorized,
  PASSWORD_CHANGE_REQUIRED_API_MESSAGE,
  PASSWORD_CHANGE_REQUIRED_CODE,
  requiresPasswordChange,
  SESSION_EXPIRED_CATCH_MESSAGE,
} from './auth.js'
import { getEmpresaContexto } from './empresa-context.js'

export async function readErrorMessage(response, fallback) {
  const text = (await response.text()).trim()
  if (!text) return fallback

  try {
    const parsed = JSON.parse(text)
    if (typeof parsed === 'string' && parsed.trim()) return parsed.trim()
    if (parsed && typeof parsed === 'object') {
      const message = parsed.mensaje ?? parsed.message ?? parsed.title ?? parsed.detalle
      if (typeof message === 'string' && message.trim()) return message.trim()
    }
  } catch {
    return text
  }

  return text
}

export function createApiError(message, status, code) {
  const error = new Error(message)
  error.status = Number(status) || 0
  if (code) error.code = code
  return error
}

function isCambiarPasswordPath(path) {
  return String(path ?? '').split('?')[0].toLowerCase() === AUTH_CAMBIAR_PASSWORD_PATH.toLowerCase()
}

async function isPasswordChangeRequiredResponse(response) {
  if (requiresPasswordChange()) return true
  try {
    const message = await readErrorMessage(response.clone(), '')
    return message === PASSWORD_CHANGE_REQUIRED_API_MESSAGE
  } catch {
    return false
  }
}

function parseEmpresaId(value) {
  const id = Number(value)
  return Number.isFinite(id) && id > 0 ? id : null
}

/**
 * Petición autenticada a la API.
 * No agrega Content-Type: cada módulo define headers y body.
 *
 * Opciones propias (no se envían a fetch):
 * - missingAuthMessage: error si no hay token
 * - skipEmpresaContext: no enviar X-Empresa-Id (p. ej. listado global de empresas)
 * - empresaId: SuperAdmin — X-Empresa-Id explícito (detalle de empresa / sucursales).
 *   Ignorado para ADMIN/RRHH: el tenant sale del claim empresa_id.
 * - logLabel: prefijo de console.error en fallos de red (false = no loguear)
 */
export async function apiFetch(path, options = {}) {
  const { headers: extraHeaders, missingAuthMessage, logLabel, skipEmpresaContext, empresaId, ...fetchOptions } = options
  const token = getToken()

  if (!token) {
    throw new Error(missingAuthMessage ?? 'No hay sesión activa.')
  }

  const url = apiUrl(path)
  const method = String(fetchOptions.method || 'GET').toUpperCase()
  const headers = {
    Authorization: `Bearer ${token}`,
    ...extraHeaders,
  }

  const user = getCurrentUser()
  delete headers['X-Empresa-Id']
  delete headers['x-empresa-id']

  if (!skipEmpresaContext && isSuperadmin(user)) {
    const contextoId = parseEmpresaId(empresaId) ?? getEmpresaContexto()?.id
    if (contextoId) {
      headers['X-Empresa-Id'] = String(contextoId)
    }
  }

  let response

  try {
    response = await fetch(url, { ...fetchOptions, headers })
  } catch (error) {
    logApiNetworkError(method, path)
    if (logLabel !== false) {
      console.error(`${logLabel ?? 'API'}: error de red o CORS`, { url, error })
    }

    throw new Error(
      `No se pudo conectar con la API (${url}). Si el servidor responde, suele ser CORS o que el navegador no llega a esa URL.`,
    )
  }

  logApiResponse(method, path, response.status)

  if (response.status === 401) {
    notifyUnauthorized()
    throw createApiError(SESSION_EXPIRED_CATCH_MESSAGE, 401, 'UNAUTHORIZED')
  }

  if (response.status === 403 && !isCambiarPasswordPath(path)) {
    const restricted = await isPasswordChangeRequiredResponse(response)
    if (restricted) {
      notifyPasswordChangeRequired()
      throw createApiError(
        PASSWORD_CHANGE_REQUIRED_API_MESSAGE,
        403,
        PASSWORD_CHANGE_REQUIRED_CODE,
      )
    }
  }

  return { url, response }
}
