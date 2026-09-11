import { resetBrowserGlobals } from './browser-globals.js'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  AUTH_CAMBIAR_PASSWORD_PATH,
  cambiarPassword,
  consumeLoginNotice,
  finishPasswordChange,
  getCurrentUser,
  login,
  notifyPasswordChangeRequired,
  notifyUnauthorized,
  PASSWORD_CHANGE_REQUIRED_API_MESSAGE,
  PASSWORD_CHANGED_LOGIN_MESSAGE,
  requiresPasswordChange,
  resetSessionGuards,
} from '../src/api/auth.js'
import { apiFetch } from '../src/api/http.js'
import {
  completeUsuarioResetReveal,
  desbloquearUsuario,
  discardPasswordTemporal,
  estadoCuentaUsuario,
  estadoPasswordUsuario,
  getUsuarios,
  mapUsuario,
  restablecerPasswordUsuario,
  takePasswordTemporal,
  USUARIO_API_PATHS,
  USUARIO_LIST_FIELDS,
} from '../src/api/usuarios.js'
import {
  esMismoUsuario,
  puedeCambiarPasswordDeOtroUsuario,
  puedeDesbloquearUsuarioObjetivo,
  puedeIdentificarOperador,
  puedeRestablecerUsuarioObjetivo,
  USUARIOS_TABLE_COLUMNS,
} from '../src/config/administracion.js'
import { validatePasswordConfirm, validateUsuarioPasswordPolicy } from '../src/components/form-field.js'
import { PASSWORD_TEMPORAL_ACK_LABEL, PASSWORD_TEMPORAL_COPIED } from '../src/components/password-temporal-panel.js'
import { usuariosTableHeadMarkup } from '../src/views/administracion.js'
import { createKeyedLock, createViewLifecycle, runLockedConfirmAction } from '../src/utils/view-guard.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
let passed = 0
let failed = 0
const fetchCalls = []
let unauthorizedEvents = 0
let passwordChangeEvents = 0

function read(relative) {
  return readFileSync(join(root, relative), 'utf8')
}

