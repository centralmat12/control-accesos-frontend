import { isAdmin, isRrhh, isSuperadmin } from '../config/roles.js'
import { displayTipoLabel, esTipoIntermedio, formatDate, formatFichadaHora, formatTime } from './format.js'
import { pick } from './pick.js'

export const OBSERVACION_DETALLE_MAX = 500

export const OBSERVACION_UNAVAILABLE_MESSAGE =
  'No se pudo guardar la observación. La función todavía no está disponible en el servidor.'

export const OBSERVACION_SAVED_MESSAGE = 'Observación guardada correctamente.'

export const OBSERVACION_HELP_TEXT =
  'Registrá información relevante sobre este movimiento para facilitar su seguimiento y auditoría.'

export const OBSERVACION_DETALLE_PLACEHOLDER =
  'Ejemplo: El empleado informó una demora por un turno médico.'

/** Códigos enviados a PATCH /api/fichadas/{id}/observacion. */
export const OBSERVACION_MOTIVOS = Object.freeze([
  { value: 'LlegadaTarde', label: 'Llegada tarde' },
  { value: 'SalidaAnticipada', label: 'Salida anticipada' },
  { value: 'OlvidoDeFichaje', label: 'Olvido de fichaje' },
  { value: 'FichajeIncorrecto', label: 'Fichaje incorrecto' },
  { value: 'AusenciaJustificada', label: 'Ausencia justificada' },
  { value: 'HorarioExcepcional', label: 'Horario excepcional' },
  { value: 'Otro', label: 'Otro' },
])

const MOTIVO_BY_VALUE = new Map(OBSERVACION_MOTIVOS.map((item) => [item.value, item.label]))

const MOTIVO_ALIASES = Object.freeze({
  llegadatarde: 'LlegadaTarde',
  llegada_tarde: 'LlegadaTarde',
  'llegada tarde': 'LlegadaTarde',
  salidaanticipada: 'SalidaAnticipada',
  salida_anticipada: 'SalidaAnticipada',
  'salida anticipada': 'SalidaAnticipada',
  olvidodefichaje: 'OlvidoDeFichaje',
  olvido_de_fichaje: 'OlvidoDeFichaje',
  'olvido de fichaje': 'OlvidoDeFichaje',
  fichajeincorrecto: 'FichajeIncorrecto',
  fichaje_incorrecto: 'FichajeIncorrecto',
  'fichaje incorrecto': 'FichajeIncorrecto',
  ausencijustificada: 'AusenciaJustificada',
  ausencajustificada: 'AusenciaJustificada',
  ausencia_justificada: 'AusenciaJustificada',
  'ausencia justificada': 'AusenciaJustificada',
  horarioexcepcional: 'HorarioExcepcional',
  horario_excepcional: 'HorarioExcepcional',
  'horario excepcional': 'HorarioExcepcional',
  otro: 'Otro',
})

export function puedeEditarObservacionFichada(user) {
  return isSuperadmin(user) || isAdmin(user) || isRrhh(user)
}

export function trimObservacionDetalle(value) {
  return String(value ?? '').trim()
}

export function normalizeObservacionMotivo(raw) {
  const text = String(raw ?? '').trim()
  if (!text) return ''
  if (MOTIVO_BY_VALUE.has(text)) return text
  const compact = text.replace(/[\s_-]+/g, '').toLowerCase()
  const spaced = text.replace(/[_-]+/g, ' ').trim().toLowerCase()
  return MOTIVO_ALIASES[compact] || MOTIVO_ALIASES[spaced] || ''
}

export function observacionMotivoLabel(motivo) {
  const code = normalizeObservacionMotivo(motivo) || String(motivo ?? '').trim()
  return MOTIVO_BY_VALUE.get(code) || code
}

export function hasObservacionHumana(item) {
  const observacion = item?.observacionHumana
  if (!observacion || typeof observacion !== 'object') return false
  return Boolean(String(observacion.motivo || observacion.detalle || '').trim())
}

export function countObservacionesJornada(jornada) {
  const movimientos = Array.isArray(jornada?.movimientos) ? jornada.movimientos : []
  return movimientos.filter((item) => hasObservacionHumana(item)).length
}

export function movimientoObservadoLabel(item) {
  const visual = item?.movimientoVisual ?? item?.tipo
  if (esTipoIntermedio(visual)) return 'Intermedia'
  return displayTipoLabel(visual) || '—'
}

export function observacionesDeJornada(jornada) {
  const movimientos = Array.isArray(jornada?.movimientos) ? jornada.movimientos : []
  return movimientos
    .filter((item) => hasObservacionHumana(item))
    .map((item) => ({
      fechaHora: item.fechaHora,
      hora: formatFichadaHora(item.fechaHora) || '—',
      movimiento: movimientoObservadoLabel(item),
      motivo: observacionMotivoLabel(item.observacionHumana?.motivo),
      detalle: String(item.observacionHumana?.detalle ?? '').trim(),
    }))
    .sort((a, b) => String(a.fechaHora ?? '').localeCompare(String(b.fechaHora ?? '')))
}

export function formatObservacionPdfLinea(item) {
  const tipo = String(item?.motivo ?? '').trim()
  const detalle = String(item?.detalle ?? '').trim()
  const cuerpo = detalle ? `${tipo}: ${detalle}` : tipo
  return `${item?.hora || '—'} — ${cuerpo}`
}

export function formatObservacionesPdf(jornada) {
  const items = observacionesDeJornada(jornada)
  if (!items.length) return '—'
  return items.map((item) => formatObservacionPdfLinea(item)).join('\n')
}

export function describeObservacionesJornada(count) {
  const n = Number(count) || 0
  if (n <= 0) return 'Sin observaciones'
  if (n === 1) return '1 observación'
  return `${n} observaciones`
}

