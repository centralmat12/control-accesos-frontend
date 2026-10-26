import { apiFetch, createApiError, readErrorMessage } from './http.js'

function text(value) {
  const raw = String(value ?? '').trim()
  return raw || ''
}

export function mapTurnoDia(raw) {
  if (!raw || typeof raw !== 'object') return null
  const diaSemana = Number(raw.diaSemana ?? raw.DiaSemana)
  if (!Number.isInteger(diaSemana)) return null
  const horaEntrada = text(raw.horaEntrada ?? raw.HoraEntrada)
  const horaSalida = text(raw.horaSalida ?? raw.HoraSalida)
  const minutosAlmuerzo = Number(raw.minutosAlmuerzo ?? raw.MinutosAlmuerzo)
  return {
    diaSemana,
    horaEntrada,
    horaSalida,
    minutosAlmuerzo: Number.isFinite(minutosAlmuerzo) ? minutosAlmuerzo : null,
  }
}

export function mapTurno(raw) {
  if (!raw || typeof raw !== 'object') return null
  const id = Number(raw.id ?? raw.Id)
  const nombre = text(raw.nombre ?? raw.Nombre)
  if (!Number.isFinite(id) || id <= 0 || !nombre) return null
  const diasRaw = raw.dias ?? raw.Dias
  const dias = Array.isArray(diasRaw) ? diasRaw.map(mapTurnoDia).filter(Boolean) : []
  const tolerancia = Number(raw.toleranciaMinutos ?? raw.ToleranciaMinutos)
  return {
    id,
    nombre,
    toleranciaMinutos: Number.isFinite(tolerancia) ? tolerancia : null,
    dias,
  }
}

export function mapTurnoList(payload) {
  if (!Array.isArray(payload)) return []
  return payload.map(mapTurno).filter(Boolean)
}

export function buildTurnoBody({ nombre, toleranciaMinutos, dias }) {
  return {
    nombre: text(nombre),
    toleranciaMinutos: Number(toleranciaMinutos),
    dias: (dias ?? []).map((dia) => ({
      diaSemana: Number(dia.diaSemana),
      horaEntrada: text(dia.horaEntrada),
      horaSalida: text(dia.horaSalida),
      minutosAlmuerzo: Number(dia.minutosAlmuerzo ?? 60),
    })),
  }
}

async function parseList(response) {
  const payload = await response.json()
  return mapTurnoList(payload)
}

export async function getTurnos() {
  const { response } = await apiFetch('/api/Turnos', {
    missingAuthMessage: 'No hay sesión activa. Iniciá sesión para consultar turnos.',
    logLabel: 'Turnos',
  })
  if (!response.ok) {
    throw createApiError(await readErrorMessage(response, 'No se pudieron consultar los turnos.'), response.status)
  }
  return parseList(response)
}

export async function createTurno(body) {
  const { response } = await apiFetch('/api/Turnos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(buildTurnoBody(body)),
    logLabel: 'Turnos',
  })
  if (response.status === 403) throw createApiError('No tenés permiso para crear turnos.', 403)
  if (!response.ok) throw createApiError(await readErrorMessage(response, 'No se pudo crear el turno.'), response.status)
  return mapTurno(await response.json())
}

export async function updateTurno(id, body) {
  const { response } = await apiFetch(`/api/Turnos/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(buildTurnoBody(body)),
    logLabel: 'Turnos',
  })
  if (response.status === 403) throw createApiError('No tenés permiso para editar turnos.', 403)
  if (response.status === 409) throw createApiError(await readErrorMessage(response, 'El turno no se puede modificar.'), 409)
  if (!response.ok) throw createApiError(await readErrorMessage(response, 'No se pudo editar el turno.'), response.status)
  return true
}

export async function deleteTurno(id) {
  const { response } = await apiFetch(`/api/Turnos/${id}`, {
    method: 'DELETE',
    logLabel: 'Turnos',
  })
  if (response.status === 403) throw createApiError('No tenés permiso para eliminar turnos.', 403)
  if (response.status === 409) throw createApiError(await readErrorMessage(response, 'El turno tiene asignaciones y no se puede eliminar.'), 409)
  if (!response.ok) throw createApiError(await readErrorMessage(response, 'No se pudo eliminar el turno.'), response.status)
  return true
}
