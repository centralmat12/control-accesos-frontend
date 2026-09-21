import { resetBrowserGlobals } from './browser-globals.js'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  alertasPendientesStatus,
  buildDashboardAlertas,
  dashboardAlertasHeading,
  puedeVerAlertasUsuarios,
} from '../src/utils/dashboard-alertas.js'
import {
  attachSucursalNombres,
  conectadosResumenLabel,
  dispositivosResumenStatus,
  filterAgentesPorEmpresa,
  puedeVerFilaDispositivos,
  resumenDispositivosDesdeAgentes,
} from '../src/utils/dashboard-dispositivos.js'
import { formatDashboardLastUpdate } from '../src/utils/format.js'
import { baseDatosStatus, sistemaOperativoStatus, systemStatusRowLabels } from '../src/components/system-status.js'
import {
  createDashboardAlerts,
  dashboardContentLayout,
  dashboardHasAlertas,
} from '../src/components/dashboard-alerts.js'
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
  assert.equal(conectadosResumenLabel(1, 1), '1 de 1 conectado')
  assert.equal(conectadosResumenLabel(1, 5), '1 de 5 conectado')
  assert.equal(conectadosResumenLabel(2, 3), '2 de 3 conectados')
  assert.equal(conectadosResumenLabel(4, 5), '4 de 5 conectados')
  assert.equal(dispositivosResumenStatus({ loaded: true, total: 5, conectados: 5 }).tone, 'success')
  assert.equal(dispositivosResumenStatus({ loaded: true, total: 5, conectados: 4 }).tone, 'warning')
  assert.equal(dispositivosResumenStatus({ loaded: true, total: 5, conectados: 1 }).tone, 'warning')
  assert.equal(dispositivosResumenStatus({ loaded: true, total: 5, conectados: 0 }).tone, 'danger')
  assert.equal(dispositivosResumenStatus({ loaded: true, total: 0, conectados: 0 }).tone, 'neutral')
  assert.equal(dispositivosResumenStatus({ loaded: true, total: 0, conectados: 0 }).label, 'Sin dispositivos')
  assert.equal(dispositivosResumenStatus({ reason: 'unsupported', loaded: true }), null)
  assert.equal(dispositivosResumenStatus({ hidden: true, loaded: true }), null)
  assert.equal(dispositivosResumenStatus({ error: 'boom', status: 500 }).label, 'No disponible')
  assert.equal(dispositivosResumenStatus({ error: 'no', status: 403 }).label, 'No disponible')
  assert.equal(dispositivosResumenStatus({ error: 'no', status: 403 }).label === '0 de 0 conectados', false)
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
  assert.equal(dashboardAlertasHeading(1, 1), '1 empleado requiere atención · 1 pendiente')
  assert.equal(dashboardAlertasHeading(3, 7), '3 empleados requieren atención · 7 pendientes')
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

check('Alertas usan panel bordo/ámbar con tarjetas internas diferenciadas', () => {
  const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../src/components/dashboard-alerts.js'), 'utf8')
  const styles = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../src/style.css'), 'utf8')
  assert.match(source, /dashboard-alerts-panel/)
  assert.match(source, /dashboard-alerts-card/)
  assert.match(source, /bg-red-50/)
  assert.match(source, /dark:bg-red-950/)
  assert.match(source, /border-amber-500/)
  assert.match(source, /text-red-700/)
  assert.match(source, /text-amber-800/)
  assert.match(source, /dark:text-red-300/)
  assert.match(source, /dark:text-amber-200/)
  assert.match(source, /border-red-600/)
  assert.match(source, /dark:border-amber-600/)
  assert.match(source, /dark:text-amber-300/)
  assert.match(source, /EMPLOYEE_CARD_CLASS/)
  assert.equal(source.includes('bg-white'), false)
  assert.equal(/Recomendado/i.test(source), false)
  assert.equal(source.includes('RECOMMEND_CLASS'), false)
  assert.match(styles, /\.dashboard-alerts-card/)
  assert.match(styles, /html\.dark \.dashboard-alerts-card/)
  assert.match(styles, /--color-red-900/)
  assert.equal(source.includes('bg-red-100 p-5'), false)
  assert.equal(source.includes('border-${'), false)
})

