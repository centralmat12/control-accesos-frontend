import { businessNow, fichadaSortKey, formatFichadaFecha } from './format.js'
import { DUPLICATE_WINDOW_MS, JORNADA_LIMITE_MS } from './movimientos.js'
import { normalizeObservacionMotivo, OBSERVACION_MOTIVOS, observacionMotivoLabel } from './fichada-observacion.js'

export const FUTURE_FICHADA_MESSAGE = 'No se puede registrar una fichada en una fecha u hora futura.'
export const SALIDA_ANTERIOR_MESSAGE = 'La salida tiene que ser posterior a la entrada.'
export const SALIDA_DUPLICADA_MESSAGE = 'La salida queda dentro de los 60 segundos de la entrada.'
export const SALIDA_LARGA_MESSAGE = 'La duración supera las 12 horas y la jornada quedará A revisar.'
export const ENTRADA_POSTERIOR_MESSAGE = 'La entrada tiene que ser anterior a la salida.'
export const ENTRADA_DUPLICADA_MESSAGE = 'La entrada queda dentro de los 60 segundos de la salida.'
export const TIPO_FICHADA_MESSAGE = 'Seleccioná si la fichada es Entrada o Salida.'

export function tryBeginSubmit(state) {
  if (!state || state.pending) return false
  state.pending = true
  return true
}

export function endSubmit(state) {
  if (state) state.pending = false
}

function isDateKey(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? ''))
  if (!match) return false
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const utc = new Date(Date.UTC(year, month - 1, day))
  return utc.getUTCFullYear() === year && utc.getUTCMonth() === month - 1 && utc.getUTCDate() === day
}

export function normalizeHora(value) {
  const match = String(value ?? '').trim().match(/^(\d{2}):(\d{2})(?::(\d{2}))?$/)
  if (!match) return ''
  const hour = Number(match[1])
  const minute = Number(match[2])
  const second = Number(match[3] ?? '0')
  if (hour > 23 || minute > 59 || second > 59) return ''
  return `${match[1]}:${match[2]}:${match[3] ?? '00'}`
}

export function limitesFichadaManual(fecha, now = new Date()) {
  const clock = businessNow(now)
  if (!clock) return { maxDate: '', maxTime: '' }
  return {
    maxDate: clock.dateKey,
    maxTime: fecha === clock.dateKey ? clock.timeKey : '',
  }
}

export function validateManualFichadaTime(input, now = new Date()) {
  const fecha = String(input?.fecha ?? '').slice(0, 10)
  const hora = normalizeHora(input?.hora)
  if (!isDateKey(fecha)) return { ok: false, message: 'Ingresá una fecha válida.', field: 'fecha' }
  if (!hora) return { ok: false, message: 'Ingresá una hora válida.', field: 'hora' }
  const clock = businessNow(now)
  if (!clock) return { ok: false, message: FUTURE_FICHADA_MESSAGE, field: 'fecha' }
  if (fecha > clock.dateKey) return { ok: false, message: FUTURE_FICHADA_MESSAGE, field: 'fecha' }
  if (fecha === clock.dateKey && hora > clock.timeKeyWithSeconds) {
    return { ok: false, message: FUTURE_FICHADA_MESSAGE, field: 'hora' }
  }
  return { ok: true }
}

function relojMs(value) {
  const key = fichadaSortKey(value)
  const match = String(key).match(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/)
  if (!match) return null
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5]), Number(match[6]))
}

export function validateSalidaContraEntrada(input, entradaFechaHora) {
  const hora = normalizeHora(input?.hora)
  if (!hora) return { ok: false, message: 'Ingresá una hora válida.', field: 'hora' }
  const salida = relojMs(`${String(input?.fecha ?? '').slice(0, 10)}T${hora}`)
  const entrada = relojMs(entradaFechaHora)
  if (salida == null || entrada == null) return { ok: false, message: SALIDA_ANTERIOR_MESSAGE, field: 'hora' }
  const diff = salida - entrada
  if (diff <= 0) return { ok: false, message: SALIDA_ANTERIOR_MESSAGE, field: 'hora' }
  if (diff <= DUPLICATE_WINDOW_MS) return { ok: false, message: SALIDA_DUPLICADA_MESSAGE, field: 'hora' }
  return { ok: true, warning: diff > JORNADA_LIMITE_MS ? SALIDA_LARGA_MESSAGE : '' }
}

export function validateEntradaContraSalida(input, salidaFechaHora) {
  const hora = normalizeHora(input?.hora)
  if (!hora) return { ok: false, message: 'Ingresá una hora válida.', field: 'hora' }
  const entrada = relojMs(`${String(input?.fecha ?? '').slice(0, 10)}T${hora}`)
  const salida = relojMs(salidaFechaHora)
  if (entrada == null || salida == null) return { ok: false, message: ENTRADA_POSTERIOR_MESSAGE, field: 'hora' }
  const diff = salida - entrada
  if (diff <= 0) return { ok: false, message: ENTRADA_POSTERIOR_MESSAGE, field: 'hora' }
  if (diff <= DUPLICATE_WINDOW_MS) return { ok: false, message: ENTRADA_DUPLICADA_MESSAGE, field: 'hora' }
  return { ok: true, warning: diff > JORNADA_LIMITE_MS ? SALIDA_LARGA_MESSAGE : '' }
}

export function validateFichadaContraMarca(input, marcaFechaHora) {
  const tipo = String(input?.tipo ?? '').trim()
  if (tipo !== 'Entrada' && tipo !== 'Salida') return { ok: false, message: TIPO_FICHADA_MESSAGE, field: 'tipo' }
  if (tipo === 'Entrada') return validateEntradaContraSalida(input, marcaFechaHora)
  return validateSalidaContraEntrada(input, marcaFechaHora)
}

