import { resetBrowserGlobals } from './browser-globals.js'
import assert from 'node:assert/strict'
import {
  puedeAbrirNuevoUsuario,
  puedeAccederAdministracion,
  puedeCrearUsuarios,
} from '../src/config/administracion.js'
import { setEmpresaContexto } from '../src/api/empresa-context.js'
import {
  buildUsuarioRegistroDto,
  clearPasswordInput,
  createUsuario,
  discardUsuarioCreateSecrets,
  USUARIO_ALTA_FIELDS,
  validateUsuarioAlta,
  validateUsuarioNombre,
} from '../src/api/usuarios.js'

const SESSION_TOKEN = 'session-jwt'
let passed = 0
let failed = 0
const fetchCalls = []

function superadmin() {
  return { nombre: 'SA', email: 'sa@example.com', rol: 'SuperAdmin' }
}

function admin(empresaId = 9) {
  return { nombre: 'Admin', email: 'admin@example.com', rol: 'ADMIN', empresaId }
}

function rrhh(empresaId = 9) {
  return { nombre: 'Rrhh', email: 'rrhh@example.com', rol: 'RRHH', empresaId }
}

function agente() {
  return { nombre: 'Agente', email: 'agente@example.com', rol: 'AGENTE_SUCURSAL' }
}

function writeSession(user, token = SESSION_TOKEN) {
  sessionStorage.setItem('ca.auth.user', JSON.stringify(user))
  sessionStorage.setItem('ca.auth.token', token)
}

