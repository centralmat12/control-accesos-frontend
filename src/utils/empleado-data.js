export const DNI_MIN_LENGTH = 7
export const DNI_MAX_LENGTH = 8
export const CUIL_LENGTH = 11

export const LEGAJO_DIGITS_RE = /^\d+$/
export const LEGAJO_INVALID_MESSAGE =
  'Ingresá solamente números, sin letras, espacios ni guiones.'
export const LEGAJO_LIST_WARNING =
  'Legajo inválido: debe reemplazarse por un valor numérico'
export const LEGAJO_EDIT_ALERT =
  'El legajo actual no es válido. Reemplazalo por un valor compuesto únicamente por números antes de guardar.'
export const LEGAJO_LIST_DUPLICATE =
  'Legajo duplicado: también está asignado a otro empleado'
export const LEGAJO_EDIT_DUPLICATE_ALERT =
  'Este legajo está asignado a más de un empleado. Ingresá un legajo único antes de guardar.'
export const LEGAJO_CREATE_DUPLICATE =
  'El legajo ingresado ya está asignado a otro empleado.'
export const LEGAJO_API_CONFLICT =
  'No se pudo guardar: el legajo ya está asignado a otro empleado.'
export const LEGAJO_USE_SUGGESTED_LABEL = 'Usar sugerido'
export const LEGAJO_SUGGESTION_MIN_DIGITS = 4

export function suggestedLegajoLabel(value) {
  return `Legajo sugerido: ${value}`
}

/**
 * La detección de duplicados es preventiva y solo usa empleados en memoria.
 * No reemplaza una futura restricción única en API/base para (EmpresaId, Legajo).
 */

