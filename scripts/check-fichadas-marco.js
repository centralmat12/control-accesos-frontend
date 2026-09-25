import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { FICHADAS_BODY_CLASS, FICHADAS_FRAME_CLASS } from '../src/components/fichadas-frame.js'
import { barGeometry, nowLabelAlign, resolveFranja, scaleTicks, visibleScaleTicks } from '../src/components/fichadas-timeline.js'
import { resolveFichadasView } from '../src/views/fichadas.js'
import { actividadRegistradaLabel, JORNADA_ESTADO } from '../src/utils/jornadas.js'
import { JORNADA_PRINT_COLUMNS, JORNADA_PRINT_NOTE } from '../src/utils/fichadas-export.js'
import { formatFichadaFecha, formatFichadaHora } from '../src/utils/format.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (file) => readFileSync(join(root, file), 'utf8')
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

check('Las tres vistas comparten marco y altura', () => {
  const view = read('src/views/fichadas.js')
  const table = read('src/components/fichadas-table.js')
  const jornadas = read('src/components/jornadas-table.js')
  const timeline = read('src/components/fichadas-timeline.js')
  assert.match(view, new RegExp(FICHADAS_FRAME_CLASS.split(' ')[0]))
  assert.match(table, /FICHADAS_BODY_CLASS/)
  assert.match(jornadas, /FICHADAS_BODY_CLASS/)
  assert.match(timeline, /FICHADAS_BODY_CLASS/)
  assert.match(FICHADAS_BODY_CLASS, /clamp\(440px,58vh,620px\)/)
})

check('La línea de tiempo no dibuja puntos y la franja automática cubre 06–20', () => {
  const timeline = read('src/components/fichadas-timeline.js')
  assert.equal(timeline.includes('rounded-full'), false)
  const band = resolveFranja('auto', [7 * 60 + 18, 17 * 60 + 3])
  assert.equal(band.start, 6 * 60)
  assert.equal(band.end, 20 * 60)
  const early = resolveFranja('auto', [5 * 60 + 25])
  assert.equal(early.start <= 5 * 60, true)
  const office = resolveFranja('office', [22 * 60 + 10])
  assert.equal(office.outside, true)
  assert.equal(resolveFranja('custom', [], { start: 10 * 60, end: 9 * 60 }), null)
})

check('Fecha y hora de fichada usan DD/MM y HH:mm', () => {
  assert.equal(formatFichadaFecha('2026-09-23'), '23/09/2026')
  assert.equal(formatFichadaHora('2026-09-23T07:53:00'), '07:53')
})

