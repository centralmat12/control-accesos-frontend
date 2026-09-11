import { resetBrowserGlobals } from './browser-globals.js'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  actualizarIdentidadUsuario,
  USUARIO_API_PATHS,
  USUARIO_CORREO_DUPLICADO,
  USUARIO_IDENTIDAD_CORREO_CONFIRM,
  validateUsuarioAlta,
  validateUsuarioEmail,
  validateUsuarioIdentidad,
  validateUsuarioNombre,
} from '../src/api/usuarios.js'
import { resetSessionGuards } from '../src/api/auth.js'
import {
  puedeActualizarIdentidadUsuarioObjetivo,
  puedeCambiarRolUsuarioObjetivo,
  puedeEditarUsuarioObjetivo,
} from '../src/config/administracion.js'
import { usuarioEditPanelMarkup } from '../src/components/usuario-edit-panel.js'
import { createKeyedLock, createViewLifecycle, runLockedConfirmAction } from '../src/utils/view-guard.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
let passed = 0
let failed = 0
const fetchCalls = []

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
    mensaje: 'Datos del usuario actualizados correctamente.',
    usuario,
    passwordHash: 'no-debe-mapearse',
    token: 'jwt-objetivo',
  }
}

function sectionOrder(markup) {
  return ['resumen', 'acceso', 'rol', 'seguridad', 'estado']
    .map((name) => markup.indexOf(`data-section="${name}"`))
    .filter((index) => index >= 0)
}