check('SuperAdmin ve Dispositivos; ADMIN y RRHH no ven la fila ni No disponible', () => {
  const dashboard = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../src/views/dashboard.js'), 'utf8')
  const statusSrc = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../src/components/system-status.js'), 'utf8')
  assert.equal(puedeVerFilaDispositivos(superadmin), true)
  assert.equal(puedeVerFilaDispositivos(admin), false)
  assert.equal(puedeVerFilaDispositivos(rrhh), false)
  assert.match(dashboard, /puedeVerFilaDispositivos\(user\) \? dispositivosResumenStatus\(deviceState\) : null/)
  assert.match(dashboard, /if \(!puedeVerFilaDispositivos\(user\)\)/)
  assert.match(dashboard, /hidden: true/)
  assert.match(dashboard, /listAgentesCatalog/)
  assert.equal(dashboard.includes('getAgentes('), false)
  const loadFn = dashboard.slice(dashboard.indexOf('async function loadDispositivos'))
  const catalogCall = loadFn.indexOf('listAgentesCatalog')
  const earlyReturn = loadFn.indexOf('return')
  assert.equal(catalogCall > earlyReturn, true)
  assert.match(statusSrc, /label: 'Dispositivos'/)
  assert.match(statusSrc, /if \(dispositivos\)/)
  assert.equal(statusSrc.includes('clientSecret'), false)
  assert.equal(statusSrc.includes('clientId'), false)
  assert.equal(statusSrc.includes('serialLector'), false)
  assert.equal(statusSrc.includes('terminal_devs'), false)

  const superadminStatus = dispositivosResumenStatus({ loaded: true, total: 1, conectados: 1 })
  assert.equal(superadminStatus.label, '1 de 1 conectado')
  assert.equal(superadminStatus.tone, 'success')
  assert.deepEqual(
    systemStatusRowLabels({
      dispositivos: superadminStatus,
      alertas: { label: 'Sin pendientes' },
    }),
    ['Sistema', 'Base de datos', 'Dispositivos', 'Alertas y pendientes'],
  )

  const adminStatus = dispositivosResumenStatus({ loaded: true, reason: 'unsupported', hidden: true })
  assert.equal(adminStatus, null)
  const rrhhStatus = dispositivosResumenStatus({ loaded: true, reason: 'unsupported' })
  assert.equal(rrhhStatus, null)
  assert.deepEqual(
    systemStatusRowLabels({
      dispositivos: null,
      alertas: { label: 'Sin pendientes' },
    }),
    ['Sistema', 'Base de datos', 'Alertas y pendientes'],
  )
  assert.equal(systemStatusRowLabels({ dispositivos: null, alertas: { label: 'Sin pendientes' } }).includes('Dispositivos'), false)
  assert.equal(JSON.stringify(adminStatus || {}).includes('No disponible'), false)
  assert.equal(statusSrc.includes('No disponible'), false)
})

