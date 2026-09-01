import { pick } from '../utils/pick.js'
import { apiFetch } from './http.js'

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