export function validateObservacionForm({ motivo, detalle }) {
  const errors = {}
  const normalizedMotivo = normalizeObservacionMotivo(motivo)
  const trimmed = trimObservacionDetalle(detalle)

  if (!normalizedMotivo) {
    errors.motivo = 'Seleccioná un motivo.'
  }
  if (!trimmed) {
    errors.detalle = 'Ingresá el detalle de la observación.'
  } else if (trimmed.length > OBSERVACION_DETALLE_MAX) {
    errors.detalle = `El detalle no puede superar ${OBSERVACION_DETALLE_MAX} caracteres.`
  }

  return {
    ok: Object.keys(errors).length === 0,
    errors,
    value: {
      motivo: normalizedMotivo,
      detalle: trimmed,
    },
  }
}

function optionalText(value) {
  const text = String(value ?? '').trim()
  return text || null
}

export function mapObservacionHumana(raw, fallbackFichadaId) {
  if (raw == null) return null
  if (typeof raw !== 'object' || Array.isArray(raw)) return null

  const motivoRaw = pick(raw, 'motivo', 'Motivo')
  const detalle = trimObservacionDetalle(pick(raw, 'detalle', 'Detalle'))
  const motivo = normalizeObservacionMotivo(motivoRaw)

  if (!motivo && !detalle) return null
  if (!motivo || !detalle) return null

  return {
    fichadaId: pick(raw, 'fichadaId', 'FichadaId') ?? fallbackFichadaId ?? null,
    motivo,
    detalle,
    creadoPor: optionalText(pick(raw, 'creadoPor', 'CreadoPor')),
    creadoEn: pick(raw, 'creadoEn', 'CreadoEn'),
    modificadoPor: optionalText(pick(raw, 'modificadoPor', 'ModificadoPor')),
    modificadoEn: pick(raw, 'modificadoEn', 'ModificadoEn'),
  }
}

export function mapFichadaObservacionFromItem(item) {
  const nested = pick(item, 'observacion', 'Observacion')
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    return mapObservacionHumana(nested, pick(item, 'id', 'Id'))
  }

  const flatMotivo = pick(item, 'observacionMotivo', 'ObservacionMotivo')
  const flatDetalle = pick(item, 'observacionDetalle', 'ObservacionDetalle')
  if (flatMotivo || flatDetalle) {
    return mapObservacionHumana(
      {
        motivo: flatMotivo,
        detalle: flatDetalle,
        creadoPor: pick(item, 'observacionCreadoPor', 'ObservacionCreadoPor'),
        creadoEn: pick(item, 'observacionCreadoEn', 'ObservacionCreadoEn'),
        modificadoPor: pick(item, 'observacionModificadoPor', 'ObservacionModificadoPor'),
        modificadoEn: pick(item, 'observacionModificadoEn', 'ObservacionModificadoEn'),
      },
      pick(item, 'id', 'Id'),
    )
  }

  return null
}

export function applyObservacionToFichada(fichada, observacion) {
  if (!fichada) return fichada
  return {
    ...fichada,
    observacionHumana: observacion,
  }
}

export function replaceFichadaObservacionInList(list, fichadaId, observacion) {
  const id = String(fichadaId ?? '')
  if (!id || !Array.isArray(list)) return Array.isArray(list) ? list : []
  return list.map((item) =>
    String(item?.id) === id ? applyObservacionToFichada(item, observacion) : item,
  )
}

export function observacionContextLabels(fichada) {
  return {
    empleado: String(fichada?.empleado ?? '').trim() || 'Empleado',
    fecha: fichada?.fechaHora ? formatDate(fichada.fechaHora) : '—',
    hora: fichada?.fechaHora ? formatTime(fichada.fechaHora) : '—',
    movimiento: displayTipoLabel(fichada?.tipo) || '—',
  }
}

export function observacionAddAriaLabel(fichada) {
  const ctx = observacionContextLabels(fichada)
  return `Agregar observación a la fichada de ${ctx.empleado} del ${ctx.fecha} a las ${ctx.hora}`
}

export function observacionEditAriaLabel(fichada, { canEdit } = { canEdit: true }) {
  const ctx = observacionContextLabels(fichada)
  if (canEdit) return `Ver o editar observación de la fichada de ${ctx.empleado}`
  return `Ver observación de la fichada de ${ctx.empleado}`
}

export function shouldAppendObservacionExportColumns(view, records) {
  if (view !== 'movimientos') return false
  return Array.isArray(records) && records.some((item) => hasObservacionHumana(item))
}

export function observacionExportColumns() {
  return [
    { id: 'observacionMotivo', label: 'Motivo de observación' },
    { id: 'observacionDetalle', label: 'Detalle de observación' },
  ]
}

export function observacionExportValue(item, columnId) {
  const observacion = item?.observacionHumana
  if (!hasObservacionHumana(item)) return ''
  if (columnId === 'observacionMotivo') return observacionMotivoLabel(observacion.motivo)
  if (columnId === 'observacionDetalle') return observacion.detalle ?? ''
  return ''
}

export function isObservacionEndpointUnavailable(status) {
  return status === 404 || status === 405 || status === 501
}

export function shouldApplyObservacionResponse({
  requestFichadaId,
  responseFichadaId,
  openFichadaId,
  modalOpen,
} = {}) {
  const requested = String(requestFichadaId ?? '')
  if (!requested) return { updateRow: false, closeModal: false }
  const responseId =
    responseFichadaId == null || responseFichadaId === '' ? requested : String(responseFichadaId)
  if (responseId !== requested) return { updateRow: false, closeModal: false }
  const sameOpen = modalOpen && String(openFichadaId ?? '') === requested
  return { updateRow: true, closeModal: sameOpen }
}
