/**
 * Empleados — API real (ControlFichajes.API).
 *
 * GET /api/empleados (sin query o incluirInactivos=false) sigue devolviendo solo activos.
 * GET /api/empleados?incluirInactivos=true incluye inactivos de la empresa autorizada.
 * GET /api/empleados/{id} y PATCH /api/empleados/{id} siguen exigiendo Activo; un inactivo da 404.
 * DELETE /api/empleados/{id} es baja lógica (Activo = false).
 * POST /api/empleados/{id}/reactivar pone Activo = true. 409 si ya está activo.
 * EmpleadoPatchDto no incluye `activo`. El DTO de lectura incluye Activo.
 *
 * Actualización: PATCH /api/empleados/{id} con EmpleadoPatchDto (campos opcionales).
 * No enviar id, empresaId, activo ni datos biométricos.
 *
 * GET /api/empleados proyecta `tieneHuella` (bool). Solo se alerta
 * huella faltante cuando el valor es exactamente false.
 *
 * No usar GET /api/huellas/empresa/{id} (expone plantillas).
 * No usar POST /api/empleados/enrolar (solo el agente local).
 */
import { pick } from '../utils/pick.js'
import { apiFetch, readErrorMessage } from './http.js'

function pickOptionalBoolean(item, ...keys) {
  for (const key of keys) {
    if (item?.[key] === true || item?.[key] === false) return item[key]
  }
  return undefined
}

function pickId(item, ...keys) {
  const value = pick(item, ...keys)
  const id = Number(value)
  return Number.isFinite(id) && id > 0 ? id : null
}

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
    departamentoId: pickId(item, 'departamentoId', 'DepartamentoId'),
    categoria: pick(item, 'categoria', 'Categoria'),
    sucursal: pick(item, 'sucursal', 'Sucursal'),
    sucursalId: pickId(item, 'sucursalId', 'SucursalId'),
    horario: pick(item, 'horario', 'Horario'),
    tieneHuella: pickOptionalBoolean(item, 'tieneHuella', 'TieneHuella'),
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

export async function getEmpleados({ incluirInactivos = false } = {}) {
  const path = incluirInactivos === true ? '/api/empleados?incluirInactivos=true' : '/api/empleados'
  const { url, response } = await request(path)

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

export async function reactivateEmpleado(id) {
  const { url, response } = await request(`/api/empleados/${id}/reactivar`, {
    method: 'POST',
  })

  if (response.status === 404) {
    throw new Error(await readErrorMessage(response, 'Empleado no encontrado.'))
  }

  if (response.status === 403) {
    throw new Error('No tenés permiso para activar este empleado.')
  }

  if (response.status === 409) {
    throw new Error(await readErrorMessage(response, 'El empleado ya está activo.'))
  }

  if (!response.ok) {
    console.error('Empleados: reactivación HTTP no exitosa', { url, status: response.status })
    throw new Error(await readErrorMessage(response, `No se pudo activar el empleado (${response.status}).`))
  }
}
