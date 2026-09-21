import {
  EMPLEADO_DATA_FIELDS,
  empleadoNombreCompleto,
  findDuplicateEmpleados,
  isBlankLegajo,
  isInvalidHistoricalLegajo,
  normalizeFieldValue,
} from './empleado-data.js'

export const ATTENTION_HUELLA = 'No tiene huella biométrica enrolada.'
export const ATTENTION_LEGAJO_EMPTY = 'Falta completar el legajo.'
export const ATTENTION_LEGAJO_FORMAT = 'El legajo debe contener solamente números.'
export const ATTENTION_EMPTY_TITLE = 'Sin pendientes de empleados'
export const ATTENTION_EMPTY_DETAIL =
  'Los empleados activos no presentan datos que requieran revisión.'

const MISSING_FIELD_MESSAGES = {
  dni: 'Falta completar el DNI.',
  cuil: 'Falta completar el CUIL.',
  nombre: 'Falta completar el nombre.',
  apellido: 'Falta completar el apellido.',
  departamento: 'Falta asignar departamento.',
  sucursal: 'Falta asignar sucursal.',
  horario: 'Falta asignar horario.',
}

function isBlank(value) {
  return !String(value ?? '').trim()
}

function parseEmpleadoId(empleado) {
  const id = Number(empleado?.id)
  return Number.isFinite(id) && id > 0 ? id : null
}

export function empleadoEstaActivo(empleado) {
  return empleado?.activo !== false
}

export const ATTENTION_AGENT_ISSUE_KEYS = Object.freeze(['huella'])

export const DASHBOARD_REVIEW_EMPLEADO_LABEL = 'Revisar empleado'
export const DASHBOARD_CORRECT_DATOS_LABEL = 'Corregir datos'
export const DASHBOARD_ENROLL_HUELLA_LABEL = 'Cómo enrolar la huella'

export function isAgentAttentionIssue(issue) {
  return ATTENTION_AGENT_ISSUE_KEYS.includes(issue?.key)
}

export function isFrontendAttentionIssue(issue) {
  return Boolean(issue?.key) && !isAgentAttentionIssue(issue)
}

export function classifyEmployeeAttentionActions(issues) {
  const list = Array.isArray(issues) ? issues : []
  const hasAgent = list.some(isAgentAttentionIssue)
  const hasFrontend = list.some(isFrontendAttentionIssue)
  if (hasAgent && hasFrontend) return 'mixed'
  if (hasAgent) return 'agent'
  if (hasFrontend) return 'frontend'
  return 'none'
}

export function empleadoPerteneceAEmpresaActiva(empleado, empresaId) {
  const scope = Number(empresaId)
  if (!Number.isFinite(scope) || scope <= 0) return false
  const empEmpresa = Number(empleado?.empresaId)
  if (!Number.isFinite(empEmpresa) || empEmpresa <= 0) return true
  return empEmpresa === scope
}

export function attentionLegajoDuplicateMessage(others) {
  const names = (others ?? []).map((item) => empleadoNombreCompleto(item)).filter(Boolean)
  if (names.length === 0) return 'El legajo también está asignado a otro empleado.'
  return `El legajo también está asignado a ${names.join(', ')}.`
}

function pushUnique(issues, issue) {
  if (!issue?.key || issues.some((item) => item.key === issue.key)) return
  issues.push(issue)
}

export function empleadoAttentionIssues(empleado, empleados = []) {
  if (!empleadoEstaActivo(empleado)) return []

  const issues = []
  const catalog = Array.isArray(empleados) && empleados.length ? empleados : [empleado]

  if (empleado?.tieneHuella === false) {
    pushUnique(issues, {
      key: 'huella',
      kind: 'missing',
      tone: 'warning',
      message: ATTENTION_HUELLA,
    })
  }

  if (isBlankLegajo(empleado?.legajo)) {
    pushUnique(issues, {
      key: 'legajo-empty',
      kind: 'missing',
      tone: 'warning',
      message: ATTENTION_LEGAJO_EMPTY,
    })
  } else {
    if (isInvalidHistoricalLegajo(empleado.legajo)) {
      pushUnique(issues, {
        key: 'legajo-format',
        kind: 'error',
        tone: 'danger',
        message: ATTENTION_LEGAJO_FORMAT,
      })
    }
    const others = findDuplicateEmpleados(empleado.legajo, catalog, empleado.id)
    if (others.length > 0) {
      pushUnique(issues, {
        key: 'legajo-duplicate',
        kind: 'conflict',
        tone: 'danger',
        message: attentionLegajoDuplicateMessage(others),
      })
    }
  }

  EMPLEADO_DATA_FIELDS.forEach(({ key }) => {
    if (key === 'legajo') return
    if (!isBlank(empleado?.[key])) return
    const message = MISSING_FIELD_MESSAGES[key]
    if (!message) return
    pushUnique(issues, {
      key: `missing-${key}`,
      kind: 'missing',
      tone: 'warning',
      message,
    })
  })

  return issues
}

