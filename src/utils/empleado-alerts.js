function isBlank(value) {
  return !String(value ?? '').trim()
}

function requiredIncomplete(empleado) {
  return ['nombre', 'apellido', 'dni', 'cuil'].some((key) => isBlank(empleado[key]))
}

function operationalIncomplete(empleado) {
  return isBlank(empleado.horario) || isBlank(empleado.departamento) || isBlank(empleado.sucursal)
}

/**
 * Misma definición de “pendiente” que las alertas del Dashboard.
 * No incluye categoría ni legajo. No usa huella.
 */
export function empleadoTienePendientes(empleado) {
  return requiredIncomplete(empleado) || operationalIncomplete(empleado)
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
  const name = [empleado.nombre, empleado.apellido].map((part) => String(part ?? '').trim()).filter(Boolean).join(' ')
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

function countPhrase(count) {
  return count === 1 ? '1 empleado' : `${count} empleados`
}

/**
 * Alertas a partir de GET /api/empleados (solo activos).
 * No usa huella ni fichadas.
 */
export function buildEmpleadoAlertas(empleados) {
  const activos = Array.isArray(empleados) ? empleados : []

  const operational = [
    {
      id: 'horario',
      employees: activos.filter((item) => isBlank(item.horario)),
      message: (count) => `${countPhrase(count)} sin horario asignado`,
    },
    {
      id: 'departamento',
      employees: activos.filter((item) => isBlank(item.departamento)),
      message: (count) => `${countPhrase(count)} sin departamento`,
    },
    {
      id: 'sucursal',
      employees: activos.filter((item) => isBlank(item.sucursal)),
      message: (count) => `${countPhrase(count)} sin sucursal`,
    },
  ]
    .filter((item) => item.employees.length > 0)
    .map((item) => ({
      id: item.id,
      kind: 'operational',
      text: item.message(item.employees.length),
      employees: item.employees,
    }))

  const incomplete = activos.filter(requiredIncomplete)
  const inconsistencies =
    incomplete.length > 0
      ? [
          {
            id: 'obligatorios',
            kind: 'inconsistency',
            text: `${countPhrase(incomplete.length)} con datos obligatorios incompletos`,
            employees: incomplete,
          },
        ]
      : []

  return {
    operational,
    inconsistencies,
    items: [...operational, ...inconsistencies],
  }
}
