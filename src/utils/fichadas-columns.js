export const DUPLICATE_WINDOW_SECONDS = 60
export const DUPLICATE_WINDOW_MS = DUPLICATE_WINDOW_SECONDS * 1000

export const FICHADAS_COLUMN_STORAGE_KEYS = {
  movimientos: 'ca.fichadas.columnas.movimientos.v1',
  jornadas: 'ca.fichadas.columnas.jornadas.v1',
}

export const MOVIMIENTOS_COLUMN_CATALOG = [
  { id: 'empleado', label: 'Empleado', required: true },
  { id: 'legajo', label: 'Legajo', required: false },
  { id: 'fecha', label: 'Fecha', required: true },
  { id: 'hora', label: 'Hora', required: true },
  { id: 'tipo', label: 'Tipo informado', required: false },
  { id: 'metodo', label: 'Método', required: false },
  { id: 'observacion', label: 'Observación', required: false },
]

export const JORNADAS_COLUMN_CATALOG = [
  { id: 'empleado', label: 'Empleado', required: true },
  { id: 'legajo', label: 'Legajo', required: false },
  { id: 'fecha', label: 'Fecha', required: true },
  { id: 'horarioPrevisto', label: 'Horario previsto', required: false },
  { id: 'ingreso', label: 'Ingreso', required: true },
  { id: 'egreso', label: 'Egreso', required: false },
  { id: 'intermedias', label: 'Fichadas intermedias', required: false },
  { id: 'estado', label: 'Estado', required: true },
  { id: 'detalle', label: 'Detalle', required: false },
]

export const MOVIMIENTOS_COMPACT_COLUMNS = ['empleado', 'fecha', 'hora', 'tipo', 'observacion']
export const JORNADAS_COMPACT_COLUMNS = ['empleado', 'fecha', 'ingreso', 'egreso', 'estado', 'detalle']

export const MOBILE_COLUMN_MAX_WIDTH = 639

const CATALOGS = {
  movimientos: MOVIMIENTOS_COLUMN_CATALOG,
  jornadas: JORNADAS_COLUMN_CATALOG,
}

const COMPACT = {
  movimientos: MOVIMIENTOS_COMPACT_COLUMNS,
  jornadas: JORNADAS_COMPACT_COLUMNS,
}

export function columnCatalog(view) {
  return CATALOGS[view] ?? MOVIMIENTOS_COLUMN_CATALOG
}

export function optionalColumnIds(view) {
  return columnCatalog(view).filter((column) => !column.required).map((column) => column.id)
}

export function requiredColumnIds(view) {
  return columnCatalog(view).filter((column) => column.required).map((column) => column.id)
}

export function alwaysVisibleLegend(view) {
  return view === 'jornadas'
    ? 'Siempre visibles: Empleado, Fecha, Ingreso y Estado.'
    : 'Siempre visibles: Empleado, Fecha y Hora.'
}

export function allColumnIds(view) {
  return columnCatalog(view).map((column) => column.id)
}

export function compactColumnIds(view) {
  return [...(COMPACT[view] ?? COMPACT.movimientos)]
}

export function isMobileColumnViewport(width) {
  const value = Number(width)
  if (!Number.isFinite(value)) return false
  return value <= MOBILE_COLUMN_MAX_WIDTH
}

export function defaultColumnIds(view, { isMobile = false } = {}) {
  return isMobile ? sanitizeColumnIds(view, compactColumnIds(view)) : allColumnIds(view)
}

export function sanitizeColumnIds(view, ids) {
  const catalog = columnCatalog(view)
  const known = new Set(catalog.map((column) => column.id))
  const required = requiredColumnIds(view)
  const incoming = Array.isArray(ids) ? ids.filter((id) => typeof id === 'string' && known.has(id)) : []
  const unique = []
  for (const id of [...required, ...incoming]) {
    if (!unique.includes(id)) unique.push(id)
  }
  return catalog.map((column) => column.id).filter((id) => unique.includes(id))
}

export function visibleColumns(view, ids) {
  const selected = new Set(sanitizeColumnIds(view, ids))
  return columnCatalog(view).filter((column) => selected.has(column.id))
}

export function visibleColumnCount(view, ids) {
  return visibleColumns(view, ids).length
}

function readStorage(storage, key) {
  try {
    return storage?.getItem?.(key) ?? null
  } catch {
    return null
  }
}

function writeStorage(storage, key, value) {
  try {
    storage?.setItem?.(key, value)
    return true
  } catch {
    return false
  }
}

export function loadColumnIds(view, { storage, isMobile = false } = {}) {
  const fallback = defaultColumnIds(view, { isMobile })
  const key = FICHADAS_COLUMN_STORAGE_KEYS[view]
  const raw = readStorage(storage, key)
  if (raw == null) return { ids: fallback, source: 'default' }

  try {
    const parsed = JSON.parse(raw)
    const known = new Set(allColumnIds(view))
    const valid =
      Array.isArray(parsed) &&
      parsed.length > 0 &&
      parsed.every((id) => typeof id === 'string' && known.has(id))
    if (!valid) return { ids: fallback, source: 'invalid' }
    return { ids: sanitizeColumnIds(view, parsed), source: 'stored' }
  } catch {
    return { ids: fallback, source: 'invalid' }
  }
}

export function saveColumnIds(view, ids, { storage } = {}) {
  const key = FICHADAS_COLUMN_STORAGE_KEYS[view]
  const sanitized = sanitizeColumnIds(view, ids)
  writeStorage(storage, key, JSON.stringify(sanitized))
  return sanitized
}

export function applyColumnPreset(view, preset, { isMobile = false } = {}) {
  if (preset === 'compact') return sanitizeColumnIds(view, compactColumnIds(view))
  if (preset === 'full') return allColumnIds(view)
  return defaultColumnIds(view, { isMobile })
}

export const MOVIMIENTOS_EXPORT_HEADERS = [
  'Empleado',
  'Legajo',
  'Fecha',
  'Hora',
  'Tipo informado',
  'Método',
  'Observación',
]

export const JORNADAS_EXPORT_HEADERS = [
  'Empleado',
  'Legajo',
  'Fecha',
  'Horario previsto',
  'Ingreso',
  'Egreso calculado',
  'Fichadas intermedias',
  'Posibles duplicados',
  'Estado',
]

export const JORNADAS_PRINT_HEADERS = [
  'Empleado',
  'Legajo',
  'Fecha',
  'Horario previsto',
  'Ingreso — primera fichada',
  'Egreso — última fichada',
  'Fichadas intermedias',
  'Posibles duplicados',
  'Estado',
]
