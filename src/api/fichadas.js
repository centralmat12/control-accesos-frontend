import {
  isObservacionEndpointUnavailable,
  mapFichadaObservacionFromItem,
  mapObservacionHumana,
  OBSERVACION_UNAVAILABLE_MESSAGE,
  trimObservacionDetalle,
  validateObservacionForm,
} from '../utils/fichada-observacion.js'
import { pick } from '../utils/pick.js'
import { apiFetch, createApiError, readErrorMessage } from './http.js'

function mapFichada(item) {
  const nombre = pick(item, 'nombre', 'Nombre')
  const apellido = pick(item, 'apellido', 'Apellido')
  const empleado =
    pick(item, 'empleado', 'Empleado') ||
    [nombre, apellido].filter(Boolean).join(' ')

  return {
    id: pick(item, 'id', 'Id'),
    empleadoId: pick(item, 'empleadoId', 'EmpleadoId'),
    nombre,
    apellido,
    empleado,
    legajo: pick(item, 'legajo', 'Legajo'),
    fechaHora: pick(item, 'fechaHora', 'FechaHora'),
    tipo: pick(item, 'tipo', 'tipoMovimiento', 'Tipo', 'TipoMovimiento'),
    metodo: pick(item, 'metodo', 'metodoRegistro', 'Metodo', 'MetodoRegistro'),
    sucursalId: pick(item, 'sucursalId', 'SucursalId'),
    sucursal: pick(item, 'sucursal', 'Sucursal'),
    dispositivoId: pick(item, 'dispositivoId', 'DispositivoId'),
    dispositivo: pick(item, 'dispositivo', 'Dispositivo'),
    observacionHumana: mapFichadaObservacionFromItem(item),
  }
}

function normalizeFichadas(payload) {
  if (Array.isArray(payload)) return payload.map(mapFichada)
  if (Array.isArray(payload?.items)) return payload.items.map(mapFichada)
  if (Array.isArray(payload?.data)) return payload.data.map(mapFichada)
  return []
}

function buildQuery(filters = {}) {
  const params = new URLSearchParams()
  params.set('limite', String(filters.limite ?? FICHADAS_LIMITE))

  if (filters.empleadoId) params.set('empleadoId', String(filters.empleadoId))
  if (filters.desde) params.set('desde', filters.desde)
  if (filters.hasta) params.set('hasta', filters.hasta)
  if (filters.tipo) params.set('tipo', filters.tipo)
  if (filters.metodo) params.set('metodo', filters.metodo)

  return params.toString()
}

export const FICHADAS_LIMITE = 500

export async function getFichadas(filters = {}) {
  const query = buildQuery(filters)
  const { url, response } = await apiFetch(`/api/fichadas?${query}`, {
    missingAuthMessage: 'No hay sesión activa. Iniciá sesión para consultar fichadas.',
    logLabel: 'Fichadas',
  })

  if (!response.ok) {
    console.error('Fichadas: respuesta HTTP no exitosa', {
      url,
      status: response.status,
    })

    if (response.status === 403) {
      throw new Error('No tenés permiso para ver las fichadas.')
    }

    throw new Error(`No se pudieron cargar las fichadas (${response.status}).`)
  }

  const payload = await response.json()
  return normalizeFichadas(payload)
}

function observacionSavePath(id) {
  return `/api/fichadas/${encodeURIComponent(String(id))}/observacion`
}

export async function saveFichadaObservacion(fichadaId, { motivo, detalle } = {}) {
  const id = String(fichadaId ?? '').trim()
  if (!id) {
    throw createApiError('No se pudo identificar la fichada.', 400)
  }

  const validated = validateObservacionForm({ motivo, detalle })
  if (!validated.ok) {
    const message = validated.errors.motivo || validated.errors.detalle || 'Completá el motivo y el detalle.'
    throw createApiError(message, 400)
  }

  const { response } = await apiFetch(observacionSavePath(id), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      motivo: validated.value.motivo,
      detalle: trimObservacionDetalle(validated.value.detalle),
    }),
    missingAuthMessage: 'No hay sesión activa. Iniciá sesión para guardar la observación.',
    logLabel: 'Observación de fichada',
  })

  if (isObservacionEndpointUnavailable(response.status)) {
    const serverMessage = await readErrorMessage(response, '')
    const looksMissing =
      /no encontrada|not found|no existe/i.test(serverMessage) && response.status === 404
    throw createApiError(
      looksMissing ? 'No se encontró la fichada.' : OBSERVACION_UNAVAILABLE_MESSAGE,
      response.status,
    )
  }

  if (response.status === 403) {
    throw createApiError('No tenés permiso para guardar observaciones de fichadas.', 403)
  }

  if (response.status === 409) {
    throw createApiError(
      await readErrorMessage(response, 'No se pudo guardar la observación por un conflicto de datos.'),
      409,
    )
  }

  if (response.status === 400) {
    throw createApiError(
      await readErrorMessage(response, 'El motivo o el detalle de la observación no son válidos.'),
      400,
    )
  }

  if (!response.ok) {
    throw createApiError(
      await readErrorMessage(response, `No se pudo guardar la observación (${response.status}).`),
      response.status,
    )
  }

  let payload
  try {
    payload = await response.json()
  } catch {
    throw createApiError('La API devolvió una observación incompleta.', 500)
  }

  const mapped = mapObservacionHumana(payload, id)
  if (!mapped) {
    throw createApiError('La API devolvió una observación incompleta.', 500)
  }

  return mapped
}