async function check(name, fn) {
  resetBrowserGlobals()
  resetSessionGuards()
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

await check('1-2. Campos nombre y correo editables; empresa estática', () => {
  const markup = usuarioEditPanelMarkup({
    usuario: usuarioApi(),
    operador: superadmin(),
    empresaLabel: 'Empresa Norte',
  })
  assert.match(markup, /<input[^>]+name="nombreUsuario"/)
  assert.match(markup, /<input[^>]+name="correo"/)
  assert.match(markup, /data-usuario-empresa-resumen/)
  assert.match(markup, /Empresa Norte/)
  assert.equal(/<input[^>]+name="empresaId"/.test(markup), false)
  assert.equal(/<select[^>]+name="empresaId"/.test(markup), false)
  assert.equal(markup.includes('formStaticFieldMarkup'), false)
})

await check('3-5. Validación compartida con el alta y mensajes específicos', () => {
  const alta = validateUsuarioAlta({
    nombreUsuario: 'martin!!!',
    email: 'no-es-correo',
    password: 'secreto12',
    empresaId: 4,
    rol: 'RRHH',
  })
  const identidad = validateUsuarioIdentidad({
    nombreUsuario: 'martin!!!',
    correo: 'no-es-correo',
  })
  assert.equal(identidad.nombreUsuario, validateUsuarioNombre('martin!!!'))
  assert.equal(identidad.correo, validateUsuarioEmail('no-es-correo'))
  assert.equal(identidad.nombreUsuario, alta.nombreUsuario)
  assert.equal(identidad.correo, alta.email)
  assert.match(validateUsuarioNombre('martin!!!'), /Solo se permiten letras, números, punto/)
  assert.equal(validateUsuarioNombre('martin.eloy'), '')
  assert.equal(validateUsuarioNombre('martin_eloy'), '')
  assert.equal(validateUsuarioNombre('martin-'), 'El nombre de usuario debe terminar con una letra o un número.')
  assert.equal(validateUsuarioNombre(' martin.eloy'), 'El nombre de usuario no puede contener espacios.')
  assert.equal(validateUsuarioNombre('martin.eloy '), 'El nombre de usuario no puede contener espacios.')
  assert.equal(validateUsuarioEmail(''), 'Ingresá el correo electrónico.')
  assert.equal(validateUsuarioEmail('martin'), 'Ingresá un correo electrónico válido.')
})

await check('6. Correo duplicado usa el mensaje de conflicto', async () => {
  writeSession(superadmin())
  installFetch(() => jsonResponse(409, { mensaje: USUARIO_CORREO_DUPLICADO }))
  await assert.rejects(
    () => actualizarIdentidadUsuario(11, { nombreUsuario: 'martin.eloy', correo: 'otro@example.com' }),
    (error) => {
      assert.equal(error.status, 409)
      assert.equal(error.message, 'Ese correo ya está registrado.')
      return true
    },
  )
})

await check('7-8. Guardar información nace deshabilitado y el panel exige cambios sin error', () => {
  const markup = usuarioEditPanelMarkup({
    usuario: usuarioApi(),
    operador: superadmin(),
  })
  assert.match(markup, /data-action="guardar-identidad"[^>]*disabled/)
  const panel = read('src/components/usuario-edit-panel.js')
  assert.match(panel, /identidadBusy \|\| !identidadChanged\(\) \|\| hasIdentidadErrors\(\)/)
  assert.match(panel, /validateUsuarioIdentidad/)
})

await check('9-11. PATCH identidad con body mínimo y un solo envío', async () => {
  writeSession(superadmin())
  const actualizado = usuarioApi({ nombreUsuario: 'martin.nuevo', correo: 'nuevo@example.com' })
  installFetch(() => jsonResponse(200, updatedResponse(actualizado)))

  const result = await actualizarIdentidadUsuario(
    11,
    { nombreUsuario: 'martin.nuevo', correo: 'nuevo@example.com' },
    { empresaId: 4 },
  )
  assert.equal(String(fetchCalls[0].options.method).toUpperCase(), 'PATCH')
  assert.equal(USUARIO_API_PATHS.identidad(11), '/api/usuarios/11/identidad')
  assert.match(String(fetchCalls[0].url), /\/api\/usuarios\/11\/identidad$/)
  assert.deepEqual(JSON.parse(fetchCalls[0].options.body), {
    nombreUsuario: 'martin.nuevo',
    correo: 'nuevo@example.com',
  })
  assert.equal(Object.keys(JSON.parse(fetchCalls[0].options.body)).join(','), 'nombreUsuario,correo')
  assert.equal(result.usuario.nombreUsuario, 'martin.nuevo')
  assert.equal(result.usuario.passwordHash, undefined)
  assert.equal(result.token, undefined)

  const lock = createKeyedLock()
  const key = lock.key('identidad', 11)
  let confirmCalls = 0
  let executeCalls = 0
  let release
  const gate = new Promise((resolve) => {
    release = resolve
  })
  installFetch(async () => {
    await gate
    return jsonResponse(200, updatedResponse(actualizado))
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
        return actualizarIdentidadUsuario(11, { nombreUsuario: 'martin.nuevo', correo: 'nuevo@example.com' })
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

await check('12. Cancelar la confirmación no escribe', async () => {
  writeSession(superadmin())
  installFetch(() => jsonResponse(200, updatedResponse(usuarioApi())))
  const outcome = await runLockedConfirmAction({
    lock: createKeyedLock(),
    key: 'identidad:11',
    confirm: async () => false,
    execute: () => actualizarIdentidadUsuario(11, { nombreUsuario: 'otro.nombre', correo: 'otro@example.com' }),
  })
  assert.equal(outcome.status, 'cancelled')
  assert.equal(fetchCalls.length, 0)
  assert.equal(
    USUARIO_IDENTIDAD_CORREO_CONFIRM,
    'El usuario deberá iniciar sesión con el nuevo correo. Sus sesiones actuales quedarán invalidadas.',
  )
})

await check('13-14. Refresh desde GET y unmount evita efectos tardíos', async () => {
  const adminSrc = read('src/views/administracion.js')
  assert.match(adminSrc, /actualizarIdentidadUsuario/)
  assert.match(adminSrc, /await loadUsuarios\(\)/)
  assert.match(adminSrc, /getUsuarios\(/)
  assert.match(adminSrc, /if \(outcome\.status !== 'ok' \|\| !isViewAlive\(\)\) return outcome/)
  assert.match(adminSrc, /usuarioAccionLock\.key\('identidad'/)

  const life = createViewLifecycle()
  const effects = { modal: 0, toast: 0, render: 0 }
  life.dispose()
  const outcome = await runLockedConfirmAction({
    lock: createKeyedLock(),
    key: 'identidad:11',
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

await check('15-18. Matriz de identidad y rol editable solo para SuperAdmin', () => {
  const sa = superadmin()
  const operadorAdmin = admin()
  const adminA = usuarioApi({ id: 10, rol: 'ADMIN' })
  const rrhhA = usuarioApi({ id: 11, rol: 'RRHH' })
  const rrhhB = usuarioApi({ id: 12, empresaId: 8 })
  const otroSa = usuarioApi({ id: 99, rol: 'SuperAdmin' })

  assert.equal(puedeActualizarIdentidadUsuarioObjetivo(sa, adminA), true)
  assert.equal(puedeActualizarIdentidadUsuarioObjetivo(sa, rrhhA), true)
  assert.equal(puedeActualizarIdentidadUsuarioObjetivo(sa, otroSa), false)
  assert.equal(puedeActualizarIdentidadUsuarioObjetivo(sa, { ...sa, rol: 'ADMIN' }), false)
  assert.equal(puedeActualizarIdentidadUsuarioObjetivo(operadorAdmin, rrhhA), true)
  assert.equal(puedeActualizarIdentidadUsuarioObjetivo(operadorAdmin, adminA), false)
  assert.equal(puedeActualizarIdentidadUsuarioObjetivo(operadorAdmin, rrhhB), false)
  assert.equal(puedeActualizarIdentidadUsuarioObjetivo(rrhh(), rrhhA), false)
  assert.equal(puedeEditarUsuarioObjetivo(rrhh(), rrhhA), false)

  const markupSa = usuarioEditPanelMarkup({ usuario: rrhhA, operador: sa })
  const markupAdmin = usuarioEditPanelMarkup({ usuario: rrhhA, operador: operadorAdmin })
  assert.equal(puedeCambiarRolUsuarioObjetivo(sa, rrhhA), true)
  assert.equal(puedeCambiarRolUsuarioObjetivo(operadorAdmin, rrhhA), false)
  assert.match(markupSa, /id="usuario-edit-rol"/)
  assert.equal(markupAdmin.includes('id="usuario-edit-rol"'), false)
  assert.equal(markupAdmin.includes('Guardar rol'), false)
  assert.match(markupAdmin, /name="nombreUsuario"/)
})

await check('19-21. Seguridad alineada, zona sensible al final y sin Eliminar', () => {
  const sa = superadmin()
  const activo = usuarioEditPanelMarkup({
    usuario: usuarioApi({ bloqueado: true }),
    operador: sa,
  })
  const inactivo = usuarioEditPanelMarkup({
    usuario: usuarioApi({ activo: false, bloqueado: true }),
    operador: sa,
  })

  assert.match(activo, /btn-secondary/)
  assert.match(activo, /sm:flex-row sm:items-center sm:justify-between/)
  assert.match(activo, /w-full sm:w-auto/)
  assert.match(activo, /Restablecer contraseña/)
  assert.match(activo, /Desbloquear cuenta/)
  assert.equal(inactivo.includes('Restablecer contraseña'), false)
  assert.equal(inactivo.includes('Desbloquear cuenta'), false)
  assert.match(inactivo, /Reactivar cuenta/)
  assert.match(activo, /Desactivar cuenta/)
  assert.match(activo, /Desactivar usuario/)
  assert.equal(activo.includes('Eliminar usuario'), false)
  assert.equal(inactivo.includes('Eliminar usuario'), false)

  const orderActivo = sectionOrder(activo)
  assert.equal(orderActivo.length >= 4, true)
  assert.deepEqual(
    orderActivo,
    [...orderActivo].sort((a, b) => a - b),
  )
  assert.ok(activo.indexOf('data-section="estado"') > activo.indexOf('data-section="seguridad"'))
  assert.ok(activo.indexOf('data-section="seguridad"') > activo.indexOf('data-section="rol"'))
  assert.ok(activo.indexOf('data-section="rol"') > activo.indexOf('data-section="acceso"'))
  assert.ok(activo.indexOf('data-section="acceso"') > activo.indexOf('data-section="resumen"'))
})

await check('22. No existe DELETE ni cambio directo de contraseña', () => {
  const usuariosSrc = read('src/api/usuarios.js')
  const panelSrc = read('src/components/usuario-edit-panel.js')
  const viewSrc = read('src/views/administracion.js')
  assert.equal(/method:\s*['"]DELETE['"]/.test(usuariosSrc), false)
  assert.equal(usuariosSrc.includes('/cambiar-password'), false)
  assert.equal(panelSrc.includes('Eliminar usuario'), false)
  assert.equal(viewSrc.includes('Eliminar usuario'), false)
  assert.match(usuariosSrc, /export async function actualizarIdentidadUsuario/)
  assert.equal(usuariosSrc.includes('function actualizarUsuario('), false)
})

await check('23-24. Tema y layout responsive verificables por clases', () => {
  const markup = usuarioEditPanelMarkup({
    usuario: usuarioApi({ bloqueado: true }),
    operador: superadmin(),
  })
  const modalSrc = read('src/components/modal.js')
  const viewSrc = read('src/views/administracion.js')
  const css = read('src/style.css')
  assert.match(markup, /dark:border-slate-700/)
  assert.match(markup, /dark:bg-slate-800/)
  assert.match(markup, /dark:text-slate-100/)
  assert.match(css, /\.btn-secondary/)
  assert.match(css, /html\.dark \.btn-secondary/)
  assert.match(modalSrc, /dialogClass/)
  assert.match(modalSrc, /dark:border-slate-700 dark:bg-slate-900/)
  assert.match(viewSrc, /dialogClass: 'max-w-2xl'/)
  assert.match(markup, /sm:grid-cols-2 lg:grid-cols-5/)
  assert.match(markup, /w-full sm:w-auto/)
})

await check('25-26. Regresión de rol, estado, reset, unlock, alta y superficies vecinas', () => {
  const viewSrc = read('src/views/administracion.js')
  const usuariosSrc = read('src/api/usuarios.js')
  assert.match(viewSrc, /cambiarRolUsuario/)
  assert.match(viewSrc, /cambiarEstadoUsuario/)
  assert.match(viewSrc, /restablecerPasswordUsuario/)
  assert.match(viewSrc, /desbloquearUsuario/)
  assert.match(viewSrc, /createUsuario/)
  assert.match(usuariosSrc, /USUARIO_API_PATHS\.rol/)
  assert.match(usuariosSrc, /USUARIO_API_PATHS\.estado/)
  assert.match(read('src/views/fichadas.js'), /export async function renderFichadas/)
  assert.match(read('src/views/empleados.js'), /export async function renderEmpleados/)
  assert.match(read('src/api/agentes.js'), /export async function getAgentes/)
  assert.match(read('src/components/dropdown.js'), /export function enhanceSelectsIn/)
  assert.match(read('src/config/navigation.js'), /administracion/)
})

await check('Cliente de identidad no acepta un body inválido localmente', async () => {
  writeSession(superadmin())
  installFetch(() => jsonResponse(200, updatedResponse(usuarioApi())))
  await assert.rejects(
    () => actualizarIdentidadUsuario(11, { nombreUsuario: 'martin!!!', correo: 'martin@example.com' }),
    (error) => error.status === 400,
  )
  assert.equal(fetchCalls.length, 0)
})

await check('401 de identidad invalida por apiFetch', async () => {
  writeSession(superadmin())
  installFetch(() => jsonResponse(401, { mensaje: 'No autorizado' }))
  await assert.rejects(() => actualizarIdentidadUsuario(11, { nombreUsuario: 'martin.eloy', correo: 'martin@example.com' }))
})

await check('Las pruebas no llaman hosts reales', async () => {
  writeSession(superadmin())
  installFetch(() => jsonResponse(200, updatedResponse(usuarioApi())))
  await actualizarIdentidadUsuario(11, { nombreUsuario: 'martin.eloy', correo: 'martin@example.com' })
  assert.equal(fetchCalls.length, 1)
  assert.equal(String(fetchCalls[0].url).startsWith('http://'), false)
  assert.equal(String(fetchCalls[0].url).startsWith('https://'), false)
  assert.match(String(fetchCalls[0].url), /\/api\/usuarios\/11\/identidad$/)
})

console.log(`${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
