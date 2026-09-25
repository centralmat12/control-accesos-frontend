import {
  displayMetodoLabel,
  displayTipoLabel,
  esMetodoBiometrico,
  esMetodoManual,
  esTipoEntrada,
  esTipoIntermedio,
  esTipoSalida,
  fichadaDateKey,
  fichadaSortKey,
  formatClockTime,
} from './format.js'

export const MOVIMIENTO_VISUAL = {
  entrada: 'Entrada',
  salida: 'Salida',
  intermedio: 'Movimiento intermedio',
}

export const JORNADA_CLASIFICACION = {
  enCurso: 'En curso',
  incompleta: 'Incompleta',
  completa: 'Completa',
  revisar: 'Revisar',
}

export const CLASIFICACION_JORNADA_AYUDA =
  'La primera fichada válida de la jornada es la entrada y la última, si hay más de una, es la salida. Las demás son intermedias. El día calendario es America/Argentina/Buenos_Aires. Una jornada sin salida deja de estar en curso a las 12 horas o al terminar el día, salvo un horario nocturno configurado.'

export const JORNADA_LIMITE_MS = 12 * 60 * 60 * 1000

export const MOTIVO_FALTA_SALIDA = 'Falta fichada de salida'
export const MOTIVO_DUPLICADO = 'Hay fichadas posiblemente duplicadas'
export const TOLERANCIA_FUTURO_MS = 5 * 60 * 1000
export const MOTIVO_FUTURO = 'La fichada posee una fecha u hora futura'
export const MOTIVO_DURACION = 'La duración entre la primera y la última fichada supera las 12 horas'
export const TEXTO_INCOMPLETA = 'Jornada incompleta: no se registró la fichada de salida.'

export function parseHorarioRango(label) {
  const match = String(label ?? '').match(/(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})/)
  if (!match) return null
  const start = Number(match[1]) * 60 + Number(match[2])
  const end = Number(match[3]) * 60 + Number(match[4])
  if (start >= 24 * 60 || end > 24 * 60) return null
  return { start, end, nocturno: end < start }
}

function wallClockMs(value) {
  const key = fichadaSortKey(value)
  const match = String(key).match(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/)
  if (!match) return null
  const fraction = String(value ?? '').match(/\.(\d{1,3})/)
  const milliseconds = fraction ? Number(fraction[1].padEnd(3, '0')) : 0
  return Date.UTC(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4]),
    Number(match[5]),
    Number(match[6]),
    milliseconds,
  )
}

function minutesOfKey(value) {
  const key = fichadaSortKey(value)
  const match = String(key).match(/T(\d{2}):(\d{2})/)
  if (!match) return null
  return Number(match[1]) * 60 + Number(match[2])
}

function shiftDateKey(dateKey, days) {
  const match = String(dateKey).match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return ''
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + days))
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function jornadaFechaDeFichada(fechaHora, horarioLabel) {
  const date = fichadaDateKey(fechaHora)
  const rango = parseHorarioRango(horarioLabel)
  if (!date || !rango?.nocturno) return date
  const minutes = minutesOfKey(fechaHora)
  if (minutes == null) return date
  if (minutes < rango.end) return shiftDateKey(date, -1)
  return date
}

/** Ventana local de presentación; no es una regla de la API. */
export const DUPLICATE_WINDOW_SECONDS = 60
export const DUPLICATE_WINDOW_MS = DUPLICATE_WINDOW_SECONDS * 1000

export const TIPO_INFORMADO_TOOLTIP = 'Tipo informado por el agente o dispositivo.'
export const INTERMEDIATE_MOVIMIENTO_TOOLTIP =
  'Esta fichada se registró entre la primera y la última marcación de la jornada. Se conserva para auditoría, pero no modifica el ingreso ni el egreso calculados.'

export function empleadoMovimientoKey(item) {
  if (item?.empleadoId != null && String(item.empleadoId).trim() !== '') {
    return `id:${item.empleadoId}`
  }
  return `nombre:${item?.empleado ?? ''}|${item?.legajo ?? ''}`
}

