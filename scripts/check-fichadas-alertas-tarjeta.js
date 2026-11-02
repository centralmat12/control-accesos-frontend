import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { presentarConteoJornadasIncompletas } from '../src/components/jornadas-alertas-panel.js'
import { puedeVerAlertasJornada } from '../src/config/labor-access.js'

const root = dirname(fileURLToPath(import.meta.url))
const view = readFileSync(join(root, '../src/views/fichadas.js'), 'utf8')
const panel = readFileSync(join(root, '../src/components/jornadas-alertas-panel.js'), 'utf8')

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

check('Existe la tarjeta Fichadas pendientes de revisión y usa el conteo real', () => {
  assert.match(view, /fichadas-pendientes-revision/)
  assert.match(view, /Fichadas pendientes de revisión/)
  assert.equal(view.includes('Alertas pendientes'), false)
  assert.equal(view.includes('Posibles duplicados'), true)
  const cards = view.slice(view.indexOf('function createSummaryCards'), view.indexOf('export async function renderFichadas'))
  assert.equal(cards.includes('Posibles duplicados'), false)
  assert.match(view, /Requieren revisión/)
  assert.match(view, /Fichadas incompletas que requieren revisión\./)
  assert.match(view, /getAlertasIncompletas/)
  assert.equal(presentarConteoJornadasIncompletas({ phase: 'cargando' }).value, '—')
  assert.equal(presentarConteoJornadasIncompletas({ phase: 'ok', count: 0 }).value, '0')
  assert.equal(presentarConteoJornadasIncompletas({ phase: 'ok', count: 4 }).value, '4')
  assert.equal(presentarConteoJornadasIncompletas({ phase: 'error' }).value, '—')
  assert.match(view, /Cargando…/)
  assert.match(view, /No se pudieron cargar/)
})

check('La tarjeta abre la tabla existente con teclado y sin consulta repetida', () => {
  assert.match(view, /openLabor\('alertas'\)/)
  assert.match(view, /createAlertasPanel/)
  assert.match(view, /event.key !== 'Enter' && event.key !== ' '/)
  assert.match(view, /if \(alertasFlight\) return alertasFlight/)
  assert.match(view, /alertasIniciales/)
  assert.match(view, /laborKind === 'alertas' && alertasApi/)
  assert.match(panel, /Array\.isArray\(alertasIniciales\)/)
  assert.match(view, /alertasApi\.replace\(list\)/)
  assert.equal(view.includes('alertasApi.reload'), false)
})

check('RRHH no ve la tarjeta y no queda el botón inferior', () => {
  assert.equal(puedeVerAlertasJornada({ rol: 'RRHH' }), false)
  assert.equal(puedeVerAlertasJornada({ rol: 'ADMIN' }), true)
  assert.match(view, /puedeVerAlertasJornada\(getCurrentUser\(\)\)/)
  assert.equal(view.includes('Alertas de jornadas'), false)
  assert.equal(view.includes('id="fichadas-modules"'), false)
})

check('Calendario es la cuarta pestaña y la grilla no desborda', () => {
  const timeline = view.indexOf('id="fichadas-tab-timeline"')
  const jornadas = view.indexOf('id="fichadas-tab-jornadas"')
  const movimientos = view.indexOf('id="fichadas-tab-movimientos"')
  const calendario = view.indexOf('id="fichadas-tab-calendario"')
  assert.ok(timeline < jornadas && jornadas < movimientos && movimientos < calendario)
  assert.match(view, /Calendario de jornadas/)
  assert.match(view, /grid-cols-1/)
  assert.match(view, /sm:grid-cols-2/)
  assert.match(view, /xl:grid-cols-4/)
  assert.equal(view.includes('xl:grid-cols-5'), false)
  assert.equal(view.includes('md:grid-cols-3'), false)
  assert.match(view, /overflow-x-hidden/)
  assert.match(view, /openLabor\('calendario'\)/)
})

console.log(`${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