/**
 * Agrupa situaciones por empleado.id (nunca por nombre).
 * Solo empleados activos. Duplicados de legajo: preventivo sobre la lista recibida.
 */
export function buildEmployeeAttentionItems(empleados) {
  const activos = Array.isArray(empleados) ? empleados.filter(empleadoEstaActivo) : []
  const grouped = new Map()

  activos.forEach((empleado) => {
    const id = parseEmpleadoId(empleado)
    if (!id) return
    const issues = empleadoAttentionIssues(empleado, activos)
    if (!issues.length) return

    const current = grouped.get(id)
    if (!current) {
      grouped.set(id, { id, empleado, issues })
      return
    }
    issues.forEach((issue) => pushUnique(current.issues, issue))
  })

  return [...grouped.values()].map((group) => ({
    ...group,
    issues: sortAttentionIssues(group.issues),
  }))
}

export function empleadoFaltantes(empleado, empleados = []) {
  return empleadoAttentionIssues(empleado, empleados).map((issue) => ({
    key: issue.key,
    label: issue.message,
  }))
}

export function empleadoTienePendientes(empleado, empleados = []) {
  return empleadoAttentionIssues(empleado, empleados).length > 0
}

export function summarizeEmpleadoDatos(empleados) {
  const list = Array.isArray(empleados) ? empleados : []
  const activos = list.filter(empleadoEstaActivo)
  const conPendientes = activos.filter((empleado) => empleadoTienePendientes(empleado, activos)).length

  return {
    activos: activos.length,
    conPendientes,
    completos: activos.length - conPendientes,
  }
}

export function empleadoAlertLabel(empleado) {
  const name = empleadoNombreCompleto({
    nombre: normalizeFieldValue('nombre', empleado?.nombre),
    apellido: normalizeFieldValue('apellido', empleado?.apellido),
  })
  if (name) return name

  const dni = String(empleado?.dni ?? '').trim()
  if (dni) return `DNI ${dni}`

  const cuil = String(empleado?.cuil ?? '').trim()
  if (cuil) return `CUIL ${cuil}`

  return 'Empleado sin nombre ni documento'
}

export function empleadoAlertCopy(empleado, missing = []) {
  const name = empleadoAlertLabel(empleado)
  const faltantes = Array.isArray(missing) ? missing : []
  const sinHuella = faltantes.some(({ key }) => key === 'huella' || key === 'tieneHuella')
  const otros = faltantes.filter(({ key }) => key !== 'huella' && key !== 'tieneHuella')

  return {
    title: sinHuella ? `${name} no tiene huella biométrica enrolada` : name,
    detail: otros.length ? otros.map(({ label }) => label).join('\n') : '',
  }
}

export function empleadoSearchHint(empleado) {
  const dni = String(empleado.dni ?? '').trim()
  if (dni) return dni

  const name = [empleado.nombre, empleado.apellido].map((part) => String(part ?? '').trim()).filter(Boolean).join(' ')
  if (name) return name

  return String(empleado.cuil ?? '').trim()
}

export const ATTENTION_ISSUE_CATEGORY = {
  huella: 'Biometría',
  'legajo-empty': 'Legajo',
  'legajo-format': 'Legajo',
  'legajo-duplicate': 'Legajo',
  'missing-sucursal': 'Sucursal',
  'missing-departamento': 'Departamento',
  'missing-horario': 'Horario',
}

const ATTENTION_ISSUE_RANK = {
  huella: 1,
  'legajo-duplicate': 2,
  'legajo-format': 2,
  'legajo-empty': 2,
  'missing-sucursal': 3,
  'missing-departamento': 3,
  'missing-horario': 4,
}

export function attentionIssueCategory(issue) {
  return ATTENTION_ISSUE_CATEGORY[issue?.key] || 'Otros'
}

export function formatAttentionIssue(issue) {
  const message = String(issue?.message ?? '').trim()
  const category = attentionIssueCategory(issue)
  return message ? `${category} · ${message}` : category
}

export function sortAttentionIssues(issues) {
  return [...(Array.isArray(issues) ? issues : [])].sort((left, right) => {
    const leftRank = ATTENTION_ISSUE_RANK[left?.key] ?? 5
    const rightRank = ATTENTION_ISSUE_RANK[right?.key] ?? 5
    if (leftRank !== rightRank) return leftRank - rightRank
    return String(left?.key ?? '').localeCompare(String(right?.key ?? ''))
  })
}

export function pendientesBadgeLabel(count) {
  const n = Number(count) || 0
  return n === 1 ? '1 pendiente' : `${n} pendientes`
}

/**
 * Alertas operativas: solo empleados activos.
 * No consulta endpoints biométricos ni un GET por empleado.
 */
export function buildEmpleadoAlertas(empleados) {
  const items = buildEmployeeAttentionItems(empleados)
  return {
    count: items.length,
    pendingCount: items.reduce((total, item) => total + item.issues.length, 0),
    items,
  }
}