function optionalToken(item, keys) {
  for (const key of keys) {
    const value = item?.[key]
    if (value != null && String(value).trim() !== '') return String(value).trim()
  }
  return ''
}

export function sameOptionalLocation(a, b) {
  const sucursalA = optionalToken(a, ['sucursalId', 'sucursal'])
  const sucursalB = optionalToken(b, ['sucursalId', 'sucursal'])
  if (sucursalA && sucursalB && sucursalA !== sucursalB) return false

  const dispositivoA = optionalToken(a, ['dispositivoId', 'dispositivo'])
  const dispositivoB = optionalToken(b, ['dispositivoId', 'dispositivo'])
  if (dispositivoA && dispositivoB && dispositivoA !== dispositivoB) return false

  return true
}

export function millisecondsBetweenMovimientos(a, b) {
  const left = new Date(a?.fechaHora).getTime()
  const right = new Date(b?.fechaHora).getTime()
  if (Number.isNaN(left) || Number.isNaN(right)) return Number.POSITIVE_INFINITY
  return Math.abs(right - left)
}

export function isWithinDuplicateWindow(ms) {
  return Number.isFinite(ms) && ms <= DUPLICATE_WINDOW_MS
}

export function formatDuplicateDelay(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return 'Posible duplicado · al mismo segundo'
  const seconds = ms / 1000
  const text = Number.isInteger(seconds) ? String(seconds) : String(seconds).replace('.', ',')
  const unidad = seconds === 1 ? 'segundo' : 'segundos'
  return `Posible duplicado · ${text} ${unidad} después`
}

export function isPossibleDuplicateOf(reference, candidate) {
  if (!reference || !candidate) return false
  if (empleadoMovimientoKey(reference) !== empleadoMovimientoKey(candidate)) return false
  const fechaReferencia = reference.jornadaFecha || fichadaDateKey(reference.fechaHora)
  const fechaCandidata = candidate.jornadaFecha || fichadaDateKey(candidate.fechaHora)
  if (fechaReferencia !== fechaCandidata) return false
  if (!isWithinDuplicateWindow(millisecondsBetweenMovimientos(reference, candidate))) return false
  return sameOptionalLocation(reference, candidate)
}

export function compareMovimientosByTime(a, b) {
  const left = fichadaSortKey(a?.fechaHora)
  const right = fichadaSortKey(b?.fechaHora)
  if (left !== right) return left < right ? -1 : 1
  const idA = Number(a?.id)
  const idB = Number(b?.id)
  if (Number.isFinite(idA) && Number.isFinite(idB) && idA !== idB) return idA - idB
  return String(a?.id ?? '').localeCompare(String(b?.id ?? ''))
}

function cloneMovimiento(item) {
  return {
    ...item,
    tipo: item.tipo,
    movimientoInformado: item.tipo,
    movimientoVisual: item.tipo,
    jornadaEstado: '',
    esSalidaProvisional: false,
    metodo: item.metodo,
    esPosibleDuplicado: false,
    esMovimientoIntermedio: false,
    observacion: '',
    observacionLabel: '',
    milisegundosDesdePrimera: null,
  }
}

function horarioDe(item, horarioByEmpleado) {
  if (!horarioByEmpleado) return ''
  const id = Number(item?.empleadoId)
  if (horarioByEmpleado instanceof Map) return horarioByEmpleado.get(id)?.horario ?? horarioByEmpleado.get(id) ?? ''
  return horarioByEmpleado[id]?.horario ?? horarioByEmpleado[id] ?? ''
}

