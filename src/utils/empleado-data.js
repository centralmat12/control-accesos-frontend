export const DNI_MIN_LENGTH = 7
export const DNI_MAX_LENGTH = 8
export const CUIL_LENGTH = 11

const ALPHANUMERIC_BLOCK = /^[\p{L}\p{M}\p{N}]+(?:-[\p{L}\p{M}\p{N}]+)*$/u
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

export function validateLegajo(value) {
  const normalized = normalizeFieldValue('legajo', value)
  if (!normalized) return ''
  if (normalized.startsWith('-') || normalized.endsWith('-')) {
    return 'El legajo no puede comenzar o terminar con guion.'
  }
  if (!ALPHANUMERIC_BLOCK.test(normalized)) {
    return 'El legajo solo admite bloques de letras y números separados por un guion.'
  }
  if (normalized.length > 20) return 'El legajo no puede superar 20 caracteres.'
  return ''
}

export function validateDni(value) {
  const normalized = normalizeFieldValue('dni', value)
  if (!new RegExp(`^\\d{${DNI_MIN_LENGTH},${DNI_MAX_LENGTH}}$`).test(normalized)) {
    return 'El DNI debe contener entre 7 y 8 números.'
  }
  return ''
}

export function validateCuil(value) {
  const normalized = normalizeFieldValue('cuil', value)
  if (!new RegExp(`^\\d{${CUIL_LENGTH}}$`).test(normalized)) {
    return 'El CUIL debe contener exactamente 11 números.'
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

export function validateEmpleadoValues(values, { initialValues, legacyValues = {} } = {}) {
  const normalized = normalizeEmpleadoValues(values)
  const normalizedInitial = initialValues ? normalizeEmpleadoValues(initialValues) : null
  const errors = {}

  Object.entries(FIELD_VALIDATORS).forEach(([name, validator]) => {
    const error = validator(normalized[name])
    const unchangedLegacyValue =
      ['legajo', 'departamento', 'categoria', 'sucursal'].includes(name) &&
      normalizedInitial &&
      normalized[name] === normalizedInitial[name]
    const acceptedCatalogValue = (legacyValues[name] ?? []).some(
      (value) => normalizeFieldValue(name, value) === normalized[name],
    )
    if (error && !unchangedLegacyValue && !acceptedCatalogValue) errors[name] = error
  })

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
  { key: 'categoria', label: 'Categoría' },
  { key: 'sucursal', label: 'Sucursal' },
  { key: 'horario', label: 'Horario' },
]
