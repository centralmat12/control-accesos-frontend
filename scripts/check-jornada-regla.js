import assert from 'node:assert/strict'
import { buildDashboardData } from '../src/api/dashboard.js'
import { buildJornadas, JORNADA_ESTADO } from '../src/utils/jornadas.js'
import { JORNADA_PRINT_NOTE } from '../src/utils/fichadas-export.js'
import { MOVIMIENTO_VISUAL, clasificarFichadas } from '../src/utils/movimientos.js'
import { NIGHT_SCALE, barGeometry, cruzaMedianoche, nightAxisMinute } from '../src/components/fichadas-timeline.js'

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

function punch(fechaHora, extra = {}) {
  return {
    id: extra.id ?? 1,
    empleadoId: extra.empleadoId ?? 7,
    empleado: 'Ana',
    legajo: '0007',
    fechaHora,
    tipo: extra.tipo ?? 'Entrada',
    metodo: 'Biometrico',
  }
}

function one(fechaHora, now, horario) {
  const empleados = horario ? new Map([[7, { id: 7, horario }]]) : new Map()
  return buildJornadas([punch(fechaHora)], empleados, { now })[0]
}

check('1. Sin fichadas no hay jornada', () => {
  assert.equal(buildJornadas([], new Map(), { now: '2026-09-23T12:00:00' }).length, 0)
})

check('2. Una fichada hace menos de 12 horas queda en curso', () => {
  const jornada = one('2026-09-23T08:03:00', '2026-09-23T19:59:59.999')
  assert.equal(jornada.estado, JORNADA_ESTADO.enCurso)
  assert.equal(jornada.egresoHora, 'En curso')
  assert.match(jornada.actividadRegistrada, /\(provisional\)/)
})

check('3. Exactamente a las 12 horas queda incompleta', () => {
  const jornada = one('2026-09-23T08:00:00', '2026-09-23T20:00:00.000')
  assert.equal(jornada.estado, JORNADA_ESTADO.incompleta)
  assert.equal(jornada.motivo, 'Falta fichada de salida')
  assert.equal(jornada.egresoHora, 'Sin salida')
  assert.equal(jornada.actividadRegistrada, '—')
})

check('4. Más de 12 horas queda incompleta', () => {
  const jornada = one('2026-09-23T08:00:00', '2026-09-23T20:00:00.001')
  assert.equal(jornada.estado, JORNADA_ESTADO.incompleta)
  assert.equal(jornada.actividadRegistrada, '—')
})

check('5. Una fichada de un día anterior queda incompleta', () => {
  const jornada = one('2026-09-22T18:00:00', '2026-09-23T00:00:00')
  assert.equal(jornada.estado, JORNADA_ESTADO.incompleta)
  assert.equal(jornada.ingresoHora, '18:00')
  assert.equal(jornada.egresoHora, 'Sin salida')
})

check('6 y 7. La medianoche cierra el día y la primera fichada siguiente es una entrada nueva', () => {
  const rows = buildJornadas(
    [punch('2026-09-22T23:59:59', { id: 1 }), punch('2026-09-23T00:00:00', { id: 2 })],
    new Map(),
    { now: '2026-09-23T00:10:00' },
  )
  const ayer = rows.find((item) => item.fecha === '2026-09-22')
  const hoy = rows.find((item) => item.fecha === '2026-09-23')
  assert.equal(ayer.estado, JORNADA_ESTADO.incompleta)
  assert.equal(hoy.estado, JORNADA_ESTADO.enCurso)
  assert.equal(hoy.movimientos[0].movimientoVisual, MOVIMIENTO_VISUAL.entrada)
})

check('8. Dos fichadas completan la jornada', () => {
  const jornada = buildJornadas(
    [punch('2026-09-22T08:03:00', { id: 1 }), punch('2026-09-22T17:02:00', { id: 2 })],
    new Map(),
    { now: '2026-09-23T09:00:00' },
  )[0]
  assert.equal(jornada.estado, JORNADA_ESTADO.completa)
  assert.equal(jornada.egresoHora, '17:02')
  assert.equal(jornada.actividadRegistrada, '8 h 59 min')
})

check('9 y 10. Tres y cuatro fichadas dejan intermedias', () => {
  const four = buildJornadas(
    [
      punch('2026-09-22T08:00:00', { id: 1 }),
      punch('2026-09-22T12:15:00', { id: 2 }),
      punch('2026-09-22T13:10:00', { id: 3 }),
      punch('2026-09-22T17:02:00', { id: 4 }),
    ],
    new Map(),
    { now: '2026-09-23T09:00:00' },
  )[0]
  assert.deepEqual(
    four.movimientos.map((item) => item.movimientoVisual),
    [MOVIMIENTO_VISUAL.entrada, MOVIMIENTO_VISUAL.intermedio, MOVIMIENTO_VISUAL.intermedio, MOVIMIENTO_VISUAL.salida],
  )
})

