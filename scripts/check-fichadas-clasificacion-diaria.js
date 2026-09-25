import assert from 'node:assert/strict'
import { fichadaDateKey } from '../src/utils/format.js'
import { buildFichadasExportSnapshot, buildFichadasViewSelection } from '../src/utils/fichadas-export.js'
import { buildJornadas, JORNADA_ESTADO } from '../src/utils/jornadas.js'
import {
  clasificarFichadas,
  filterMovimientosOriginales,
  MOVIMIENTO_VISUAL,
} from '../src/utils/movimientos.js'
import { paginateItems } from '../src/utils/paginate.js'

let failed = 0

function check(name, fn) {
  try {
    fn()
    console.log(`ok - ${name}`)
  } catch (error) {
    failed += 1
    console.error(`not ok - ${name}`)
    console.error(error)
  }
}

function at(iso, extra = {}) {
  return {
    id: extra.id,
    empleadoId: extra.empleadoId ?? 1,
    empleado: extra.empleado ?? 'Ana',
    fechaHora: iso,
    tipo: extra.tipo ?? 'Salida',
    metodo: extra.metodo ?? 'Biometrico',
  }
}

const past = '2026-03-01T15:00:00Z'

check('1. Un día impar anterior no arrastra la primera fichada de hoy', () => {
  const rows = clasificarFichadas(
    [
      at('2026-03-01T11:00:00Z', { id: 1 }),
      at('2026-03-01T15:00:00Z', { id: 2 }),
      at('2026-03-01T20:00:00Z', { id: 3 }),
      at('2026-03-02T11:00:00Z', { id: 4, tipo: 'Salida' }),
    ],
    { now: new Date('2026-03-02T18:00:00Z') },
  )
  const today = rows.find((item) => item.id === 4)
  assert.equal(today.movimientoVisual, MOVIMIENTO_VISUAL.entrada)
  assert.equal(today.tipo, 'Salida')
})

check('2. Una fichada pasada es entrada incompleta y no inventa salida', () => {
  const [only] = clasificarFichadas([at('2026-03-01T11:00:00Z', { id: 1, tipo: 'Salida' })], {
    now: new Date('2026-03-02T15:00:00Z'),
  })
  assert.equal(only.movimientoVisual, MOVIMIENTO_VISUAL.entrada)
  assert.equal(only.jornadaEstado, JORNADA_ESTADO.incompleta)
  assert.equal(only.esSalidaProvisional, false)
  const jornada = buildJornadas([at('2026-03-01T11:00:00Z', { id: 1 })], new Map(), {
    todayKey: '2026-03-02',
  })[0]
  assert.equal(jornada.egresoHora, 'Sin salida')
})

check('3. Dos fichadas', () => {
  const rows = clasificarFichadas(
    [at('2026-03-01T11:00:00Z', { id: 1 }), at('2026-03-01T20:00:00Z', { id: 2 })],
    { now: new Date(past) },
  ).sort((a, b) => a.id - b.id)
  assert.deepEqual(rows.map((item) => item.movimientoVisual), [MOVIMIENTO_VISUAL.entrada, MOVIMIENTO_VISUAL.salida])
})

check('4. Tres fichadas', () => {
  const rows = clasificarFichadas(
    [1, 2, 3].map((id) => at(`2026-03-01T${10 + id}:00:00Z`, { id })),
    { now: new Date(past) },
  ).sort((a, b) => a.id - b.id)
  assert.deepEqual(rows.map((item) => item.movimientoVisual), [
    MOVIMIENTO_VISUAL.entrada,
    MOVIMIENTO_VISUAL.intermedio,
    MOVIMIENTO_VISUAL.salida,
  ])
})

check('5. Cuatro fichadas', () => {
  const rows = clasificarFichadas(
    [1, 2, 3, 4].map((id) => at(`2026-03-01T${9 + id}:00:00Z`, { id })),
    { now: new Date(past) },
  ).sort((a, b) => a.id - b.id)
  assert.deepEqual(rows.map((item) => item.movimientoVisual), [
    MOVIMIENTO_VISUAL.entrada,
    MOVIMIENTO_VISUAL.intermedio,
    MOVIMIENTO_VISUAL.intermedio,
    MOVIMIENTO_VISUAL.salida,
  ])
})

check('6. Una fichada nueva corre la salida provisional', () => {
  const now = new Date('2026-03-10T20:00:00Z')
  const base = [
    at('2026-03-10T11:00:00Z', { id: 1 }),
    at('2026-03-10T15:30:00Z', { id: 2 }),
  ]
  const firstPass = clasificarFichadas(base, { now })
  assert.equal(firstPass.find((item) => item.id === 2).movimientoVisual, MOVIMIENTO_VISUAL.salida)
  assert.equal(firstPass.find((item) => item.id === 2).esSalidaProvisional, false)
  const second = clasificarFichadas([...base, at('2026-03-10T16:30:00Z', { id: 3 })], { now })
  assert.equal(second.find((item) => item.id === 2).movimientoVisual, MOVIMIENTO_VISUAL.intermedio)
  assert.equal(second.find((item) => item.id === 3).movimientoVisual, MOVIMIENTO_VISUAL.salida)
})

