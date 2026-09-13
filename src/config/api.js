const viteEnv = import.meta.env
export const API_BASE_URL = (viteEnv && viteEnv.VITE_API_BASE_URL) || ''

/**
 * La API oficial no expone /health/ready.
 * Solo se consulta si VITE_ENABLE_HEALTH_READY=true en una instalación que sí lo tenga.
 */
export const HEALTH_READY_ENABLED =
  String(viteEnv?.VITE_ENABLE_HEALTH_READY ?? '').trim().toLowerCase() === 'true'

export function apiUrl(path) {
  return `${API_BASE_URL}${path}`
}
