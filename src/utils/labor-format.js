/** Convierte minutos informados por la API. No aplica reglas laborales. */
export function formatMinutosInformados(value) {
  if (value == null || value === '') return null
  const number = Number(value)
  if (!Number.isFinite(number)) return null
  const sign = number < 0 ? '−' : ''
  const abs = Math.abs(Math.round(number))
  const hours = Math.floor(abs / 60)
  const minutes = abs % 60
  if (hours === 0) return `${sign}${minutes} min`
  if (minutes === 0) return `${sign}${hours} h`
  return `${sign}${hours} h ${String(minutes).padStart(2, '0')} min`
}

export function parseHora(value) {
  const match = String(value ?? '').trim().match(/^(\d{1,2}):(\d{2})/)
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours > 23 || minutes > 59) return null
  return hours * 60 + minutes
}

/** Diferencia de reloj entre dos horas del mismo día. No resta almuerzo. */
export function duracionReloj(entrada, salida) {
  const start = parseHora(entrada)
  const end = parseHora(salida)
  if (start == null || end == null || end <= start) return null
  return formatMinutosInformados(end - start)
}

export function horarioNocturnoNoSoportado(entrada, salida) {
  const start = parseHora(entrada)
  const end = parseHora(salida)
  return start != null && end != null && end <= start
}

export const NOCTURNO_PENDIENTE =
  'El horario nocturno se habilitará cuando el servicio acepte una salida del día siguiente. Hoy el servicio solo admite horarios que terminan el mismo día.'

export function monthBounds(year, monthIndex) {
  const month = String(monthIndex + 1).padStart(2, '0')
  const last = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate()
  return {
    desde: `${year}-${month}-01`,
    hasta: `${year}-${month}-${String(last).padStart(2, '0')}`,
  }
}

export function shiftMonth(year, monthIndex, delta) {
  const date = new Date(Date.UTC(year, monthIndex + delta, 1))
  return { year: date.getUTCFullYear(), monthIndex: date.getUTCMonth() }
}