const PERSON_NAME = /^[\p{L}\p{M}]+(?:[ '\u2019-][\p{L}\p{M}]+)*$/u
const LETTER_WORDS = /^[\p{L}\p{M}]+(?: [\p{L}\p{M}]+)*$/u
const ALPHANUMERIC_WORDS = /^[\p{L}\p{M}\p{N}]+(?: [\p{L}\p{M}\p{N}]+)*$/u

const SPACE_FIELDS = new Set([
  'nombre',
  'apellido',
  'departamento',
  'categoria',
  'sucursal',
])

function text(value) {
  return String(value ?? '')
}

export function normalizeFieldValue(name, value) {
  const trimmed = text(value).trim()
  return SPACE_FIELDS.has(name) ? trimmed.replace(/\s+/g, ' ') : trimmed
}

export function normalizeEmpleadoValues(values) {
  return {
    ...values,
    legajo: normalizeFieldValue('legajo', values.legajo) || null,
    nombre: normalizeFieldValue('nombre', values.nombre),
    apellido: normalizeFieldValue('apellido', values.apellido),
    dni: normalizeFieldValue('dni', values.dni),
    cuil: normalizeFieldValue('cuil', values.cuil),
    departamento: normalizeFieldValue('departamento', values.departamento) || null,
    categoria: normalizeFieldValue('categoria', values.categoria) || null,
    sucursal: normalizeFieldValue('sucursal', values.sucursal) || null,
  }
}

export function normalizeLegajoValue(value) {
  if (value == null) return ''
  return String(value).trim()
}

export function isBlankLegajo(value) {
  return !normalizeLegajoValue(value)
}

export function isValidNumericLegajo(value) {
  return LEGAJO_DIGITS_RE.test(normalizeLegajoValue(value))
}

export function isInvalidHistoricalLegajo(value) {
  const normalized = normalizeLegajoValue(value)
  return Boolean(normalized) && !LEGAJO_DIGITS_RE.test(normalized)
}

export function validateLegajo(value) {
  const normalized = normalizeLegajoValue(value)
  if (!normalized) return ''
  if (!LEGAJO_DIGITS_RE.test(normalized)) return LEGAJO_INVALID_MESSAGE
  return ''
}

export function empleadoNombreCompleto(empleado) {
  return [empleado?.nombre, empleado?.apellido].filter(Boolean).join(' ').trim()
}

export function legajoDuplicateKey(value) {
  const normalized = normalizeLegajoValue(value)
  if (!normalized) return null
  return normalized.toLowerCase()
}

export function buildLegajoUsageIndex(empleados) {
  const index = new Map()
  for (const empleado of empleados ?? []) {
    const key = legajoDuplicateKey(empleado?.legajo)
    if (!key) continue
    const bucket = index.get(key)
    if (bucket) bucket.push(empleado)
    else index.set(key, [empleado])
  }
  return index
}

export function findDuplicateEmpleados(legajo, empleados, excludeId = null) {
  const key = legajoDuplicateKey(legajo)
  if (!key) return []
  const exclude = excludeId == null || excludeId === '' ? null : Number(excludeId)
  return (empleados ?? []).filter((empleado) => {
    if (legajoDuplicateKey(empleado?.legajo) !== key) return false
    if (exclude != null && Number.isFinite(exclude) && Number(empleado?.id) === exclude) return false
    return true
  })
}

export function inspectLegajo(value, { empleados = [], excludeId = null } = {}) {
  const formatError = validateLegajo(value)
  const others = findDuplicateEmpleados(value, empleados, excludeId)
  return {
    formatError,
    duplicate: others.length > 0,
    others,
    blocksSave: Boolean(formatError) || others.length > 0,
  }
}

function belongsToEmpresa(empleado, empresaId) {
  const scopeId = Number(empresaId)
  if (!Number.isFinite(scopeId) || scopeId <= 0) return true
  const empEmpresa = Number(empleado?.empresaId)
  if (!Number.isFinite(empEmpresa) || empEmpresa <= 0) return true
  return empEmpresa === scopeId
}

function parseNumericLegajo(raw) {
  const digits = String(raw).replace(/^0+(?=\d)/, '')
  try {
    return BigInt(digits)
  } catch {
    return null
  }
}

export function formatCorrelativeLegajo(value) {
  const text = String(value ?? '')
  if (!text) return ''
  return text.length >= LEGAJO_SUGGESTION_MIN_DIGITS ? text : text.padStart(LEGAJO_SUGGESTION_MIN_DIGITS, '0')
}

/**
 * Primer correlativo libre desde 1, con padding a 4 dígitos (`0001`).
 * Usa un Set numérico: `1`, `01`, `001` y `0001` ocupan el mismo valor.
 * No usa máximo + 1 si hay huecos. Ignora EMP-010, POLY-002 y no numéricos.
 * Incluye activos e inactivos. Si el catálogo no está disponible, no inventa un valor.
 */
export function getRecommendedLegajo(empleados, { empresaId, excludeId } = {}) {
  if (!Array.isArray(empleados)) return null

  const exclude = excludeId == null || excludeId === '' ? null : Number(excludeId)
  const used = new Set()
  for (const empleado of empleados) {
    if (exclude != null && Number.isFinite(exclude) && Number(empleado?.id) === exclude) continue
    if (!belongsToEmpresa(empleado, empresaId)) continue
    const raw = normalizeLegajoValue(empleado?.legajo)
    if (!LEGAJO_DIGITS_RE.test(raw)) continue
    const n = parseNumericLegajo(raw)
    if (n == null || n < 1n) continue
    used.add(n)
  }

  let next = 1n
  while (used.has(next)) next += 1n
  return formatCorrelativeLegajo(next)
}

export function shouldOfferRecommendedLegajo(value, { empleados = [], excludeId = null } = {}) {
  if (isBlankLegajo(value)) return true
  const inspection = inspectLegajo(value, { empleados, excludeId })
  return Boolean(inspection.formatError || inspection.duplicate)
}

export function listLegajoWarnings(empleado, empleados = []) {
  const warnings = []
  if (isInvalidHistoricalLegajo(empleado?.legajo)) {
    warnings.push({ kind: 'invalid', message: LEGAJO_LIST_WARNING })
  }
  const others = findDuplicateEmpleados(empleado?.legajo, empleados, empleado?.id)
  if (others.length > 0) {
    const otherName = empleadoNombreCompleto(others[0])
    warnings.push({
      kind: 'duplicate',
      message: otherName
        ? `Legajo duplicado: también asignado a ${otherName}`
        : LEGAJO_LIST_DUPLICATE,
    })
  }
  return warnings
}

export function validateDni(value) {
  const normalized = normalizeFieldValue('dni', value)
  if (!normalized) return 'Ingresá el DNI.'
  if (!new RegExp(`^\\d{${DNI_MIN_LENGTH},${DNI_MAX_LENGTH}}$`).test(normalized)) {
    return 'El DNI debe contener entre 7 y 8 números, sin puntos.'
  }
  return ''
}

export function validateCuil(value) {
  const normalized = normalizeFieldValue('cuil', value)
  if (!normalized) return 'Ingresá el CUIL.'
  if (!new RegExp(`^\\d{${CUIL_LENGTH}}$`).test(normalized)) {
    return 'El CUIL debe contener 11 dígitos.'
  }
  return ''
}

export function validatePersonName(value, label) {
  const normalized = normalizeFieldValue(label === 'Nombre' ? 'nombre' : 'apellido', value)
  if (!normalized) return `Ingresá el ${label.toLowerCase()}.`
  if (!PERSON_NAME.test(normalized)) {
    return `El ${label.toLowerCase()} solo admite letras y separadores propios de nombres.`
  }
  if (normalized.length > 50) return `El ${label.toLowerCase()} no puede superar 50 caracteres.`
  return ''
}

export function validateDepartamento(value) {
  const normalized = normalizeFieldValue('departamento', value)
  if (!normalized) return ''
  if (!LETTER_WORDS.test(normalized)) return 'El Departamento solo admite letras y espacios.'
  if (normalized.length > 50) return 'El departamento no puede superar 50 caracteres.'
  return ''
}

export function validateCategoria(value) {
  const normalized = normalizeFieldValue('categoria', value)
  if (!normalized) return ''
  if (!ALPHANUMERIC_WORDS.test(normalized)) {
    return 'La Categoría solo admite letras, números y espacios.'
  }
  if (normalized.length > 50) return 'La categoría no puede superar 50 caracteres.'
  return ''
}

export function validateSucursal(value) {
  const normalized = normalizeFieldValue('sucursal', value)
  if (!normalized) return ''
  if (!ALPHANUMERIC_WORDS.test(normalized)) {
    return 'La Sucursal solo admite letras, números y espacios.'
  }
  if (normalized.length > 50) return 'La sucursal no puede superar 50 caracteres.'
  return ''
}

const FIELD_VALIDATORS = {
  legajo: validateLegajo,
  nombre: (value) => validatePersonName(value, 'Nombre'),
  apellido: (value) => validatePersonName(value, 'Apellido'),
  dni: validateDni,
  cuil: validateCuil,
  departamento: validateDepartamento,
  categoria: validateCategoria,
  sucursal: validateSucursal,
}

export function validateEmpleadoValues(
  values,
  { initialValues, legacyValues = {}, empleados = [], excludeId = null } = {},
) {
  const normalized = normalizeEmpleadoValues(values)
  const normalizedInitial = initialValues ? normalizeEmpleadoValues(initialValues) : null
  const errors = {}

  Object.entries(FIELD_VALIDATORS).forEach(([name, validator]) => {
    if (name === 'departamento' || name === 'sucursal' || name === 'categoria') return
    const error = validator(normalized[name])
    const unchangedLegacyValue =
      ['departamento', 'categoria', 'sucursal'].includes(name) &&
      normalizedInitial &&
      normalized[name] === normalizedInitial[name]
    const acceptedCatalogValue = (legacyValues[name] ?? []).some(
      (value) => normalizeFieldValue(name, value) === normalized[name],
    )
    if (error && !unchangedLegacyValue && !acceptedCatalogValue) errors[name] = error
  })

  const inspection = inspectLegajo(normalized.legajo, { empleados, excludeId })
  if (inspection.duplicate) {
    errors.legajoDuplicado = LEGAJO_CREATE_DUPLICATE
  }

  if (values.horarioError) {
    errors.horario = values.horarioError
  } else if (values.horario && text(values.horario).length > 50) {
    errors.horario = 'El horario no puede superar 50 caracteres.'
  }

  return errors
}

export const EMPLEADO_DATA_FIELDS = [
  { key: 'legajo', label: 'Legajo' },
  { key: 'dni', label: 'DNI' },
  { key: 'cuil', label: 'CUIL' },
  { key: 'nombre', label: 'Nombre' },
  { key: 'apellido', label: 'Apellido' },
  { key: 'departamento', label: 'Departamento' },
  { key: 'sucursal', label: 'Sucursal' },
  { key: 'horario', label: 'Horario' },
]
