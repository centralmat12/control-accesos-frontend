import {
  displayMetodoLabel,
  displayTipoLabel,
  formatDate,
  formatTime,
  toDateKey,
} from './format.js'
import {
  allColumnIds,
  columnCatalog,
} from './fichadas-columns.js'
import { describePeriodo } from './period.js'
import { describeDetalleLinea } from './movimientos.js'
import { buildCsv } from './csv.js'

export const FICHADAS_EXPORT_TITLE = 'Reporte de fichadas'
export const FICHADAS_EXPORT_EMPTY_MESSAGE =
  'No hay fichadas para exportar con los filtros seleccionados.'
export const FICHADAS_EXPORT_NO_COLUMNS_MESSAGE =
  'Seleccioná al menos una columna para exportar.'

export const FICHADAS_CSV_MODAL_TITLE = 'Exportar fichadas'
export const FICHADAS_CSV_MODAL_SUBTITLE = 'Elegí qué información querés incluir en el archivo.'
export const FICHADAS_CSV_VIEW_TITLE = 'Vista actual'
export const FICHADAS_CSV_VIEW_DESCRIPTION =
  'Exporta los resultados de los filtros, las columnas visibles y el ordenamiento actual.'
export const FICHADAS_CSV_FULL_TITLE = 'Información completa'
export const FICHADAS_CSV_FULL_DESCRIPTION =
  'Exporta todos los registros y todas las columnas permitidas para la empresa seleccionada.'
export const FICHADAS_CSV_FULL_WARNING = 'Los filtros y la selección de columnas actuales no se aplicarán.'
export const FICHADAS_CSV_RECOMMENDED = 'Recomendada'
export const FICHADAS_CSV_EXPORT_LABEL = 'Exportar archivo'
export const FICHADAS_CSV_GENERATING_LABEL = 'Generando CSV…'
export const FICHADAS_CSV_LARGE_THRESHOLD = 200
export const FICHADAS_CSV_LARGE_TITLE = 'Exportación grande'

export function fichadasCompleteQuery() {
  return {}
}

export function csvExportSummaryLabel(recordCount, columnCount) {
  return `${Number(recordCount) || 0} registros · ${Number(columnCount) || 0} columnas`
}

export function needsLargeCsvConfirm(recordCount) {
  return Number(recordCount) >= FICHADAS_CSV_LARGE_THRESHOLD
}

export function largeCsvConfirmMessage(recordCount) {
  return `Vas a exportar ${Number(recordCount) || 0} registros. Esta operación puede tardar. ¿Querés continuar?`
}

export function csvExportFilename(snapshot, stamp) {
  const prefix = snapshot?.view === 'jornadas' ? 'jornadas' : 'fichadas'
  const suffix = snapshot?.mode === 'full' ? 'completo' : 'vista'
  return `${prefix}-${suffix}-${stamp}.csv`
}

export function hasFichadasServerFilters(filters = {}) {
  return Boolean(filters.empleadoId) || Boolean(filters.periodo && filters.periodo !== 'todos')
}

export const FICHADAS_FORBIDDEN_EXPORT_FIELDS = Object.freeze([
  'id',
  'empleadoId',
  'dispositivoId',
  'jwt',
  'token',
  'passwordHash',
  'PasswordHash',
  'clientSecret',
  'plantilla',
  'template',
  'biometria',
  'huella',
])

const PRINT_LABELS = {
  jornadas: {
    ingreso: 'Ingreso — primera fichada',
    egreso: 'Egreso — última fichada',
  },
}

export function selectedCatalogColumns(view, ids) {
  if (!Array.isArray(ids) || ids.length === 0) return []
  const selected = new Set(ids)
  return columnCatalog(view).filter((column) => selected.has(column.id))
}

export function columnExportLabel(view, column) {
  return PRINT_LABELS[view]?.[column.id] ?? column.label
}

