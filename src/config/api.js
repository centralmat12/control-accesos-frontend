const viteEnv = import.meta.env
export const API_BASE_URL = (viteEnv && viteEnv.VITE_API_BASE_URL) || ''

export function apiUrl(path) {
  return `${API_BASE_URL}${path}`
}
