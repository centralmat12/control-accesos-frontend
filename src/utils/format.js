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

export function formatDashboardClock(value) {
  const date = parseApiLocalDate(value)
  if (!date) return ''
  return date.toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

export function formatDashboardLastUpdate(value, now = new Date()) {
  const date = parseApiLocalDate(value)
  if (!date) return 'Última actualización: sin datos'
  const time = formatDashboardClock(date)
  const dayLabel = toDateKey(date) === toDateKey(now) ? 'hoy' : formatDate(date)
  return `Última actualización: ${dayLabel}, ${time}`
}

export function formatFichadaHora(value) {
  const key = fichadaSortKey(value)
  const match = key.match(/T(\d{2}):(\d{2})/)
  return match ? `${match[1]}:${match[2]}` : ''
}

export function formatFichadaFecha(value) {
  const raw = String(value ?? '').trim()
  const key = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : fichadaDateKey(value)
  const match = key.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  return match ? `${match[3]}/${match[2]}/${match[1]}` : ''
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

/** Calendario de fichadas. No usa la zona del navegador. */
export const FICHADA_TIME_ZONE = 'America/Argentina/Buenos_Aires'

const FICHADA_ZONED_RE = /(?:Z|[+-]\d{2}:\d{2})$/i
const FICHADA_NAIVE_RE = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/

function zoneDateParts(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const read = (type) => parts.find((part) => part.type === type)?.value ?? ''
  return {
    year: read('year'),
    month: read('month'),
    day: read('day'),
    hour: read('hour'),
    minute: read('minute'),
    second: read('second'),
  }
}

/**
 * Fecha calendario de una fichada en America/Argentina/Buenos_Aires.
 * Un instante con zona se convierte. Un reloj sin zona se toma como hora local de esa zona.
 */
export function fichadaDateKey(value, timeZone = FICHADA_TIME_ZONE) {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return ''
    const parts = zoneDateParts(value, timeZone)
    return `${parts.year}-${parts.month}-${parts.day}`
  }

  const text = String(value ?? '').trim()
  if (!text) return ''

  if (FICHADA_ZONED_RE.test(text)) {
    const date = new Date(text)
    if (Number.isNaN(date.getTime())) return ''
    const parts = zoneDateParts(date, timeZone)
    return `${parts.year}-${parts.month}-${parts.day}`
  }

  const naive = text.match(FICHADA_NAIVE_RE)
  if (naive) return `${naive[1]}-${naive[2]}-${naive[3]}`

  const date = new Date(text)
  if (Number.isNaN(date.getTime())) return ''
  const parts = zoneDateParts(date, timeZone)
  return `${parts.year}-${parts.month}-${parts.day}`
}

/** Clave ordenable de reloj en la zona de fichadas. */
export function fichadaSortKey(value, timeZone = FICHADA_TIME_ZONE) {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return ''
    const parts = zoneDateParts(value, timeZone)
    return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`
  }

  const text = String(value ?? '').trim()
  if (!text) return ''

  if (FICHADA_ZONED_RE.test(text)) {
    const date = new Date(text)
    if (Number.isNaN(date.getTime())) return ''
    const parts = zoneDateParts(date, timeZone)
    return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`
  }

  const naive = text.match(FICHADA_NAIVE_RE)
  if (naive) {
    const second = naive[6] ?? '00'
    return `${naive[1]}-${naive[2]}-${naive[3]}T${naive[4]}:${naive[5]}:${second}`
  }

  const date = new Date(text)
  if (Number.isNaN(date.getTime())) return ''
  const parts = zoneDateParts(date, timeZone)
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`
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

export function esTipoIntermedio(tipo) {
  const value = normalizarFiltro(tipo)
  return value === 'movimiento intermedio' || value === 'intermedio'
}

export function displayTipoLabel(tipo) {
  if (esTipoEntrada(tipo)) return 'Entrada'
  if (esTipoSalida(tipo)) return 'Salida'
  if (esTipoIntermedio(tipo)) return 'Movimiento intermedio'
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