check('7 y 8. Empleados y fechas no se mezclan', () => {
  const rows = clasificarFichadas(
    [
      at('2026-03-01T11:00:00Z', { id: 1, empleadoId: 1 }),
      at('2026-03-01T18:00:00Z', { id: 2, empleadoId: 2 }),
      at('2026-03-02T11:00:00Z', { id: 3, empleadoId: 1 }),
    ],
    { now: new Date('2026-03-03T15:00:00Z') },
  )
  assert.equal(rows.every((item) => item.movimientoVisual === MOVIMIENTO_VISUAL.entrada), true)
})

check('9. El cambio de día usa America/Argentina/Buenos_Aires', () => {
  assert.equal(fichadaDateKey('2026-01-02T02:30:00Z'), '2026-01-01')
  assert.equal(fichadaDateKey('2026-01-02T02:30:00'), '2026-01-02')
  const rows = clasificarFichadas(
    [at('2026-01-02T02:30:00Z', { id: 1 }), at('2026-01-02T12:00:00Z', { id: 2 })],
    { now: new Date('2026-01-03T15:00:00Z') },
  )
  assert.equal(rows.find((item) => item.id === 1).movimientoVisual, MOVIMIENTO_VISUAL.entrada)
  assert.equal(rows.find((item) => item.id === 2).movimientoVisual, MOVIMIENTO_VISUAL.entrada)
})

check('10. El filtro de tipo ocurre después de clasificar', () => {
  const classified = clasificarFichadas(
    [
      at('2026-03-01T11:00:00Z', { id: 1, tipo: 'Salida' }),
      at('2026-03-01T15:00:00Z', { id: 2, tipo: 'Entrada' }),
      at('2026-03-01T20:00:00Z', { id: 3, tipo: 'Entrada' }),
    ],
    { now: new Date(past) },
  )
  const salidas = filterMovimientosOriginales(classified, { tipo: 'Salida' })
  assert.equal(salidas.length, 1)
  assert.equal(salidas[0].id, 3)
  assert.equal(salidas[0].tipo, 'Entrada')
})

check('11. La página visible no define la clasificación', () => {
  const all = [1, 2, 3, 4].map((id) => at(`2026-03-01T${9 + id}:00:00Z`, { id }))
  const classified = clasificarFichadas(all, { now: new Date(past) })
  const page = paginateItems(classified, 2, 2)
  assert.equal(page.items[0].id, 3)
  assert.equal(page.items[0].movimientoVisual, MOVIMIENTO_VISUAL.intermedio)
  const onlyPage = clasificarFichadas(page.items, { now: new Date(past) })
  assert.equal(onlyPage[0].movimientoVisual, MOVIMIENTO_VISUAL.entrada)
  assert.notEqual(onlyPage[0].movimientoVisual, page.items[0].movimientoVisual)
})

check('12. El tipo original queda intacto', () => {
  const source = at('2026-03-01T11:00:00Z', { id: 1, tipo: 'Salida' })
  const [row] = clasificarFichadas([source], { now: new Date(past) })
  assert.equal(source.tipo, 'Salida')
  assert.equal(row.tipo, 'Salida')
  assert.equal(row.movimientoInformado, 'Salida')
  assert.equal(row.movimientoVisual, MOVIMIENTO_VISUAL.entrada)
})

check('13. CSV y PDF usan la clasificación visual', () => {
  const records = clasificarFichadas(
    [at('2026-03-01T11:00:00Z', { id: 1, tipo: 'Salida' }), at('2026-03-01T20:00:00Z', { id: 2, tipo: 'Entrada' })],
    { now: new Date(past) },
  )
  const selection = buildFichadasViewSelection({
    view: 'movimientos',
    records,
    columnIds: ['tipo'],
    filters: { periodo: '7', tipo: 'todos', metodo: 'todos' },
    empresa: 'Empresa',
    generatedAt: '2026-03-02',
  })
  const snapshot = buildFichadasExportSnapshot(selection, { mode: 'view' })
  assert.deepEqual(snapshot.csvRows.map((row) => row[0]), ['Entrada', 'Salida'])
  assert.deepEqual(snapshot.printRows.map((row) => row[0]), ['Entrada', 'Salida'])
})

check('15. Un posible duplicado marca la jornada para revisar', () => {
  const rows = clasificarFichadas(
    [at('2026-03-01T11:00:00Z', { id: 1 }), at('2026-03-01T11:00:20Z', { id: 2, tipo: 'Salida' })],
    { now: new Date(past) },
  )
  assert.equal(rows[1].esPosibleDuplicado, true)
  assert.equal(rows[0].jornadaEstado, JORNADA_ESTADO.enCurso)
  assert.equal(rows[1].tipo, 'Salida')
})

if (failed) {
  console.error(`${failed} failed`)
  process.exit(1)
}
