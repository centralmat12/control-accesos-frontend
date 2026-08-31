import { getToken, logout } from './auth.js'
import { apiUrl } from '../config/api.js'

function pick(item, ...keys) {
  for (const key of keys) {
    if (item?.[key] !== undefined && item?.[key] !== null) {
      return item[key]
    }
  }

  return null
}

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
  const token = getToken()

  if (!token) {
    throw new Error('No hay sesión activa. Iniciá sesión para consultar fichadas.')
  }

  const fichadasUrl = apiUrl(`/api/fichadas?limite=${FICHADAS_LIMITE}`)
  let response

  try {
    response = await fetch(fichadasUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
  } catch (error) {
    console.error('Fichadas: error de red o CORS', { url: fichadasUrl, error })
    throw new Error(
      `No se pudo conectar con la API (${fichadasUrl}). Si el servidor responde, suele ser CORS o que el navegador no llega a esa URL.`,
    )
  }

  if (response.status === 401) {
    logout()
    window.dispatchEvent(new CustomEvent('ca:unauthorized'))
    throw new Error('Sesión expirada o no autorizada.')
  }

  if (!response.ok) {
    console.error('Fichadas: respuesta HTTP no exitosa', {
      url: fichadasUrl,
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
