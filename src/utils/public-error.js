/**
 * Mensajes visibles al usuario. No reenvía SQL, stacks ni HTML del servidor.
 */
export const PUBLIC_ERROR_MAX = 180

export const INTERNAL_ERROR_PATTERN =
  /stack\s*trace|exception|inner exception|sqlstate|\bsql\b|select\s+.+\s+from|mysql|mariadb|npgsql|sqlite|connectionstring|connection string|at\s+\w+\.\w+|<\/?[a-z][\s\S]*>/i

export function sanitizePublicErrorMessage(message, fallback = 'No se pudo completar la operación.') {
  const text = String(message ?? '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!text) return fallback
  if (text.length > PUBLIC_ERROR_MAX) return fallback
  if (INTERNAL_ERROR_PATTERN.test(text)) return fallback
  return text
}
