import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildCsv } from '../src/utils/csv.js'
import { formatTime, toDateKey } from '../src/utils/format.js'
import { buildJornadas, buildJornadasCsvRows, JORNADA_ESTADO, summarizeJornadasVista } from '../src/utils/jornadas.js'
import {
  annotateMovimientos,
  describeDetalleLinea,
  DUPLICATE_WINDOW_MS,
  DUPLICATE_WINDOW_SECONDS,
  filterMovimientosOriginales,
  formatDuplicateDelay,
  INTERMEDIATE_MOVIMIENTO_TOOLTIP,
  isWithinDuplicateWindow,
  millisecondsBetweenMovimientos,
  summarizeMovimientosVista,
} from '../src/utils/movimientos.js'
import {
  applyColumnPreset,
  FICHADAS_COLUMN_STORAGE_KEYS,
  JORNADAS_EXPORT_HEADERS,
  JORNADAS_PRINT_HEADERS,
  MOVIMIENTOS_EXPORT_HEADERS,
  allColumnIds,
  compactColumnIds,
  defaultColumnIds,
  isMobileColumnViewport,
  loadColumnIds,
  requiredColumnIds,
  saveColumnIds,
  sanitizeColumnIds,
  visibleColumnCount,
  visibleColumns,
} from '../src/utils/fichadas-columns.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
let passed = 0
let failed = 0

function check(name, fn) {
  try {
    fn()
    passed += 1
    console.log(`ok - ${name}`)
  } catch (error) {
    failed += 1
    console.error(`not ok - ${name}`)
    console.error(error)
  }
}

function read(relative) {
  return readFileSync(join(root, relative), 'utf8')
}

function punch({
  id,
  empleadoId = 7,
  empleado = 'Ana Pérez',
  legajo = '100',
  day = 8,
  hours,
  minutes,
  seconds = 0,
  milliseconds = 0,
  tipo,
  metodo = 'Biometrico',
  sucursalId,
  dispositivoId,
}) {
  return {
    id,
    empleadoId,
    empleado,
    legajo,
    fechaHora: new Date(2024, 0, day, hours, minutes, seconds, milliseconds).toISOString(),
    tipo,
    metodo,
    sucursalId,
    dispositivoId,
  }
}

function punchOffset(offsetMs, { id, tipo }) {
  const base = new Date(2024, 0, 8, 10, 0, 0, 0)
  return {
    id,
    empleadoId: 7,
    empleado: 'Ana Pérez',
    legajo: '100',
    fechaHora: new Date(base.getTime() + offsetMs).toISOString(),
    tipo,
    metodo: 'Biometrico',
  }
}

function memoryStorage(initial = {}) {
  const map = new Map(Object.entries(initial))
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => {
      map.set(key, String(value))
    },
    removeItem: (key) => {
      map.delete(key)
    },
  }
}

check('La ventana de duplicados es una constante de presentación de 60 segundos', () => {
  assert.equal(DUPLICATE_WINDOW_SECONDS, 60)
  const view = read('src/views/fichadas.js')
  assert.match(view, /DUPLICATE_WINDOW_SECONDS|annotateMovimientos/)
  assert.equal(view.includes('regla de la API'), false)
})

check('1. Una sola fichada histórica → Pendiente', () => {
  const original = [punch({ id: 1, hours: 10, minutes: 3, tipo: 'Entrada' })]
  const jornadas = buildJornadas(original, new Map(), { todayKey: '2024-01-09' })
  assert.equal(jornadas.length, 1)
  assert.equal(jornadas[0].estado, JORNADA_ESTADO.pendiente)
  assert.equal(jornadas[0].ingresoHora, formatTime(original[0].fechaHora))
  assert.equal(jornadas[0].egresoHora, 'Pendiente')
  assert.equal(jornadas[0].fichadasIntermedias, 0)
  assert.equal(jornadas[0].fichadasIntermediasLabel, 'Sin fichadas intermedias')
})

