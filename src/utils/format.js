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

export function toDateKey(value) {
  const date = value instanceof Date ? value : new Date(value)
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
