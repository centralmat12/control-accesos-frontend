import { apiFetch, createApiError, readErrorMessage } from './http.js'

function text(value) {
  const raw = String(value ?? '').trim()
  return raw || ''
}

function enteroPresente(value) {
  if (value == null || value === '' || typeof value === 'boolean') return null
  const number = Number(value)
  return Number.isInteger(number) ? number : null
}

export function mapTurnoDia(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const diaSemana = enteroPresente(raw.diaSemana ?? raw.DiaSemana)
  if (diaSemana == null || diaSemana < 0 || diaSemana > 6) return null
  const horaEntrada = text(raw.horaEntrada ?? raw.HoraEntrada)
  const horaSalida = text(raw.horaSalida ?? raw.HoraSalida)
  const minutosAlmuerzo = enteroPresente(raw.minutosAlmuerzo ?? raw.MinutosAlmuerzo)
  return {
    diaSemana,
    horaEntrada,
    horaSalida,
    minutosAlmuerzo: minutosAlmuerzo == null || minutosAlmuerzo < 0 ? null : minutosAlmuerzo,
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
  const cantidad = raw.cantidadEmpleadosAsignados ?? raw.CantidadEmpleadosAsignados
  const cantidadNumero = Number(cantidad)
  return {
    id,
    nombre,
    toleranciaMinutos: Number.isFinite(tolerancia) ? tolerancia : null,
    cantidadEmpleadosAsignados: cantidad == null || cantidad === '' || !Number.isInteger(cantidadNumero) || cantidadNumero < 0
      ? null
      : cantidadNumero,
    dias,
  }
}

export function mapTurnoEmpleado(raw) {
  if (!raw || typeof raw !== 'object') return null
  const empleadoId = Number(raw.empleadoId ?? raw.EmpleadoId)
  if (!Number.isInteger(empleadoId) || empleadoId <= 0) return null
  const fin = raw.fechaFin ?? raw.FechaFin
  const inicio = raw.fechaInicio ?? raw.FechaInicio
  return {
    empleadoId,
    nombreCompleto: String(raw.nombreCompleto ?? raw.NombreCompleto ?? '').trim(),
    legajo: String(raw.legajo ?? raw.Legajo ?? '').trim(),
    fechaInicio: String(inicio ?? '').slice(0, 10),
    fechaFin: fin ? String(fin).slice(0, 10) : null,
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

export async function consultarTurnoExistente(id) {
  const turnoId = Number(id)
  if (!Number.isInteger(turnoId) || turnoId <= 0) return 'ausente'
  try {
    const { response } = await apiFetch(`/api/Turnos/${turnoId}`, {
      missingAuthMessage: 'No hay sesión activa. Iniciá sesión para consultar turnos.',
      logLabel: 'Turnos',
    })
    if (response.status === 200) return 'existe'
    if (response.status === 404) return 'ausente'
    if (response.status === 403) return 'restringido'
    return 'temporal'
  } catch (error) {
    if (error?.status === 401) throw error
    if (error?.status === 403) return 'restringido'
    return 'temporal'
  }
}

export async function getTurnoEmpleados(id, fecha) {
  const query = fecha ? `?fecha=${encodeURIComponent(fecha)}` : ''
  const { response } = await apiFetch(`/api/Turnos/${id}/empleados${query}`, {
    missingAuthMessage: 'No hay sesión activa. Iniciá sesión para consultar los empleados del turno.',
    logLabel: 'Turnos',
  })
  if (response.status === 403) throw createApiError('Acceso restringido.', 403)
  if (response.status === 404) throw createApiError('La nómina del turno no está disponible.', 404, 'NOT_FOUND')
  if (response.status === 405) throw createApiError('La nómina del turno no está disponible.', 405, 'METHOD_NOT_ALLOWED')
  if (!response.ok) throw createApiError(await readErrorMessage(response, 'No se pudo consultar la nómina del turno.'), response.status)
  const payload = await response.json()
  if (!Array.isArray(payload)) throw createApiError('No se pudo consultar la nómina del turno.', 500)
  return payload.map(mapTurnoEmpleado).filter(Boolean)
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
