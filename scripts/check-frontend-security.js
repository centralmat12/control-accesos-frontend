import { resetBrowserGlobals } from './browser-globals.js'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  puedeAccederAdministracion,
  puedeConsultarEstadoAgente,
  puedeListarAgentes,
  puedeListarUsuarios,
  puedeVerSeccionEmpresas,
} from '../src/config/administracion.js'
import { canAccessView } from '../src/config/navigation.js'
import { isAdmin, isRrhh, isSuperadmin, normalizeRole, ROLES } from '../src/config/roles.js'
import { filterUsuariosByOperador } from '../src/api/usuarios.js'
import { sanitizeActivityRoute } from '../src/utils/activity-log.js'
import { sanitizePublicErrorMessage } from '../src/utils/public-error.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
let passed = 0
let failed = 0

function read(relative) {
  return readFileSync(join(root, relative), 'utf8')
}

function readSrcTree(dir = join(root, 'src'), acc = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) readSrcTree(full, acc)
    else if (entry.name.endsWith('.js')) acc.push(full)
  }
  return acc
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

const admin = { rol: 'ADMIN', empresaId: 9, email: 'admin@example.com', id: 2 }
const rrhh = { rol: 'RRHH', empresaId: 9, email: 'rrhh@example.com', id: 3 }
const superadmin = { rol: 'SuperAdmin', email: 'root@example.com', id: 1 }

check('Roles normalizados y visibilidad de Administración', () => {
  assert.equal(normalizeRole('Administrador'), 'ADMINISTRADOR')
  assert.equal(isAdmin({ rol: 'ADMIN' }), true)
  assert.equal(isAdmin({ rol: 'Administrador' }), false)
  assert.equal(isSuperadmin(superadmin), true)
  assert.equal(isRrhh(rrhh), true)
  assert.equal(puedeAccederAdministracion(rrhh), false)
  assert.equal(puedeAccederAdministracion(admin), true)
  assert.equal(canAccessView(rrhh, 'administracion'), false)
  assert.equal(canAccessView(admin, 'administracion'), true)
  assert.equal(puedeVerSeccionEmpresas(admin), false)
  assert.equal(puedeVerSeccionEmpresas(superadmin), true)
  assert.equal(puedeListarUsuarios(rrhh), false)
  assert.equal(puedeListarAgentes(admin, 9), false)
  assert.equal(puedeListarAgentes(rrhh, 9), false)
  assert.equal(puedeConsultarEstadoAgente(admin), false)
  assert.equal(puedeConsultarEstadoAgente(rrhh), false)
  assert.equal(puedeConsultarEstadoAgente(superadmin), true)
})

check('ADMIN no ve SuperAdmin en el listado local', () => {
  const rows = filterUsuariosByOperador(
    [
      { id: 1, nombreUsuario: 'root', correo: 'root@x', rol: 'SuperAdmin', empresaId: 9 },
      { id: 2, nombreUsuario: 'ana', correo: 'ana@x', rol: 'RRHH', empresaId: 9 },
      { id: 3, nombreUsuario: 'otro', correo: 'otro@x', rol: 'RRHH', empresaId: 8 },
    ],
    admin,
  )
  assert.equal(rows.some((item) => isSuperadmin(item)), false)
  assert.equal(rows.length, 1)
  assert.equal(rows[0].id, 2)
})

check('Health opcional desactivado por defecto y sin contratos de dashboard', () => {
  const apiConfig = read('src/config/api.js')
  const health = read('src/api/health.js')
  const dashboardView = read('src/views/dashboard.js')
  const dashboardApi = read('src/api/dashboard.js')
  const envExample = read('.env.example')

  assert.match(apiConfig, /VITE_ENABLE_HEALTH_READY/)
  assert.match(apiConfig, /=== 'true'/)
  assert.match(health, /isHealthReadyEnabled/)
  assert.match(dashboardView, /isHealthReadyEnabled/)
  assert.equal(dashboardView.includes('/api/dashboard/estado-sistema'), false)
  assert.equal(dashboardView.includes('/api/dashboard/estado-dispositivos'), false)
  assert.equal(dashboardApi.includes('/api/dashboard/'), false)
  assert.match(envExample, /VITE_ENABLE_HEALTH_READY/)
  assert.equal(envExample.includes('VITE_ENABLE_HEALTH_READY=true\n'), false)
})

check('X-Empresa-Id solo en apiFetch para SuperAdmin', () => {
  const http = read('src/api/http.js')
  assert.match(http, /if \(!skipEmpresaContext && isSuperadmin\(user\)\)/)
  assert.match(http, /headers\['X-Empresa-Id'\]/)
  const src = readSrcTree()
    .filter((file) => !file.endsWith(`${join('api', 'http.js')}`))
    .map((file) => readFileSync(file, 'utf8'))
    .join('\n')
  assert.equal(src.includes("headers['X-Empresa-Id']"), false)
})

check('No hay llamadas activas a plantillas biométricas', () => {
  const src = readSrcTree()
    .map((file) => readFileSync(file, 'utf8'))
    .join('\n')
  assert.equal(/fetch\([^)]*\/api\/huellas/i.test(src), false)
  assert.equal(/apiFetch\(['`]\/api\/huellas/i.test(src), false)
})

check('JWT en sessionStorage; cambio de contraseña invalida sesión', () => {
  const auth = read('src/api/auth.js')
  assert.match(auth, /sessionStorage\.setItem\(TOKEN_KEY/)
  assert.equal(auth.includes('localStorage.setItem(TOKEN_KEY'), false)
  assert.match(auth, /export function finishPasswordChange/)
  assert.match(auth, /logout\(\)/)
  assert.match(auth, /La autorización real corresponde a la API/)
  assert.match(auth, /isAgentCredential/)
})

check('Actividad local no registra token ni password', () => {
  assert.equal(sanitizeActivityRoute('/api/Auth/Login?token=abc'), '/api/Auth/Login')
  assert.equal(sanitizeActivityRoute('/x?password=secret&ok=1').includes('secret'), false)
  const log = read('src/utils/activity-log.js')
  assert.match(log, /Actividad local del panel/)
  assert.match(log, /SENSITIVE_PATTERN/)
})

check('Mensajes públicos sanitizan SQL y stacks', () => {
  assert.equal(
    sanitizePublicErrorMessage('SELECT * FROM usuarios', 'fallback'),
    'fallback',
  )
  assert.equal(
    sanitizePublicErrorMessage('System.Exception: boom at Foo.Bar()', 'fallback'),
    'fallback',
  )
  assert.equal(sanitizePublicErrorMessage('El correo ya está registrado.', 'x'), 'El correo ya está registrado.')
})

check('Alertas crítico/warning tienen clases claro y oscuro', () => {
  const alerts = read('src/components/dashboard-alerts.js')
  assert.match(alerts, /border-red-600/)
  assert.match(alerts, /dark:border-amber-600/)
  assert.match(alerts, /dark:text-amber-300/)
})

check('Documentación de seguridad presente', () => {
  const doc = read('docs/FRONTEND-SECURITY.md')
  assert.match(doc, /autorización real corresponde a la API/)
  assert.match(doc, /Actividad local del panel/)
  assert.match(doc, /VITE_ENABLE_HEALTH_READY/)
  assert.equal(ROLES.Admin, 'ADMIN')
})

console.log(`${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
