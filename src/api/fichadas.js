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

export const FICHADAS_LIMITE = 500

export async function getFichadas() {
  const { url, response } = await apiFetch(`/api/fichadas?limite=${FICHADAS_LIMITE}`, {
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