check('La fila permanente de alertas resume el total de problemas', () => {
  const clean = alertasPendientesStatus({
    catalogReady: true,
    empleadosConsultaOk: true,
    hasAlertas: false,
    pendingCount: 0,
  })
  assert.equal(clean?.label, 'Sin pendientes')
  assert.equal(clean?.interactive, false)
  assert.equal(clean?.tone, 'success')

  const one = alertasPendientesStatus({
    catalogReady: true,
    empleadosConsultaOk: true,
    hasAlertas: true,
    pendingCount: 1,
  })
  assert.equal(one.label, '1 pendiente')
  assert.equal(one.interactive, true)
  assert.equal(one.actionLabel, 'Ver 1 pendiente')

  const many = alertasPendientesStatus({
    catalogReady: true,
    empleadosConsultaOk: true,
    hasAlertas: true,
    pendingCount: 4,
  })
  assert.equal(many.label, '4 pendientes')
  assert.equal(many.actionLabel, 'Ver 4 pendientes')

  const loading = alertasPendientesStatus({ catalogReady: false, empleadosConsultaOk: false, loading: true })
  assert.equal(loading.label, 'Verificando…')
  assert.equal(loading.label.includes('Sin pendientes'), false)

  const failed = alertasPendientesStatus({ catalogReady: false, empleadosConsultaOk: false, failed: true })
  assert.equal(failed.label, 'No se pudo verificar')
  assert.equal(failed.label.includes('Sin pendientes'), false)

  const emptyAlertas = buildDashboardAlertas({
    user: admin,
    empleados: [{
      id: 1,
      nombre: 'Ana',
      apellido: 'Perez',
      legajo: '0001',
      dni: '12345678',
      cuil: '20123456786',
      sucursal: 'Centro',
      horario: '08:00-17:00',
      departamento: 'Ops',
      tieneHuella: true,
    }],
    catalogReady: true,
  })
  assert.equal(emptyAlertas.items.length, 0)
  assert.equal(emptyAlertas.sinPendientes, true)
  assert.equal(dashboardHasAlertas(emptyAlertas), false)
  assert.equal(createDashboardAlerts(emptyAlertas), null)
  assert.equal(dashboardContentLayout({ hasDataError: false, alertas: emptyAlertas }), 'wide')

  const withPending = buildDashboardAlertas({
    user: admin,
    empleados: [
      {
        id: 1,
        nombre: 'Ana',
        apellido: 'Perez',
        legajo: '0001',
        dni: '12345678',
        cuil: '20123456786',
        sucursal: 'Centro',
        horario: '08:00-17:00',
        departamento: 'Ops',
        tieneHuella: false,
      },
      {
        id: 2,
        nombre: 'Bruno',
        apellido: 'Diaz',
        legajo: '',
        dni: '87654321',
        cuil: '20876543213',
        sucursal: '',
        horario: '08:00-17:00',
        departamento: 'Ops',
        tieneHuella: true,
      },
    ],
    catalogReady: true,
  })
  assert.equal(dashboardHasAlertas(withPending), true)
  assert.equal(withPending.employeeCount, 2)
  assert.equal(withPending.pendingCount, 3)
  assert.equal(alertasPendientesStatus({
    catalogReady: true,
    empleadosConsultaOk: true,
    hasAlertas: true,
    pendingCount: withPending.pendingCount,
  }).label, '3 pendientes')
  assert.equal(dashboardContentLayout({ hasDataError: false, alertas: withPending }), 'split')

  const statusSrc = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../src/components/system-status.js'), 'utf8')
  const alertsSrc = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../src/components/dashboard-alerts.js'), 'utf8')
  const dashboard = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../src/views/dashboard.js'), 'utf8')
  assert.match(statusSrc, /label: 'Alertas y pendientes'/)
  assert.match(statusSrc, /data-system-alertas-action/)
  assert.match(statusSrc, /interactive === true/)
  assert.match(statusSrc, /flex h-full min-h-0 flex-col justify-between/)
  assert.match(statusSrc, /justify-evenly/)
  assert.match(statusSrc, /data-system-last-update/)
  assert.equal(statusSrc.includes('Estados correspondientes a la aplicación instalada en Sede Central'), false)
  assert.match(alertsSrc, /if \(!items.length\) return null/)
  assert.match(alertsSrc, /scrollIntoView/)
  assert.match(alertsSrc, /tabindex="-1"/)
  assert.match(dashboard, /lg:col-span-2/)
  assert.match(dashboard, /focusDashboardAlertasPanel/)
  assert.match(dashboard, /formatDashboardLastUpdate\(lastSuccessAt\)/)
  assert.match(dashboard, /lg:h-full/)
  assert.equal(dashboard.includes('lastSuccessAt = new Date()'), true)
  const loadSrc = dashboard.slice(dashboard.indexOf('async function load'))
  assert.equal(loadSrc.indexOf("textContent = active ? 'Actualizando...'") < loadSrc.indexOf('lastSuccessAt = new Date()'), true)
})

check('La última actualización usa la carga exitosa y no una hora simulada', () => {
  const now = new Date('2026-09-21T15:32:00')
  assert.equal(formatDashboardLastUpdate(null), 'Última actualización: sin datos')
  assert.equal(formatDashboardLastUpdate(now, now), 'Última actualización: hoy, 15:32')
  const yesterday = new Date('2026-09-20T09:05:00')
  assert.match(formatDashboardLastUpdate(yesterday, now), /Última actualización: .*09:05/)
  assert.equal(formatDashboardLastUpdate(yesterday, now).includes('15:32'), false)
  const dashboard = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../src/views/dashboard.js'), 'utf8')
  assert.match(dashboard, /lastSuccessAt = new Date\(\)/)
  const failBranch = dashboard.slice(dashboard.indexOf('if (hasSuccessfulData && lastData)'))
  assert.equal(failBranch.slice(0, failBranch.indexOf('banner.replaceChildren()')).includes('lastSuccessAt = new Date()'), false)
})

console.log(`${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