export function csvDateValue(value) {
  if (!value) return ''
  return toDateKey(value)
}

export function csvTimeValue(value) {
  if (!value) return ''
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return [date.getHours(), date.getMinutes(), date.getSeconds()]
    .map((part) => String(part).padStart(2, '0'))
    .join(':')
}

function movimientoField(item, columnId, { forCsv }) {
  switch (columnId) {
    case 'empleado':
      return item.empleado ?? ''
    case 'legajo':
      return item.legajo ?? ''
    case 'fecha':
      if (!item.fechaHora) return ''
      return forCsv ? csvDateValue(item.fechaHora) : formatDate(item.fechaHora)
    case 'hora':
      if (!item.fechaHora) return ''
      return forCsv ? csvTimeValue(item.fechaHora) : formatTime(item.fechaHora)
    case 'tipo':
      return displayTipoLabel(item.tipo)
    case 'metodo':
      return displayMetodoLabel(item.metodo)
    case 'observacion':
      return item.observacionLabel ?? ''
    default:
      return ''
  }
}

function jornadaField(item, columnId, { forCsv }) {
  switch (columnId) {
    case 'empleado':
      return item.empleado ?? ''
    case 'legajo':
      return item.legajo ?? ''
    case 'fecha':
      return item.fecha ?? ''
    case 'horarioPrevisto':
      return item.horarioPrevisto ?? ''
    case 'ingreso':
      return item.ingresoHora ?? ''
    case 'egreso':
      return item.egresoHora ?? ''
    case 'intermedias':
      return forCsv ? String(item.fichadasIntermedias ?? 0) : (item.fichadasIntermediasLabel ?? '')
    case 'estado':
      return item.estado ?? ''
    case 'detalle': {
      const lines = Array.isArray(item.movimientos)
        ? item.movimientos.map((movimiento) => describeDetalleLinea(movimiento)).filter(Boolean)
        : []
      if (lines.length) return lines.join(' · ')
      return item.fichadasIntermediasLabel ?? ''
    }
    default:
      return ''
  }
}

function fieldValue(view, item, columnId, options) {
  return view === 'jornadas'
    ? jornadaField(item, columnId, options)
    : movimientoField(item, columnId, options)
}

export function describeActiveFichadasFilters(filters = {}, empleadoLabel = '') {
  const parts = []
  if (filters.tipo && filters.tipo !== 'todos') {
    parts.push(`Tipo: ${displayTipoLabel(filters.tipo)}`)
  }
  if (filters.metodo && filters.metodo !== 'todos') {
    parts.push(`Método: ${displayMetodoLabel(filters.metodo)}`)
  }
  if (empleadoLabel) parts.push(`Empleado: ${empleadoLabel}`)
  if (filters.sucursalLabel) parts.push(`Sucursal: ${filters.sucursalLabel}`)
  return parts.join(' · ')
}

export function shouldPrintLandscape(columns = []) {
  if (columns.length >= 6) return true
  const width = columns.reduce((total, column) => total + String(column.label ?? column ?? '').length, 0)
  return width >= 72
}

export function buildFichadasViewSelection({
  view = 'movimientos',
  records = [],
  columnIds,
  filters = {},
  empresa = '',
  empleadoLabel = '',
  generatedAt = '',
} = {}) {
  const ids = Array.isArray(columnIds) ? columnIds : allColumnIds(view)
  const columns = selectedCatalogColumns(view, ids)
  return {
    view,
    records: Array.isArray(records) ? records : [],
    columnIds: columns.map((column) => column.id),
    columns,
    filters,
    empresa: empresa || '',
    empleadoLabel: empleadoLabel || '',
    generatedAt: generatedAt || '',
    periodo: describePeriodo(filters.periodo, filters.desde, filters.hasta),
  }
}