export function sameManualFichada(left, right) {
  if (!left || !right) return false
  return String(left.empleadoId) === String(right.empleadoId)
    && String(left.fecha ?? '') === String(right.fecha ?? '')
    && normalizeHora(left.hora).slice(0, 5) === normalizeHora(right.hora).slice(0, 5)
    && String(left.tipo ?? '') === String(right.tipo ?? '')
    && String(left.motivo ?? '') === String(right.motivo ?? '')
    && String(left.detalle ?? '').trim() === String(right.detalle ?? '').trim()
}

export async function commitManualFichada(input, { now = new Date(), confirmed = null, create, submitState = null, extraCheck = null } = {}) {
  if (submitState?.pending) {
    const error = new Error('La fichada ya se está registrando.')
    error.code = 'duplicate-submit'
    throw error
  }
  if (submitState) submitState.pending = true
  try {
    const check = validateManualFichadaTime(input, now)
    if (!check.ok) {
      const error = new Error(check.message)
      error.code = check.message === FUTURE_FICHADA_MESSAGE ? 'future-fichada' : 'invalid-fichada'
      error.field = check.field
      throw error
    }
    if (extraCheck) {
      const extra = extraCheck(input)
      if (!extra?.ok) {
        const error = new Error(extra?.message || 'La fichada no es válida.')
        error.field = extra?.field || 'hora'
        throw error
      }
    }
    if (confirmed && !sameManualFichada(input, confirmed)) {
      const error = new Error('Los datos de la fichada cambiaron. Volvé a confirmarlos.')
      error.code = 'stale-fichada'
      throw error
    }
    return await create(input)
  } finally {
    if (submitState) submitState.pending = false
  }
}

export function motivoUnicoEquivalente(text, motivos = OBSERVACION_MOTIVOS) {
  const raw = String(text ?? '').trim()
  if (!raw) return ''
  const folded = raw.toLowerCase()
  const hits = new Set(
    motivos
      .filter((item) => item.value.toLowerCase() === folded || item.label.toLowerCase() === folded)
      .map((item) => item.value),
  )
  const normalized = normalizeObservacionMotivo(raw)
  if (normalized && motivos.some((item) => item.value === normalized)) hits.add(normalized)
  return hits.size === 1 ? [...hits][0] : ''
}

export function salidaManualConfirmModel({ empleado, entrada, fecha, hora, motivo, detalle, warning = '' }) {
  const observacion = String(detalle ?? '').trim()
  return {
    title: 'Confirmar salida manual',
    intro: `Vas a registrar manualmente una Salida para ${empleado}.`,
    rows: [
      { label: 'Empleado', value: String(empleado ?? '') },
      { label: 'Entrada existente', value: String(entrada ?? '') },
      { label: 'Salida manual', value: normalizeHora(hora).slice(0, 5) },
      { label: 'Fecha', value: formatFichadaFecha(fecha) || String(fecha ?? '') },
      { label: 'Motivo', value: observacionMotivoLabel(motivo) || String(motivo ?? '') },
      { label: 'Observación', value: observacion || 'Sin observación' },
    ],
    warning: String(warning ?? ''),
    legend: 'Esta salida quedará identificada como manual y registrada para auditoría. Verificá los datos antes de confirmar.',
    cancel: 'Volver y corregir',
    confirm: 'Confirmar salida manual',
  }
}

export function entradaManualConfirmModel({ empleado, salida, fecha, hora, motivo, detalle, warning = '' }) {
  const observacion = String(detalle ?? '').trim()
  return {
    title: 'Confirmar entrada manual',
    intro: `Vas a registrar manualmente una Entrada para ${empleado}.`,
    rows: [
      { label: 'Empleado', value: String(empleado ?? '') },
      { label: 'Salida existente', value: String(salida ?? '') },
      { label: 'Entrada manual', value: normalizeHora(hora).slice(0, 5) },
      { label: 'Fecha', value: formatFichadaFecha(fecha) || String(fecha ?? '') },
      { label: 'Motivo', value: observacionMotivoLabel(motivo) || String(motivo ?? '') },
      { label: 'Observación', value: observacion || 'Sin observación' },
    ],
    warning: String(warning ?? ''),
    legend: 'Esta entrada quedará identificada como manual y registrada para auditoría. Verificá los datos antes de confirmar.',
    cancel: 'Volver y corregir',
    confirm: 'Confirmar entrada manual',
  }
}

export function manualConfirmModel({ tipo, empleado, fecha, hora, motivo, detalle }) {
  const observacion = String(detalle ?? '').trim()
  return {
    title: 'Confirmar fichada manual',
    intro: `Vas a registrar manualmente una ${tipo} para ${empleado}.`,
    rows: [
      { label: 'Fecha', value: formatFichadaFecha(fecha) || String(fecha ?? '') },
      { label: 'Hora', value: normalizeHora(hora).slice(0, 5) },
      { label: 'Tipo', value: String(tipo ?? '') },
      { label: 'Motivo', value: observacionMotivoLabel(motivo) || String(motivo ?? '') },
      { label: 'Observación', value: observacion || 'Sin observación' },
    ],
    legend: 'Esta fichada quedará identificada como manual y registrada para auditoría. Verificá los datos antes de continuar.',
    cancel: 'Volver y corregir',
    confirm: 'Confirmar fichada',
  }
}
