import { apiUrl, HEALTH_READY_ENABLED } from '../config/api.js'
import { interpretHealthResponse } from '../utils/dashboard-sistema.js'

/**
 * Chequeo opcional. No forma parte de la API oficial (ControlFichajes.API main).
 * Desactivado por defecto: no provoca 404 en cada carga del Dashboard.
 */
export const HEALTH_READY_PATH = '/health/ready'

export function isHealthReadyEnabled() {
  return HEALTH_READY_ENABLED === true
}

/**
 * GET /health/ready sin apiFetch (anónimo). No usar si isHealthReadyEnabled() es false.
 */
export async function getHealthReady() {
  if (!isHealthReadyEnabled()) {
    return interpretHealthResponse({ skipped: true })
  }

  const url = apiUrl(HEALTH_READY_PATH)

  try {
    const response = await fetch(url, { method: 'GET' })
    const body = (await response.text()).trim()
    const contentType = String(response.headers.get('content-type') ?? '')

    return interpretHealthResponse({
      status: response.status,
      contentType,
      body,
      networkError: false,
    })
  } catch {
    return interpretHealthResponse({ networkError: true })
  }
}
