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
  let response

  try {
    response = await fetch(apiUrl(`/api/empleados/empresa/${empresaId}`))
  } catch {
    throw new Error('No se pudo conectar con la API.')
  }

  if (!response.ok) {
    throw new Error(`No se pudieron cargar los empleados (${response.status}).`)
  }

  const payload = await response.json()
  return normalizeEmpleados(payload)
}
