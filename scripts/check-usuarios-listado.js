import { resetBrowserGlobals } from './browser-globals.js'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  LOGIN_RATE_LIMIT_MESSAGE,
  LOGIN_TEMPORARY_LOCK_MESSAGE,
  login,
} from '../src/api/auth.js'
import { setEmpresaContexto } from '../src/api/empresa-context.js'
import {
  USUARIO_API_CAPABILITIES,
  USUARIO_LIST_FIELDS,
  buildUsuariosQuery,
  createUsuario,
  getUsuarios,
  mapUsuario,
} from '../src/api/usuarios.js'
import {
  puedeAccederAdministracion,
  puedeCambiarPasswordDeOtroUsuario,
  puedeDesbloquearUsuario,
  puedeListarUsuarios,
  puedeRestablecerPasswordUsuario,
} from '../src/config/administracion.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
let passed = 0
let failed = 0
const fetchCalls = []

function read(relative) {
  return readFileSync(join(root, relative), 'utf8')
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

function writeSession(user, token = 'session-jwt') {
  sessionStorage.setItem('ca.auth.user', JSON.stringify(user))
  sessionStorage.setItem('ca.auth.token', token)
}

function usuarioApi(overrides = {}) {
  return {
    id: 11,
    empresaId: 4,
    nombreUsuario: 'martin.eloy',
    correo: 'martin@example.com',
    rol: 'ADMIN',
    activo: true,
    requiereCambioPassword: false,
    ...overrides,
  }
}

function jsonResponse(status, payload) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
    text: async () => JSON.stringify(payload ?? {}),
  }
}

function installFetch(handler) {
  fetchCalls.length = 0
  globalThis.fetch = async (url, options = {}) => {
    fetchCalls.push({ url, options })
    return handler({ url, options, count: fetchCalls.length })
  }
}

function requestMethods() {
  return fetchCalls.map(({ options }) => String(options.method ?? 'GET').toUpperCase())
}

