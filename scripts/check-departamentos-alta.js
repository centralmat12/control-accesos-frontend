import { resetBrowserGlobals } from './browser-globals.js'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  DEPARTAMENTO_NOMBRE_MAX,
  createDepartamento,
  validateDepartamentoAlta,
} from '../src/api/departamentos.js'
import { setEmpresaContexto } from '../src/api/empresa-context.js'
import {
  puedeCrearDepartamentos,
  puedeCrearSucursales,
  puedeMostrarAltaDepartamento,
} from '../src/config/administracion.js'
import { isSuperadmin } from '../src/config/roles.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const SESSION_TOKEN = 'session-jwt'
let passed = 0
let failed = 0
const fetchCalls = []

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

async function checkAsync(name, fn) {
  resetBrowserGlobals()
  fetchCalls.length = 0
  try {
    await fn()
    passed += 1
    console.log(`ok - ${name}`)
  } catch (error) {
    failed += 1
    console.error(`not ok - ${name}`)
    console.error(error)
  }
}

function superadmin() {
  return { nombre: 'SA', email: 'sa@example.com', rol: 'SuperAdmin' }
}

function admin(empresaId = 9) {
  return { nombre: 'Admin', email: 'admin@example.com', rol: 'ADMIN', empresaId }
}

function rrhh(empresaId = 9) {
  return { nombre: 'Rrhh', email: 'rrhh@example.com', rol: 'RRHH', empresaId }
}

function writeSession(user, token = SESSION_TOKEN) {
  sessionStorage.setItem('ca.auth.user', JSON.stringify(user))
  sessionStorage.setItem('ca.auth.token', token)
}

function jsonResponse(status, payload) {
  const body = JSON.stringify(payload ?? {})
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
    text: async () => body,
    clone() {
      return jsonResponse(status, payload)
    },
    headers: { get: () => null },
  }
}

function mockFetch(handler) {
  globalThis.fetch = async (url, options = {}) => {
    const call = { url: String(url), options }
    fetchCalls.push(call)
    return handler(call)
  }
}

check('SuperAdmin puede crear departamentos', () => {
  assert.equal(isSuperadmin({ rol: 'SuperAdmin' }), true)
  assert.equal(isSuperadmin({ rol: 'superadmin' }), true)
  assert.equal(isSuperadmin({ role: 'SUPERADMIN' }), true)
  assert.equal(puedeMostrarAltaDepartamento(superadmin()), true)
  assert.equal(puedeCrearDepartamentos(superadmin(), 7), true)
  assert.equal(puedeCrearDepartamentos(superadmin(), null), false)
})

check('ADMIN puede crear departamentos dentro de su empresa', () => {
  const user = admin(9)
  assert.equal(puedeMostrarAltaDepartamento(user), true)
  assert.equal(puedeCrearDepartamentos(user, 9), true)
  assert.equal(puedeCrearDepartamentos(user, 4), false)
  assert.equal(puedeCrearSucursales(user, 9), false)
})

