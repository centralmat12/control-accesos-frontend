const dateTimeFormatter = new Intl.DateTimeFormat('es-AR', {
  dateStyle: 'short',
  timeStyle: 'short',
})

export function formatDateTime(isoString) {
  return dateTimeFormatter.format(new Date(isoString))
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