async function check(name, fn) {
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

await check('Capacidades reales: listado, restablecer y desbloquear', () => {
  assert.equal(USUARIO_API_CAPABILITIES.listar, true)
  assert.equal(USUARIO_API_CAPABILITIES.requiereCambioPassword, true)
  assert.equal(USUARIO_API_CAPABILITIES.bloqueoPorIntentos, true)
  assert.equal(USUARIO_API_CAPABILITIES.obtenerPorId, false)
  assert.equal(USUARIO_API_CAPABILITIES.restablecerPassword, true)
  assert.equal(USUARIO_API_CAPABILITIES.cambiarPassword, false)
  assert.equal(USUARIO_API_CAPABILITIES.desbloquear, true)
  assert.equal(puedeRestablecerPasswordUsuario(), true)
  assert.equal(puedeDesbloquearUsuario(), true)
  assert.equal(puedeCambiarPasswordDeOtroUsuario(), false)
})

await check('Matriz de acceso: SuperAdmin y ADMIN listan, RRHH no', () => {
  assert.equal(puedeListarUsuarios(superadmin()), true)
  assert.equal(puedeListarUsuarios(admin(4)), true)
  assert.equal(puedeListarUsuarios(admin(0)), false)
  assert.equal(puedeListarUsuarios(rrhh(4)), false)
  assert.equal(puedeListarUsuarios(), false)
  assert.equal(puedeAccederAdministracion(superadmin()), true)
  assert.equal(puedeAccederAdministracion(admin(4)), true)
  assert.equal(puedeAccederAdministracion(rrhh(4)), false)
})

await check('1. SuperAdmin obtiene usuarios con GET /api/usuarios', async () => {
  writeSession(superadmin())
  installFetch(() =>
    jsonResponse(200, [usuarioApi(), usuarioApi({ id: 12, empresaId: 7, rol: 'RRHH', activo: false })]),
  )

  const usuarios = await getUsuarios()
  assert.equal(fetchCalls.length, 1)
  assert.deepEqual(requestMethods(), ['GET'])
  assert.match(String(fetchCalls[0].url), /\/api\/usuarios$/)
  assert.equal(usuarios.length, 2)
  assert.equal(usuarios[0].nombreUsuario, 'martin.eloy')
  assert.equal(usuarios[1].activo, false)
})

await check('2. La empresa seleccionada viaja como query empresaId', async () => {
  writeSession(superadmin())
  setEmpresaContexto({ id: 7, nombre: 'Empresa 7' })
  installFetch(() => jsonResponse(200, [usuarioApi({ empresaId: 7 })]))

  const usuarios = await getUsuarios()
  assert.equal(fetchCalls.length, 1)
  const url = new URL(String(fetchCalls[0].url), 'http://localhost')
  assert.equal(url.pathname, '/api/usuarios')
  assert.equal(url.searchParams.get('empresaId'), '7')
  assert.equal(fetchCalls[0].options.headers['X-Empresa-Id'], '7')
  assert.equal(usuarios.length, 1)
})

await check('3. Cambiar de empresa recarga el listado con el nuevo empresaId', async () => {
  writeSession(superadmin())
  setEmpresaContexto({ id: 7, nombre: 'Empresa 7' })
  installFetch(() => jsonResponse(200, [usuarioApi({ empresaId: 7 }), usuarioApi({ id: 21, empresaId: 8 })]))

  const primera = await getUsuarios()
  assert.equal(primera.length, 1, 'no debe mezclar usuarios de otra empresa')
  assert.equal(primera[0].empresaId, 7)

  setEmpresaContexto({ id: 8, nombre: 'Empresa 8' })
  const segunda = await getUsuarios()
  assert.equal(fetchCalls.length, 2)
  const url = new URL(String(fetchCalls[1].url), 'http://localhost')
  assert.equal(url.searchParams.get('empresaId'), '8')
  assert.equal(segunda.length, 1)
  assert.equal(segunda[0].empresaId, 8)

  // La recarga la dispara app.js al re-renderizar la vista activa.
  const app = read('src/app.js')
  assert.match(app, /window\.addEventListener\(EMPRESA_CONTEXTO_EVENT, refreshActiveView\)/)
  assert.match(app, /void renderView\(mainEl, currentView, viewExtras\)/)
})

await check('4. ADMIN no elige empresa: no envía empresaId ni X-Empresa-Id', async () => {
  writeSession(admin(9))
  setEmpresaContexto({ id: 2, nombre: 'No debe usarse' })
  installFetch(() => jsonResponse(200, [usuarioApi({ empresaId: 9 })]))

  const usuarios = await getUsuarios({ empresaId: 2 })
  const url = new URL(String(fetchCalls[0].url), 'http://localhost')
  assert.equal(url.search, '')
  assert.equal(fetchCalls[0].options.headers['X-Empresa-Id'], undefined)
  assert.equal(fetchCalls[0].options.headers['x-empresa-id'], undefined)
  assert.equal(usuarios.length, 1)
  assert.equal(usuarios[0].empresaId, 9)
})

await check('5. RRHH no accede y no genera solicitudes', async () => {
  writeSession(rrhh(9))
  installFetch(() => jsonResponse(200, [usuarioApi()]))

  await assert.rejects(() => getUsuarios(), (error) => {
    assert.equal(error.status, 403)
    assert.match(error.message, /No tenés permiso para consultar usuarios/)
    return true
  })
  assert.equal(fetchCalls.length, 0)
})

await check('6. Estado de carga antes de la respuesta', () => {
  const adminView = read('src/views/administracion.js')
  assert.match(adminView, /if \(!usuariosLoaded\) \{/)
  assert.match(adminView, /createTableSkeleton\(/)
  assert.match(adminView, /label: 'Cargando usuarios'/)
  assert.match(adminView, /USUARIOS_TABLE_COLUMNS\.length/)
  assert.match(adminView, /usuariosLoaded = false\s*\n\s*usuariosError = false\s*\n\s*paintUsuariosResults\(\)/)
})

await check('7. Estado vacío cuando la API no devuelve usuarios', async () => {
  writeSession(superadmin())
  installFetch(() => jsonResponse(200, []))
  assert.deepEqual(await getUsuarios(), [])

  const adminView = read('src/views/administracion.js')
  assert.match(adminView, /title: 'No hay usuarios'/)
})

await check('8. Error de la API con opción de reintento', async () => {
  writeSession(superadmin())
  installFetch(() => jsonResponse(500, { mensaje: 'boom' }))
  await assert.rejects(() => getUsuarios(), (error) => {
    assert.equal(error.status, 500)
    assert.match(error.message, /La API no pudo listar los usuarios/)
    assert.equal(/boom/.test(error.message), false)
    return true
  })

  installFetch(() => jsonResponse(403, { mensaje: 'Forbidden' }))
  await assert.rejects(() => getUsuarios(), (error) => {
    assert.equal(error.status, 403)
    return true
  })

  const adminView = read('src/views/administracion.js')
  assert.match(adminView, /title: 'No se pudieron cargar los usuarios'/)
  assert.match(adminView, /actionLabel: 'Reintentar',\s*\n\s*onAction: \(\) => loadUsuarios\(\)/)
})

await check('9. El listado no expone hashes ni contraseñas', async () => {
  writeSession(superadmin())
  installFetch(() =>
    jsonResponse(200, [
      {
        ...usuarioApi(),
        passwordHash: 'AQAAAA-hash',
        PasswordHash: 'AQAAAA-hash',
        passwordTemporal: 'Temp-abc123!',
        token: 'eyJhbGciOi.jwt',
      },
    ]),
  )

  const usuarios = await getUsuarios()
  assert.deepEqual(Object.keys(usuarios[0]).sort(), [...USUARIO_LIST_FIELDS].sort())
  const serialized = JSON.stringify(usuarios)
  for (const secreto of ['hash', 'Temp-abc123!', 'eyJhbGciOi']) {
    assert.equal(serialized.includes(secreto), false, secreto)
  }
  assert.equal(mapUsuario({ id: 3, passwordHash: 'x' }).passwordHash, undefined)

  const adminView = read('src/views/administracion.js')
  assert.equal(/passwordHash/i.test(adminView), false)
  assert.match(adminView, /createPasswordTemporalPanel/)
  assert.equal(/eyJ[A-Za-z0-9_-]+\./.test(adminView), false)
  assert.equal(/localStorage/.test(adminView), false)
})

await check('10. El listado no ejecuta POST, PUT, PATCH ni DELETE', async () => {
  writeSession(superadmin())
  installFetch(() => jsonResponse(200, [usuarioApi()]))
  await getUsuarios()
  await getUsuarios({ rol: 'RRHH', nombreUsuario: 'mar', correo: 'mar', activo: true })

  assert.deepEqual([...new Set(requestMethods())], ['GET'])
  assert.equal(buildUsuariosQuery({}), '')
  assert.equal(
    buildUsuariosQuery({ empresaId: 4, rol: 'RRHH', nombreUsuario: 'mar', correo: 'a@b.c', activo: false }),
    '?empresaId=4&rol=RRHH&nombreUsuario=mar&correo=a%40b.c&activo=false',
  )

  const usuariosApi = read('src/api/usuarios.js')
  assert.equal((usuariosApi.match(/method: 'PUT'/g) || []).length, 0)
  assert.equal((usuariosApi.match(/method: 'DELETE'/g) || []).length, 0)
  assert.equal((usuariosApi.match(/method: 'PATCH'/g) || []).length, 2)
  assert.match(usuariosApi, /USUARIO_API_PATHS\.estado/)
  assert.match(usuariosApi, /USUARIO_API_PATHS\.rol/)
  assert.match(usuariosApi, /USUARIO_API_PATHS\.identidad/)
})

await check('11. La vista no agrega listeners globales al cambiar de pestaña', () => {
  const adminView = read('src/views/administracion.js')
  assert.equal(/window\.addEventListener/.test(adminView), false)
  assert.equal(/EMPRESA_CONTEXTO_EVENT/.test(adminView), false)
  // Un solo binding del tab por render y limpieza al desmontar la vista.
  assert.equal((adminView.match(/tabButtons\.forEach/g) || []).length, 2)
  assert.match(adminView, /life\.dispose\(\(\) => \{/)
  assert.match(adminView, /listenerAbort\.abort\(\)/)
  assert.match(adminView, /clearSecretHolder\(\)/)

  const app = read('src/app.js')
  assert.match(app, /activeViewCleanup\?\.\(\)/)
  assert.match(app, /clearActiveView\(\)/)
})

await check('12. Nuevo usuario continúa funcionando', async () => {
  writeSession(superadmin())
  installFetch(() => jsonResponse(201, { token: 'nuevo-jwt', mensaje: 'ok' }))

  const result = await createUsuario({
    nombreUsuario: 'nueva.cuenta',
    email: 'nueva@example.com',
    password: 'secreto12',
    rol: 'RRHH',
    empresaId: 4,
  })
  assert.equal(result.mensaje, 'Usuario creado correctamente.')
  assert.equal(result.token, undefined)
  assert.deepEqual(requestMethods(), ['POST'])
  assert.equal(fetchCalls[0].options.headers['X-Empresa-Id'], '4')

  const adminView = read('src/views/administracion.js')
  assert.match(adminView, /#admin-usuario-new'\)\?\.addEventListener\('click', openUsuarioCreate/)
})

await check('La UI ya no muestra el bloqueo estático del listado', () => {
  const adminView = read('src/views/administracion.js')
  assert.equal(adminView.includes('Consulta de usuarios no disponible'), false)
  assert.equal(adminView.includes('El listado de usuarios todavía no está disponible'), false)
  assert.match(adminView, /getUsuarios\(\{ empresaId: empresaSeleccionadaId\(\) \}\)/)
  assert.equal(adminView.includes('USUARIO_ACCIONES_SENSIBLES_HINT'), false)
  assert.equal(adminView.includes('/api/usuarios/'), false)
  assert.equal(adminView.includes('/cambiar-password'), false)
})

await check('401 de login no revela si el correo existe', async () => {
  installFetch(() => jsonResponse(401, { mensaje: 'Credenciales incorrectas' }))
  await assert.rejects(() => login({ email: 'a@example.com', password: 'secreto12' }), /Correo o contraseña incorrectos/)
  assert.equal(sessionStorage.getItem('ca.auth.token'), null)
  assert.equal(sessionStorage.getItem('ca.auth.user'), null)
})

await check('423 indica bloqueo de cuenta y 429 indica límite de intentos', async () => {
  installFetch(() => jsonResponse(423, { mensaje: 'locked' }))
  await assert.rejects(() => login({ email: 'a@example.com', password: 'secreto12' }), (error) => {
    assert.equal(error.message, LOGIN_TEMPORARY_LOCK_MESSAGE)
    assert.match(error.message, /cuenta se encuentra temporalmente bloqueada/)
    return true
  })

  installFetch(() => jsonResponse(429, {}))
  await assert.rejects(() => login({ email: 'a@example.com', password: 'secreto12' }), (error) => {
    assert.equal(error.message, LOGIN_RATE_LIMIT_MESSAGE)
    assert.equal(error.message.includes('bloqueada'), false)
    return true
  })
})

await check('500 de login no se trata como intento de contraseña en el cliente', async () => {
  installFetch(() => jsonResponse(500, { mensaje: 'error interno' }))
  await assert.rejects(() => login({ email: 'a@example.com', password: 'secreto12' }), /No se pudo iniciar sesión \(500\)/)
})

await check('No hay hashes ni JWT en el código de listado', () => {
  const adminView = read('src/views/administracion.js')
  assert.equal(/eyJ[A-Za-z0-9_-]+\./.test(adminView), false)
  assert.equal(/admin123/.test(read('src/api/auth.js')), false)
})

if (failed) {
  console.error(`\n${failed} failed, ${passed} passed`)
  process.exit(1)
}

console.log(`\n${passed} passed`)
