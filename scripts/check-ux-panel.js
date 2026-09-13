import { resetBrowserGlobals } from './browser-globals.js'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  AGENTE_CONTACTO_FIELDS,
  agenteConectividad,
  extractAgenteContacto,
  resumenAgentesConectividad,
} from '../src/utils/agente-conectividad.js'
import {
  puedeConsultarEstadoAgente,
  puedeListarAgentes,
  puedeVerSeccionEmpresas,
  USUARIOS_TABLE_CENTERED_COLUMNS,
  USUARIOS_TABLE_COLUMNS,
} from '../src/config/administracion.js'
import {
  apiConsultaStatus,
  agenteEmpresaAusenteStatus,
  agenteSinConfigurarStatus,
  agenteSinPermisoStatus,
  datosCargaStatus,
} from '../src/components/system-status.js'
import {
  dashboardContentLayout,
  dashboardHasAlertas,
} from '../src/components/dashboard-alerts.js'
import { NAV_ITEMS } from '../src/config/navigation.js'
import { usuariosColumnAlignClass, usuariosTableHeadMarkup } from '../src/views/administracion.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
let passed = 0
let failed = 0

function read(relative) {
  return readFileSync(join(root, relative), 'utf8')
}

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

check('El encabezado conserva los nombres de sección', () => {
  const labels = NAV_ITEMS.filter((item) =>
    ['dashboard', 'administracion', 'fichadas', 'empleados'].includes(item.id),
  ).map((item) => item.label)
  assert.deepEqual(labels, ['Dashboard', 'Fichadas', 'Empleados', 'Administración'])
  assert.match(read('src/components/header.js'), /item\?\.label/)
})

check('Los contenidos usan títulos funcionales y no repiten la sección', () => {
  const admin = read('src/views/administracion.js')
  const fichadas = read('src/views/fichadas.js')
  const empleados = read('src/views/empleados.js')
  const dashboard = read('src/views/dashboard.js')

  assert.match(admin, /Gestioná usuarios y empresas/)
  assert.match(admin, /Gestioná usuarios/)
  assert.match(admin, /Administrá sus accesos, roles, estados y estructura organizativa\./)
  assert.match(admin, /Administrá sus accesos, roles y estados\./)
  assert.match(admin, /canViewEmpresasSection/)
  assert.match(admin, /puedeVerSeccionEmpresas/)
  assert.equal(admin.includes('<h2 class="text-xl font-semibold tracking-tight text-slate-900">Administración</h2>'), false)

  assert.match(fichadas, /Consultá las fichadas/)
  assert.match(fichadas, /Filtrá y revisá los registros de ingreso y egreso\./)
  assert.equal(fichadas.includes('>Fichadas</h2>'), false)

  assert.match(empleados, /Gestioná los empleados/)
  assert.match(empleados, /Administrá sus datos laborales, asignaciones y estado\./)
  assert.equal(empleados.includes('>Empleados</h2>'), false)

  assert.equal(dashboard.includes('>Dashboard</h2>'), false)
  assert.equal(dashboard.includes('No indica conexión del agente ni del lector'), false)
  assert.match(read('src/components/page-heading.js'), /font-semibold/)
})

check('Administración usa pestañas compactas de ancho automático', () => {
  const admin = read('src/views/administracion.js')
  assert.match(admin, /role="tablist"/)
  assert.match(admin, /inline-flex w-fit max-w-full/)
  assert.match(admin, /data-section="\$\{SECTIONS\.usuarios\}"/)
  assert.match(admin, /data-section="\$\{SECTIONS\.empresas\}"/)
})

