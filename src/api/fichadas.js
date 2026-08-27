import { fichadas } from '../data/mock/fichadas.js'

/**
 * Capa de acceso a datos de Fichadas.
 * Hoy usa datos simulados; más adelante reemplazar el cuerpo por fetch a ASP.NET Core.
 */

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

export async function getFichadas() {
  // TODO: reemplazar por fetch(apiUrl('/api/fichadas/...'))
  return normalizeFichadas(structuredClone(fichadas))
}
