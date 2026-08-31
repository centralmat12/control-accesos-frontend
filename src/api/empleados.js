/**
 * Empleados — API real.
 *
 * Pendiente de backend (no implementar en este frontend hasta que existan):
 * - PUT/PATCH /api/empleados/{id} (edición)
 * - Reactivar empleado / listar inactivos (GET hoy solo devuelve Activo = true)
 * - Paginación en el listado
 * - Campo booleano `tieneHuella` en el empleado, o un endpoint de estado
 *   de enrolamiento que NO devuelva templateBiometrico
 *
 * No usar GET /api/huellas/empresa/{id} (expone plantillas).
 * No usar POST /api/empleados/enrolar (solo el agente local).
 */
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

export function mapEmpleado(item) {
  return {
    id: pick(item, 'id', 'Id'),
    empresaId: pick(item, 'empresaId', 'EmpresaId'),
    legajo: pick(item, 'legajo', 'Legajo'),
    dni: pick(item, 'dni', 'DNI', 'Dni'),
    cuil: pick(item, 'cuil', 'CUIL', 'Cuil'),
    nombre: pick(item, 'nombre', 'Nombre'),
    apellido: pick(item, 'apellido', 'Apellido'),
    departamento: pick(item, 'departamento', 'Departamento'),
    categoria: pick(item, 'categoria', 'Categoria'),
    sucursal: pick(item, 'sucursal', 'Sucursal'),
    horario: pick(item, 'horario', 'Horario'),
    activo: Boolean(pick(item, 'activo', 'Activo')),
  }
}

function normalizeEmpleados(payload) {
  if (Array.isArray(payload)) return payload.map(mapEmpleado)
  if (Array.isArray(payload?.items)) return payload.items.map(mapEmpleado)
  if (Array.isArray(payload?.data)) return payload.data.map(mapEmpleado)
  return []
}

function notifyUnauthorized() {
  logout()
  window.dispatchEvent(new CustomEvent('ca:unauthorized'))
}

async function readErrorMessage(response, fallback) {
  const text = (await response.text()).trim()
  if (!text) return fallback

  try {
    const parsed = JSON.parse(text)
    if (typeof parsed === 'string' && parsed.trim()) return parsed.trim()
    if (parsed && typeof parsed === 'object') {
      const message = parsed.mensaje ?? parsed.message ?? parsed.title ?? parsed.detalle
      if (typeof message === 'string' && message.trim()) return message.trim()
    }
  } catch {
    return text
  }

  return text
}

async function request(path, options = {}) {
  const token = getToken()

  if (!token) {
    throw new Error('No hay sesión activa. Iniciá sesión para consultar empleados.')
  }

  const url = apiUrl(path)
  const headers = {
    Authorization: `Bearer ${token}`,
    ...(options.headers ?? {}),
  }

  if (options.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json'
  }

  let response

  try {
    response = await fetch(url, { ...options, headers })
  } catch (error) {
    console.error('Empleados: error de red o CORS', { url, error })
    throw new Error(
      `No se pudo conectar con la API (${url}). Si el servidor responde, suele ser CORS o que el navegador no llega a esa URL.`,
    )
  }

  if (response.status === 401) {
    notifyUnauthorized()
    throw new Error('Sesión expirada o no autorizada.')
  }

  return { url, response }
}

export async function getEmpleados() {
  const { url, response } = await request('/api/empleados')

  if (!response.ok) {
    console.error('Empleados: respuesta HTTP no exitosa', { url, status: response.status })

    if (response.status === 403) {
      throw new Error('No tenés permiso para ver los empleados.')
    }

    throw new Error(await readErrorMessage(response, `No se pudieron cargar los empleados (${response.status}).`))
  }

  const payload = await response.json()
  return normalizeEmpleados(payload)
}

export async function getEmpleadoById(id) {
  const { url, response } = await request(`/api/empleados/${id}`)

  if (response.status === 404) {
    throw new Error(await readErrorMessage(response, 'Empleado no encontrado o inactivo.'))
  }

  if (response.status === 403) {
    throw new Error('No tenés permiso para ver este empleado.')
  }

  if (!response.ok) {
    console.error('Empleados: detalle HTTP no exitoso', { url, status: response.status })
    throw new Error(await readErrorMessage(response, `No se pudo cargar el empleado (${response.status}).`))
  }

  return mapEmpleado(await response.json())
}

export async function createEmpleado(dto) {
  const { url, response } = await request('/api/empleados', {
    method: 'POST',
    body: JSON.stringify(dto),
  })

  if (response.status === 403) {
    throw new Error('No tenés permiso para dar de alta empleados.')
  }

  if (response.status === 400) {
    throw new Error(await readErrorMessage(response, 'Los datos del empleado no son válidos.'))
  }

  if (!response.ok) {
    console.error('Empleados: alta HTTP no exitosa', { url, status: response.status })
    throw new Error(await readErrorMessage(response, `No se pudo crear el empleado (${response.status}).`))
  }

  return mapEmpleado(await response.json())
}

export async function deactivateEmpleado(id) {
  const { url, response } = await request(`/api/empleados/${id}`, {
    method: 'DELETE',
  })

  if (response.status === 404) {
    throw new Error(await readErrorMessage(response, 'Empleado no encontrado.'))
  }

  if (response.status === 403) {
    throw new Error('No tenés permiso para desactivar este empleado.')
  }

  if (!response.ok) {
    console.error('Empleados: baja HTTP no exitosa', { url, status: response.status })
    throw new Error(await readErrorMessage(response, `No se pudo desactivar el empleado (${response.status}).`))
  }
}