check('La tabla de usuarios centra Estado, Cambio de clave, Bloqueo y Acciones', () => {
  assert.deepEqual([...USUARIOS_TABLE_COLUMNS], [
    'Usuario',
    'Correo',
    'Rol',
    'Empresa',
    'Estado',
    'Cambio de clave',
    'Bloqueo',
    'Acciones',
  ])
  assert.deepEqual([...USUARIOS_TABLE_CENTERED_COLUMNS], ['Estado', 'Cambio de clave', 'Bloqueo', 'Acciones'])
  assert.equal(usuariosColumnAlignClass('Usuario'), 'text-left')
  assert.equal(usuariosColumnAlignClass('Estado'), 'text-center')
  assert.equal(usuariosColumnAlignClass('Cambio de clave'), 'text-center')
  const markup = usuariosTableHeadMarkup()
  assert.match(markup, /w-28 min-w-28/)
  assert.match(markup, /w-36 min-w-36/)
  assert.match(markup, /w-32 min-w-32/)
  assert.match(read('src/views/administracion.js'), /bloqueoEstadoMarkup/)
})

check('El modal de edición unifica el formulario y conserva endpoints separados', () => {
  const panel = read('src/components/usuario-edit-panel.js')
  const view = read('src/views/administracion.js')
  assert.match(panel, /Datos de acceso y permisos/)
  assert.match(panel, /Modificación de usuario/)
  assert.match(panel, /Modificá la identificación, el correo o el rol/)
  assert.match(panel, /id: 'usuario-edit-rol'/)
  assert.match(panel, /grid gap-3 sm:grid-cols-2/)
  assert.match(panel, /sm:flex-row sm:items-end/)
  assert.match(panel, /Guardar cambios/)
  assert.equal(panel.includes('Guardar información'), false)
  assert.equal(panel.includes('Guardar rol'), false)
  assert.equal(panel.includes('Zona de peligro'), false)
  assert.match(view, /dialogClass: 'max-w-2xl/)
  assert.match(view, /actualizarIdentidadUsuario/)
  assert.match(view, /cambiarRolUsuario/)
  assert.match(view, /cambiarEstadoUsuario/)
  assert.match(view, /applyUsuarioEditSaves/)
  assert.match(view, /openUsuarioModificacionesConfirm/)
})

check('El dashboard usa la grilla operativa de dos columnas', () => {
  const dashboard = read('src/views/dashboard.js')
  assert.match(dashboard, /lg:grid-cols-\[minmax\(16rem,32%\)_minmax\(0,1fr\)\]/)
  assert.match(dashboard, /contents lg:flex lg:min-h-0 lg:flex-col lg:gap-6/)
  assert.match(dashboard, /order-1 min-w-0 shrink-0/)
  assert.match(dashboard, /order-2 min-w-0 shrink-0/)
  assert.match(dashboard, /order-3/)
  assert.match(dashboard, /order-4/)
  assert.match(dashboard, /createSystemStatusCard/)
  assert.match(dashboard, /REFRESH_INTERVAL_MS = 5 \* 60_000/)
  assert.match(dashboard, /LABEL_INTERVAL_MS = 30_000/)
  assert.match(dashboard, /load\(\{ silent: true \}\)/)
  assert.match(dashboard, /stopLabelClock/)
  assert.match(dashboard, /stopAutoRefresh/)
  assert.match(dashboard, /isHealthReadyEnabled/)
  assert.match(dashboard, /listAgentesCatalog/)
  assert.equal(dashboard.includes('createImplementationStatusSection'), false)
  assert.equal(dashboard.includes('Estado de implementación'), false)
  assert.equal(dashboard.includes('/api/health/'), false)
  assert.equal(dashboard.includes('/api/sistema'), false)
  assert.equal(dashboard.includes('/api/dashboard/estado'), false)
})

check('Dashboard con alertas, sin alertas y con error', () => {
  const withAlerts = { items: [{ empleado: { nombre: 'Ana' }, missing: [] }] }
  assert.equal(dashboardHasAlertas(withAlerts), true)
  assert.equal(dashboardHasAlertas({ items: [] }), false)
  assert.equal(dashboardHasAlertas(null), false)
  assert.equal(dashboardHasAlertas(undefined), false)
  assert.equal(dashboardContentLayout({ hasDataError: false, alertas: withAlerts }), 'split')
  assert.equal(dashboardContentLayout({ hasDataError: false, alertas: { items: [] } }), 'wide')
  assert.equal(dashboardContentLayout({ hasDataError: true, alertas: { items: [] } }), 'error')
  assert.equal(dashboardContentLayout({ hasDataError: true, alertas: withAlerts }), 'error')

  const dashboard = read('src/views/dashboard.js')
  const alerts = read('src/components/dashboard-alerts.js')
  assert.match(dashboard, /dashboardContentLayout/)
  assert.match(dashboard, /layout === 'split'/)
  assert.match(dashboard, /lg:col-span-2/)
  assert.match(dashboard, /data-dashboard-layout/)
  assert.match(dashboard, /showDataError: true/)
  assert.match(alerts, /if \(!dashboardHasAlertas\(alertas\)\) return null/)
  assert.equal(alerts.includes('No hay alertas ni pendientes en este momento.'), false)
  assert.match(read('src/components/recent-punches-table.js'), /data-view-all/)
  assert.match(read('src/components/recent-punches-table.js'), /min-h-0 flex-1 overflow-auto/)
})

check('API y datos no inventan una base de datos consultada por el navegador', () => {
  const api = apiConsultaStatus({ ok: true })
  const error = apiConsultaStatus({ ok: false, errorMessage: 'La API no respondió.' })
  const datos = datosCargaStatus({ lastSuccessAt: new Date(), clockLabel: '12:00' })
  assert.equal(api.label, 'Operativo')
  assert.equal(error.label, 'Error')
  assert.equal(error.detail, 'La API no respondió.')
  assert.equal(datos.label, 'Datos actualizados')
  assert.match(datos.detail, /Última carga correcta/)
  assert.equal(read('src/components/system-status.js').includes('Base de datos actualizada'), false)
})

check('La conectividad del agente usa un último contacto real', () => {
  const now = new Date('2026-09-11T12:00:00.000Z')
  assert.deepEqual([...AGENTE_CONTACTO_FIELDS], [
    'ultimoAcceso',
    'ultimoContacto',
    'ultimaConexion',
    'ultimoHeartbeat',
  ])
  assert.equal(extractAgenteContacto({}), null)
  assert.equal(agenteConectividad({}, now).label, 'Sin actividad registrada')
  assert.equal(agenteConectividad({ ultimoAcceso: 'fecha-invalida' }, now).label, 'Sin información')

  const connected = agenteConectividad(
    { ultimoAcceso: new Date(now.getTime() - 10 * 60_000).toISOString() },
    now,
  )
  assert.equal(connected.tone, 'success')
  assert.equal(connected.label, 'Conectado')

  const idle = agenteConectividad(
    { ultimoAcceso: new Date(now.getTime() - 78 * 60_000).toISOString() },
    now,
  )
  assert.equal(idle.tone, 'warning')
  assert.equal(idle.label, 'Sin actividad reciente')
  assert.match(idle.detail, /sin conectividad desde hace/)

  const offline = agenteConectividad(
    { ultimoAcceso: new Date(now.getTime() - 137 * 60_000).toISOString() },
    now,
  )
  assert.equal(offline.tone, 'danger')
  assert.equal(offline.label, 'Desconectado')
  assert.match(offline.detail, /sin conexión desde hace/)

  const summary = resumenAgentesConectividad(
    [
      { nombre: 'Lector A', clientId: 'sucursal-a', ultimoAcceso: new Date(now.getTime() - 5 * 60_000).toISOString() },
      { nombre: 'Lector B', clientId: 'sucursal-b', ultimoAcceso: new Date(now.getTime() - 140 * 60_000).toISOString() },
    ],
    now,
  )
  assert.equal(summary.label, 'Desconectado')
  assert.match(summary.detail, /Lector B/)
  assert.equal(agenteSinPermisoStatus().label, 'Estado no disponible para este rol')
  assert.equal(agenteEmpresaAusenteStatus().label, 'Empresa no disponible')
  assert.equal(agenteSinConfigurarStatus().label, 'Sin dispositivos configurados')
  assert.equal(resumenAgentesConectividad([], now).label, 'Sin información')
  assert.equal(resumenAgentesConectividad([{ nombre: 'App Sede Central' }], now).label, 'Sin actividad registrada')
  assert.equal(puedeConsultarEstadoAgente({ rol: 'ADMIN', empresaId: 9 }), false)
  assert.equal(puedeConsultarEstadoAgente({ rol: 'RRHH', empresaId: 9 }), false)
  assert.equal(puedeConsultarEstadoAgente({ rol: 'SuperAdmin' }), true)
  assert.equal(puedeListarAgentes({ rol: 'ADMIN', empresaId: 9 }, 9), false)
  assert.equal(puedeListarAgentes({ rol: 'RRHH', empresaId: 9 }, 9), false)
  assert.equal(puedeVerSeccionEmpresas({ rol: 'ADMIN', empresaId: 9 }), false)
  assert.equal(puedeVerSeccionEmpresas({ rol: 'SuperAdmin' }), true)
})

check('El dashboard consulta el estado operativo y no el listado administrativo de agentes', () => {
  const agentes = read('src/api/agentes.js')
  const dashboard = read('src/views/dashboard.js')
  const api = read('src/api/dashboard.js')
  const mapFn = agentes.slice(agentes.indexOf('export function mapAgente'), agentes.indexOf('export function mapAgenteCreado'))
  assert.match(mapFn, /ultimoAcceso/)
  assert.equal(mapFn.includes('clientSecret'), false)
  assert.match(dashboard, /listAgentesCatalog/)
  assert.match(dashboard, /isSuperadmin/)
  assert.equal(dashboard.includes('puedeConsultarEstadoAgente'), false)
  assert.equal(dashboard.includes('getDashboardDispositivosEstado'), false)
  assert.equal(dashboard.includes('getDashboardSistemaEstado'), false)
  assert.equal(dashboard.includes('getAgentes('), false)
  assert.equal(api.includes('/api/dashboard/'), false)
  assert.match(read('src/config/api.js'), /HEALTH_READY_ENABLED/)
  assert.match(read('src/api/health.js'), /isHealthReadyEnabled/)
  assert.match(read('.env.example'), /VITE_ENABLE_HEALTH_READY/)
})

check('El contenedor común no rompe tablas anchas', () => {
  assert.match(read('src/components/layout.js'), /max-w-7xl/)
  assert.match(read('src/components/layout.js'), /min-w-0/)
  assert.match(read('src/views/administracion.js'), /max-h-\[65vh\] overflow-auto/)
  assert.match(read('src/components/recent-punches-table.js'), /min-h-0 flex-1 overflow-auto/)
  assert.match(read('src/components/recent-punches-table.js'), /data-view-all/)
  assert.equal(read('src/components/recent-punches-table.js').includes('data-previous-page'), false)
})

check('El pie muestra solo la versión del frontend', () => {
  const pkg = JSON.parse(read('package.json'))
  const lock = JSON.parse(read('package-lock.json'))
  const version = read('src/config/version.js')
  const sidebar = read('src/components/sidebar.js')
  assert.equal(pkg.version, '0.2.0-beta')
  assert.equal(lock.version, '0.2.0-beta')
  assert.equal(lock.packages[''].version, '0.2.0-beta')
  assert.match(version, /from '\.\.\/\.\.\/package\.json'/)
  assert.match(version, /APP_VERSION_LABEL = `Frontend v\$\{APP_VERSION\}`/)
  assert.match(sidebar, /APP_VERSION_LABEL/)
  assert.equal(sidebar.includes('Rama'), false)
  assert.equal(sidebar.includes('git'), false)
  assert.equal(/\bbranch\b/i.test(sidebar), false)
})

check('Estado del sistema es compacto y usa tooltips', () => {
  const status = read('src/components/system-status.js')
  assert.match(status, /tooltipTriggerAttributes/)
  assert.match(status, /Estados correspondientes a la aplicación instalada en Sede Central/)
  assert.equal(status.includes('Consulta del panel, datos cargados'), false)
  assert.equal(status.includes('clientId'), false)
  assert.equal(status.includes('terminal_devs'), false)
  assert.match(status, /focus-visible:ring-2/)
  assert.match(read('src/components/tooltip.js'), /aria-describedby/)
  assert.match(read('src/components/tooltip.js'), /pointerType === 'touch'/)
})

console.log(`${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