check('2. Dos fichadas históricas → primera y última', () => {
  const original = [
    punch({ id: 1, hours: 8, minutes: 0, tipo: 'Salida' }),
    punch({ id: 2, hours: 17, minutes: 10, tipo: 'Entrada' }),
  ]
  const jornadas = buildJornadas(original, new Map(), { todayKey: '2024-01-09' })
  assert.equal(jornadas[0].estado, JORNADA_ESTADO.completa)
  assert.equal(jornadas[0].ingresoHora, formatTime(original[0].fechaHora))
  assert.equal(jornadas[0].egresoHora, formatTime(original[1].fechaHora))
  assert.equal(jornadas[0].egresoDefinitivo, true)
  assert.equal(jornadas[0].fichadasIntermedias, 0)
})

check('3. Cinco fichadas → primera, última y tres intermedias', () => {
  const original = [
    punch({ id: 1, hours: 8, minutes: 0, tipo: 'Entrada' }),
    punch({ id: 2, hours: 10, minutes: 0, tipo: 'Salida' }),
    punch({ id: 3, hours: 13, minutes: 0, tipo: 'Entrada' }),
    punch({ id: 4, hours: 14, minutes: 0, tipo: 'Salida' }),
    punch({ id: 5, hours: 18, minutes: 4, tipo: 'Salida' }),
  ]
  const jornadas = buildJornadas(original, new Map(), { todayKey: '2024-01-09' })
  assert.equal(jornadas[0].fichadasIntermedias, 3)
  assert.equal(jornadas[0].fichadasIntermediasLabel, '3 fichadas intermedias')
  assert.equal(jornadas[0].ingresoHora, formatTime(original[0].fechaHora))
  assert.equal(jornadas[0].egresoHora, formatTime(original[4].fechaHora))
  const intermedios = jornadas[0].movimientos.filter((item) => item.esMovimientoIntermedio)
  assert.equal(intermedios.length, 3)
})

check('4. Dos fichadas separadas por 25 segundos → posible duplicado', () => {
  const original = [
    punch({ id: 1, hours: 10, minutes: 3, seconds: 0, tipo: 'Entrada' }),
    punch({ id: 2, hours: 10, minutes: 3, seconds: 25, tipo: 'Salida' }),
  ]
  const annotated = annotateMovimientos(original)
  assert.equal(annotated[0].esPosibleDuplicado, false)
  assert.equal(annotated[1].esPosibleDuplicado, true)
  assert.match(annotated[1].observacionLabel, /Posible duplicado/)
  assert.match(annotated[1].observacionLabel, /25 segundos después/)

  const jornadas = buildJornadas(original, new Map(), { todayKey: '2024-01-09' })
  assert.equal(jornadas[0].validos.length, 1)
  assert.equal(jornadas[0].estado, JORNADA_ESTADO.pendiente)
  assert.equal(jornadas[0].posiblesDuplicados, 1)
})

check('5. Dos fichadas separadas por 61 segundos → movimientos distintos', () => {
  const jornadas = buildJornadas(
    [
      punch({ id: 1, hours: 10, minutes: 0, seconds: 0, tipo: 'Entrada' }),
      punch({ id: 2, hours: 10, minutes: 1, seconds: 1, tipo: 'Salida' }),
    ],
    new Map(),
    { todayKey: '2024-01-09' },
  )
  assert.equal(jornadas[0].validos.length, 2)
  assert.equal(jornadas[0].posiblesDuplicados, 0)
  assert.equal(jornadas[0].estado, JORNADA_ESTADO.completa)
})

check('6. Tres fichadas consecutivas dentro de 60 segundos → un grupo', () => {
  const jornadas = buildJornadas(
    [
      punch({ id: 1, hours: 10, minutes: 0, seconds: 0, tipo: 'Entrada' }),
      punch({ id: 2, hours: 10, minutes: 0, seconds: 20, tipo: 'Salida' }),
      punch({ id: 3, hours: 10, minutes: 0, seconds: 40, tipo: 'Entrada' }),
    ],
    new Map(),
    { todayKey: '2024-01-09' },
  )
  assert.equal(jornadas[0].validos.length, 1)
  assert.equal(jornadas[0].posiblesDuplicados, 2)
  assert.equal(jornadas[0].movimientos.length, 3)
})

