import { empleadoTienePendientes } from './empleado-alerts.js'

function fullName(empleado) {
  return [empleado?.nombre, empleado?.apellido].filter(Boolean).join(' ')
}

export const EMPLEADO_SORT_KEYS = ['legajo', 'nombre', 'dni', 'departamento']

function compareText(a, b) {
  return String(a ?? '').localeCompare(String(b ?? ''), 'es', {
    numeric: true,
    sensitivity: 'base',
  })
}

function sortValue(empleado, key) {
  if (key === 'nombre') return fullName(empleado)
  return empleado?.[key]
}

export function matchesEmpleadoSearch(empleado, query) {
  if (!query) return true

  const haystack = [
    empleado.nombre,
    empleado.apellido,
    `${empleado.nombre ?? ''} ${empleado.apellido ?? ''}`,
    empleado.dni,
    empleado.legajo,
  ]
    .join(' ')
    .toLowerCase()

  return haystack.includes(query)
}

export function matchesCatalogFilter(empleado, key, selected) {
  if (selected === 'todos') return true
  return String(empleado?.[key] ?? '').trim() === selected
}

export function matchesEstadoDatos(empleado, estado) {
  if (estado === 'todos') return true
  const pendiente = empleadoTienePendientes(empleado)
  if (estado === 'pendientes') return pendiente
  if (estado === 'completo') return !pendiente
  return true
}

export function filterEmpleados(empleados, { query, departamento, sucursal, estado }) {
  const normalizedQuery = String(query ?? '')
    .trim()
    .toLowerCase()

  return empleados.filter(
    (empleado) =>
      matchesEmpleadoSearch(empleado, normalizedQuery) &&
      matchesCatalogFilter(empleado, 'departamento', departamento) &&
      matchesCatalogFilter(empleado, 'sucursal', sucursal) &&
      matchesEstadoDatos(empleado, estado),
  )
}

export function sortEmpleados(empleados, key, direction) {
  const sortKey = EMPLEADO_SORT_KEYS.includes(key) ? key : 'nombre'
  const dir = direction === 'desc' ? -1 : 1

  return [...empleados].sort((a, b) => dir * compareText(sortValue(a, sortKey), sortValue(b, sortKey)))
}
