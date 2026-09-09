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
import { USUARIO_API_CAPABILITIES } from '../src/api/usuarios.js'
import {
  puedeAccederAdministracion,
  puedeListarUsuarios,
} from '../src/config/administracion.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
let passed = 0
let failed = 0
const fetchCalls = []

function read(relative) {
  return readFileSync(join(root, relative), 'utf8')
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

await check('Capacidades reales: sin GET, reset, cambio ni desbloqueo', () => {
  assert.equal(USUARIO_API_CAPABILITIES.listar, false)
  assert.equal(USUARIO_API_CAPABILITIES.obtenerPorId, false)
  assert.equal(USUARIO_API_CAPABILITIES.restablecerPassword, false)
  assert.equal(USUARIO_API_CAPABILITIES.cambiarPassword, false)
  assert.equal(USUARIO_API_CAPABILITIES.desbloquear, false)
  assert.equal(USUARIO_API_CAPABILITIES.requiereCambioPassword, false)
  assert.equal(USUARIO_API_CAPABILITIES.bloqueoPorIntentos, false)
  assert.equal(puedeListarUsuarios(), false)
})

await check('Matriz de acceso a Administración', () => {
  assert.equal(puedeAccederAdministracion({ rol: 'SuperAdmin' }), true)
  assert.equal(puedeAccederAdministracion({ rol: 'ADMIN', empresaId: 4 }), true)
  assert.equal(puedeAccederAdministracion({ rol: 'RRHH', empresaId: 4 }), false)
})

await check('El cliente no llama GET /api/usuarios', () => {
  const usuariosApi = read('src/api/usuarios.js')
  assert.match(usuariosApi, /jsonRequest\(\s*'\/api\/usuarios'/)
  assert.match(usuariosApi, /method:\s*'POST'/)
  assert.equal(USUARIO_API_CAPABILITIES.listar, false)
  assert.equal(usuariosApi.includes("method: 'GET'"), false)
})

await check('La UI no simula un listado local ni muestra secretos', () => {
  const adminView = read('src/views/administracion.js')
  const usuariosApi = read('src/api/usuarios.js')
  assert.match(adminView, /Consulta de usuarios no disponible/)
  assert.match(adminView, /operaciones independientes/)
  assert.equal(/localStorage/.test(adminView), false)
  assert.equal(/passwordHash/.test(adminView), false)
  assert.equal(/Listado no disponible/.test(adminView), false)
  assert.match(usuariosApi, /discardUsuarioCreateSecrets/)
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