check('7. El movimiento duplicado sigue visible en auditoría', () => {
  const original = [
    punch({ id: 1, hours: 10, minutes: 3, seconds: 0, tipo: 'Entrada' }),
    punch({ id: 2, hours: 10, minutes: 3, seconds: 25, tipo: 'Salida' }),
  ]
  const annotated = annotateMovimientos(original)
  assert.equal(annotated.length, 2)
  assert.equal(annotated[1].id, 2)
  assert.equal(describeDetalleLinea(annotated[1]).includes('Posible duplicado'), true)
})

check('8. El Tipo original nunca se modifica', () => {
  const original = [
    punch({ id: 1, hours: 8, minutes: 0, tipo: 'Salida' }),
    punch({ id: 2, hours: 8, minutes: 0, seconds: 10, tipo: 'Entrada' }),
    punch({ id: 3, hours: 18, minutes: 0, tipo: 'Entrada' }),
  ]
  const annotated = annotateMovimientos(original)
  assert.equal(annotated[0].tipo, 'Salida')
  assert.equal(annotated[1].tipo, 'Entrada')
  assert.equal(annotated[2].tipo, 'Entrada')
  const jornadas = buildJornadas(original, new Map(), { todayKey: '2024-01-09' })
  assert.equal(jornadas[0].movimientos[0].tipo, 'Salida')
  assert.equal(jornadas[0].validos[0].tipo, 'Salida')
})

check('9. Jornada del día actual → En curso', () => {
  const jornadas = buildJornadas(
    [
      punch({ id: 1, hours: 9, minutes: 0, tipo: 'Entrada' }),
      punch({ id: 2, hours: 13, minutes: 0, tipo: 'Salida' }),
    ],
    new Map(),
    { todayKey: '2024-01-08' },
  )
  assert.equal(jornadas[0].estado, JORNADA_ESTADO.enCurso)
  assert.equal(jornadas[0].egresoDefinitivo, false)
  assert.match(jornadas[0].egresoHora, /última disponible/)
  assert.equal(jornadas[0].egresoHora.includes('18:00'), false)
})

check('10. Exportación de movimientos conserva registros', () => {
  const annotated = annotateMovimientos([
    punch({ id: 1, hours: 10, minutes: 0, tipo: 'Entrada' }),
    punch({ id: 2, hours: 10, minutes: 0, seconds: 20, tipo: 'Salida' }),
    punch({ id: 3, hours: 18, minutes: 0, tipo: 'Salida' }),
  ])
  const csv = buildCsv(
    ['Empleado', 'Legajo', 'Fecha', 'Hora', 'Tipo informado', 'Método', 'Observación'],
    annotated.map((item) => [
      item.empleado,
      item.legajo,
      item.fechaHora,
      item.fechaHora,
      item.tipo,
      item.metodo,
      item.observacionLabel,
    ]),
  )
  assert.equal(csv.split(/\r\n/).length, 4)
  assert.match(csv, /Tipo informado/)
  assert.match(csv, /Observación/)
  assert.match(csv, /Salida/)
  assert.match(csv, /Posible duplicado/)
})

check('11. Exportación de jornadas incluye el cálculo', () => {
  const original = [
    punch({ id: 1, hours: 8, minutes: 0, tipo: 'Entrada' }),
    punch({ id: 2, hours: 12, minutes: 0, tipo: 'Salida' }),
    punch({ id: 3, hours: 18, minutes: 0, tipo: 'Salida' }),
  ]
  const jornadas = buildJornadas(original, new Map(), { todayKey: '2024-01-09' })
  const rows = buildJornadasCsvRows(jornadas)
  assert.equal(rows[0][6], '1')
  assert.equal(rows[0][7], '0')
  assert.equal(rows[0][8], JORNADA_ESTADO.completa)
  assert.equal(rows[0][4], formatTime(original[0].fechaHora))
  assert.equal(rows[0][5], formatTime(original[2].fechaHora))
})