function altaDto(overrides = {}) {
  return {
    nombreUsuario: 'martin.eloy',
    email: 'ana@example.com',
    password: 'secreto12',
    rol: 'ADMIN',
    empresaId: 4,
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

await check('SuperAdmin puede abrir Nuevo usuario', () => {
  assert.equal(puedeAbrirNuevoUsuario(superadmin()), true)
  assert.equal(puedeCrearUsuarios(superadmin()), true)
  assert.equal(puedeAccederAdministracion(superadmin()), true)
})

await check('SuperAdmin sin empresa seleccionada no puede enviar', async () => {
  const errors = validateUsuarioAlta({
    nombreUsuario: 'Ana',
    email: 'ana@example.com',
    password: 'secreto12',
    rol: 'ADMIN',
    empresaId: '',
  })
  assert.equal(Boolean(errors.empresaId), true)
  assert.equal(puedeCrearUsuarios(superadmin(), ''), false)

  writeSession(superadmin())
  installFetch(async () => jsonResponse(201, { token: 'nuevo-jwt' }))
  await assert.rejects(() => createUsuario(altaDto({ empresaId: null })), (error) => {
    assert.equal(error.status, 400)
    return true
  })
  assert.equal(fetchCalls.length, 0)
})

await check('SuperAdmin envía header y body con el mismo ID', async () => {
  writeSession(superadmin())
  setEmpresaContexto({ id: 1, nombre: 'Contexto distinto' })
  installFetch(async () => jsonResponse(201, { token: 'nuevo-jwt', Token: 'nuevo-jwt', mensaje: 'ok' }))

  const result = await createUsuario(altaDto({ empresaId: 4 }))
  assert.equal(result.mensaje, 'Usuario creado correctamente.')
  assert.equal(fetchCalls.length, 1)

  const { options } = fetchCalls[0]
  const body = JSON.parse(options.body)
  assert.equal(options.method, 'POST')
  assert.match(String(fetchCalls[0].url), /\/api\/usuarios$/)
  assert.equal(options.headers['X-Empresa-Id'], '4')
  assert.equal(body.empresaId, 4)
  assert.equal(String(options.headers['X-Empresa-Id']), String(body.empresaId))
  assert.deepEqual(Object.keys(body).sort(), [...USUARIO_ALTA_FIELDS].sort())
  assert.equal(body.nombreUsuario, 'martin.eloy')
  assert.equal(body.email, 'ana@example.com')
  assert.equal(body.password, 'secreto12')
  assert.equal(body.rol, 'ADMIN')
})

await check('ADMIN puede crear dentro de su empresa', async () => {
  writeSession(admin(9))
  installFetch(async () => jsonResponse(201, { token: 'nuevo-jwt' }))

  const result = await createUsuario(altaDto({ empresaId: 9, rol: 'RRHH' }))
  assert.equal(result.mensaje, 'Usuario creado correctamente.')
  assert.equal(fetchCalls.length, 1)
  assert.equal(JSON.parse(fetchCalls[0].options.body).empresaId, 9)
  assert.equal(puedeCrearUsuarios(admin(9), 9), true)
  assert.equal(puedeAbrirNuevoUsuario(admin(9)), true)
})

await check('ADMIN no envía X-Empresa-Id', async () => {
  writeSession(admin(9))
  setEmpresaContexto({ id: 2, nombre: 'No debe usarse' })
  installFetch(async () => jsonResponse(201, { token: 'nuevo-jwt' }))

  await createUsuario(altaDto({ empresaId: 9 }))
  const headers = fetchCalls[0].options.headers
  assert.equal(headers['X-Empresa-Id'], undefined)
  assert.equal(headers['x-empresa-id'], undefined)
})

await check('RRHH no accede', async () => {
  writeSession(rrhh(9))
  installFetch(async () => jsonResponse(201, { token: 'nuevo-jwt' }))

  assert.equal(puedeAbrirNuevoUsuario(rrhh(9)), false)
  assert.equal(puedeCrearUsuarios(rrhh(9), 9), false)
  assert.equal(puedeAccederAdministracion(rrhh(9)), false)
  assert.equal(puedeCrearUsuarios(agente(), 9), false)

  await assert.rejects(() => createUsuario(altaDto({ empresaId: 9 })), (error) => {
    assert.equal(error.status, 403)
    return true
  })
  assert.equal(fetchCalls.length, 0)
})

await check('El token devuelto no reemplaza la sesión', async () => {
  writeSession(superadmin(), SESSION_TOKEN)
  installFetch(async () =>
    jsonResponse(201, {
      token: 'jwt-del-usuario-creado',
      Token: 'jwt-del-usuario-creado',
      mensaje: 'Usuario registrado correctamente.',
    }),
  )

  const result = await createUsuario(altaDto({ empresaId: 4 }))
  assert.equal(sessionStorage.getItem('ca.auth.token'), SESSION_TOKEN)
  assert.equal(result.token, undefined)
  assert.equal(result.Token, undefined)
  assert.equal(result.mensaje, 'Usuario creado correctamente.')
})

await check('La contraseña se limpia después del intento', async () => {
  const input = { value: 'secreto12' }
  writeSession(admin(9))
  installFetch(async () => jsonResponse(201, { token: 'nuevo-jwt' }))

  try {
    await createUsuario(altaDto({ empresaId: 9 }))
  } finally {
    clearPasswordInput(input)
  }
  assert.equal(input.value, '')

  input.value = 'otra-clave'
  installFetch(async () => jsonResponse(409, { mensaje: 'El correo ya está registrado o la empresa no existe.' }))
  try {
    await createUsuario(altaDto({ empresaId: 9, email: 'dup@example.com' }))
  } catch {
    // el alta falló; la contraseña igual debe limpiarse
  } finally {
    clearPasswordInput(input)
  }
  assert.equal(input.value, '')
})

await check('El doble clic no duplica solicitudes', async () => {
  writeSession(superadmin())
  let started = 0
  let release
  const gate = new Promise((resolve) => {
    release = resolve
  })

  installFetch(async () => {
    started += 1
    await gate
    return jsonResponse(201, { token: 'nuevo-jwt' })
  })

  const dto = altaDto({ empresaId: 4 })
  const first = createUsuario(dto)
  const second = createUsuario(dto)
  release()
  await Promise.all([first, second])
  assert.equal(fetchCalls.length, 1)
  assert.equal(started, 1)
})

await check('El body del alta no incluye campos adicionales', () => {
  const dto = buildUsuarioRegistroDto(altaDto({ nombreUsuario: 'martin.eloy', email: '  ana@example.com  ' }))
  assert.deepEqual(Object.keys(dto), ['empresaId', 'nombreUsuario', 'email', 'password', 'rol'])
  assert.equal(dto.nombreUsuario, 'martin.eloy')
  assert.equal(dto.email, 'ana@example.com')
})

await check('Descarta token y PasswordHash de la respuesta', () => {
  const payload = {
    token: 'secret',
    Token: 'secret',
    passwordHash: 'hash',
    PasswordHash: 'hash',
    mensaje: 'ok',
  }
  discardUsuarioCreateSecrets(payload)
  assert.equal(payload.token, undefined)
  assert.equal(payload.Token, undefined)
  assert.equal(payload.passwordHash, undefined)
  assert.equal(payload.PasswordHash, undefined)
})

await check('Nombre de usuario: formatos válidos e inválidos', () => {
  for (const value of ['martin', 'martin.eloy', 'martin_eloy', 'martin-eloy', 'martin2026', 'rrhh.central']) {
    assert.equal(validateUsuarioNombre(value), '', value)
  }
  assert.match(validateUsuarioNombre('martin!!!'), /Solo se permiten letras/)
  assert.equal(validateUsuarioNombre('martin eloy'), 'El nombre de usuario no puede contener espacios.')
  assert.equal(validateUsuarioNombre('martin..eloy'), 'No utilices puntos, guiones o guiones bajos consecutivos.')
  assert.equal(validateUsuarioNombre('martin__eloy'), 'No utilices puntos, guiones o guiones bajos consecutivos.')
  assert.equal(validateUsuarioNombre('martin--eloy'), 'No utilices puntos, guiones o guiones bajos consecutivos.')
  assert.equal(validateUsuarioNombre('ma'), 'El nombre de usuario debe tener entre 3 y 50 caracteres.')
  assert.equal(validateUsuarioNombre('a'.repeat(51)), 'El nombre de usuario debe tener entre 3 y 50 caracteres.')
  assert.equal(validateUsuarioNombre('.martin'), 'El nombre de usuario debe comenzar con una letra.')
  assert.equal(validateUsuarioNombre('martin.'), 'El nombre de usuario debe terminar con una letra o un número.')
  assert.match(validateUsuarioNombre('martin@empresa'), /Solo se permiten letras/)
  assert.equal(validateUsuarioNombre(''), 'Ingresá un nombre de usuario.')
})

await check('El formulario inválido no ejecuta POST', async () => {
  writeSession(admin(4))
  installFetch(async () => jsonResponse(201, { token: 'nuevo-jwt' }))
  await assert.rejects(() => createUsuario(altaDto({ nombreUsuario: 'martin!!!' })), (error) => {
    assert.equal(error.status, 400)
    return true
  })
  assert.equal(fetchCalls.length, 0)
})

console.log(`${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
