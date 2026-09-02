/**
 * Empleados — API real.
 *
 * Actualización: PATCH /api/empleados/{id} con EmpleadoPatchDto (campos opcionales).
 * No enviar id, empresaId, activo ni datos biométricos.
 *
 * Pendiente de backend:
 * - Reactivar empleado / listar inactivos (GET hoy solo devuelve Activo = true)
 * - Paginación en el listado
 * - Campo booleano `tieneHuella` (o equivalente) en el empleado, o un endpoint de estado
 *   de enrolamiento que NO devuelva templateBiometrico. El Dashboard no infiere huella
 *   ni muestra contador 0 hasta que exista ese dato.
 *
 * No usar GET /api/huellas/empresa/{id} (expone plantillas).
 * No usar POST /api/empleados/enrolar (solo el agente local).
 */
import { pick } from '../utils/pick.js'
import { apiFetch, readErrorMessage } from './http.js'

function mapEmpleado(item) {
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

async function request(path, options = {}) {
  const headers = { ...(options.headers ?? {}) }

  if (options.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json'
  }

  return apiFetch(path, {
    ...options,
    headers,
    missingAuthMessage: 'No hay sesión activa. Iniciá sesión para consultar empleados.',
    logLabel: 'Empleados',
  })
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

export async function patchEmpleado(id, dto) {
  if (!dto || Object.keys(dto).length === 0) {
    throw new Error('No hay cambios pendientes.')
  }

  const { url, response } = await request(`/api/empleados/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(dto),
  })

  if (response.status === 404) {
    throw new Error(await readErrorMessage(response, 'Empleado no encontrado o inactivo.'))
  }

  if (response.status === 403) {
    throw new Error('No tenés permiso para editar este empleado.')
  }

  if (response.status === 405) {
    throw new Error(
      'La API desplegada todavía no acepta PATCH de empleados. Hay que publicar la versión que incluye la actualización.',
    )
  }

  if (response.status === 400) {
    throw new Error(await readErrorMessage(response, 'Los datos del empleado no son válidos.'))
  }

  if (!response.ok) {
    console.error('Empleados: edición HTTP no exitosa', { url, status: response.status })
    throw new Error(await readErrorMessage(response, `No se pudo actualizar el empleado (${response.status}).`))
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
