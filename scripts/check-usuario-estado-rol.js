import { resetBrowserGlobals } from './browser-globals.js'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  cambiarEstadoUsuario,
  cambiarRolUsuario,
  createUsuario,
  desbloquearUsuario,
  estadoCuentaUsuario,
  getUsuarios,
  restablecerPasswordUsuario,
  USUARIO_API_CAPABILITIES,
  USUARIO_API_PATHS,
  validateUsuarioAlta,
} from '../src/api/usuarios.js'
import { resetSessionGuards } from '../src/api/auth.js'
import {
  puedeCambiarEstadoUsuarioObjetivo,
  puedeCambiarRolUsuarioObjetivo,
  puedeDesbloquearUsuarioObjetivo,
  puedeEditarUsuarioObjetivo,
  puedeRestablecerUsuarioObjetivo,
} from '../src/config/administracion.js'
import {
  canAccessView,
  getNavItemsForUser,
  resolveAccessibleView,
} from '../src/config/navigation.js'
import { rolesAsignablesParaAlta } from '../src/config/roles.js'
import {
  rolCambioConfirmMessage,
  USUARIO_DESACTIVAR_MESSAGE,
  USUARIO_REACTIVAR_MESSAGE,
  USUARIO_ROL_DEMOTE_MESSAGE,
  USUARIO_ROL_PROMOTE_MESSAGE,
  usuarioEditPanelMarkup,
  usuarioEstadoConfirmMessage,
} from '../src/components/usuario-edit-panel.js'
import { usuarioFilaAccionesMarkup } from '../src/views/administracion.js'
import { createKeyedLock, createViewLifecycle, runLockedConfirmAction } from '../src/utils/view-guard.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
let passed = 0
let failed = 0
const fetchCalls = []
let unauthorizedEvents = 0

function read(relative) {
  return readFileSync(join(root, relative), 'utf8')
}

function superadmin(id = 1) {
  return { id, nombre: 'SA', email: 'sa@example.com', rol: 'SuperAdmin' }
}

function admin(empresaId = 4, id = 2) {
  return { id, nombre: 'Admin', email: 'admin@example.com', rol: 'ADMIN', empresaId }
}

