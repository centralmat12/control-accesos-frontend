import { getToken, logout } from './auth.js'
import { apiUrl, DEFAULT_EMPRESA_ID } from '../config/api.js'

function pick(item, ...keys) {
  for (const key of keys) {
    if (item?.[key] !== undefined && item?.[key] !== null) {
      return item[key]
    }
  }

  return null
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

export async function getEmpleadosByEmpresa(empresaId = DEFAULT_EMPRESA_ID) {
  const token = getToken()

  if (!token) {
    throw new Error('No hay sesión activa. Iniciá sesión para consultar empleados.')
  }

  const empleadosUrl = apiUrl(`/api/empleados/empresa/${empresaId}`)
  let response

  try {
    response = await fetch(empleadosUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
  } catch (error) {
    console.error('Empleados: error de red o CORS', { url: empleadosUrl, error })
    throw new Error(
      `No se pudo conectar con la API (${empleadosUrl}). Si el servidor responde, suele ser CORS o que el navegador no llega a esa URL.`,
    )
  }

  if (response.status === 401) {
    logout()
    window.dispatchEvent(new CustomEvent('ca:unauthorized'))
    throw new Error('Sesión expirada o no autorizada.')
  }

  if (!response.ok) {
    console.error('Empleados: respuesta HTTP no exitosa', {
      url: empleadosUrl,
      status: response.status,
    })

    if (response.status === 403) {
      throw new Error('No tenés permiso para ver los empleados.')
    }

    throw new Error(`No se pudieron cargar los empleados (${response.status}).`)
  }

  const payload = await response.json()
  return normalizeEmpleados(payload)
}
