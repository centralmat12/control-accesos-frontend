import { EMPLEADO_DATA_FIELDS, normalizeFieldValue } from './empleado-data.js'

function isBlank(value) {
  return !String(value ?? '').trim()
}

export function empleadoFaltantes(empleado) {
  const missing = EMPLEADO_DATA_FIELDS
    .filter(({ key }) => isBlank(empleado?.[key]))
    .map(({ key, label }) => ({ key, label }))

  if (empleado?.tieneHuella === false) {
    missing.push({ key: 'tieneHuella', label: 'Huella enrolada' })
  }

  return missing
}

/**
 * Misma definición de “pendiente” que las alertas del Dashboard.
 * La huella solo se considera cuando la API devuelve false explícitamente.
 */
export function empleadoTienePendientes(empleado) {
  return empleadoFaltantes(empleado).length > 0
}

export function summarizeEmpleadoDatos(empleados) {
  const activos = Array.isArray(empleados) ? empleados : []
  const conPendientes = activos.filter(empleadoTienePendientes).length

  return {
    activos: activos.length,
    conPendientes,
    completos: activos.length - conPendientes,
  }
}

export function empleadoAlertLabel(empleado) {
  const name = [empleado.nombre, empleado.apellido]
    .map((part, index) => normalizeFieldValue(index === 0 ? 'nombre' : 'apellido', part))
    .filter(Boolean)
    .join(' ')
  if (name) return name

  const dni = String(empleado.dni ?? '').trim()
  if (dni) return `DNI ${dni}`

  const cuil = String(empleado.cuil ?? '').trim()
  if (cuil) return `CUIL ${cuil}`

  return 'Empleado sin nombre ni documento'
}

export function empleadoSearchHint(empleado) {
  const dni = String(empleado.dni ?? '').trim()
  if (dni) return dni

  const name = [empleado.nombre, empleado.apellido].map((part) => String(part ?? '').trim()).filter(Boolean).join(' ')
  if (name) return name

  return String(empleado.cuil ?? '').trim()
}

/**
 * Alertas a partir de GET /api/empleados (solo activos).
 * No consulta endpoints biométricos.
 */
export function buildEmpleadoAlertas(empleados) {
  const activos = Array.isArray(empleados) ? empleados : []
  const items = activos.flatMap((empleado, index) => {
    const missing = empleadoFaltantes(empleado)
    return missing.length > 0
      ? [{ id: empleado.id ?? index, empleado, missing }]
      : []
  })

  return {
    count: items.length,
    items,
  }
}
