import { apiFetch, createApiError, readErrorMessage } from './http.js'
import { diaLibreRequest, ETIQUETA_DIA_LIBRE } from '../utils/dia-libre.js'
import { formatMinutosInformados } from '../utils/labor-format.js'

function dateText(value) {
  const text = String(value ?? '')
  return text.length >= 10 ? text.slice(0, 10) : text
}

export function mapAsignacion(raw) {
  if (!raw || typeof raw !== 'object') return null
  const id = Number(raw.id ?? raw.Id)
  const turnoId = Number(raw.turnoId ?? raw.TurnoId)
  if (!Number.isFinite(id) || !Number.isFinite(turnoId)) return null
  return {
    id,
    turnoId,
    nombreTurno: String(raw.nombreTurno ?? raw.NombreTurno ?? '').trim(),
    fechaInicio: dateText(raw.fechaInicio ?? raw.FechaInicio),
    fechaFin: (raw.fechaFin ?? raw.FechaFin) ? dateText(raw.fechaFin ?? raw.FechaFin) : null,
  }
}

export function mapJornadaDia(raw) {
  if (!raw || typeof raw !== 'object') return null
  const fecha = dateText(raw.fecha ?? raw.Fecha)
  if (!fecha) return null
  return {
    fecha,
    tieneTurnoAsignado: Boolean(raw.tieneTurnoAsignado ?? raw.TieneTurnoAsignado),
    tieneHorarioConfigurado: Boolean(raw.tieneHorarioConfigurado ?? raw.TieneHorarioConfigurado),
    esDiaLibre: Boolean(raw.esDiaLibre ?? raw.EsDiaLibre),
    esExcepcionManual: Boolean(raw.esExcepcionManual ?? raw.EsExcepcionManual),
    toleranciaMinutos: Number(raw.toleranciaMinutos ?? raw.ToleranciaMinutos ?? 0),
    minutosAlmuerzo: Number(raw.minutosAlmuerzo ?? raw.MinutosAlmuerzo ?? 0),
    horaEntrada: raw.horaEntrada ?? raw.HoraEntrada ?? null,
    horaSalida: raw.horaSalida ?? raw.HoraSalida ?? null,
    minutosProgramados: Number(raw.minutosProgramados ?? raw.MinutosProgramados ?? 0),
  }
}

export function etiquetaDiaCalendario(dia) {
  if (!dia) return 'Sin jornada prevista'
  if (dia.esDiaLibre) return ETIQUETA_DIA_LIBRE
  if (!dia.tieneTurnoAsignado) return 'Sin jornada prevista'
  if (dia.esExcepcionManual) return 'Excepción'
  if (dia.tieneHorarioConfigurado) return 'Horario configurado'
  return 'Turno asignado'
}

