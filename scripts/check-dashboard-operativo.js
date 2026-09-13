import { resetBrowserGlobals } from './browser-globals.js'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  buildDashboardAlertas,
  dashboardAlertasHeading,
  puedeVerAlertasUsuarios,
} from '../src/utils/dashboard-alertas.js'
import {
  attachSucursalNombres,
  conectadosResumenLabel,
  dispositivosResumenStatus,
  filterAgentesPorEmpresa,
  resumenDispositivosDesdeAgentes,
} from '../src/utils/dashboard-dispositivos.js'
import { baseDatosStatus, sistemaOperativoStatus } from '../src/components/system-status.js'
import {
  deriveBaseDatosConnected,
  deriveSistemaKind,
  interpretHealthResponse,
  queryFromSettled,
} from '../src/utils/dashboard-sistema.js'

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

resetBrowserGlobals()

const admin = { rol: 'ADMIN', empresaId: 9 }
const rrhh = { rol: 'RRHH', empresaId: 9 }
const superadmin = { rol: 'SuperAdmin' }

check('Resumen de dispositivos: colores y textos', () => {
  assert.equal(conectadosResumenLabel(1, 5), '1 de 5 conectado')
  assert.equal(conectadosResumenLabel(4, 5), '4 de 5 conectados')
  assert.equal(dispositivosResumenStatus({ loaded: true, total: 5, conectados: 5 }).tone, 'success')
  assert.equal(dispositivosResumenStatus({ loaded: true, total: 5, conectados: 4 }).tone, 'warning')
  assert.equal(dispositivosResumenStatus({ loaded: true, total: 5, conectados: 1 }).tone, 'warning')
  assert.equal(dispositivosResumenStatus({ loaded: true, total: 5, conectados: 0 }).tone, 'danger')
  assert.equal(dispositivosResumenStatus({ loaded: true, total: 0, conectados: 0 }).tone, 'neutral')
  assert.equal(dispositivosResumenStatus({ loaded: true, total: 0, conectados: 0 }).label, 'Sin dispositivos configurados')
  assert.equal(dispositivosResumenStatus({ error: 'boom', status: 500 }).tone, 'neutral')
  assert.equal(dispositivosResumenStatus({ error: 'boom', status: 500 }).label, 'Estado desconocido')
  assert.equal(dispositivosResumenStatus({ error: 'no', status: 403 }).label, 'Estado desconocido')
  assert.equal(dispositivosResumenStatus({ hidden: true }), null)
})

check('Filtra agentes por empresa y aplica el umbral del frontend', () => {
  const now = new Date('2026-09-12T18:00:00.000Z')
  const agentes = [
    { id: 3, nombre: 'Lector A', empresaId: 4, sucursalId: 1, activo: true, ultimoAcceso: '2026-09-12T17:50:00.000Z' },
    { id: 4, nombre: 'Lector B', empresaId: 4, sucursalId: 2, activo: true, ultimoAcceso: '2026-09-12T15:00:00.000Z' },
    { id: 5, nombre: 'Ajeno', empresaId: 9, sucursalId: 3, activo: true, ultimoAcceso: '2026-09-12T17:50:00.000Z' },
  ]
  const propios = filterAgentesPorEmpresa(agentes, 4)
  assert.equal(propios.length, 2)
  const estado = resumenDispositivosDesdeAgentes(propios, now)
  assert.equal(estado.total, 2)
  assert.equal(estado.conectados, 1)
  assert.equal(estado.dispositivos[0].conectado, true)
  assert.equal(estado.dispositivos[1].conectado, false)
  const conNombre = attachSucursalNombres(propios, [{ id: 1, nombre: 'Sede Central' }])
  assert.equal(conNombre[0].sucursalNombre, 'Sede Central')
  assert.equal(conNombre[1].sucursalNombre, '')
})

