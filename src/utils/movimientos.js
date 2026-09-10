import {
  displayMetodoLabel,
  displayTipoLabel,
  esMetodoBiometrico,
  esMetodoManual,
  esTipoEntrada,
  esTipoSalida,
  formatClockTime,
  toDateKey,
} from './format.js'

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
  if (toDateKey(reference.fechaHora) !== toDateKey(candidate.fechaHora)) return false
  if (!isWithinDuplicateWindow(millisecondsBetweenMovimientos(reference, candidate))) return false
  return sameOptionalLocation(reference, candidate)
}

export function compareMovimientosByTime(a, b) {
  return new Date(a.fechaHora) - new Date(b.fechaHora)
}

function cloneMovimiento(item) {
  return {
    ...item,
    tipo: item.tipo,
    metodo: item.metodo,
    esPosibleDuplicado: false,
    esMovimientoIntermedio: false,
    observacion: '',
    observacionLabel: '',
    milisegundosDesdePrimera: null,
  }
}

function groupByEmpleadoFecha(items) {
  const groups = new Map()
  items.forEach((item, index) => {
    if (!item?.fechaHora || !toDateKey(item.fechaHora)) return
    const key = `${empleadoMovimientoKey(item)}|${toDateKey(item.fechaHora)}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push({ item, index })
  })
  return groups
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
  if (esTipoEntrada(tipo)) return esTipoEntrada(item.tipo)
  if (esTipoSalida(tipo)) return esTipoSalida(item.tipo)
  return String(item.tipo ?? '') === String(tipo)
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
    entradas: movimientos.filter((item) => esTipoEntrada(item.tipo)).length,
    salidas: movimientos.filter((item) => esTipoSalida(item.tipo)).length,
    posiblesDuplicados: movimientos.filter((item) => item.esPosibleDuplicado).length,
  }
}

/**
 * Anota movimientos para presentación. No modifica el Tipo almacenado ni elimina registros.
 */
export function annotateMovimientos(fichadas = []) {
  const annotated = fichadas.map((item) => cloneMovimiento(item))
  const groups = groupByEmpleadoFecha(annotated)

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

    const validEntries = duplicateGroups.map((group) => group[0])
    const intermediateIndexes = new Set(
      validEntries.length >= 2
        ? validEntries.slice(1, -1).map((entry) => entry.index)
        : [],
    )

    duplicateGroups.forEach((group) => {
      group.forEach((entry, offset) => {
        const movimiento = annotated[entry.index]
        if (offset === 0) {
          if (intermediateIndexes.has(entry.index)) {
            movimiento.esMovimientoIntermedio = true
            movimiento.observacion = 'intermedio'
            movimiento.observacionLabel = 'Movimiento intermedio'
          }
          return
        }

        const ms = millisecondsBetweenMovimientos(group[0].item, entry.item)
        movimiento.esPosibleDuplicado = true
        movimiento.observacion = 'duplicado'
        movimiento.milisegundosDesdePrimera = ms
        movimiento.observacionLabel = formatDuplicateDelay(ms)
      })
    })
  })

  return annotated
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
    item.tipo ?? '',
    displayTipoLabel(item.tipo),
    displayMetodoLabel(item.metodo),
    item.observacionLabel ?? '',
  ])
}
