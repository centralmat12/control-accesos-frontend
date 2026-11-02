import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildDashboardAlertas } from '../src/utils/dashboard-alertas.js'
import { descartarPreferenciasWidgets } from '../src/views/dashboard.js'

const root = dirname(fileURLToPath(import.meta.url))
const dashboard = readFileSync(join(root, '../src/views/dashboard.js'), 'utf8')
const alerts = readFileSync(join(root, '../src/components/dashboard-alerts.js'), 'utf8')

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

check('No existe Indicadores laborales ni el selector de período', () => {
  assert.equal(dashboard.includes('Indicadores laborales'), false)
  assert.equal(dashboard.includes('Esta semana'), false)
  assert.equal(dashboard.includes('Este mes'), false)
  assert.equal(dashboard.includes('id="dashboard-labor"'), false)
  assert.equal(existsSync(join(root, '../src/components/dashboard-labor.js')), false)
  assert.equal(existsSync(join(root, '../src/utils/dashboard-widgets.js')), false)
  assert.equal(existsSync(join(root, '../src/config/dashboard-widgets.js')), false)
})

check('No existe Personalizar panel ni preferencias de widgets', () => {
  assert.equal(dashboard.includes('Personalizar panel'), false)
  assert.equal(dashboard.includes('leerPreferenciasDashboard'), false)
  const storage = new Map([
    ['ca.dashboard.widgets.v2.ana.1', '{"visibles":["fichadas-manuales"]}'],
    ['ca.ui.theme', 'dark'],
  ])
  const keys = [...storage.keys()]
  const memoria = {
    get length() {
      return storage.size
    },
    key(index) {
      return keys[index] ?? null
    },
    removeItem(key) {
      storage.delete(key)
    },
  }
  descartarPreferenciasWidgets(memoria)
  assert.equal(storage.has('ca.dashboard.widgets.v2.ana.1'), false)
  assert.equal(storage.get('ca.ui.theme'), 'dark')
})

check('Alertas y pendientes recupera el contenedor original sin filtros', () => {
  assert.match(alerts, /Alertas y pendientes/)
  assert.match(alerts, /bg-red-50/)
  assert.match(alerts, /dark:bg-red-950/)
  assert.match(alerts, /border-amber-500/)
  assert.match(alerts, /dashboard-alerts-panel/)
  assert.match(alerts, /dashboard-alerts-card/)
  assert.equal(alerts.includes('data-centro-filtro'), false)
  assert.equal(alerts.includes('>Asistencia<'), false)
  assert.equal(alerts.includes('>Ver todas<'), false)
  assert.match(alerts, /Ver todos los empleados con pendientes/)
})

check('Se muestran las alertas originales y sus acciones', () => {
  const superadmin = { rol: 'SuperAdmin' }
  const rrhh = { rol: 'RRHH', empresaId: 9 }
  const dispositivos = [
    { id: 1, nombre: 'Lector PB', sucursalNombre: 'Sede Central', conectado: false, ultimaConexion: '2026-10-28T12:00:00Z' },
    { id: 2, nombre: 'Lector Piso 1', sucursalNombre: 'Sede Central', conectado: false, ultimaConexion: '2026-10-28T12:00:00Z' },
  ]
  const alertas = buildDashboardAlertas({
    user: superadmin,
    dispositivos,
    dispositivosConsultaOk: true,
    jornadasIncompletas: 24,
  })
  const critica = alertas.items.find((item) => item.type === 'dispositivos-critico')
  const individual = alertas.items.filter((item) => item.type === 'dispositivo')
  const jornadas = alertas.items.find((item) => item.type === 'jornada')
  assert.equal(critica.title, 'Todos los dispositivos están desconectados')
  assert.match(critica.detail, /No se están recibiendo fichadas en ninguna sucursal/)
  assert.equal(critica.action.label, 'Revisar configuración')
  assert.equal(critica.action.view, 'administracion')
  assert.equal(individual.length, 2)
  assert.match(individual[0].detail, /Sede Central/)
  assert.equal(individual[0].action.label, 'Revisar configuración')
  assert.equal(jornadas.title, '24 jornadas incompletas')
  assert.equal(jornadas.detail, 'Hay fichadas que requieren revisión.')
  assert.equal(jornadas.action.label, 'Ver jornadas')
  assert.equal(jornadas.action.view, 'fichadas')
  assert.equal(jornadas.action.fichadasLabor, 'alertas')
  assert.match(dashboard, /fichadasLabor/)

  const rrhhAlertas = buildDashboardAlertas({
    user: rrhh,
    dispositivos,
    dispositivosConsultaOk: true,
    jornadasIncompletas: 24,
  })
  assert.equal(rrhhAlertas.items.some((item) => item.action?.label === 'Revisar configuración'), false)
  assert.match(dashboard, /puedeVerAlertasJornada/)
})

console.log(`${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
