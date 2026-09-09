/**
 * Validaciones de alta de empresa (solo frontend).
 *
 * El índice único de CUIT compara el string exacto. Los registros y pruebas
 * de la API usan el formato argentino con guiones: XX-XXXXXXXX-X.
 * El formulario pide 11 dígitos y envía ese formato para no duplicar por
 * “30123456789” vs “30-12345678-9”.
 *
 * Estas reglas no impiden que otro cliente invoque POST /api/empresas.
 * El backend debería aplicar después las mismas longitudes, el charset,
 * el dígito verificador y una comparación de CUIT normalizada.
 */
import { digitsOnly, isValidCuitChecksum } from '../components/form-field.js'

const NOMBRE_MIN = 2
const NOMBRE_MAX = 100
const RAZON_MIN = 3
const RAZON_MAX = 100
const CUIT_LENGTH = 11

const NOMBRE_ALLOWED = /^[\p{L}\p{N} .,&'()/+-]+$/u
const CONSECUTIVE_ALNUM = /([\p{L}\p{N}])\1{4,}/u

export function normalizeEmpresaText(value) {
  return String(value ?? '')
    .normalize('NFC')
    .trim()
    .replace(/\s+/g, ' ')
}

export function sanitizeCuitDigits(value) {
  return digitsOnly(value).slice(0, CUIT_LENGTH)
}

export function formatCuitForApi(value) {
  const digits = sanitizeCuitDigits(value)
  if (digits.length !== CUIT_LENGTH) return digits
  return `${digits.slice(0, 2)}-${digits.slice(2, 10)}-${digits.slice(10)}`
}

function countLetters(value) {
  return (String(value ?? '').match(/\p{L}/gu) || []).length
}

function isSingleRepeatedCharacter(value) {
  const compact = String(value ?? '').replaceAll(/\s+/g, '')
  if (compact.length < 2) return false
  const first = compact[0]
  return [...compact].every((char) => char === first)
}

function hasFiveConsecutiveAlphanumeric(value) {
  return CONSECUTIVE_ALNUM.test(String(value ?? ''))
}

export function validateNombreComercial(value) {
  const normalized = normalizeEmpresaText(value)
  if (!normalized) return 'Ingresá el nombre comercial.'
  if (normalized.length < NOMBRE_MIN || normalized.length > NOMBRE_MAX) {
    return `El nombre comercial debe tener entre ${NOMBRE_MIN} y ${NOMBRE_MAX} caracteres.`
  }
  if (countLetters(normalized) < 1) return 'El nombre comercial debe contener al menos una letra.'
  if (!NOMBRE_ALLOWED.test(normalized)) {
    return 'El nombre comercial solo admite letras, números, espacios y signos comerciales habituales.'
  }
  if (isSingleRepeatedCharacter(normalized)) {
    return 'El nombre comercial no puede estar formado por un único carácter repetido.'
  }
  if (hasFiveConsecutiveAlphanumeric(normalized)) {
    return 'El nombre comercial no puede repetir el mismo carácter cinco o más veces seguidas.'
  }
  return ''
}

export function validateRazonSocial(value) {
  const normalized = normalizeEmpresaText(value)
  if (!normalized) return 'Ingresá la razón social.'
  if (normalized.length < RAZON_MIN || normalized.length > RAZON_MAX) {
    return `La razón social debe tener entre ${RAZON_MIN} y ${RAZON_MAX} caracteres.`
  }
  if (countLetters(normalized) < 2) return 'La razón social debe contener al menos dos letras.'
  if (!NOMBRE_ALLOWED.test(normalized)) {
    return 'La razón social solo admite letras, números, espacios y signos legales habituales.'
  }
  if (isSingleRepeatedCharacter(normalized)) {
    return 'La razón social no puede estar formada por un único carácter repetido.'
  }
  if (hasFiveConsecutiveAlphanumeric(normalized)) {
    return 'La razón social no puede repetir el mismo carácter cinco o más veces seguidas.'
  }
  return ''
}

export function validateEmpresaCuit(value) {
  const raw = String(value ?? '')
  if (!raw.trim()) return 'Ingresá el CUIT.'
  if (/\D/.test(raw)) {
    return 'El CUIT solo admite números, sin puntos, espacios ni guiones.'
  }

  const digits = digitsOnly(raw)
  if (digits.length !== CUIT_LENGTH) return 'El CUIT debe tener exactamente 11 dígitos.'
  if (/^(\d)\1{10}$/.test(digits)) return 'El CUIT no puede estar formado por un solo dígito repetido.'
  if (!isValidCuitChecksum(digits)) return 'El dígito verificador del CUIT no es válido.'
  return ''
}

export function validateEmpresaAlta(values = {}) {
  return {
    nombreFantasia: validateNombreComercial(values.nombreFantasia),
    razonSocial: validateRazonSocial(values.razonSocial),
    cuit: validateEmpresaCuit(values.cuit),
  }
}

export function buildEmpresaAltaDto({ nombreFantasia, razonSocial, cuit }) {
  const nombre = normalizeEmpresaText(nombreFantasia)
  const razon = normalizeEmpresaText(razonSocial)
  const cuitDigits = digitsOnly(cuit)
  const errors = validateEmpresaAlta({
    nombreFantasia: nombre,
    razonSocial: razon,
    cuit: cuitDigits,
  })

  return {
    dto: {
      nombreFantasia: nombre,
      razonSocial: razon,
      cuit: errors.cuit ? cuitDigits : formatCuitForApi(cuitDigits),
    },
    errors,
    hasErrors: Object.values(errors).some(Boolean),
  }
}