check('12. Los filtros recalculan indicadores', () => {
  const annotated = annotateMovimientos([
    punch({ id: 1, hours: 8, minutes: 0, tipo: 'Entrada' }),
    punch({ id: 2, hours: 8, minutes: 0, seconds: 15, tipo: 'Entrada' }),
    punch({ id: 3, hours: 18, minutes: 0, tipo: 'Salida' }),
  ])
  const all = summarizeMovimientosVista(annotated)
  assert.equal(all.total, 3)
  assert.equal(all.entradas, 2)
  assert.equal(all.salidas, 1)
  assert.equal(all.posiblesDuplicados, 1)

  const onlySalidas = filterMovimientosOriginales(annotated, { tipo: 'Salida' })
  const filtered = summarizeMovimientosVista(onlySalidas)
  assert.equal(filtered.total, 1)
  assert.equal(filtered.entradas, 0)
  assert.equal(filtered.salidas, 1)
  assert.equal(filtered.posiblesDuplicados, 0)

  const jornadas = buildJornadas(annotated, new Map(), { todayKey: '2024-01-09' })
  const jornadaTotals = summarizeJornadasVista(jornadas)
  assert.equal(jornadaTotals.total, 1)
  assert.equal(jornadaTotals.completas, 1)
})

check('13. Fechas locales sin desplazamiento UTC', () => {
  const utcMorning = new Date(Date.UTC(2024, 0, 9, 2, 30, 0))
  const jornadas = buildJornadas(
    [
      {
        id: 1,
        empleadoId: 7,
        empleado: 'Ana Pérez',
        legajo: '100',
        fechaHora: utcMorning.toISOString(),
        tipo: 'Entrada',
        metodo: 'Biometrico',
      },
    ],
    new Map(),
    { todayKey: '1999-01-01' },
  )
  assert.equal(jornadas[0].fecha, toDateKey(utcMorning))
  const utcKey = utcMorning.toISOString().slice(0, 10)
  if (toDateKey(utcMorning) !== utcKey) {
    assert.notEqual(jornadas[0].fecha, utcKey)
  }
})

