export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5052'

export const DEFAULT_EMPRESA_ID = Number(import.meta.env.VITE_EMPRESA_ID ?? 1)

export function apiUrl(path) {
  return `${API_BASE_URL}${path}`
}
