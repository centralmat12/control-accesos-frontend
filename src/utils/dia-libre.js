import { formatFichadaFecha } from './format.js'

export const ETIQUETA_DIA_LIBRE = 'Vacaciones / día libre'
export const DIA_LIBRE_EXITO = 'El período se registró correctamente como Vacaciones / día libre.'
export const DIA_LIBRE_LEYENDA = 'Durante ese período no se computarán horas programadas ni se esperarán fichadas. Esta acción no genera movimientos de entrada o salida. Verificá las fechas antes de confirmar.'

function isDateKey(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? ''))
  if (!match) return false
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const utc = new Date(Date.UTC(year, month - 1, day))
  return utc.getUTCFullYear() === year && utc.getUTCMonth() === month - 1 && utc.getUTCDate() === day
}

export function addUtcDays(dateKey, days) {
  const [year, month, day] = String(dateKey).split('-').map(Number)
  const utc = new Date(Date.UTC(year, month - 1, day + days))
  const text = (value) => String(value).padStart(2, '0')
  return `${utc.getUTCFullYear()}-${text(utc.getUTCMonth() + 1)}-${text(utc.getUTCDate())}`
}

export function inclusiveDateKeys(desde, hasta) {
  if (!isDateKey(desde) || !isDateKey(hasta) || hasta < desde) return []
  const dates = []
  let cursor = desde
  while (cursor <= hasta) {
    dates.push(cursor)
    const next = addUtcDays(cursor, 1)
    if (next <= cursor) break
    cursor = next
  }
  return dates
}

export function validateDiaLibreRange({ desde, hasta } = {}) {
  if (!isDateKey(desde)) return { ok: false, field: 'desde', message: 'La fecha desde es obligatoria.' }
  if (!isDateKey(hasta)) return { ok: false, field: 'hasta', message: 'La fecha hasta es obligatoria.' }
  if (hasta < desde) {
    return { ok: false, field: 'hasta', message: 'La fecha hasta no puede ser anterior a la fecha desde.' }
  }
  const fechas = inclusiveDateKeys(desde, hasta)
  return { ok: true, fechas, dias: fechas.length }
}

export function clasificarDiaLibre(dia) {
  if (dia?.esDiaLibre) return 'omitida'
  if (dia?.esExcepcionManual) return 'bloqueada'
  return 'registrar'
}

export function diaLibreRequest(empleadoId, fecha) {
  return {
    method: 'PUT',
    path: `/api/jornadas/empleados/${Number(empleadoId)}/dias/${fecha}`,
    body: { esDiaLibre: true },
  }
}

export async function registrarPeriodoDiaLibre({ fechas, readDias, writeDia, onProgress } = {}) {
  const unique = [...new Set((fechas || []).filter(Boolean))]
  const empty = {
    registradas: [],
    omitidas: [],
    bloqueadas: [],
    fallidas: [],
    maintenance: false,
    unauthorized: false,
    forbidden: false,
    invalidContract: false,
    message: '',
  }
  let dias
  try {
    dias = await readDias()
  } catch (error) {
    if (error?.status === 401) return { ...empty, unauthorized: true, message: error.message }
    if (error?.status === 403) return { ...empty, forbidden: true, message: error.message }
    if (error?.code === 'invalid-contract') return { ...empty, invalidContract: true, message: error.message }
    return {
      ...empty,
      fallidas: unique.map((fecha) => ({
        fecha,
        message: error?.message || 'No se pudo consultar el calendario.',
        status: error?.status || 0,
      })),
      message: error?.message || 'No se pudo consultar el calendario.',
    }
  }
  if (!Array.isArray(dias)) {
    return { ...empty, invalidContract: true, message: 'La respuesta del calendario no tiene el formato esperado.' }
  }

  const byFecha = new Map(dias.filter(Boolean).map((dia) => [String(dia.fecha).slice(0, 10), dia]))
  const registradas = []
  const omitidas = []
  const bloqueadas = []
  const pendientes = []
  for (const fecha of unique) {
    const decision = clasificarDiaLibre(byFecha.get(fecha))
    if (decision === 'omitida') omitidas.push(fecha)
    else if (decision === 'bloqueada') bloqueadas.push(fecha)
    else pendientes.push(fecha)
  }

  const fallidas = []
  let maintenance = false
  let unauthorized = false
  let forbidden = false
  for (let index = 0; index < pendientes.length; index += 1) {
    const fecha = pendientes[index]
    if (pendientes.length > 1) onProgress?.({ current: index + 1, total: pendientes.length, fecha })
    try {
      await writeDia(fecha)
      registradas.push(fecha)
    } catch (error) {
      const status = error?.status || 0
      fallidas.push({ fecha, message: error?.message || 'No se pudo registrar el día libre.', status })
      if (status === 401) {
        unauthorized = true
        break
      }
      if (status === 403) {
        forbidden = true
        break
      }
      if (error?.code === 'maintenance' || status === 404 || status === 405) {
        maintenance = true
        break
      }
    }
  }

  return { registradas, omitidas, bloqueadas, fallidas, maintenance, unauthorized, forbidden, invalidContract: false, message: '' }
}

export function periodoDiaLibreExitoso(result) {
  if (!result || result.invalidContract || result.unauthorized || result.forbidden || result.maintenance) return false
  if ((result.fallidas?.length ?? 0) > 0 || (result.bloqueadas?.length ?? 0) > 0) return false
  return (result.registradas?.length ?? 0) + (result.omitidas?.length ?? 0) > 0
}

export function mensajeExitoDiaLibre(result) {
  if (result?.omitidas?.length) return `${DIA_LIBRE_EXITO} Las fechas que ya estaban marcadas se mantuvieron.`
  return DIA_LIBRE_EXITO
}

export function describirResultadoDiaLibre(result) {
  const fmt = (list) => list.map((fecha) => formatFichadaFecha(fecha) || fecha).join(', ')
  const parts = []
  if (result?.registradas?.length) parts.push(`Fechas registradas: ${fmt(result.registradas)}.`)
  if (result?.omitidas?.length) parts.push(`Fechas omitidas por estar ya marcadas: ${fmt(result.omitidas)}.`)
  if (result?.bloqueadas?.length) parts.push(`Fechas con horario personalizado, sin cambios: ${fmt(result.bloqueadas)}.`)
  if (result?.fallidas?.length) {
    parts.push(`Fechas que fallaron: ${fmt(result.fallidas.map((item) => item.fecha || item))}.`)
  }
  return parts.join(' ')
}

export function fechasReintento(result) {
  if (!result || result.unauthorized || result.invalidContract || result.forbidden) return []
  if (result.maintenance && (result.registradas?.length ?? 0) === 0) return []
  return (result.fallidas || []).map((item) => item.fecha).filter(Boolean)
}

export function diaLibreConfirmModel({ empleado, desde, hasta, dias }) {
  const desdeTexto = formatFichadaFecha(desde) || desde
  const hastaTexto = formatFichadaFecha(hasta) || hasta
  return {
    title: 'Confirmar vacaciones / día libre',
    intro: `Se marcarán como Vacaciones / día libre los días del ${desdeTexto} al ${hastaTexto} para ${empleado}.`,
    rows: [
      { label: 'Empleado', value: empleado },
      { label: 'Fecha desde', value: desdeTexto },
      { label: 'Fecha hasta', value: hastaTexto },
      { label: 'Días calendario', value: String(dias) },
    ],
    legend: DIA_LIBRE_LEYENDA,
    cancel: 'Volver y corregir',
    confirm: 'Confirmar período',
  }
}