check('14. Apertura repetida del detalle sin listeners duplicados', () => {
  const tableSrc = read('src/components/jornadas-table.js')
  const detalleSrc = read('src/components/jornada-detalle.js')
  const viewSrc = read('src/views/fichadas.js')
  const modalSrc = read('src/components/modal.js')
  assert.equal((tableSrc.match(/addEventListener\('click'/g) || []).length, 1)
  assert.match(tableSrc, /closest\('\[data-action="ver-movimientos"\]'\)/)
  assert.match(detalleSrc, /unsavedChanges: false/)
  assert.equal(detalleSrc.includes('document.addEventListener'), false)
  assert.match(viewSrc, /jornadaDetalleModal\?\.close\(\{ force: true \}\)/)
  assert.match(modalSrc, /document\.removeEventListener\('keydown', onKeyDown\)/)
})

check('15. Ninguna llamada POST, PUT, PATCH o DELETE', () => {
  const files = [
    'src/views/fichadas.js',
    'src/api/fichadas.js',
    'src/utils/jornadas.js',
    'src/utils/movimientos.js',
    'src/utils/fichadas-columns.js',
    'src/components/fichadas-table.js',
    'src/components/jornadas-table.js',
    'src/components/jornada-detalle.js',
    'src/components/fichadas-print.js',
    'src/components/column-picker.js',
  ]
  for (const file of files) {
    const src = read(file)
    assert.equal(/\bPOST\b/.test(src), false, file)
    assert.equal(/\bPUT\b/.test(src), false, file)
    assert.equal(/\bPATCH\b/.test(src), false, file)
    assert.equal(/\bDELETE\b/.test(src), false, file)
    assert.equal(src.includes('method: \'POST\''), false, file)
    assert.equal(src.includes('method: "POST"'), false, file)
  }
  assert.match(read('src/api/fichadas.js'), /\/api\/fichadas\?/)
})

check('El horario previsto no se usa como egreso', () => {
  const empleadoById = new Map([[7, { id: 7, horario: '09:00-18:00' }]])
  const jornadas = buildJornadas(
    [punch({ id: 1, hours: 10, minutes: 0, tipo: 'Entrada' })],
    empleadoById,
    { todayKey: '2024-01-09' },
  )
  assert.equal(jornadas[0].horarioPrevisto.includes('18:00') || jornadas[0].horarioPrevisto.includes('09:00'), true)
  assert.equal(jornadas[0].egresoHora, 'Pendiente')
})

check('El filtro de Tipo no recorta el resumen de jornadas', () => {
  const view = read('src/views/fichadas.js')
  assert.match(view, /filterMovimientosOriginales/)
  assert.match(view, /buildJornadas\(fichadas/)
  assert.match(view, /Tipo y Método filtran solo la auditoría/)
  assert.equal(view.includes('tipo: filters.tipo === \'todos\' ? undefined : filters.tipo'), false)
})

check('Columnas 1. Mostrar y ocultar cada columna opcional', () => {
  for (const optional of ['legajo', 'tipo', 'metodo', 'observacion']) {
    const ids = allColumnIds('movimientos').filter((id) => id !== optional)
    const visible = visibleColumns('movimientos', ids).map((column) => column.id)
    assert.equal(visible.includes(optional), false, optional)
    for (const required of requiredColumnIds('movimientos')) {
      assert.equal(visible.includes(required), true, required)
    }
  }
  for (const optional of ['legajo', 'horarioPrevisto', 'egreso', 'intermedias', 'detalle']) {
    const ids = allColumnIds('jornadas').filter((id) => id !== optional)
    assert.equal(visibleColumns('jornadas', ids).some((column) => column.id === optional), false, optional)
  }
  const picker = read('src/components/column-picker.js')
  assert.match(picker, /Columnas opcionales/)
  assert.match(picker, /alwaysVisibleLegend/)
  assert.equal(picker.includes('input.disabled = column.required'), false)
})

check('Columnas 2. Las columnas esenciales no se pueden ocultar', () => {
  const hiddenOptional = sanitizeColumnIds('movimientos', ['legajo'])
  for (const id of requiredColumnIds('movimientos')) {
    assert.equal(hiddenOptional.includes(id), true, id)
  }
  assert.equal(sanitizeColumnIds('movimientos', []).includes('empleado'), true)
  const jornadas = sanitizeColumnIds('jornadas', ['detalle'])
  for (const id of requiredColumnIds('jornadas')) {
    assert.equal(jornadas.includes(id), true, id)
  }
})

check('Columnas 3. Vista compacta', () => {
  assert.deepEqual(applyColumnPreset('movimientos', 'compact'), compactColumnIds('movimientos'))
  assert.deepEqual(applyColumnPreset('jornadas', 'compact'), compactColumnIds('jornadas'))
})

check('Columnas 4. Vista completa', () => {
  assert.deepEqual(applyColumnPreset('movimientos', 'full'), allColumnIds('movimientos'))
  assert.deepEqual(applyColumnPreset('jornadas', 'full'), allColumnIds('jornadas'))
})

check('Columnas 5. Restablecer', () => {
  assert.deepEqual(applyColumnPreset('movimientos', 'reset', { isMobile: false }), allColumnIds('movimientos'))
  assert.deepEqual(applyColumnPreset('movimientos', 'reset', { isMobile: true }), compactColumnIds('movimientos'))
})

check('Columnas 6. Preferencias independientes por pestaña', () => {
  const storage = memoryStorage()
  saveColumnIds('movimientos', compactColumnIds('movimientos'), { storage })
  saveColumnIds('jornadas', allColumnIds('jornadas'), { storage })
  assert.equal(storage.getItem(FICHADAS_COLUMN_STORAGE_KEYS.movimientos).includes('tipo'), true)
  assert.equal(storage.getItem(FICHADAS_COLUMN_STORAGE_KEYS.jornadas).includes('detalle'), true)
  assert.notEqual(
    FICHADAS_COLUMN_STORAGE_KEYS.movimientos,
    FICHADAS_COLUMN_STORAGE_KEYS.jornadas,
  )
  const loadedMov = loadColumnIds('movimientos', { storage, isMobile: false }).ids
  const loadedJor = loadColumnIds('jornadas', { storage, isMobile: false }).ids
  assert.deepEqual(loadedMov, compactColumnIds('movimientos'))
  assert.deepEqual(loadedJor, allColumnIds('jornadas'))
})

check('Columnas 7. Preferencia dañada', () => {
  const storage = memoryStorage({
    [FICHADAS_COLUMN_STORAGE_KEYS.movimientos]: '{no json',
  })
  const damaged = loadColumnIds('movimientos', { storage, isMobile: false })
  assert.equal(damaged.source, 'invalid')
  assert.deepEqual(damaged.ids, defaultColumnIds('movimientos', { isMobile: false }))

  storage.setItem(FICHADAS_COLUMN_STORAGE_KEYS.movimientos, JSON.stringify(['empleado', 'inexistente']))
  const unknown = loadColumnIds('movimientos', { storage, isMobile: false })
  assert.equal(unknown.source, 'invalid')
  assert.deepEqual(unknown.ids, defaultColumnIds('movimientos', { isMobile: false }))
})

check('Columnas 8. Cambio de filtros y paginación conserva selección', () => {
  const view = read('src/views/fichadas.js')
  assert.match(view, /onClientFilterChange/)
  assert.match(view, /movimientosPage = 1/)
  assert.equal(view.includes('columnPrefs.movimientos = defaultColumnIds'), false)
  assert.match(view, /saveColumnIds\(viewId, ids/)
})

check('Columnas 9. colspan correcto', () => {
  const compact = compactColumnIds('movimientos')
  assert.equal(visibleColumnCount('movimientos', compact), compact.length)
  assert.equal(visibleColumnCount('jornadas', requiredColumnIds('jornadas')), requiredColumnIds('jornadas').length)
  const tableSrc = read('src/components/fichadas-table.js')
  const jornadasSrc = read('src/components/jornadas-table.js')
  assert.match(tableSrc, /colspan="\$\{colspan\}"/)
  assert.match(jornadasSrc, /colspan="\$\{colspan\}"/)
  const view = read('src/views/fichadas.js')
  assert.match(view, /visibleColumnCount\(activeView, columnPrefs\[activeView\]\)/)
})

check('Columnas 10. No hay listeners duplicados', () => {
  const view = read('src/views/fichadas.js')
  assert.equal((view.match(/createColumnPicker\(/g) || []).length, 1)
  assert.match(view, /columnPicker\.setState/)
  assert.match(view, /columnPicker\.destroy\(\)/)
  assert.match(read('src/components/dropdown.js'), /AbortController/)
  assert.match(read('src/components/dropdown.js'), /abort\.abort\(\)/)
  assert.equal((read('src/components/jornadas-table.js').match(/addEventListener\('click'/g) || []).length, 1)
})

check('Columnas 11. CSV completo con columnas ocultas', () => {
  assert.deepEqual(MOVIMIENTOS_EXPORT_HEADERS, [
    'Empleado',
    'Legajo',
    'Fecha',
    'Hora',
    'Tipo informado',
    'Método',
    'Observación',
  ])
  const compact = compactColumnIds('movimientos')
  assert.equal(compact.includes('legajo'), false)
  assert.equal(MOVIMIENTOS_EXPORT_HEADERS.includes('Legajo'), true)
  const csv = buildCsv(MOVIMIENTOS_EXPORT_HEADERS, [['Ana', '100', '8/1/2024', '10:00', 'Entrada', 'Biométrico', '']])
  assert.match(csv, /Legajo/)
  assert.match(csv, /Método/)
})

check('Columnas 12. Impresión completa con columnas ocultas', () => {
  assert.equal(JORNADAS_PRINT_HEADERS.includes('Horario previsto'), true)
  assert.equal(JORNADAS_EXPORT_HEADERS.includes('Posibles duplicados'), true)
  assert.equal(compactColumnIds('jornadas').includes('horarioPrevisto'), false)
  const view = read('src/views/fichadas.js')
  assert.match(view, /columns: MOVIMIENTOS_EXPORT_HEADERS/)
  assert.match(view, /columns: JORNADAS_PRINT_HEADERS/)
})

check('Columnas 13. Móvil sin preferencia guardada', () => {
  assert.equal(isMobileColumnViewport(390), true)
  assert.equal(isMobileColumnViewport(1280), false)
  const storage = memoryStorage()
  const mobile = loadColumnIds('movimientos', { storage, isMobile: true })
  assert.equal(mobile.source, 'default')
  assert.deepEqual(mobile.ids, compactColumnIds('movimientos'))
  const desktop = loadColumnIds('jornadas', { storage, isMobile: false })
  assert.deepEqual(desktop.ids, allColumnIds('jornadas'))
})

check('Duplicados 14. 59 segundos: duplicado', () => {
  const original = [punchOffset(0, { id: 1, tipo: 'Entrada' }), punchOffset(59_000, { id: 2, tipo: 'Salida' })]
  const annotated = annotateMovimientos(original)
  assert.equal(isWithinDuplicateWindow(millisecondsBetweenMovimientos(original[0], original[1])), true)
  assert.equal(annotated[1].esPosibleDuplicado, true)
  assert.equal(annotated[1].observacionLabel, formatDuplicateDelay(59_000))
  assert.match(annotated[1].observacionLabel, /59 segundos después/)
})

check('Duplicados 15. 60 segundos: duplicado', () => {
  const original = [punchOffset(0, { id: 1, tipo: 'Entrada' }), punchOffset(60_000, { id: 2, tipo: 'Salida' })]
  const annotated = annotateMovimientos(original)
  assert.equal(DUPLICATE_WINDOW_MS, 60_000)
  assert.equal(annotated[1].esPosibleDuplicado, true)
  assert.equal(annotated[1].milisegundosDesdePrimera, 60_000)
  assert.equal(annotated[1].observacionLabel, 'Posible duplicado · 60 segundos después')
})

check('Duplicados 16. 60,001 segundos: independiente', () => {
  const original = [punchOffset(0, { id: 1, tipo: 'Entrada' }), punchOffset(60_001, { id: 2, tipo: 'Salida' })]
  const annotated = annotateMovimientos(original)
  assert.equal(isWithinDuplicateWindow(60_001), false)
  assert.equal(annotated[1].esPosibleDuplicado, false)
  assert.equal(annotated[1].observacionLabel.includes('62'), false)
  assert.equal(annotated[1].observacionLabel.includes('60,001'), false)
})

check('Duplicados 17. 61 y 62 segundos: independientes', () => {
  const at61 = annotateMovimientos([
    punchOffset(0, { id: 1, tipo: 'Entrada' }),
    punchOffset(61_000, { id: 2, tipo: 'Salida' }),
  ])
  const at62 = annotateMovimientos([
    punchOffset(0, { id: 1, tipo: 'Entrada' }),
    punchOffset(62_000, { id: 2, tipo: 'Salida' }),
  ])
  assert.equal(at61[1].esPosibleDuplicado, false)
  assert.equal(at62[1].esPosibleDuplicado, false)
})

check('Duplicados 18. Una secuencia no se agrupa indefinidamente por encadenamiento', () => {
  const original = [
    punchOffset(0, { id: 1, tipo: 'Entrada' }),
    punchOffset(31_000, { id: 2, tipo: 'Salida' }),
    punchOffset(62_000, { id: 3, tipo: 'Entrada' }),
  ]
  const annotated = annotateMovimientos(original)
  assert.equal(annotated[1].esPosibleDuplicado, true)
  assert.equal(annotated[2].esPosibleDuplicado, false)
  const jornadas = buildJornadas(original, new Map(), { todayKey: '2024-01-09' })
  assert.equal(jornadas[0].validos.length, 2)
  assert.equal(jornadas[0].posiblesDuplicados, 1)
  assert.equal(read('src/utils/movimientos.js').includes('Math.round'), false)
})

check('Duplicados 19. El Tipo original nunca se modifica', () => {
  const original = [
    punchOffset(0, { id: 1, tipo: 'Salida' }),
    punchOffset(10_000, { id: 2, tipo: 'Entrada' }),
  ]
  const annotated = annotateMovimientos(original)
  assert.equal(annotated[0].tipo, 'Salida')
  assert.equal(annotated[1].tipo, 'Entrada')
})

check('Duplicados 20. No se ejecutan solicitudes de escritura', () => {
  const picker = read('src/components/column-picker.js')
  assert.equal(/\bPOST\b/.test(picker), false)
  assert.equal(picker.includes('fetch('), false)
  assert.match(read('src/views/fichadas.js'), /columnPicker\.destroy\(\)/)
})

check('Columnas opcionales: el menú no lista obligatorias', () => {
  const picker = read('src/components/column-picker.js')
  assert.match(picker, /Columnas opcionales/)
  assert.match(picker, /alwaysVisibleLegend/)
  assert.equal(picker.includes('Empleado, Fecha y Hora'), false)
  assert.match(read('src/utils/fichadas-columns.js'), /Siempre visibles: Empleado, Fecha y Hora/)
  assert.match(read('src/utils/fichadas-columns.js'), /Siempre visibles: Empleado, Fecha, Ingreso y Estado/)
  const damaged = sanitizeColumnIds('movimientos', ['legajo'])
  assert.deepEqual(requiredColumnIds('movimientos').every((id) => damaged.includes(id)), true)
})

check('Tooltip de movimiento intermedio accesible', () => {
  assert.match(
    INTERMEDIATE_MOVIMIENTO_TOOLTIP,
    /primera y la última marcación/,
  )
  const tooltip = read('src/components/tooltip.js')
  assert.match(tooltip, /setAttribute\('role', 'tooltip'\)/)
  assert.match(tooltip, /aria-describedby/)
  assert.equal(tooltip.includes("addEventListener('keydown'") && tooltip.includes('documentBound'), true)
  const table = read('src/components/fichadas-table.js')
  assert.match(table, /tooltip: INTERMEDIATE_MOVIMIENTO_TOOLTIP/)
  assert.match(read('src/components/badge.js'), /data-tooltip/)
  assert.equal(table.includes('Marcación entre el ingreso y el egreso calculados'), false)
})

check('Botones secundarios de Fichadas usan btn-secondary', () => {
  const view = read('src/views/fichadas.js')
  const css = read('src/style.css')
  assert.match(view, /id="fichadas-clear" class="\$\{BTN_SECONDARY_CLASS\}"/)
  assert.match(view, /id="fichadas-csv" class="\$\{BTN_SECONDARY_CLASS\}"/)
  assert.match(view, /id="fichadas-print" class="rounded-lg bg-blue-600/)
  assert.equal(view.includes('id="fichadas-print" class="${BTN_SECONDARY_CLASS}"'), false)
  assert.match(css, /\.btn-secondary/)
  assert.match(css, /prefers-reduced-motion: reduce/)
  assert.match(css, /translateY\(1px\)/)
  assert.match(css, /cursor: pointer/)
  assert.match(css, /cursor: not-allowed/)
  assert.match(css, /:focus-visible/)
  assert.equal(/id="fichadas-clear"[^>]*style=/.test(view), false)
  assert.equal(/id="fichadas-csv"[^>]*style=/.test(view), false)
})

console.log(`${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
