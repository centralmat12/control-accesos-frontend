const MINUTE_MS = 60_000

export function parseContactDate(value) {
  if (value == null || value === '') return null
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date
}

export function elapsedMinutes(from, now = new Date()) {
  const start = parseContactDate(from)
  const current = parseContactDate(now)
  if (!start || !current) return null
  return (current.getTime() - start.getTime()) / MINUTE_MS
}

export function formatElapsedLabel(totalMinutes) {
  const minutes = Math.max(0, Math.floor(Number(totalMinutes) || 0))
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours <= 0) return minutes <= 1 ? '1 min' : `${minutes} min`
  if (rest === 0) return hours === 1 ? '1 h' : `${hours} h`
  return `${hours} h ${rest} min`
}