check('Resumen no usa Última disponible y el dashboard reutiliza jornadas', () => {
  const jornadas = read('src/utils/jornadas.js')
  const dashboard = read('src/components/recent-punches-table.js')
  assert.equal(jornadas.includes('última disponible'), false)
  assert.match(read('src/components/jornadas-table.js'), /Primera fichada/)
  assert.match(read('src/components/jornadas-table.js'), /Última fichada/)
  assert.match(dashboard, /buildJornadas/)
  assert.match(dashboard, /Jornadas de hoy/)
  assert.match(dashboard, /Ver línea de tiempo completa/)
  assert.match(read('src/views/dashboard.js'), /fichadasView: 'timeline'/)
  assert.match(read('src/views/fichadas.js'), /Franja horaria/)
  const activity = read('src/components/recent-punches-table.js')
  const viewportAt = activity.indexOf('data-actividad-viewport')
  const footerAt = activity.indexOf('data-view-all')
  assert.equal(viewportAt > 0 && footerAt > viewportAt, true)
  assert.match(activity, /data-actividad-viewport class="min-h-0 flex-1 overflow-auto/)
  assert.equal((activity.match(/overflow-auto/g) || []).length, 1)
})

check('La cronología es proporcional y no usa un ancho mínimo fijo', () => {
  const timeline = read('src/components/fichadas-timeline.js')
  const dashboard = read('src/components/recent-punches-table.js')
  assert.equal(/min-w-\[\d+rem\]/.test(timeline), false)
  assert.match(timeline, /minmax\(0,1fr\)/)
  assert.match(timeline, /barGeometry/)
  assert.match(timeline, /variant === 'compact'/)
  assert.match(dashboard, /createFichadasTimeline/)
  assert.match(timeline, /overflow-x-hidden/)
  assert.match(timeline, /sticky top-0/)
  assert.match(dashboard, /data-actividad-viewport/)
  assert.match(dashboard, /data-view-all/)
  const office = barGeometry(8 * 60, 17 * 60, 6 * 60, 20 * 60)
  assert.equal(Math.round(office.left), 14)
  assert.equal(Math.round(office.width), 64)
  const day = barGeometry(0, 24 * 60, 0, 24 * 60)
  assert.equal(day.left, 0)
  assert.equal(day.width, 100)
  const custom = resolveFranja('custom', [], { start: 9 * 60, end: 18 * 60 })
  const customBar = barGeometry(9 * 60, 18 * 60, custom.start, custom.end)
  assert.equal(customBar.left, 0)
  assert.equal(customBar.width, 100)
  const wide = visibleScaleTicks(scaleTicks(6 * 60, 20 * 60), 1440)
  const narrow = visibleScaleTicks(scaleTicks(6 * 60, 20 * 60), 390)
  assert.equal(wide[0], 6 * 60)
  assert.equal(wide.at(-1), 20 * 60)
  assert.equal(narrow[0], 6 * 60)
  assert.equal(narrow.at(-1), 20 * 60)
  assert.equal(narrow.length < wide.length, true)
  assert.equal(nowLabelAlign(2), 'start')
  assert.equal(nowLabelAlign(50), 'center')
  assert.equal(nowLabelAlign(98), 'end')
  assert.match(timeline, /Ahora/)
  assert.match(timeline, /iconClock/)
  assert.match(timeline, /Hora actual:/)
  assert.match(timeline, /aria-hidden="true"/)
  assert.match(timeline, /60000/)
  assert.match(timeline, /clearNowTimer/)
  assert.match(timeline, /data-short/)
  assert.match(timeline, /data-tooltip/)
  assert.match(timeline, /truncate/)
  assert.match(timeline, /focus-visible:ring-2/)
  assert.match(timeline, /dark:bg-slate-900/)
  assert.match(timeline, /dark:bg-red-950/)
})

check('Las vistas de fichadas se ordenan por identificador y el PDF resume la jornada', () => {
  const view = read('src/views/fichadas.js')
  const timelineAt = view.indexOf('id="fichadas-tab-timeline"')
  const summaryAt = view.indexOf('id="fichadas-tab-jornadas"')
  const movementsAt = view.indexOf('id="fichadas-tab-movimientos"')
  assert.equal(timelineAt < summaryAt && summaryAt < movementsAt, true)
  assert.equal(resolveFichadasView(undefined), 'timeline')
  assert.equal(resolveFichadasView('summary'), 'jornadas')
  assert.equal(resolveFichadasView('movements'), 'movimientos')
  assert.equal(resolveFichadasView('timeline'), 'timeline')
  assert.match(read('src/views/dashboard.js'), /fichadasView: 'movimientos'/)
  assert.equal(JORNADA_PRINT_COLUMNS.some((column) => column.id === 'detalle'), false)
  assert.equal(JORNADA_PRINT_COLUMNS.some((column) => column.label === 'Primera fichada'), true)
  assert.equal(JORNADA_PRINT_COLUMNS.some((column) => column.label === 'Última fichada'), true)
  assert.equal(JORNADA_PRINT_COLUMNS.some((column) => column.label === 'Actividad registrada'), true)
  assert.match(JORNADA_PRINT_NOTE, /no representa necesariamente horas netas/i)
  assert.match(view, /JORNADA_PRINT_COLUMNS/)
  assert.match(read('src/components/fichadas-print.js'), /table-header-group/)
  assert.match(read('src/components/fichadas-print.js'), /counter\(page\)/)
  const completa = actividadRegistradaLabel({
    ingreso: { fechaHora: '2026-09-22T07:53:17' },
    egreso: { fechaHora: '2026-09-22T17:02:17' },
    estado: JORNADA_ESTADO.completa,
    isToday: false,
  })
  assert.equal(completa, '9 h 09 min')
  const abierta = actividadRegistradaLabel({
    ingreso: { fechaHora: '2026-09-23T07:58:00' },
    egreso: null,
    estado: JORNADA_ESTADO.enCurso,
    isToday: true,
    now: '2026-09-23T22:28:00',
  })
  assert.match(abierta, /\(provisional\)/)
  const incompleta = actividadRegistradaLabel({
    ingreso: { fechaHora: '2026-09-22T07:58:00' },
    egreso: null,
    estado: JORNADA_ESTADO.incompleta,
    isToday: false,
  })
  assert.equal(incompleta, '—')
})

if (failed) process.exit(1)