check('11 y 12. El orden real y una salida tardía recalculan la jornada', () => {
  const late = buildJornadas(
    [punch('2026-09-22T17:02:00', { id: 2 }), punch('2026-09-22T08:00:00', { id: 1 })],
    new Map(),
    { now: '2026-09-23T09:00:00' },
  )[0]
  assert.equal(late.estado, JORNADA_ESTADO.completa)
  assert.equal(late.ingresoHora, '08:00')
  assert.equal(late.egresoHora, '17:02')
})

check('13. Más de 12 horas entre fichadas queda para revisar', () => {
  const jornada = buildJornadas(
    [punch('2026-09-22T08:00:00', { id: 1 }), punch('2026-09-22T20:00:01', { id: 2 })],
    new Map(),
    { now: '2026-09-23T09:00:00' },
  )[0]
  assert.equal(jornada.estado, JORNADA_ESTADO.revisar)
  assert.match(jornada.motivo, /12 horas/)
})

check('14. Un timestamp futuro queda para revisar', () => {
  const jornada = one('2026-09-23T18:00:00', '2026-09-23T12:00:00')
  assert.equal(jornada.estado, JORNADA_ESTADO.revisar)
  assert.match(jornada.motivo, /futura/)
})

check('15. Un posible duplicado no convierte una entrada en jornada completa', () => {
  const jornada = buildJornadas(
    [punch('2026-09-23T08:00:00', { id: 1 }), punch('2026-09-23T08:00:30', { id: 2 })],
    new Map(),
    { now: '2026-09-23T10:00:00' },
  )[0]
  assert.equal(jornada.estado, JORNADA_ESTADO.enCurso)
  assert.equal(jornada.egresoHora, 'En curso')
  assert.equal(jornada.advertencia, '1 posible duplicado')
})

check('16 y 17. El turno nocturno configurado cruza la medianoche y cierra a las 12 horas', () => {
  const empleados = new Map([[7, { id: 7, horario: '22:00-06:00' }]])
  const abierta = buildJornadas(
    [punch('2026-09-22T22:00:00', { id: 1 }), punch('2026-09-23T05:30:00', { id: 2 })],
    empleados,
    { now: '2026-09-23T06:00:00' },
  )
  assert.equal(abierta.length, 1)
  assert.equal(abierta[0].fecha, '2026-09-22')
  assert.equal(abierta[0].estado, JORNADA_ESTADO.completa)
  const vencida = buildJornadas([punch('2026-09-22T22:00:00')], empleados, { now: '2026-09-23T10:00:00' })[0]
  assert.equal(vencida.estado, JORNADA_ESTADO.incompleta)
  assert.equal(vencida.egresoHora, 'Sin salida')
})

check('18. La zona argentina no depende de un host en UTC', () => {
  const rows = clasificarFichadas([punch('2026-09-23T00:30:00Z')], { now: '2026-09-23T12:00:00Z' })
  assert.equal(rows[0].jornadaFecha, '2026-09-22')
  assert.equal(rows[0].jornadaEstado, JORNADA_ESTADO.incompleta)
})

check('19 y 20. Resumen, clasificación y PDF comparten el estado y no inventan salida', () => {
  const fichadas = [punch('2026-09-22T08:00:00')]
  const now = '2026-09-23T09:00:00'
  const clasificada = clasificarFichadas(fichadas, { now })[0]
  const jornada = buildJornadas(fichadas, new Map(), { now })[0]
  assert.equal(clasificada.jornadaEstado, jornada.estado)
  assert.equal(jornada.egresoHora, 'Sin salida')
  assert.equal(jornada.actividadRegistrada, '—')
  assert.match(JORNADA_PRINT_NOTE, /no incluyen una duración calculada/)
  assert.equal(jornada.movimientos.some((item) => item.movimientoVisual === MOVIMIENTO_VISUAL.salida), false)
})

check('El Dashboard cuenta la clasificación calculada', () => {
  const empleados = [{ id: 7, horario: '09:00-18:00' }]
  const now = '2026-09-23T18:00:00'
  const fichadas = [
    punch('2026-09-23T08:00:00', { id: 1, tipo: 'Salida' }),
    punch('2026-09-23T12:00:00', { id: 2, tipo: 'Entrada' }),
    punch('2026-09-23T17:00:00', { id: 3, tipo: 'Entrada' }),
    punch('2026-09-22T08:00:00', { id: 4, tipo: 'Salida' }),
  ]
  const data = buildDashboardData(empleados, fichadas, { now })
  assert.equal(data.fichadasHoy, 4)
  assert.equal(data.entradas, 2)
  assert.equal(data.salidas, 1)
  assert.equal(data.entradas + data.salidas === data.fichadasHoy, false)
})

