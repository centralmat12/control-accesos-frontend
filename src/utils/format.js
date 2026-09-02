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

export function formatDateTime(isoString) {
  return dateTimeFormatter.format(new Date(isoString))
}

export function formatDate(isoString) {
  return dateFormatter.format(new Date(isoString))
}

export function formatTime(isoString) {
  return timeFormatter.format(new Date(isoString))
}

export function formatClockTime(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  return date.toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

export function toDateKey(value) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
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
