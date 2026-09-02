import { todayDateKey, toDateKey } from './format.js'

const LAST_DAYS = {
  7: 7,
  15: 15,
  30: 30,
  60: 60,
  90: 90,
}

export function addCalendarDays(dateKey, days) {
  const date = new Date(`${dateKey}T12:00:00`)
  date.setDate(date.getDate() + days)
  return toDateKey(date)
}

export function startOfDayIso(dateKey) {
  return `${dateKey}T00:00:00`
}

/** `hasta` en la API es exclusivo: el día inclusive se cubre enviando el inicio del día siguiente. */
export function exclusiveHastaIso(inclusiveDateKey) {
  return startOfDayIso(addCalendarDays(inclusiveDateKey, 1))
}

export function resolvePeriodRange(periodo, customDesde, customHasta) {
  const today = todayDateKey()

  if (!periodo || periodo === 'todos') {
    return {}
  }

  if (periodo === 'hoy') {
    return {
      desde: startOfDayIso(today),
      hasta: exclusiveHastaIso(today),
    }
  }

  const days = LAST_DAYS[periodo]
  if (days) {
    const from = addCalendarDays(today, -(days - 1))
    return {
      desde: startOfDayIso(from),
      hasta: exclusiveHastaIso(today),
    }
  }

  if (periodo === 'personalizado') {
    const range = {}
    if (customDesde) range.desde = startOfDayIso(customDesde)
    if (customHasta) range.hasta = exclusiveHastaIso(customHasta)
    return range
  }

  return {}
}

export function describePeriodo(periodo, customDesde, customHasta) {
  if (periodo === 'hoy') return 'Período: hoy'
  if (LAST_DAYS[periodo]) return `Período: últimos ${LAST_DAYS[periodo]} días`
  if (periodo === 'personalizado') {
    if (customDesde && customHasta) return `Período: ${customDesde} a ${customHasta}`
    if (customDesde) return `Desde: ${customDesde}`
    if (customHasta) return `Hasta: ${customHasta}`
    return 'Período: personalizado sin fechas'
  }
  return 'Período: sin filtro de fecha'
}