check('Duplicado nocturno 23:59:40 y 00:00:20 no es una salida', () => {
  const empleados = new Map([[7, { horario: '22:00-06:00' }]])
  const jornada = buildJornadas(
    [
      punch('2026-09-22T23:59:40', { id: 1 }),
      punch('2026-09-23T00:00:20', { id: 2, tipo: 'Salida' }),
    ],
    empleados,
    { now: '2026-09-23T01:00:00' },
  )[0]
  assert.equal(jornada.fecha, '2026-09-22')
  assert.equal(jornada.movimientos[1].esPosibleDuplicado, true)
  assert.equal(jornada.movimientos[1].tipo, 'Salida')
  assert.equal(jornada.estado, JORNADA_ESTADO.enCurso)
  assert.equal(jornada.egresoHora, 'En curso')
  assert.equal(jornada.advertencia, '1 posible duplicado')
})

check('Completa con duplicado sigue verde y una sola fichada respeta las 12 horas', () => {
  const entrada = buildJornadas(
    [
      punch('2026-09-22T07:53:00', { id: 1 }),
      punch('2026-09-22T07:53:30', { id: 2 }),
      punch('2026-09-22T17:02:00', { id: 3 }),
    ],
    new Map(),
    { now: '2026-09-22T18:00:00' },
  )[0]
  assert.equal(entrada.estado, JORNADA_ESTADO.completa)
  assert.equal(entrada.ingresoHora, '07:53')
  assert.equal(entrada.egresoHora, '17:02')
  assert.equal(entrada.actividadRegistrada, '9 h 09 min')
  assert.equal(entrada.advertencia, '1 posible duplicado')
  const salida = buildJornadas(
    [
      punch('2026-09-22T08:00:00', { id: 1 }),
      punch('2026-09-22T17:02:00', { id: 2 }),
      punch('2026-09-22T17:02:20', { id: 3 }),
    ],
    new Map(),
    { now: '2026-09-22T18:00:00' },
  )[0]
  assert.equal(salida.estado, JORNADA_ESTADO.completa)
  assert.equal(salida.egresoHora, '17:02')
  assert.equal(salida.advertencia, '1 posible duplicado')
  const casi = one('2026-09-23T08:00:00', '2026-09-23T19:59:00')
  const exacta = one('2026-09-23T08:00:00', '2026-09-23T20:00:00')
  const larga = one('2026-09-23T07:58:00', '2026-09-23T23:31:00')
  assert.equal(casi.estado, JORNADA_ESTADO.enCurso)
  assert.equal(exacta.estado, JORNADA_ESTADO.incompleta)
  assert.equal(exacta.egresoHora, 'Sin salida')
  assert.equal(exacta.actividadRegistrada, '—')
  assert.equal(larga.estado, JORNADA_ESTADO.incompleta)
  assert.equal(larga.actividadRegistrada, '—')
  const dashboard = buildDashboardData([{ id: 7 }], [punch('2026-09-23T07:58:00')], { now: '2026-09-23T23:31:00' })
  assert.equal(dashboard.entradas, 1)
  assert.equal(dashboard.salidas, 0)
})

check('Cinco minutos de tolerancia y un minuto más', () => {
  const dentro = one('2026-09-23T12:05:00', '2026-09-23T12:00:00')
  const fuera = one('2026-09-23T12:05:00.001', '2026-09-23T12:00:00')
  assert.equal(dentro.estado, JORNADA_ESTADO.enCurso)
  assert.equal(fuera.estado, JORNADA_ESTADO.revisar)
  assert.equal(fuera.motivo, 'La fichada posee una fecha u hora futura')
})

check('Turno nocturno visual en una sola escala con host UTC', () => {
  const empleados = new Map([[7, { horario: '22:00-06:00' }]])
  const jornada = buildJornadas(
    [punch('2026-09-23T01:00:00Z', { id: 1 }), punch('2026-09-23T08:30:00Z', { id: 2 })],
    empleados,
    { now: '2026-09-23T12:00:00Z' },
  )[0]
  assert.equal(cruzaMedianoche(jornada), true)
  const geometry = barGeometry(nightAxisMinute(22 * 60), nightAxisMinute(6 * 60), NIGHT_SCALE.start, NIGHT_SCALE.end)
  assert.equal(geometry.left, 0)
  assert.equal(geometry.width, 100)
  assert.equal(jornada.estado, JORNADA_ESTADO.completa)
})

if (failed) process.exit(1)