function jwtFromPayload(payload) {
  const header = Buffer.from(JSON.stringify({ alg: 'none' })).toString('base64url')
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${header}.${body}.sig`
}

function superadmin(id = 1) {
  return { id, nombre: 'SA', email: 'sa@example.com', rol: 'SuperAdmin' }
}

function admin(empresaId = 9, id = 2) {
  return { id, nombre: 'Admin', email: 'admin@example.com', rol: 'ADMIN', empresaId }
}

function rrhh(empresaId = 9, id = 3) {
  return { id, nombre: 'Rrhh', email: 'rrhh@example.com', rol: 'RRHH', empresaId }
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
    bloqueado: false,
    bloqueadoHasta: null,
    ...overrides,
  }
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
  }
}

function installFetch(handler) {
  fetchCalls.length = 0
  globalThis.fetch = async (url, options = {}) => {
    fetchCalls.push({ url, options })
    return handler({ url, options, count: fetchCalls.length })
  }
}

function requestOf(index = 0) {
  return fetchCalls[index]
}

async function check(name, fn) {
  resetBrowserGlobals()
  resetSessionGuards()
  fetchCalls.length = 0
  unauthorizedEvents = 0
  passwordChangeEvents = 0
  window.dispatchEvent = (event) => {
    if (event?.type === 'ca:unauthorized') unauthorizedEvents += 1
    if (event?.type === 'ca:password-change-required') passwordChangeEvents += 1
    return true
  }
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

await check('1. Mapea bloqueado y bloqueadoHasta sin inferir', () => {
  const mapped = mapUsuario(
    usuarioApi({
      bloqueado: true,
      bloqueadoHasta: '2026-09-11T00:00:00Z',
      passwordHash: 'secret',
    }),
  )
  assert.equal(mapped.bloqueado, true)
  assert.equal(mapped.bloqueadoHasta, '2026-09-11T00:00:00Z')
  assert.equal(mapped.passwordHash, undefined)
  assert.deepEqual(Object.keys(mapped).sort(), [...USUARIO_LIST_FIELDS].sort())

  const noInfer = mapUsuario(usuarioApi({ bloqueado: false, bloqueadoHasta: '2026-09-11T00:00:00Z' }))
  assert.equal(noInfer.bloqueado, false)
  assert.equal(estadoCuentaUsuario(noInfer), 'Activo')
})

await check('2. Usuario bloqueado no aparece solo como activo', () => {
  const usuario = mapUsuario(usuarioApi({ activo: true, bloqueado: true }))
  assert.equal(estadoCuentaUsuario(usuario), 'Bloqueado')
  assert.equal(estadoCuentaUsuario(usuario) === 'Activo', false)
  assert.match(read('src/views/administracion.js'), /badgeHtml\('Bloqueado', 'danger'\)/)
})

await check('3. Estado Cambio requerido', () => {
  assert.equal(estadoPasswordUsuario({ requiereCambioPassword: true }), 'Cambio requerido')
  assert.equal(estadoPasswordUsuario({ requiereCambioPassword: false }), 'Normal')
})

await check('4-7. Matriz visual de acciones', () => {
  const sa = superadmin(1)
  const otroSa = { id: 99, rol: 'SuperAdmin', activo: true, empresaId: 1 }
  const adminA = { id: 10, rol: 'ADMIN', activo: true, empresaId: 4, bloqueado: true }
  const rrhhA = { id: 11, rol: 'RRHH', activo: true, empresaId: 4, bloqueado: true }
  const rrhhB = { id: 12, rol: 'RRHH', activo: true, empresaId: 8, bloqueado: true }

  assert.equal(puedeRestablecerUsuarioObjetivo(sa, adminA), true)
  assert.equal(puedeRestablecerUsuarioObjetivo(sa, rrhhA), true)
  assert.equal(puedeDesbloquearUsuarioObjetivo(sa, adminA), true)
  assert.equal(puedeDesbloquearUsuarioObjetivo(sa, rrhhA), true)
  assert.equal(puedeRestablecerUsuarioObjetivo(sa, otroSa), false)
  assert.equal(puedeRestablecerUsuarioObjetivo(sa, { ...sa, rol: 'ADMIN', activo: true }), false)

  const operadorAdmin = admin(4, 2)
  assert.equal(puedeRestablecerUsuarioObjetivo(operadorAdmin, rrhhA), true)
  assert.equal(puedeRestablecerUsuarioObjetivo(operadorAdmin, adminA), false)
  assert.equal(puedeRestablecerUsuarioObjetivo(operadorAdmin, rrhhB), false)
  assert.equal(puedeRestablecerUsuarioObjetivo(operadorAdmin, otroSa), false)
  assert.equal(puedeDesbloquearUsuarioObjetivo(operadorAdmin, rrhhA), true)
  assert.equal(puedeDesbloquearUsuarioObjetivo(operadorAdmin, adminA), false)

  assert.equal(puedeRestablecerUsuarioObjetivo(rrhh(4), rrhhA), false)
  assert.equal(puedeDesbloquearUsuarioObjetivo(rrhh(4), rrhhA), false)
  assert.equal(puedeCambiarPasswordDeOtroUsuario(), false)
})

await check('8. Desbloquear solo si está bloqueado', () => {
  const sa = superadmin()
  const rrhhLibre = { id: 11, rol: 'RRHH', activo: true, empresaId: 4, bloqueado: false }
  assert.equal(puedeDesbloquearUsuarioObjetivo(sa, rrhhLibre), false)
})

await check('9-10. Reset usa POST correcto y no envía contraseña', async () => {
  writeSession(superadmin())
  installFetch(() =>
    jsonResponse(200, {
      mensaje: 'ok',
      passwordTemporal: 'Tmp-once-12!',
      venceEn: '2026-09-11T12:00:00Z',
    }),
  )

  const result = await restablecerPasswordUsuario(11, { empresaId: 4 })
  assert.equal(result.passwordTemporal, 'Tmp-once-12!')
  assert.equal(String(requestOf().options.method).toUpperCase(), 'POST')
  assert.match(String(requestOf().url), /\/api\/usuarios\/11\/restablecer-password$/)
  assert.equal(requestOf().options.body, undefined)
  assert.equal(JSON.stringify(requestOf().options).includes('Tmp'), false)
})

await check('11-15. Temporal se transfiere y no queda en la respuesta ni en storage', () => {
  const payload = {
    mensaje: 'ok',
    passwordTemporal: 'Tmp-once-12!',
    PasswordTemporal: 'Tmp-once-12!',
    venceEn: '2026-09-11T12:00:00Z',
  }
  const taken = takePasswordTemporal(payload)
  assert.equal(taken.passwordTemporal, 'Tmp-once-12!')
  assert.equal(taken.venceEn, '2026-09-11T12:00:00Z')
  assert.equal(payload.passwordTemporal, '')
  assert.equal(payload.PasswordTemporal, '')
  assert.equal(sessionStorage.getItem('ca.auth.user'), null)
  assert.equal(PASSWORD_TEMPORAL_COPIED.includes('temporal'), true)
  assert.equal(PASSWORD_TEMPORAL_ACK_LABEL.includes('guardé'), true)

  const discarded = discardPasswordTemporal({ passwordTemporal: 'abc', PasswordTemporal: 'abc' })
  assert.equal(discarded.passwordTemporal, '')
})

await check('16. Doble clic no abre dos confirmaciones ni dos POST', async () => {
  const lock = createKeyedLock()
  const key = lock.key('restablecer', 11)
  let confirmCalls = 0
  let executeCalls = 0
  let panelCalls = 0
  let resolveConfirm
  const confirm = () => {
    confirmCalls += 1
    return new Promise((resolve) => {
      resolveConfirm = resolve
    })
  }
  const execute = async () => {
    executeCalls += 1
    return { passwordTemporal: 'Tmp-1!' }
  }

  const first = runLockedConfirmAction({ lock, key, confirm, execute })
  const second = await runLockedConfirmAction({ lock, key, confirm, execute })
  assert.equal(second.status, 'busy')
  assert.equal(confirmCalls, 1)
  assert.equal(lock.has(key), true)

  resolveConfirm(true)
  const firstResult = await first
  assert.equal(firstResult.status, 'ok')
  assert.equal(executeCalls, 1)
  assert.equal(lock.has(key), false)

  await completeUsuarioResetReveal({
    result: firstResult.result,
    reveal: async () => {
      panelCalls += 1
    },
    refresh: async () => {},
  })
  assert.equal(panelCalls, 1)
})

await check('16b. El candado se libera al cancelar, error y éxito', async () => {
  const lock = createKeyedLock()
  const key = lock.key('desbloquear', 11)

  const cancelled = await runLockedConfirmAction({
    lock,
    key,
    confirm: async () => false,
    execute: async () => {
      throw new Error('no debería ejecutarse')
    },
  })
  assert.equal(cancelled.status, 'cancelled')
  assert.equal(lock.has(key), false)

  const failed = await runLockedConfirmAction({
    lock,
    key,
    confirm: async () => true,
    execute: async () => {
      throw Object.assign(new Error('falló'), { status: 500 })
    },
  })
  assert.equal(failed.status, 'error')
  assert.equal(lock.has(key), false)

  const ok = await runLockedConfirmAction({
    lock,
    key,
    confirm: async () => true,
    execute: async () => ({ mensaje: 'Cuenta desbloqueada.' }),
  })
  assert.equal(ok.status, 'ok')
  assert.equal(lock.has(key), false)

  const otherKey = lock.key('restablecer', 12)
  assert.equal(lock.acquire(key), true)
  assert.equal(lock.acquire(otherKey), true)
  lock.release(key)
  lock.release(otherKey)
})

await check('16c. Confirmación que arroja libera el candado', async () => {
  const lock = createKeyedLock()
  const key = lock.key('restablecer', 11)
  const outcome = await runLockedConfirmAction({
    lock,
    key,
    confirm: async () => {
      throw new Error('confirmación rota')
    },
    execute: async () => ({ passwordTemporal: 'x' }),
  })
  assert.equal(outcome.status, 'confirm-error')
  assert.equal(lock.has(key), false)
})

await check('17-18. Desbloqueo POST sin body y refresh después del temporal', async () => {
  writeSession(superadmin())
  installFetch(() => jsonResponse(200, { mensaje: 'Cuenta desbloqueada.' }))
  const result = await desbloquearUsuario(11)
  assert.equal(result.mensaje, 'Cuenta desbloqueada.')
  assert.equal(String(requestOf().options.method).toUpperCase(), 'POST')
  assert.match(String(requestOf().url), /\/api\/usuarios\/11\/desbloquear$/)
  assert.equal(requestOf().options.body, undefined)

  let refreshCalls = 0
  let panelOpen = false
  let resolvePanel
  const resetResult = { passwordTemporal: 'Tmp-once-12!', venceEn: '2026-09-11T12:00:00Z' }
  const pending = completeUsuarioResetReveal({
    result: resetResult,
    reveal: () => {
      panelOpen = true
      return new Promise((resolve) => {
        resolvePanel = resolve
      })
    },
    refresh: async () => {
      refreshCalls += 1
    },
  })
  assert.equal(panelOpen, true)
  assert.equal(refreshCalls, 0)
  assert.equal(resetResult.passwordTemporal, '')
  resolvePanel()
  const reveal = await pending
  assert.equal(reveal.refreshed, true)
  assert.equal(refreshCalls, 1)
})

await check('19-21. Login normal y flag de cambio', async () => {
  const token = jwtFromPayload({
    unique_name: 'Admin',
    email: 'admin@example.com',
    role: 'ADMIN',
    empresa_id: '4',
    'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier': '2',
  })

  installFetch(() => jsonResponse(200, { token, mensaje: 'ok', requiereCambioPassword: false }))
  const user = await login({ email: 'admin@example.com', password: 'Password123!' })
  assert.equal(user.requiereCambioPassword, false)
  assert.equal(requiresPasswordChange(user), false)
  assert.equal(sessionStorage.getItem('ca.auth.token'), token)

  resetBrowserGlobals()
  installFetch(() => jsonResponse(200, { token, mensaje: 'ok', requiereCambioPassword: true }))
  const restricted = await login({ email: 'admin@example.com', password: 'Password123!' })
  assert.equal(restricted.requiereCambioPassword, true)
  assert.equal(requiresPasswordChange(restricted), true)
})

await check('22-23. El flag de sesión abre el flujo obligatorio y un 403 genérico no', async () => {
  writeSession({ ...admin(), requiereCambioPassword: true }, 'restricted-jwt')
  assert.equal(requiresPasswordChange(), true)

  writeSession({ ...admin(), requiereCambioPassword: false }, 'jwt')
  assert.equal(requiresPasswordChange(), false)
  installFetch(() => jsonResponse(403, { mensaje: 'Forbidden' }))
  const { response } = await apiFetch('/api/usuarios')
  assert.equal(response.status, 403)
  assert.equal(passwordChangeEvents, 0)
  assert.equal(getCurrentUser()?.requiereCambioPassword, false)
})

await check('Ciclo de vida: desmontaje durante confirmación y POST', async () => {
  const lock = createKeyedLock()
  const key = lock.key('restablecer', 11)
  const life = createViewLifecycle()
  const effects = { modal: 0, toast: 0, refresh: 0, dom: 0, panel: 0 }
  let resolveConfirm
  let resolvePost

  const pendingConfirm = runLockedConfirmAction({
    lock,
    key,
    isAlive: () => life.isAlive(),
    confirm: () =>
      new Promise((resolve) => {
        resolveConfirm = resolve
      }),
    execute: async () => ({ passwordTemporal: 'Tmp-1!' }),
  })
  life.dispose()
  resolveConfirm(true)
  const disposedOnConfirm = await pendingConfirm
  assert.equal(disposedOnConfirm.status, 'disposed')
  assert.equal(disposedOnConfirm.result, undefined)
  if (life.isAlive()) effects.modal += 1
  assert.equal(effects.modal, 0)
  assert.equal(lock.has(key), false)

  const lifePost = createViewLifecycle()
  let executeStarted
  const executeStartedP = new Promise((resolve) => {
    executeStarted = resolve
  })
  const pendingPost = runLockedConfirmAction({
    lock,
    key,
    isAlive: () => lifePost.isAlive(),
    confirm: async () => true,
    execute: () => {
      executeStarted()
      return new Promise((resolve) => {
        resolvePost = resolve
      })
    },
  })
  await executeStartedP
  lifePost.dispose()
  resolvePost({ passwordTemporal: 'Tmp-2!' })
  const disposedOnPost = await pendingPost
  assert.equal(disposedOnPost.status, 'disposed')
  assert.equal(disposedOnPost.result.passwordTemporal, 'Tmp-2!')
  if (lifePost.isAlive()) {
    effects.panel += 1
    effects.toast += 1
    effects.refresh += 1
    effects.dom += 1
  }
  assert.deepEqual(
    { modal: effects.modal, toast: effects.toast, refresh: effects.refresh, dom: effects.dom, panel: effects.panel },
    { modal: 0, toast: 0, refresh: 0, dom: 0, panel: 0 },
  )
})

await check('Ciclo de vida: éxito o error posterior al desmontaje no refresca', async () => {
  const life = createViewLifecycle()
  let refreshCalls = 0
  let toastCalls = 0
  let panelCalls = 0
  life.dispose()

  const success = await completeUsuarioResetReveal({
    result: { passwordTemporal: 'Tmp-dead!', venceEn: null },
    isAlive: () => life.isAlive(),
    reveal: async () => {
      panelCalls += 1
    },
    refresh: async () => {
      refreshCalls += 1
    },
  })
  assert.equal(success.refreshed, false)
  assert.equal(panelCalls, 0)
  assert.equal(refreshCalls, 0)

  const failed = await runLockedConfirmAction({
    lock: createKeyedLock(),
    key: 'desbloquear:11',
    isAlive: () => life.isAlive(),
    confirm: async () => true,
    execute: async () => {
      throw Object.assign(new Error('boom'), { status: 500 })
    },
  })
  if (life.isAlive() && failed.status === 'error') toastCalls += 1
  assert.equal(failed.status, 'disposed')
  assert.equal(toastCalls, 0)
})

await check('24-26. Body y validación del cambio', async () => {
  writeSession({ ...admin(), requiereCambioPassword: true }, 'restricted-jwt')
  installFetch(() => jsonResponse(200, { mensaje: 'Contraseña cambiada correctamente.' }))

  await cambiarPassword({
    passwordActual: 'Temp-old-12!',
    nuevaPassword: 'NuevaClave2026!',
    confirmarPassword: 'NuevaClave2026!',
  })

  assert.equal(String(requestOf().url).includes(AUTH_CAMBIAR_PASSWORD_PATH), true)
  assert.equal(String(requestOf().options.method).toUpperCase(), 'POST')
  assert.deepEqual(JSON.parse(requestOf().options.body), {
    passwordActual: 'Temp-old-12!',
    nuevaPassword: 'NuevaClave2026!',
    confirmarPassword: 'NuevaClave2026!',
  })

  assert.match(validateUsuarioPasswordPolicy('corta'), /entre 8 y 20/)
  assert.match(validateUsuarioPasswordPolicy('sinnumero!!'), /número/)
  assert.match(validateUsuarioPasswordPolicy('12345678!'), /letra/)
  assert.match(validateUsuarioPasswordPolicy('SinEspecial12'), /especial/)
  assert.match(validateUsuarioPasswordPolicy('Con espacio1!'), /espacios/)
  assert.match(validatePasswordConfirm('NuevaClave2026!', 'otra'), /coinciden/)
  assert.equal(validateUsuarioPasswordPolicy('NuevaClave2026!'), '')
})

await check('27-28. Cambio exitoso limpia token y no reutiliza JWT', () => {
  writeSession({ ...admin(), requiereCambioPassword: true }, 'restricted-jwt')
  finishPasswordChange()
  assert.equal(sessionStorage.getItem('ca.auth.token'), null)
  assert.equal(sessionStorage.getItem('ca.auth.user'), null)
  assert.equal(consumeLoginNotice(), PASSWORD_CHANGED_LOGIN_MESSAGE)
  assert.equal(read('src/api/auth.js').includes('writeToken(payload'), false)
})

await check('29. 401 por TokenVersion invalida una sola vez', async () => {
  writeSession(admin(), 'old-jwt')
  notifyUnauthorized()
  notifyUnauthorized()
  assert.equal(unauthorizedEvents, 1)
  assert.equal(sessionStorage.getItem('ca.auth.token'), null)
  assert.equal(sessionStorage.getItem('ca.auth.user'), null)
})

await check('30-31. 403 restringido vs 403 normal', async () => {
  writeSession(admin(), 'jwt')
  installFetch(() => jsonResponse(403, { mensaje: PASSWORD_CHANGE_REQUIRED_API_MESSAGE }))
  await assert.rejects(() => apiFetch('/api/usuarios'), (error) => {
    assert.equal(error.code, 'PASSWORD_CHANGE_REQUIRED')
    return true
  })
  assert.equal(passwordChangeEvents, 1)
  assert.equal(sessionStorage.getItem('ca.auth.token'), 'jwt')
  assert.equal(getCurrentUser()?.requiereCambioPassword, true)

  resetBrowserGlobals()
  resetSessionGuards()
  writeSession(admin(), 'jwt')
  passwordChangeEvents = 0
  window.dispatchEvent = (event) => {
    if (event?.type === 'ca:password-change-required') passwordChangeEvents += 1
    return true
  }
  installFetch(() => jsonResponse(403, { mensaje: 'Forbidden' }))
  const { response } = await apiFetch('/api/usuarios')
  assert.equal(response.status, 403)
  assert.equal(passwordChangeEvents, 0)
  assert.equal(getCurrentUser()?.requiereCambioPassword, undefined)

  resetBrowserGlobals()
  resetSessionGuards()
  writeSession({ ...admin(), requiereCambioPassword: true }, 'jwt')
  passwordChangeEvents = 0
  window.dispatchEvent = (event) => {
    if (event?.type === 'ca:password-change-required') passwordChangeEvents += 1
    return true
  }
  installFetch(() => jsonResponse(403, { mensaje: 'Forbidden' }))
  await assert.rejects(() => apiFetch('/api/usuarios'), (error) => {
    assert.equal(error.code, 'PASSWORD_CHANGE_REQUIRED')
    return true
  })
  assert.equal(passwordChangeEvents, 1)

  resetBrowserGlobals()
  resetSessionGuards()
  writeSession({ ...admin(), requiereCambioPassword: true }, 'jwt')
  passwordChangeEvents = 0
  window.dispatchEvent = (event) => {
    if (event?.type === 'ca:password-change-required') passwordChangeEvents += 1
    return true
  }
  installFetch(() => jsonResponse(403, { mensaje: PASSWORD_CHANGE_REQUIRED_API_MESSAGE }))
  const changePath = await apiFetch(AUTH_CAMBIAR_PASSWORD_PATH)
  assert.equal(changePath.response.status, 403)
  assert.equal(passwordChangeEvents, 0)

  notifyPasswordChangeRequired()
  notifyPasswordChangeRequired()
  assert.equal(passwordChangeEvents, 1)
})

await check('32. 404 administrativo seguro', async () => {
  writeSession(admin(4), 'jwt')
  installFetch(() => jsonResponse(404, { mensaje: 'Usuario no encontrado.' }))
  await assert.rejects(() => restablecerPasswordUsuario(88), (error) => {
    assert.match(error.message, /No se encontró el usuario o no tenés permiso/)
    assert.equal(error.message.includes('88'), false)
    return true
  })
})

await check('33-36. Sin endpoint retirado ni escrituras inesperadas en listado', async () => {
  const frontend = [
    read('src/api/usuarios.js'),
    read('src/api/auth.js'),
    read('src/views/administracion.js'),
    read('src/views/cambiar-password.js'),
  ].join('\n')
  assert.equal(frontend.includes('/api/usuarios/${id}/cambiar-password') || frontend.includes('/api/usuarios/{id}/cambiar-password'), false)
  assert.match(frontend, /\/api\/Auth\/cambiar-password/)
  assert.equal(USUARIO_API_PATHS.restablecerPassword(3), '/api/usuarios/3/restablecer-password')

  writeSession(superadmin())
  installFetch(() => jsonResponse(200, [usuarioApi()]))
  await getUsuarios()
  assert.equal(String(requestOf().options.method ?? 'GET').toUpperCase(), 'GET')
})

await check('34. Listado y logs no guardan hash ni JWT', () => {
  const adminView = read('src/views/administracion.js')
  const auth = read('src/api/auth.js')
  assert.equal(/passwordHash/i.test(adminView), false)
  assert.equal(/eyJ[A-Za-z0-9_-]+\./.test(adminView), false)
  assert.equal(/admin123/.test(auth), false)
  assert.equal(auth.includes('console.log(token'), false)
})

await check('37. Encabezado y skeleton de usuarios usan las mismas columnas', () => {
  const markup = usuariosTableHeadMarkup()
  const heads = markup.match(/<th\b/g) || []
  assert.equal(heads.length, USUARIOS_TABLE_COLUMNS.length)
  assert.equal(USUARIOS_TABLE_COLUMNS.length, 8)
  assert.equal(USUARIOS_TABLE_COLUMNS.includes('Acciones'), true)
  assert.equal(USUARIOS_TABLE_COLUMNS.includes('Contraseña'), true)
  assert.equal(USUARIOS_TABLE_COLUMNS.includes('Bloqueo'), true)
  assert.match(markup, /text-center/)
  assert.match(markup, /text-left/)
})

await check('esMismoUsuario prioriza ID y no habilita sin identificar al operador', () => {
  const operador = admin(4, 2)
  assert.equal(esMismoUsuario(operador, { id: 2, correo: 'otro@example.com' }), true)
  assert.equal(esMismoUsuario(operador, { id: 11, correo: 'admin@example.com' }), false)
  assert.equal(
    esMismoUsuario({ email: 'admin@example.com', rol: 'ADMIN' }, { id: 11, correo: 'admin@example.com' }),
    true,
  )
  assert.equal(puedeIdentificarOperador({ rol: 'ADMIN' }), false)
  assert.equal(
    puedeRestablecerUsuarioObjetivo({ rol: 'ADMIN', empresaId: 4 }, { id: 11, rol: 'RRHH', activo: true, empresaId: 4 }),
    false,
  )
})

await check('38-39. Tema y responsive básicos', () => {
  const view = read('src/views/cambiar-password.js')
  assert.match(view, /dark:bg-slate-950/)
  assert.match(view, /max-w-md/)
  assert.match(read('src/views/administracion.js'), /overflow-auto/)
  assert.match(read('src/components/password-temporal-panel.js'), /dark:bg-amber-950/)
})

await check('40-42. Alta, listado y módulos existentes no se reescriben', () => {
  assert.match(read('src/views/administracion.js'), /createUsuario\(/)
  assert.match(read('src/api/usuarios.js'), /buildUsuariosQuery/)
  assert.match(read('src/views/fichadas.js'), /renderFichadas/)
  assert.match(read('src/api/agentes.js'), /rotarSecret/)
  assert.match(read('src/components/column-picker.js'), /createDropdownBase/)
})

if (failed) {
  console.error(`\n${failed} failed, ${passed} passed`)
  process.exit(1)
}

console.log(`\n${passed} passed`)