check('RRHH no ve la acción para crear departamentos', () => {
  const user = rrhh(9)
  assert.equal(puedeMostrarAltaDepartamento(user), false)
  assert.equal(puedeCrearDepartamentos(user, 9), false)
  const form = read('src/components/empleado-form.js')
  assert.match(form, /showAddDepartamento/)
  assert.match(form, /puedeMostrarAltaDepartamento/)
  assert.match(form, /showAddDepartamento\s*\n\s*\? `<button/)
  assert.equal(form.includes('No disponible'), false)
})

check('RRHH puede seleccionar y guardar un departamento existente', () => {
  const form = read('src/components/empleado-form.js')
  assert.match(form, /name="departamentoId"/)
  assert.match(form, /id="empleado-departamentoId"/)
  assert.match(form, /departamentoId: parseEntityId\(departamentoSelect\?\.value\)/)
  assert.match(form, /if \(after.departamentoId\) dto.departamentoId = after.departamentoId/)
  assert.equal(/departamentoSelect\.disabled/.test(form), false)
  assert.equal(/name="departamentoId"[\s\S]{0,400}puedeCrearDepartamentos/.test(form), false)
})

check('La creación de sucursales continúa limitada al SuperAdmin', () => {
  assert.equal(puedeCrearSucursales(superadmin(), 7), true)
  assert.equal(puedeCrearSucursales(admin(9), 9), false)
  assert.equal(puedeCrearSucursales(rrhh(9), 9), false)
  const form = read('src/components/empleado-form.js')
  assert.equal(form.includes('Agregar sucursal'), false)
  assert.equal(form.includes('createSucursal'), false)
})

check('Ningún rol distinto obtiene permiso accidentalmente', () => {
  assert.equal(puedeCrearDepartamentos(rrhh(9), 9), false)
  assert.equal(puedeMostrarAltaDepartamento(rrhh(9)), false)
  assert.equal(puedeCrearDepartamentos({ rol: 'AGENTE_SUCURSAL', empresaId: 9 }, 9), false)
  assert.equal(puedeMostrarAltaDepartamento({ rol: 'AGENTE_SUCURSAL', empresaId: 9 }), false)
  assert.equal(puedeCrearDepartamentos({ rol: 'INVITADO', empresaId: 9 }, 9), false)
  assert.equal(puedeMostrarAltaDepartamento({ rol: 'INVITADO', empresaId: 9 }), false)
  assert.equal(puedeCrearDepartamentos({ rol: 'ADMIN' }, 9), false)
})

check('Validación recorta, rechaza vacío y respeta 100 caracteres', () => {
  assert.equal(validateDepartamentoAlta({ nombre: '   ', sucursalId: 1 }).hasErrors, true)
  assert.equal(validateDepartamentoAlta({ nombre: 'Sistemas', sucursalId: null }).hasErrors, true)
  assert.equal(validateDepartamentoAlta({ nombre: '  Sistemas  ', sucursalId: 1 }).nombre, 'Sistemas')
  const max = 'A'.repeat(DEPARTAMENTO_NOMBRE_MAX)
  assert.equal(validateDepartamentoAlta({ nombre: max, sucursalId: 1 }).hasErrors, false)
  assert.equal(validateDepartamentoAlta({ nombre: `${max}x`, sucursalId: 1 }).hasErrors, true)
})

check('El formulario de empleados muestra alta de departamento y no de sucursal', () => {
  const form = read('src/components/empleado-form.js')
  const deptForm = read('src/components/departamento-form.js')
  const dropdown = read('src/components/dropdown.js')
  assert.match(form, /puedeMostrarAltaDepartamento/)
  assert.match(form, /puedeCrearDepartamentos/)
  assert.match(form, /getOperativeEmpresaId/)
  assert.match(form, /id="empleado-add-departamento"/)
  assert.match(form, /data-ca-native="true"/)
  assert.match(form, /iconPlus/)
  assert.match(form, /aria-label="\$\{escapeHtml\(ADD_DEPARTAMENTO_LABEL\)\}"/)
  assert.match(form, /data-tooltip/)
  assert.match(form, /createDepartamentoForm/)
  assert.match(form, /createDepartamento\(/)
  assert.match(form, /reloadDepartamentos\(\{ preserveDepartamentoId: departamentoId \}\)/)
  assert.match(form, /createEmpleadoForm\(/)
  assert.match(form, /empresaId: parsePositiveId\(current.empresaId\) \?\? getOperativeEmpresaId/)
  assert.equal(form.includes('setEnhancedSelectMenuAction'), false)
  assert.equal(form.includes('departamentos.length'), false)
  assert.equal(form.includes('departamentoCatalog.length'), false)
  assert.equal(form.includes('Agregar sucursal'), false)
  assert.equal(form.includes('createSucursal'), false)
  assert.equal(form.includes('createSucursalForm'), false)
  assert.equal(form.includes('puedeCrearSucursales'), false)
  assert.match(dropdown, /dataset.caNative === 'true'/)
  assert.equal(dropdown.includes('setEnhancedSelectMenuAction'), false)
  assert.equal(dropdown.includes('MENU_ACTION_INDEX'), false)
  assert.match(deptForm, /form.dataset.submitting === 'true'/)
  assert.match(deptForm, /submitButton.disabled = true/)
  assert.equal(deptForm.includes('Agregar sucursal'), false)
})

check('El botón no depende de una lista vacía y aparece en alta y edición', () => {
  const form = read('src/components/empleado-form.js')
  assert.match(form, /showAddDepartamento/)
  assert.equal(form.includes('if (departamentos.length'), false)
  assert.equal(form.includes('options.length === 0'), false)
  assert.match(form, /export function createEmpleadoForm/)
  assert.match(form, /function showEdit/)
  assert.match(form, /createEmpleadoForm\(\{/)
  const createFn = form.indexOf('export function createEmpleadoForm')
  const editFn = form.indexOf('function showEdit')
  assert.equal(form.slice(createFn).includes('id="empleado-add-departamento"'), true)
  assert.equal(editFn > createFn, true)
  assert.match(form, /sm:flex-row sm:items-stretch/)
  assert.match(form, /sm:w-11/)
})

await checkAsync('POST usa sucursal de la empresa activa y Authorization', async () => {
  writeSession(admin(9))
  mockFetch(() => jsonResponse(201, { id: 44, nombre: 'Sistemas', sucursalId: 1 }))

  const created = await createDepartamento({ nombre: '  Sistemas  ', sucursalId: 1, empresaId: 9 })
  assert.equal(created.id, 44)
  assert.equal(created.nombre, 'Sistemas')
  assert.equal(created.sucursalId, 1)
  assert.equal(fetchCalls.length, 1)
  assert.match(fetchCalls[0].url, /\/api\/departamentos$/)
  assert.equal(fetchCalls[0].options.method, 'POST')
  assert.equal(fetchCalls[0].options.headers.Authorization, `Bearer ${SESSION_TOKEN}`)
  assert.equal(fetchCalls[0].options.headers['Content-Type'], 'application/json')
  assert.equal(fetchCalls[0].options.headers['X-Empresa-Id'], undefined)
  assert.deepEqual(JSON.parse(fetchCalls[0].options.body), { nombre: 'Sistemas', sucursalId: 1 })
})

await checkAsync('SuperAdmin envía X-Empresa-Id de la empresa activa', async () => {
  writeSession(superadmin())
  setEmpresaContexto({ id: 7, nombreFantasia: 'Acme' })
  mockFetch(() => jsonResponse(201, { Id: 12, Nombre: 'Calidad', SucursalId: 3 }))

  const created = await createDepartamento({ nombre: 'Calidad', sucursalId: 3, empresaId: 7 })
  assert.equal(created.id, 12)
  assert.equal(fetchCalls.length, 1)
  assert.equal(fetchCalls[0].options.headers['X-Empresa-Id'], '7')
  assert.deepEqual(JSON.parse(fetchCalls[0].options.body), { nombre: 'Calidad', sucursalId: 3 })
})

await checkAsync('RRHH no genera POST /api/departamentos', async () => {
  writeSession(rrhh(9))
  mockFetch(() => jsonResponse(201, { id: 88, nombre: 'Legales', sucursalId: 2 }))
  await assert.rejects(() => createDepartamento({ nombre: 'Legales', sucursalId: 2, empresaId: 9 }), (error) => {
    assert.equal(error.status, 403)
    return true
  })
  assert.equal(fetchCalls.length, 0)
  const form = read('src/components/empleado-form.js')
  assert.match(form, /if \(!showAddDepartamento \|\| !canSubmitDepartamento/)
})

await checkAsync('Tras 201 el departamento mapeado queda disponible para seleccionar', async () => {
  writeSession(admin(9))
  mockFetch(() => jsonResponse(201, { id: 88, nombre: 'Legales', sucursalId: 2 }))
  const created = await createDepartamento({ nombre: 'Legales', sucursalId: 2, empresaId: 9 })
  assert.equal(created.id, 88)
  assert.equal(created.sucursalId, 2)
  const form = read('src/components/empleado-form.js')
  assert.match(form, /applyCreatedDepartamento\(created\)/)
  assert.match(form, /preserveDepartamentoId: departamentoId/)
  assert.match(form, /getDepartamentosBySucursal|reloadDepartamentos/)
})

await checkAsync('Un error no inventa el departamento en memoria', async () => {
  writeSession(admin(9))
  mockFetch(() => jsonResponse(400, { mensaje: 'La sucursal no existe.' }))
  await assert.rejects(() => createDepartamento({ nombre: 'Sistemas', sucursalId: 1, empresaId: 9 }), (error) => {
    assert.equal(error.status, 400)
    assert.equal(error.message, 'La sucursal no existe.')
    return true
  })
  assert.equal(fetchCalls.length, 1)
  const form = read('src/components/empleado-form.js')
  assert.match(form, /await createDepartamento\(/)
  assert.equal(/fillDepartamentoOptions\([^)]*created/.test(form), false)
})

await checkAsync('Un 409 de duplicado no crea opciones locales', async () => {
  writeSession(admin(9))
  mockFetch(() =>
    jsonResponse(409, { mensaje: 'Ya existe un departamento con ese nombre en esa sucursal.' }),
  )
  await assert.rejects(() => createDepartamento({ nombre: 'Sistemas', sucursalId: 1, empresaId: 9 }), (error) => {
    assert.equal(error.status, 409)
    return true
  })
  assert.equal(fetchCalls.length, 1)
})

await checkAsync('Un formulario inválido no dispara POST', async () => {
  writeSession(admin(9))
  mockFetch(() => jsonResponse(201, { id: 1, nombre: 'X', sucursalId: 1 }))
  await assert.rejects(() => createDepartamento({ nombre: '   ', sucursalId: 1, empresaId: 9 }), (error) => {
    assert.equal(error.status, 400)
    return true
  })
  assert.equal(fetchCalls.length, 0)
})

await checkAsync('No se generan dobles solicitudes en un alta en curso', async () => {
  writeSession(admin(9))
  let resolveFetch
  const pending = new Promise((resolve) => {
    resolveFetch = resolve
  })
  mockFetch(async () => {
    await pending
    return jsonResponse(201, { id: 5, nombre: 'Sistemas', sucursalId: 1 })
  })

  const first = createDepartamento({ nombre: 'Sistemas', sucursalId: 1, empresaId: 9 })
  await Promise.resolve()
  assert.equal(fetchCalls.length, 1)

  const form = read('src/components/departamento-form.js')
  assert.match(form, /if \(form.dataset.submitting === 'true'\) return/)
  assert.match(form, /form.dataset.submitting = 'true'/)
  assert.match(form, /submitButton.disabled = true/)

  resolveFetch()
  await first
  assert.equal(fetchCalls.length, 1)
})

console.log(`${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