check('Alertas de dispositivos y usuarios respetan el rol', () => {
  const dispositivos = [
    { id: 3, nombre: 'Lector Piso 3', sucursalNombre: 'Sede Central', conectado: false, ultimaConexion: '2026-09-12T17:35:00Z' },
    { id: 4, nombre: 'Lector PB', sucursalNombre: 'Sede Central', conectado: true, ultimaConexion: '2026-09-12T17:50:00Z' },
  ]
  const usuarios = [
    { id: 11, nombreUsuario: 'Martin.Test.RRHH', bloqueado: true, bloqueadoHasta: '2026-09-13T10:00:00Z' },
    { id: 12, nombreUsuario: 'otro', requiereCambioPassword: true, bloqueado: false },
    { id: 13, nombreUsuario: 'root', rol: 'SuperAdmin', bloqueado: true },
  ]
  const empleados = [{ id: 1, nombre: 'Ana', apellido: 'Paz', tieneHuella: false }]

  const adminAlertas = buildDashboardAlertas({
    user: admin,
    empleados,
    usuarios,
    dispositivos,
    dispositivosConsultaOk: false,
  })
  assert.equal(adminAlertas.items.some((item) => item.type === 'dispositivo'), false)
  assert.equal(adminAlertas.items.some((item) => item.type === 'usuario-bloqueado'), true)
  assert.equal(adminAlertas.items.some((item) => item.id === 'usuario-bloqueado-13'), false)
  assert.equal(adminAlertas.items.some((item) => item.type === 'usuario-password'), true)
  assert.equal(adminAlertas.items.some((item) => item.type === 'empleado'), true)
  assert.equal(adminAlertas.items.find((item) => item.type === 'empleado')?.severity, 'warning')
  assert.equal(adminAlertas.items.find((item) => item.type === 'empleado')?.tone, 'warning')
  assert.equal(adminAlertas.worst, 'warning')

  const rrhhAlertas = buildDashboardAlertas({
    user: rrhh,
    empleados,
    usuarios,
    dispositivos,
    dispositivosConsultaOk: false,
  })
  assert.equal(puedeVerAlertasUsuarios(rrhh), false)
  assert.equal(rrhhAlertas.items.some((item) => item.type === 'usuario-bloqueado'), false)
  assert.equal(rrhhAlertas.items.some((item) => item.type === 'usuario-password'), false)
  assert.equal(rrhhAlertas.items.some((item) => item.type === 'dispositivo'), false)
  assert.equal(rrhhAlertas.items.some((item) => item.action?.view === 'administracion'), false)

  const allOffline = buildDashboardAlertas({
    user: superadmin,
    dispositivos: dispositivos.map((item) => ({ ...item, conectado: false })),
    dispositivosConsultaOk: true,
  })
  assert.equal(allOffline.items.some((item) => item.type === 'dispositivos-critico'), true)
  assert.equal(allOffline.worst, 'critical')
  assert.equal(allOffline.items.find((item) => item.type === 'dispositivo')?.action?.view, 'administracion')
  assert.equal(allOffline.items.find((item) => item.type === 'dispositivo')?.severity, 'warning')

  const failed = buildDashboardAlertas({
    user: admin,
    dispositivos,
    dispositivosConsultaOk: false,
  })
  assert.equal(failed.items.some((item) => item.type === 'dispositivo'), false)
  assert.equal(dashboardAlertasHeading(1), '1 situación requiere atención')
  assert.equal(dashboardAlertasHeading(4), '4 situaciones requieren atención')
})

check('Sistema y base de datos se derivan de resultados reales', () => {
  const empleadosOk = queryFromSettled('empleados', { status: 'fulfilled', value: Array.from({ length: 6 }) })
  const fichadasOk = queryFromSettled('fichadas', { status: 'fulfilled', value: [] })
  const emptyEmpleados = queryFromSettled('empleados', { status: 'fulfilled', value: [] })
  const health404 = interpretHealthResponse({ status: 404, contentType: '', body: '' })
  const healthOk = interpretHealthResponse({ status: 200, contentType: 'text/plain', body: 'Healthy' })
  const healthJson = interpretHealthResponse({ status: 200, contentType: 'application/json', body: '{"status":"Healthy"}' })
  const offline = queryFromSettled('empleados', { status: 'rejected', reason: new Error('No se pudo conectar con la API') })

  assert.equal(health404.verdict, 'inconclusive')
  assert.equal(health404.connected, null)
  assert.equal(healthOk.verdict, 'healthy')
  assert.equal(healthJson.verdict, 'healthy')
  assert.equal(interpretHealthResponse({ skipped: true }).verdict, 'skipped')
  assert.equal(interpretHealthResponse({ skipped: true }).connected, null)
  assert.equal(
    deriveBaseDatosConnected({
      health: interpretHealthResponse({ skipped: true }),
      evidence: [empleadosOk],
      sistemaKind: 'ok',
    }),
    true,
  )

  assert.equal(deriveSistemaKind([empleadosOk, fichadasOk], { settled: true }), 'ok')
  assert.equal(
    deriveBaseDatosConnected({ health: health404, evidence: [empleadosOk], sistemaKind: 'ok' }),
    true,
  )
  assert.equal(
    deriveBaseDatosConnected({ health: health404, evidence: [emptyEmpleados], sistemaKind: 'ok' }),
    true,
  )
  assert.equal(deriveBaseDatosConnected({ health: healthOk, evidence: [], sistemaKind: 'ok' }), true)
  assert.equal(deriveSistemaKind([offline], { settled: true }), 'offline')
  assert.equal(deriveBaseDatosConnected({ health: health404, evidence: [offline], sistemaKind: 'offline' }), null)

  assert.equal(sistemaOperativoStatus({ kind: 'ok' }).label, 'Operativo')
  assert.equal(sistemaOperativoStatus({ kind: 'degraded' }).label, 'Con inconvenientes')
  assert.equal(sistemaOperativoStatus({ kind: 'offline' }).label, 'No disponible')
  assert.equal(sistemaOperativoStatus({}).label, 'Estado desconocido')
  assert.equal(baseDatosStatus({ connected: true }).label, 'Conectada')
  assert.equal(baseDatosStatus({}).label, 'Estado desconocido')
  assert.equal(baseDatosStatus({ connected: false }).label, 'No disponible')
})

check('Alertas usan rojo en claro y ámbar en oscuro', () => {
  const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../src/components/dashboard-alerts.js'), 'utf8')
  assert.match(source, /border-red-600/)
  assert.match(source, /bg-red-100/)
  assert.match(source, /text-red-800/)
  assert.match(source, /dark:border-amber-600/)
  assert.match(source, /dark:bg-amber-800\/20/)
  assert.match(source, /dark:text-amber-300/)
  assert.equal(source.includes('border-${'), false)
})

console.log(`${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
