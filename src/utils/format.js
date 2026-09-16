const dateTimeFormatter = new Intl.DateTimeFormat('es-AR', {
  dateStyle: 'short',
  timeStyle: 'short',
})

const dateFormatter = new Intl.DateTimeFormat('es-AR', {
  dateStyle: 'short',
})

const timeFormatter = new Intl.DateTimeFormat('es-AR', {
  timeStyle: 'short',
})

/** True when the string already carries an explicit zone (`Z` or ±HH:MM). */
const EXPLICIT_ZONE_RE = /(?:Z|[+-]\d{2}:\d{2})$/i

/**
 * Temporary compatibility for API UTC timestamps that lost `Kind` after MySQL
 * and arrive without `Z` (e.g. `2026-09-15T22:30:00`).
 *
 * Only use for fields known to be written with `DateTime.UtcNow` (or equivalent).
 * Do NOT use for `fechaHora` of fichadas (agent local wall clock).
 * Not a permanent contract fix — prefer real UTC/`DateTimeOffset` on the API.
 */
export function parseApiUtcDate(value) {
  if (value == null || value === '') return null
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value
  }

  const normalized = String(value).trim()
  if (!normalized) return null

  const hasExplicitZone = EXPLICIT_ZONE_RE.test(normalized)
  const date = new Date(hasExplicitZone ? normalized : `${normalized}Z`)
  return Number.isNaN(date.getTime()) ? null : date
}

/**
 * Local / inherited wall-clock timestamps (notably fichada `fechaHora` from the
 * biometric agent). Must not append `Z` or shift by timezone offset.
 */
export function parseApiLocalDate(value) {
  if (value == null || value === '') return null
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value
  }

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export function formatDateTime(isoString) {
  const date = parseApiLocalDate(isoString)
  if (!date) return ''
  return dateTimeFormatter.format(date)
}

/** Formats confirmed API-UTC instants in the browser timezone. */
export function formatApiDateTime(value) {
  const date = parseApiUtcDate(value)
  if (!date) return ''
  return dateTimeFormatter.format(date)
}

export function formatDate(isoString) {
  const date = parseApiLocalDate(isoString)
  if (!date) return ''
  return dateFormatter.format(date)
}

export function formatTime(isoString) {
  const date = parseApiLocalDate(isoString)
  if (!date) return ''
  return timeFormatter.format(date)
}

export function formatClockTime(value = new Date()) {
  const date = parseApiLocalDate(value)
  if (!date) return ''

  return date.toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

export function toDateKey(value) {
  const date = parseApiLocalDate(value)
  if (!date) return ''
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function todayDateKey() {
  return toDateKey(new Date())
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

export function displayValue(value) {
  const text = String(value ?? '').trim()
  return text ? escapeHtml(text) : '—'
}

const HORARIO_RANGE = /^([01]\d|2[0-3]):([0-5]\d)-([01]\d|2[0-3]):([0-5]\d)$/

export function formatHorarioDisplay(horario) {
  const text = String(horario ?? '').trim()
  if (!text) return ''

  const match = text.match(HORARIO_RANGE)
  if (!match) return text

  return `${match[1]}:${match[2]} a ${match[3]}:${match[4]}`
}

export function normalizarFiltro(valor) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
}

export function esTipoEntrada(tipo) {
  return normalizarFiltro(tipo) === 'entrada'
}

export function esTipoSalida(tipo) {
  return normalizarFiltro(tipo) === 'salida'
}

export function esMetodoManual(metodo) {
  return normalizarFiltro(metodo) === 'manual'
}

export function esMetodoBiometrico(metodo) {
  return normalizarFiltro(metodo) === 'biometrico'
}

export function displayTipoLabel(tipo) {
  if (esTipoEntrada(tipo)) return 'Entrada'
  if (esTipoSalida(tipo)) return 'Salida'
  return String(tipo ?? '').trim()
}

export function displayMetodoLabel(metodo) {
  if (esMetodoManual(metodo)) return 'Manual'
  if (esMetodoBiometrico(metodo)) return 'Biométrico'
  return String(metodo ?? '').trim()
}

export function horarioPrevistoLabel(horario) {
  const text = String(horario ?? '').trim()
  if (!text) return 'No asignado'
  return formatHorarioDisplay(text)
}

export function uniqueCatalogValues(items, key) {
  const seen = new Map()

  items.forEach((item) => {
    const value = String(item?.[key] ?? '').trim()
    if (!value) return

    const normalized = value.toLowerCase()
    if (!seen.has(normalized)) seen.set(normalized, value)
  })

  return [...seen.values()].sort((a, b) => a.localeCompare(b, 'es'))
}