function minutosInformados(value) {
  if (value == null || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

export function mapResumen(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const minutosProgramados = minutosInformados(raw.minutosProgramados ?? raw.MinutosProgramados)
  const actividadRegistrada = minutosInformados(raw.actividadRegistrada ?? raw.ActividadRegistrada)
  const minutosTrabajados = minutosInformados(raw.minutosTrabajados ?? raw.MinutosTrabajados)
  const minutosRepuestos = minutosInformados(raw.minutosRepuestos ?? raw.MinutosRepuestos)
  const saldoMinutos = minutosInformados(raw.saldoMinutos ?? raw.SaldoMinutos)
  const diasRaw = raw.dias ?? raw.Dias
  return {
    empleadoId: Number(raw.empleadoId ?? raw.EmpleadoId) || null,
    desde: dateText(raw.desde ?? raw.Desde),
    hasta: dateText(raw.hasta ?? raw.Hasta),
    minutosProgramados,
    actividadRegistrada,
    minutosTrabajados,
    minutosRepuestos,
    saldoMinutos,
    horasPrevistas: formatMinutosInformados(minutosProgramados),
    recuperacionesInformadas: formatMinutosInformados(minutosRepuestos),
    saldoPeriodo: formatMinutosInformados(saldoMinutos),
    dias: Array.isArray(diasRaw)
      ? diasRaw.map((dia) => ({
          fecha: dateText(dia.fecha ?? dia.Fecha),
          minutosProgramados: minutosInformados(dia.minutosProgramados ?? dia.MinutosProgramados),
          actividadRegistrada: minutosInformados(dia.actividadRegistrada ?? dia.ActividadRegistrada),
          minutosTrabajados: minutosInformados(dia.minutosTrabajados ?? dia.MinutosTrabajados),
          minutosTarde: minutosInformados(dia.minutosTarde ?? dia.MinutosTarde),
          minutosSaldo: minutosInformados(dia.minutosSaldo ?? dia.MinutosSaldo),
          incompleta: Boolean(dia.incompleta ?? dia.Incompleta),
        }))
      : [],
  }
}

export function mapReposicion(raw) {
  if (!raw || typeof raw !== 'object') return null
  return {
    id: Number(raw.id ?? raw.Id) || null,
    fecha: dateText(raw.fecha ?? raw.Fecha),
    minutos: Number(raw.minutos ?? raw.Minutos),
    detalle: String(raw.detalle ?? raw.Detalle ?? ''),
    creadoPor: String(raw.creadoPor ?? raw.CreadoPor ?? ''),
    creadoEn: raw.creadoEn ?? raw.CreadoEn ?? null,
  }
}

export function mapAlertaIncompleta(raw) {
  if (!raw || typeof raw !== 'object') return null
  const empleadoId = Number(raw.empleadoId ?? raw.EmpleadoId)
  if (!Number.isFinite(empleadoId)) return null
  const minutos = raw.minutosHastaCorte ?? raw.MinutosHastaCorte
  const legajo = String(raw.legajo ?? raw.Legajo ?? '').trim()
  return {
    fichadaId: Number(raw.fichadaId ?? raw.FichadaId ?? raw.id ?? raw.Id) || null,
    empleadoId,
    nombre: String(raw.nombre ?? raw.Nombre ?? '').trim(),
    apellido: String(raw.apellido ?? raw.Apellido ?? '').trim(),
    legajo,
    fechaHora: raw.fechaHora ?? raw.FechaHora ?? null,
    ultimaFechaHora: raw.ultimaFechaHora ?? raw.UltimaFechaHora ?? null,
    minutosHastaCorte: minutos == null || minutos === '' ? null : Number(minutos),
    esManual: raw.esManual === true ? true : raw.esManual === false ? false : undefined,
    mensaje: String(raw.mensaje ?? raw.Mensaje ?? '').trim(),
  }
}

function query(desde, hasta) {
  return `desde=${encodeURIComponent(desde)}&hasta=${encodeURIComponent(hasta)}`
}

async function getJson(path) {
  const { response } = await apiFetch(path, { logLabel: 'Jornadas' })
  if (response.status === 403) throw createApiError('No tenés permiso para consultar esta información.', 403)
  if (response.status === 404) throw createApiError('No se encontró la información solicitada.', 404)
  if (!response.ok) throw createApiError(await readErrorMessage(response, 'No se pudo consultar la jornada.'), response.status)
  return response.json()
}

export async function getAsignaciones(empleadoId) {
  const payload = await getJson(`/api/jornadas/empleados/${empleadoId}/asignaciones`)
  return Array.isArray(payload) ? payload.map(mapAsignacion).filter(Boolean) : []
}

export async function assignTurno(empleadoId, { turnoId, fechaInicio, fechaFin = null }) {
  const body = { turnoId: Number(turnoId), fechaInicio }
  if (fechaFin) body.fechaFin = fechaFin
  const { response } = await apiFetch(`/api/jornadas/empleados/${empleadoId}/asignaciones`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    logLabel: 'Jornadas',
  })
  if (response.status === 403) throw createApiError('No tenés permiso para asignar turnos.', 403)
  if (response.status === 409) throw createApiError(await readErrorMessage(response, 'La vigencia se superpone con otra asignación.'), 409)
  if (!response.ok) throw createApiError(await readErrorMessage(response, 'No se pudo asignar el turno.'), response.status)
  return mapAsignacion(await response.json())
}

export function calendarioFromPayload(payload) {
  if (!Array.isArray(payload)) {
    const error = createApiError('La respuesta del calendario no tiene el formato esperado.', 200)
    error.code = 'invalid-contract'
    throw error
  }
  return payload.map(mapJornadaDia).filter(Boolean)
}

export async function getCalendario(empleadoId, desde, hasta) {
  return calendarioFromPayload(await getJson(`/api/jornadas/empleados/${empleadoId}/calendario?${query(desde, hasta)}`))
}

export async function guardarDiaLibre(empleadoId, fecha) {
  const request = diaLibreRequest(empleadoId, fecha)
  const { response } = await apiFetch(request.path, {
    method: request.method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request.body),
    logLabel: 'Excepción de jornada',
  })
  if (response.status === 403) throw createApiError('No tenés permiso para registrar días libres.', 403)
  if (response.status === 404 || response.status === 405) {
    const error = createApiError('Funcionalidad aún en mantenimiento', response.status)
    error.code = 'maintenance'
    throw error
  }
  if (!response.ok) throw createApiError(await readErrorMessage(response, 'No se pudo registrar el día libre.'), response.status)
  return true
}

export async function getResumen(empleadoId, desde, hasta) {
  return mapResumen(await getJson(`/api/jornadas/empleados/${empleadoId}/resumen?${query(desde, hasta)}`))
}

export async function getReposiciones(empleadoId, desde, hasta) {
  const payload = await getJson(`/api/jornadas/empleados/${empleadoId}/reposiciones?${query(desde, hasta)}`)
  return Array.isArray(payload) ? payload.map(mapReposicion).filter(Boolean) : []
}

export async function getAlertasIncompletas() {
  const { response } = await apiFetch('/api/fichadas/alertas/incompletas?limite=500', { logLabel: 'Alertas' })
  if (response.status === 403) throw createApiError('No tenés permiso para ver las alertas de jornadas.', 403)
  if (response.status === 404 || response.status === 405) {
    const error = createApiError('Funcionalidad aún en mantenimiento', response.status)
    error.code = 'maintenance'
    throw error
  }
  if (!response.ok) throw createApiError(await readErrorMessage(response, 'No se pudieron consultar las alertas.'), response.status)
  const payload = await response.json()
  if (!Array.isArray(payload)) {
    const error = createApiError('La respuesta de alertas no tiene el formato esperado.', response.status)
    error.code = 'invalid-contract'
    throw error
  }
  return payload.map(mapAlertaIncompleta).filter(Boolean)
}
