const dateTimeFormatter = new Intl.DateTimeFormat('es-AR', {
  dateStyle: 'short',
  timeStyle: 'short',
})

export function formatDateTime(isoString) {
  return dateTimeFormatter.format(new Date(isoString))
}
