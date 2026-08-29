export const API_BASE_URL = import.meta.env.DEV
  ? ''
  : (import.meta.env.VITE_API_BASE_URL || 'http://161.153.193.159:8080')

export const DEFAULT_EMPRESA_ID = Number(import.meta.env.VITE_EMPRESA_ID ?? 1)

export function apiUrl(path) {
  return `${API_BASE_URL}${path}`
}