export function buildFichadasExportSnapshot(selection, { mode = 'view' } = {}) {
  const view = selection?.view === 'jornadas' ? 'jornadas' : 'movimientos'
  const records = Array.isArray(selection?.records) ? selection.records : []
  const columns =
    mode === 'full' ? columnCatalog(view) : selectedCatalogColumns(view, selection?.columnIds ?? [])
  const headers = columns.map((column) => columnExportLabel(view, column))
  const hasRecords = records.length > 0
  const hasColumns = columns.length > 0
  let disableReason = ''
  if (!hasColumns && mode === 'view') disableReason = FICHADAS_EXPORT_NO_COLUMNS_MESSAGE
  else if (!hasRecords) disableReason = FICHADAS_EXPORT_EMPTY_MESSAGE

  return {
    title: FICHADAS_EXPORT_TITLE,
    view,
    mode,
    empresa: selection?.empresa || '',
    periodo: selection?.periodo || describePeriodo(selection?.filters?.periodo, selection?.filters?.desde, selection?.filters?.hasta),
    generatedAt: selection?.generatedAt || '',
    filtersSummary: describeActiveFichadasFilters(selection?.filters, selection?.empleadoLabel),
    columns,
    columnIds: columns.map((column) => column.id),
    headers,
    recordCount: records.length,
    landscape: shouldPrintLandscape(columns.map((column) => ({ label: columnExportLabel(view, column) }))),
    canExport: hasRecords && hasColumns,
    canExportFull: hasRecords && columnCatalog(view).length > 0,
    disableReason,
    printRows: records.map((item) => columns.map((column) => fieldValue(view, item, column.id, { forCsv: false }))),
    csvRows: records.map((item) => columns.map((column) => fieldValue(view, item, column.id, { forCsv: true }))),
    forbiddenFields: [...FICHADAS_FORBIDDEN_EXPORT_FIELDS],
  }
}

export function buildFichadasCompleteSelection({
  view = 'movimientos',
  records = [],
  empresa = '',
  generatedAt = '',
} = {}) {
  return buildFichadasViewSelection({
    view,
    records: Array.isArray(records) ? records : [],
    columnIds: allColumnIds(view),
    filters: { periodo: 'todos', tipo: 'todos', metodo: 'todos' },
    empresa,
    empleadoLabel: '',
    generatedAt,
  })
}

export function resolveFichadasCsvSnapshot({ mode = 'view', viewSelection, completeSelection } = {}) {
  if (mode === 'full') {
    return buildFichadasExportSnapshot(completeSelection ?? viewSelection, { mode: 'full' })
  }
  return buildFichadasExportSnapshot(viewSelection, { mode: 'view' })
}

export function buildFichadasCsvPayload(snapshot, stamp) {
  if (!snapshot?.canExport) {
    return {
      ok: false,
      message: snapshot?.disableReason || FICHADAS_EXPORT_EMPTY_MESSAGE,
    }
  }
  return {
    ok: true,
    filename: csvExportFilename(snapshot, stamp),
    content: buildCsv(snapshot.headers, snapshot.csvRows),
  }
}

export async function runFichadasCsvExportAttempt({
  busy = false,
  snapshot,
  stamp,
  confirmLarge,
  download,
} = {}) {
  if (busy) return { status: 'busy' }
  if (!snapshot) return { status: 'error', message: FICHADAS_EXPORT_EMPTY_MESSAGE }

  if (snapshot.mode === 'full' && needsLargeCsvConfirm(snapshot.recordCount)) {
    const confirmed = await confirmLarge?.(snapshot.recordCount)
    if (!confirmed) return { status: 'cancelled' }
  }

  const payload = buildFichadasCsvPayload(snapshot, stamp)
  if (!payload.ok) {
    return { status: 'empty', message: payload.message }
  }

  try {
    await download?.(payload.filename, payload.content)
    return { status: 'ok', filename: payload.filename, content: payload.content }
  } catch (error) {
    return { status: 'error', error, message: error?.message || 'No se pudo generar el CSV.' }
  }
}