function rrhh(empresaId = 4, id = 3) {
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
    rol: 'RRHH',
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

function updatedResponse(usuario) {
  return {
    mensaje: 'Usuario actualizado correctamente.',
    usuario,
    passwordHash: 'no-debe-mapearse',
    token: 'jwt-objetivo',
  }
}

async function check(name, fn) {
  resetBrowserGlobals()
  resetSessionGuards()
  fetchCalls.length = 0
  unauthorizedEvents = 0
  window.dispatchEvent = (event) => {
    if (event?.type === 'ca:unauthorized') unauthorizedEvents += 1
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

await check('1. Botón Editar según la matriz', () => {
  const sa = superadmin()
  const operadorAdmin = admin()
  const adminA = usuarioApi({ id: 10, rol: 'ADMIN' })
  const rrhhA = usuarioApi({ id: 11, rol: 'RRHH' })
  const rrhhB = usuarioApi({ id: 12, empresaId: 8 })
  const otroSa = usuarioApi({ id: 99, rol: 'SuperAdmin' })

  assert.equal(puedeEditarUsuarioObjetivo(sa, adminA), true)
  assert.equal(puedeEditarUsuarioObjetivo(sa, rrhhA), true)
  assert.equal(puedeEditarUsuarioObjetivo(sa, otroSa), false)
  assert.equal(puedeEditarUsuarioObjetivo(sa, { ...sa, rol: 'ADMIN' }), false)
  assert.equal(puedeEditarUsuarioObjetivo(operadorAdmin, rrhhA), true)
  assert.equal(puedeEditarUsuarioObjetivo(operadorAdmin, adminA), false)
  assert.equal(puedeEditarUsuarioObjetivo(operadorAdmin, rrhhB), false)
  assert.equal(puedeEditarUsuarioObjetivo(rrhh(), rrhhA), false)

  assert.match(usuarioFilaAccionesMarkup(sa, adminA), /Editar usuario/)
  assert.equal(usuarioFilaAccionesMarkup(sa, otroSa).includes('Editar usuario'), false)
  assert.equal(usuarioFilaAccionesMarkup(operadorAdmin, adminA).includes('Editar usuario'), false)
  assert.match(usuarioFilaAccionesMarkup(operadorAdmin, rrhhA), /Editar usuario/)
  assert.equal(usuarioFilaAccionesMarkup(rrhh(), rrhhA).includes('Editar usuario'), false)
})

await check('2-3. SuperAdmin edita ADMIN/RRHH; ADMIN solo RRHH propio', () => {
  const sa = superadmin()
  const operadorAdmin = admin()
  const adminA = usuarioApi({ id: 10, rol: 'ADMIN' })
  const rrhhA = usuarioApi({ id: 11, rol: 'RRHH' })

  assert.equal(puedeCambiarRolUsuarioObjetivo(sa, adminA), true)
  assert.equal(puedeCambiarRolUsuarioObjetivo(sa, rrhhA), true)
  assert.equal(puedeCambiarEstadoUsuarioObjetivo(sa, adminA), true)
  assert.equal(puedeCambiarRolUsuarioObjetivo(operadorAdmin, rrhhA), false)
  assert.equal(puedeCambiarEstadoUsuarioObjetivo(operadorAdmin, rrhhA), true)
  assert.equal(puedeCambiarEstadoUsuarioObjetivo(operadorAdmin, adminA), false)
})

await check('4-7. Navegación: Administración y Registros por rol', () => {
  assert.equal(canAccessView(superadmin(), 'administracion'), true)
  assert.equal(canAccessView(superadmin(), 'registros'), true)
  assert.equal(canAccessView(admin(), 'administracion'), true)
  assert.equal(canAccessView(admin(), 'registros'), false)
  assert.equal(canAccessView(rrhh(), 'administracion'), false)
  assert.equal(canAccessView(rrhh(), 'registros'), false)

  assert.equal(resolveAccessibleView(admin(), 'registros'), 'dashboard')
  assert.equal(resolveAccessibleView(rrhh(), 'registros'), 'dashboard')
  assert.equal(resolveAccessibleView(rrhh(), 'administracion'), 'dashboard')
  assert.equal(resolveAccessibleView(superadmin(), 'registros'), 'registros')

  const navAdmin = getNavItemsForUser(admin()).map((item) => item.id)
  const navRrhh = getNavItemsForUser(rrhh()).map((item) => item.id)
  const navSa = getNavItemsForUser(superadmin()).map((item) => item.id)
  assert.equal(navAdmin.includes('administracion'), true)
  assert.equal(navAdmin.includes('registros'), false)
  assert.equal(navRrhh.includes('administracion'), false)
  assert.equal(navRrhh.includes('registros'), false)
  assert.equal(navSa.includes('registros'), true)

  const app = read('src/app.js')
  const resolveAt = app.indexOf('viewId = resolveAccessibleView(user, viewId)')
  const renderAt = app.indexOf('const render = views[viewId]')
  assert.equal(resolveAt > 0 && renderAt > resolveAt, true)
  assert.match(app, /registros: renderRegistros/)
})

await check('8-12. Modal: identidad editable, empresa estática y rol según operador', () => {
  const sa = superadmin()
  const operadorAdmin = admin()
  const rrhhA = usuarioApi({ nombreUsuario: 'martin.eloy', correo: 'martin@example.com', rol: 'RRHH' })
  const markupSa = usuarioEditPanelMarkup({
    usuario: rrhhA,
    operador: sa,
    empresaLabel: 'Empresa Norte',
  })
  const markupAdmin = usuarioEditPanelMarkup({
    usuario: rrhhA,
    operador: operadorAdmin,
    empresaLabel: 'Empresa Norte',
  })

  assert.match(markupSa, /name="nombreUsuario"/)
  assert.match(markupSa, /name="correo"/)
  assert.match(markupSa, /value="martin\.eloy"/)
  assert.match(markupSa, /value="martin@example\.com"/)
  assert.match(markupSa, /Empresa Norte/)
  assert.match(markupSa, /data-usuario-empresa-resumen/)
  assert.equal(/<input[^>]+name="empresaId"/.test(markupSa), false)
  assert.equal(markupSa.includes('type="text"') || markupSa.includes('name="nombreUsuario"'), true)
  assert.match(markupSa, /id="usuario-edit-rol"/)
  assert.equal(markupAdmin.includes('id="usuario-edit-rol"'), false)
  assert.equal(markupAdmin.includes('Guardar rol'), false)
  assert.match(markupAdmin, /name="nombreUsuario"/)
  assert.match(markupAdmin, /Desactivar usuario/)
})

await check('13. Confirmaciones de ascenso y descenso', () => {
  assert.equal(rolCambioConfirmMessage('RRHH', 'ADMIN'), USUARIO_ROL_PROMOTE_MESSAGE)
  assert.equal(rolCambioConfirmMessage('ADMIN', 'RRHH'), USUARIO_ROL_DEMOTE_MESSAGE)
  assert.equal(usuarioEstadoConfirmMessage(false), USUARIO_DESACTIVAR_MESSAGE)
  assert.equal(usuarioEstadoConfirmMessage(true), USUARIO_REACTIVAR_MESSAGE)
})

await check('14-16. PATCH de rol y estado con body mínimo', async () => {
  writeSession(superadmin())
  const actualizado = usuarioApi({ rol: 'ADMIN' })
  installFetch(() => jsonResponse(200, updatedResponse(actualizado)))

  const rol = await cambiarRolUsuario(11, 'ADMIN', { empresaId: 4 })
  assert.equal(String(fetchCalls[0].options.method).toUpperCase(), 'PATCH')
  assert.equal(USUARIO_API_PATHS.rol(11), '/api/usuarios/11/rol')
  assert.match(String(fetchCalls[0].url), /\/api\/usuarios\/11\/rol$/)
  assert.deepEqual(JSON.parse(fetchCalls[0].options.body), { rol: 'ADMIN' })
  assert.equal(rol.usuario.rol, 'ADMIN')
  assert.equal(rol.usuario.passwordHash, undefined)
  assert.equal(rol.token, undefined)

  installFetch(() => jsonResponse(200, updatedResponse(usuarioApi({ activo: false }))))
  const estado = await cambiarEstadoUsuario(11, false, { empresaId: 4 })
  assert.equal(String(fetchCalls[0].options.method).toUpperCase(), 'PATCH')
  assert.match(String(fetchCalls[0].url), /\/api\/usuarios\/11\/estado$/)
  assert.deepEqual(JSON.parse(fetchCalls[0].options.body), { activo: false })
  assert.equal(estado.usuario.activo, false)
  assert.equal(Object.keys(JSON.parse(fetchCalls[0].options.body)).join(','), 'activo')
})

await check('17-19. Listado conserva inactivos y el refresh usa GET', async () => {
  writeSession(superadmin())
  const inactivo = usuarioApi({ id: 12, activo: false, bloqueado: true })
  installFetch(() => jsonResponse(200, [usuarioApi(), inactivo]))
  const usuarios = await getUsuarios()
  assert.equal(usuarios.length, 2)
  assert.equal(usuarios[1].activo, false)
  assert.equal(estadoCuentaUsuario(usuarios[1]), 'Inactivo')
  assert.equal(estadoCuentaUsuario(usuarios[1]) === 'Bloqueado', false)
  assert.equal(String(fetchCalls[0].options.method ?? 'GET').toUpperCase(), 'GET')
})

await check('20-21. Inactivo no ofrece reset/unlock; bloqueado activo sí', () => {
  const sa = superadmin()
  const inactivo = usuarioApi({ activo: false, bloqueado: true })
  const bloqueado = usuarioApi({ activo: true, bloqueado: true })
  const markupInactivo = usuarioEditPanelMarkup({ usuario: inactivo, operador: sa })
  const markupBloqueado = usuarioEditPanelMarkup({ usuario: bloqueado, operador: sa })

  assert.equal(puedeRestablecerUsuarioObjetivo(sa, inactivo), false)
  assert.equal(puedeDesbloquearUsuarioObjetivo(sa, inactivo), false)
  assert.equal(markupInactivo.includes('Restablecer contraseña'), false)
  assert.equal(markupInactivo.includes('Desbloquear cuenta'), false)
  assert.match(markupInactivo, /Reactivar usuario/)
  assert.equal(puedeDesbloquearUsuarioObjetivo(sa, bloqueado), true)
  assert.match(markupBloqueado, /Desbloquear cuenta/)
  assert.match(markupBloqueado, /Restablecer contraseña/)
})

await check('22-23. No existe Eliminar ni DELETE de usuarios', () => {
  const frontend = [
    read('src/views/administracion.js'),
    read('src/api/usuarios.js'),
    read('src/components/usuario-edit-panel.js'),
  ].join('\n')
  assert.equal(frontend.includes('Eliminar usuario'), false)
  assert.equal(/method:\s*['"]DELETE['"]/.test(read('src/api/usuarios.js')), false)
  assert.equal(read('src/api/usuarios.js').includes('/cambiar-password'), false)
})

await check('24. Doble clic produce un solo PATCH', async () => {
  const lock = createKeyedLock()
  const key = lock.key('estado', 11)
  let confirmCalls = 0
  let executeCalls = 0
  writeSession(superadmin())
  let release
  const gate = new Promise((resolve) => {
    release = resolve
  })
  installFetch(async () => {
    await gate
    return jsonResponse(200, updatedResponse(usuarioApi({ activo: false })))
  })

  const run = () =>
    runLockedConfirmAction({
      lock,
      key,
      confirm: async () => {
        confirmCalls += 1
        return true
      },
      execute: () => {
        executeCalls += 1
        return cambiarEstadoUsuario(11, false)
      },
    })

  const first = run()
  const second = run()
  release()
  const [a, b] = await Promise.all([first, second])
  assert.equal(confirmCalls, 1)
  assert.equal(executeCalls, 1)
  assert.equal(fetchCalls.length, 1)
  assert.equal([a.status, b.status].includes('busy'), true)
  assert.equal([a.status, b.status].includes('ok'), true)
})

await check('25. Cancelar no escribe', async () => {
  writeSession(superadmin())
  installFetch(() => jsonResponse(200, updatedResponse(usuarioApi({ activo: false }))))
  const outcome = await runLockedConfirmAction({
    lock: createKeyedLock(),
    key: 'estado:11',
    confirm: async () => false,
    execute: () => cambiarEstadoUsuario(11, false),
  })
  assert.equal(outcome.status, 'cancelled')
  assert.equal(fetchCalls.length, 0)
})

await check('26. Unmount evita modal, toast y render tardío', async () => {
  const life = createViewLifecycle()
  const effects = { modal: 0, toast: 0, render: 0 }
  life.dispose()
  const outcome = await runLockedConfirmAction({
    lock: createKeyedLock(),
    key: 'rol:11',
    isAlive: () => life.isAlive(),
    confirm: async () => true,
    execute: async () => ({ mensaje: 'ok' }),
  })
  if (life.isAlive()) {
    effects.modal += 1
    effects.toast += 1
    effects.render += 1
  }
  assert.equal(outcome.status, 'disposed')
  assert.deepEqual(effects, { modal: 0, toast: 0, render: 0 })
})

await check('27. 401 invalida sesión', async () => {
  writeSession(superadmin())
  installFetch(() => jsonResponse(401, { mensaje: 'No autorizado' }))
  await assert.rejects(() => cambiarEstadoUsuario(11, false), (error) => {
    assert.equal(error.status, 401)
    return true
  })
  assert.equal(unauthorizedEvents, 1)
})

await check('28. 403/404 no filtran información', async () => {
  writeSession(admin())
  installFetch(() => jsonResponse(404, { mensaje: 'Usuario 11 de empresa 9 no encontrado.' }))
  await assert.rejects(() => cambiarRolUsuario(11, 'ADMIN'), (error) => {
    assert.match(error.message, /No se encontró el usuario o no tenés permiso/)
    assert.equal(error.message.includes('11'), false)
    assert.equal(error.message.includes('empresa 9'), false)
    return true
  })

  installFetch(() => jsonResponse(403, { mensaje: 'El usuario 11 es ADMIN de otra empresa' }))
  await assert.rejects(() => cambiarEstadoUsuario(11, false), (error) => {
    assert.match(error.message, /No se encontró el usuario o no tenés permiso/)
    assert.equal(error.message.includes('ADMIN'), false)
    return true
  })
})

await check('29. Cambio de rol no devuelve JWT del objetivo', async () => {
  writeSession(superadmin())
  installFetch(() => jsonResponse(200, updatedResponse(usuarioApi({ rol: 'ADMIN' }))))
  const result = await cambiarRolUsuario(11, 'ADMIN')
  assert.equal(result.usuario.token, undefined)
  assert.equal(result.token, undefined)
  assert.equal(USUARIO_API_CAPABILITIES.cambiarRol, true)
})

await check('30-31. Alta: ADMIN solo RRHH; SuperAdmin ADMIN y RRHH', async () => {
  assert.deepEqual(rolesAsignablesParaAlta(admin()), ['RRHH'])
  assert.deepEqual(rolesAsignablesParaAlta(superadmin()), ['ADMIN', 'RRHH'])
  assert.deepEqual(rolesAsignablesParaAlta(rrhh()), [])
  assert.equal(
    Boolean(validateUsuarioAlta({ rol: 'ADMIN' }, { rolesPermitidos: ['RRHH'] }).rol),
    true,
  )

  writeSession(admin())
  installFetch(() => jsonResponse(201, { token: 'nuevo' }))
  await assert.rejects(
    () =>
      createUsuario({
        nombreUsuario: 'martin.eloy',
        email: 'ana@example.com',
        password: 'secreto12',
        rol: 'ADMIN',
        empresaId: 4,
      }),
    (error) => {
      assert.equal(error.status, 400)
      assert.match(error.message, /RRHH/)
      return true
    },
  )
  assert.equal(fetchCalls.length, 0)

  writeSession(superadmin())
  installFetch(() => jsonResponse(201, { token: 'nuevo' }))
  await createUsuario({
    nombreUsuario: 'martin.eloy',
    email: 'ana@example.com',
    password: 'secreto12',
    rol: 'ADMIN',
    empresaId: 4,
  })
  assert.equal(JSON.parse(fetchCalls[0].options.body).rol, 'ADMIN')
})

await check('32-35. Regresión de reset, login, listado y módulos', async () => {
  writeSession(superadmin())
  installFetch(() =>
    jsonResponse(200, {
      mensaje: 'ok',
      passwordTemporal: 'Tmp-once-12!',
      venceEn: '2026-09-11T12:00:00Z',
    }),
  )
  const reset = await restablecerPasswordUsuario(11)
  assert.match(String(fetchCalls[0].url), /\/api\/usuarios\/11\/restablecer-password$/)
  assert.equal(reset.passwordTemporal, 'Tmp-once-12!')

  installFetch(() => jsonResponse(200, { mensaje: 'Cuenta desbloqueada.' }))
  await desbloquearUsuario(11)
  assert.match(String(fetchCalls[0].url), /\/api\/usuarios\/11\/desbloquear$/)

  assert.match(read('src/views/login.js'), /renderLogin/)
  assert.match(read('src/views/cambiar-password.js'), /cambiarPassword/)
  assert.match(read('src/views/fichadas.js'), /renderFichadas/)
  assert.match(read('src/views/empleados.js'), /renderEmpleados/)
  assert.match(read('src/api/agentes.js'), /rotarSecret/)
  assert.match(read('src/components/dropdown.js'), /enhanceSelectsIn/)
  assert.match(read('src/views/administracion.js'), /rolesPermitidos: rolesAsignablesParaAlta/)
  assert.match(read('src/views/administracion.js'), /openModal\(/)
  assert.match(read('src/components/usuario-form.js'), /rolesPermitidos/)
})

console.log(`${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
