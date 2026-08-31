import { apiUrl } from '../config/api.js'
import { getToken, logout } from './auth.js'

function notifyUnauthorized() {
  logout()
  window.dispatchEvent(new CustomEvent('ca:unauthorized'))
}

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

/**
 * Petición autenticada a la API.
 * No agrega Content-Type: cada módulo define headers y body.
 *
 * Opciones propias (no se envían a fetch):
 * - missingAuthMessage: error si no hay token
 * - logLabel: prefijo de console.error en fallos de red (false = no loguear)
 */
export async function apiFetch(path, options = {}) {
  const { headers: extraHeaders, missingAuthMessage, logLabel, ...fetchOptions } = options
  const token = getToken()

  if (!token) {
    throw new Error(missingAuthMessage ?? 'No hay sesión activa.')
  }

  const url = apiUrl(path)
  const headers = {
    Authorization: `Bearer ${token}`,
    ...extraHeaders,
  }

  let response

  try {
    response = await fetch(url, { ...fetchOptions, headers })
  } catch (error) {
    if (logLabel !== false) {
      console.error(`${logLabel ?? 'API'}: error de red o CORS`, { url, error })
    }

    throw new Error(
      `No se pudo conectar con la API (${url}). Si el servidor responde, suele ser CORS o que el navegador no llega a esa URL.`,
    )
  }

  if (response.status === 401) {
    notifyUnauthorized()
    throw new Error('Sesión expirada o no autorizada.')
  }

  return { url, response }
}