function groupByEmpleadoFecha(items, horarioByEmpleado) {
  const groups = new Map()
  items.forEach((item, index) => {
    const fecha = jornadaFechaDeFichada(item?.fechaHora, horarioDe(item, horarioByEmpleado))
    if (!fecha) return
    item.jornadaFecha = fecha
    const key = `${empleadoMovimientoKey(item)}|${fecha}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push({ item, index })
  })
  return groups
}

function resolverEstadoJornada(roles, { now, nocturno, jornadaFecha }) {
  const efectivos = roles.filter((item) => !item.esPosibleDuplicado)
  const nowMs = wallClockMs(now)
  if (efectivos.some((item) => wallClockMs(item.fechaHora) != null && nowMs != null && wallClockMs(item.fechaHora) - nowMs > TOLERANCIA_FUTURO_MS)) {
    return { estado: JORNADA_CLASIFICACION.revisar, motivo: MOTIVO_FUTURO }
  }
  if (!efectivos.length || efectivos.some((item) => wallClockMs(item.fechaHora) == null)) {
    return { estado: JORNADA_CLASIFICACION.revisar, motivo: 'No se puede interpretar la jornada' }
  }
  const first = wallClockMs(efectivos[0].fechaHora)
  const last = wallClockMs(efectivos.at(-1).fechaHora)
  if (efectivos.length >= 2) {
    if (last < first) return { estado: JORNADA_CLASIFICACION.revisar, motivo: 'La salida queda antes de la entrada' }
    if (last - first > JORNADA_LIMITE_MS) {
      return { estado: JORNADA_CLASIFICACION.revisar, motivo: MOTIVO_DURACION }
    }
    return { estado: JORNADA_CLASIFICACION.completa, motivo: '' }
  }
  const elapsed = nowMs == null ? JORNADA_LIMITE_MS : nowMs - first
  const diaCerrado = !nocturno && fichadaDateKey(now) > jornadaFecha
  if (elapsed >= JORNADA_LIMITE_MS || diaCerrado) {
    return { estado: JORNADA_CLASIFICACION.incompleta, motivo: MOTIVO_FALTA_SALIDA }
  }
  return { estado: JORNADA_CLASIFICACION.enCurso, motivo: '' }
}

export function describeFichadasIntermedias(count) {
  if (!count) return 'Sin fichadas intermedias'
  if (count === 1) return '1 fichada intermedia'
  return `${count} fichadas intermedias`
}

export function describeTipoInformado(tipo) {
  const label = displayTipoLabel(tipo)
  return label ? `${label} informada` : 'Tipo informado'
}

export function describeDetalleLinea(movimiento) {
  const hora = movimiento.fechaHora ? formatClockTime(movimiento.fechaHora) : '—'
  const tipo = describeTipoInformado(movimiento.tipo)
  if (movimiento.esPosibleDuplicado) return `${hora} — ${tipo} · Posible duplicado`
  if (movimiento.esMovimientoIntermedio) return `${hora} — ${tipo} · Movimiento intermedio`
  return `${hora} — ${tipo}`
}

export function matchesTipoFiltro(item, tipo) {
  if (!tipo || tipo === 'todos') return true
  const visual = item?.movimientoVisual ?? item?.tipo
  if (esTipoEntrada(tipo)) return esTipoEntrada(visual)
  if (esTipoSalida(tipo)) return esTipoSalida(visual)
  if (esTipoIntermedio(tipo)) return esTipoIntermedio(visual)
  return String(visual ?? '') === String(tipo)
}

export function matchesMetodoFiltro(item, metodo) {
  if (!metodo || metodo === 'todos') return true
  if (esMetodoBiometrico(metodo)) return esMetodoBiometrico(item.metodo)
  if (esMetodoManual(metodo)) return esMetodoManual(item.metodo)
  return String(item.metodo ?? '') === String(metodo)
}

export function filterMovimientosOriginales(movimientos, { tipo = 'todos', metodo = 'todos' } = {}) {
  return movimientos.filter(
    (item) => matchesTipoFiltro(item, tipo) && matchesMetodoFiltro(item, metodo),
  )
}

export function summarizeMovimientosVista(movimientos) {
  return {
    total: movimientos.length,
    entradas: movimientos.filter((item) => esTipoEntrada(item.movimientoVisual ?? item.tipo)).length,
    salidas: movimientos.filter((item) => esTipoSalida(item.movimientoVisual ?? item.tipo)).length,
    intermedios: movimientos.filter((item) => esTipoIntermedio(item.movimientoVisual)).length,
    posiblesDuplicados: movimientos.filter((item) => item.esPosibleDuplicado).length,
  }
}

/**
 * Clasifica fichadas por empleado y jornada en America/Argentina/Buenos_Aires.
 * No modifica `tipo`. Recibe `now` para que todas las pantallas usen la misma hora.
 * Un horario nocturno configurado (hora desde posterior a hora hasta) cruza la medianoche.
 */
export function clasificarFichadas(fichadas = [], { now = new Date(), horarioByEmpleado } = {}) {
  const annotated = fichadas.map((item) => cloneMovimiento(item))
  const groups = groupByEmpleadoFecha(annotated, horarioByEmpleado)

  groups.forEach((entries) => {
    const sorted = [...entries].sort((a, b) => compareMovimientosByTime(a.item, b.item))
    const duplicateGroups = []

    sorted.forEach((entry) => {
      const lastGroup = duplicateGroups.at(-1)
      const reference = lastGroup?.[0]?.item
      if (reference && isPossibleDuplicateOf(reference, entry.item)) {
        lastGroup.push(entry)
        return
      }
      duplicateGroups.push([entry])
    })

    duplicateGroups.forEach((group) => {
      group.forEach((entry, offset) => {
        if (offset === 0) return
        const movimiento = annotated[entry.index]
        const ms = millisecondsBetweenMovimientos(group[0].item, entry.item)
        movimiento.esPosibleDuplicado = true
        movimiento.observacion = 'duplicado'
        movimiento.milisegundosDesdePrimera = ms
        movimiento.observacionLabel = formatDuplicateDelay(ms)
      })
    })

    const roles = sorted.map((entry) => annotated[entry.index])
    const horario = horarioDe(roles[0], horarioByEmpleado)
    const nocturno = Boolean(parseHorarioRango(horario)?.nocturno)
    const jornadaFecha = roles[0]?.jornadaFecha ?? ''
    const decision = resolverEstadoJornada(roles, { now, nocturno, jornadaFecha })
    const efectivos = roles.filter((item) => !item.esPosibleDuplicado)
    const lastEfectivo = efectivos.at(-1)

    roles.forEach((movimiento) => {
      const efectivoIndex = efectivos.indexOf(movimiento)
      if (efectivoIndex === 0 || efectivos.length === 0) {
        movimiento.movimientoVisual = MOVIMIENTO_VISUAL.entrada
        movimiento.esMovimientoIntermedio = false
      } else if (movimiento === lastEfectivo && efectivos.length >= 2) {
        movimiento.movimientoVisual = MOVIMIENTO_VISUAL.salida
        movimiento.esMovimientoIntermedio = false
        movimiento.esSalidaProvisional = decision.estado === JORNADA_CLASIFICACION.enCurso
      } else {
        movimiento.movimientoVisual = MOVIMIENTO_VISUAL.intermedio
        movimiento.esMovimientoIntermedio = true
        if (!movimiento.observacion) {
          movimiento.observacion = 'intermedio'
          movimiento.observacionLabel = 'Movimiento intermedio'
        }
      }
      movimiento.jornadaEstado = decision.estado
      movimiento.jornadaMotivo = decision.motivo
    })
  })

  return annotated
}

/**
 * Anota movimientos para presentación. No modifica el Tipo almacenado ni elimina registros.
 */
export function annotateMovimientos(fichadas = [], options = {}) {
  return clasificarFichadas(fichadas, options)
}

export function validMovimientosForResumen(annotatedMovimientos) {
  const sorted = [...annotatedMovimientos]
    .filter((item) => item?.fechaHora)
    .sort(compareMovimientosByTime)
  const groups = []

  sorted.forEach((item) => {
    const lastGroup = groups.at(-1)
    const reference = lastGroup?.[0]
    if (reference && isPossibleDuplicateOf(reference, item)) {
      lastGroup.push(item)
      return
    }
    groups.push([item])
  })

  return groups.map((group) => group[0])
}

export function buildMovimientosCsvRows(movimientos) {
  return movimientos.map((item) => [
    item.empleado ?? '',
    item.legajo ?? '',
    item.fechaHora ?? '',
    item.movimientoInformado ?? item.tipo ?? '',
    displayTipoLabel(item.movimientoVisual ?? item.tipo),
    displayMetodoLabel(item.metodo),
    item.observacionLabel ?? '',
  ])
}
