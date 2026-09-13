import { resetBrowserGlobals } from './browser-globals.js'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  applyUsuarioEditSaves,
  USUARIO_EDIT_CONFIRM_TITLE,
  USUARIO_EDIT_FORM_HELP,
  USUARIO_EDIT_SAVE_WARNING,
  USUARIO_EDIT_SUCCESS_MESSAGE,
  USUARIO_EDIT_TITLE,
  USUARIO_EDIT_TOOLTIPS,
  usuarioEditDiff,
  usuarioEditHeaderActionsMarkup,
  usuarioEditIdentidadPayload,
  usuarioEditPanelMarkup,
  usuarioEditRolPayload,
  usuarioEditSaveFeedback,
  usuarioEditSavePlan,
  usuarioEditSubtitle,
  usuarioModificacionesConfirmMarkup,
} from '../src/components/usuario-edit-panel.js'
import { createKeyedLock, runLockedConfirmAction } from '../src/utils/view-guard.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
let passed = 0
let failed = 0

function read(relative) {
  return readFileSync(join(root, relative), 'utf8')
}

function superadmin(id = 1) {
  return { id, nombre: 'SA', email: 'sa@example.com', rol: 'SuperAdmin' }
}

function admin(empresaId = 4, id = 2) {
  return { id, nombre: 'Admin', email: 'admin@example.com', rol: 'ADMIN', empresaId }
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

async function check(name, fn) {
  resetBrowserGlobals()
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

const original = usuarioApi()

await check('ningún cambio no arma solicitudes', () => {
  const changes = usuarioEditDiff(original, {
    nombreUsuario: 'martin.eloy',
    correo: 'martin@example.com',
    rol: 'RRHH',
  })
  assert.deepEqual(changes, [])
  assert.deepEqual(usuarioEditSavePlan(changes), { identity: false, role: false })
  assert.equal(usuarioEditSubtitle(original), 'martin.eloy · martin@example.com')
  assert.equal(USUARIO_EDIT_TITLE, 'Modificación de usuario')
})

await check('cambio solo de identidad', () => {
  const changes = usuarioEditDiff(original, {
    nombreUsuario: 'martin.nuevo',
    correo: 'nuevo@example.com',
    rol: 'RRHH',
  })
  assert.equal(changes.length, 2)
  assert.equal(changes.every((change) => change.kind === 'identidad'), true)
  assert.deepEqual(usuarioEditSavePlan(changes), { identity: true, role: false })
  assert.deepEqual(usuarioEditIdentidadPayload(original, changes), {
    nombreUsuario: 'martin.nuevo',
    correo: 'nuevo@example.com',
  })
  assert.equal(usuarioEditRolPayload(changes), '')
})

await check('cambio solo de rol', () => {
  const changes = usuarioEditDiff(original, {
    nombreUsuario: 'martin.eloy',
    correo: 'martin@example.com',
    rol: 'ADMIN',
  })
  assert.equal(changes.length, 1)
  assert.equal(changes[0].key, 'rol')
  assert.equal(changes[0].currentLabel, 'Recursos Humanos')
  assert.equal(changes[0].newLabel, 'Administrador')
  assert.deepEqual(usuarioEditSavePlan(changes), { identity: false, role: true })
  assert.equal(usuarioEditRolPayload(changes), 'ADMIN')
  assert.deepEqual(usuarioEditIdentidadPayload(original, changes), {
    nombreUsuario: 'martin.eloy',
    correo: 'martin@example.com',
  })
})

await check('ambos cambios arman identidad y rol', () => {
  const changes = usuarioEditDiff(original, {
    nombreUsuario: 'martin.nuevo',
    correo: 'martin@example.com',
    rol: 'ADMIN',
  })
  assert.equal(changes.some((change) => change.key === 'nombreUsuario'), true)
  assert.equal(changes.some((change) => change.key === 'rol'), true)
  assert.equal(changes.some((change) => change.key === 'correo'), false)
  assert.deepEqual(usuarioEditSavePlan(changes), { identity: true, role: true })
})

await check('cancelación no envía solicitudes', async () => {
  let executeCalls = 0
  const outcome = await runLockedConfirmAction({
    lock: createKeyedLock(),
    key: 'guardar:11',
    confirm: async () => false,
    execute: async () => {
      executeCalls += 1
      return applyUsuarioEditSaves({
        changes: usuarioEditDiff(original, { nombreUsuario: 'otro', correo: original.correo, rol: original.rol }),
        saveIdentidad: async () => ({ ok: true }),
        saveRol: async () => ({ ok: true }),
      })
    },
  })
  assert.equal(outcome.status, 'cancelled')
  assert.equal(executeCalls, 0)
  const panel = read('src/components/usuario-edit-panel.js')
  assert.match(panel, /data-action="cancel"/)
  assert.match(panel, /if \(busy\) return/)
  assert.equal(USUARIO_EDIT_CONFIRM_TITLE, 'Confirmar modificaciones')
})

await check('doble clic produce un solo guardado', async () => {
  const lock = createKeyedLock()
  const key = lock.key('guardar', 11)
  let confirmCalls = 0
  let executeCalls = 0
  let release
  const gate = new Promise((resolve) => {
    release = resolve
  })

  const run = () =>
    runLockedConfirmAction({
      lock,
      key,
      confirm: async () => {
        confirmCalls += 1
        return true
      },
      execute: async () => {
        executeCalls += 1
        await gate
        return { status: 'ok' }
      },
    })

  const first = run()
  const second = run()
  release()
  const [a, b] = await Promise.all([first, second])
  assert.equal(confirmCalls, 1)
  assert.equal(executeCalls, 1)
  assert.equal([a.status, b.status].includes('busy'), true)
  assert.equal([a.status, b.status].includes('ok'), true)
  assert.match(read('src/views/administracion.js'), /usuarioAccionLock\.key\('guardar'/)
  assert.match(read('src/components/usuario-edit-panel.js'), /if \(busy \|\| finished\) return/)
})

await check('éxito completo llama solo lo modificado', async () => {
  const calls = []
  const changes = usuarioEditDiff(original, {
    nombreUsuario: 'martin.nuevo',
    correo: 'nuevo@example.com',
    rol: 'ADMIN',
  })
  const summary = await applyUsuarioEditSaves({
    changes,
    saveIdentidad: async () => {
      calls.push('identidad')
      return { usuario: usuarioApi({ nombreUsuario: 'martin.nuevo', correo: 'nuevo@example.com' }) }
    },
    saveRol: async () => {
      calls.push('rol')
      return { usuario: usuarioApi({ rol: 'ADMIN' }) }
    },
  })
  assert.deepEqual(calls, ['identidad', 'rol'])
  assert.equal(summary.status, 'ok')
  assert.deepEqual(summary.succeeded, ['identidad', 'rol'])
  assert.equal(usuarioEditSaveFeedback(summary).message, USUARIO_EDIT_SUCCESS_MESSAGE)

  const onlyIdentity = await applyUsuarioEditSaves({
    changes: usuarioEditDiff(original, { nombreUsuario: 'martin.nuevo', correo: original.correo, rol: original.rol }),
    saveIdentidad: async () => {
      calls.push('identidad-only')
      return { ok: true }
    },
    saveRol: async () => {
      calls.push('rol-only')
      return { ok: true }
    },
  })
  assert.equal(onlyIdentity.status, 'ok')
  assert.equal(calls.includes('rol-only'), false)
})

await check('éxito parcial no informa que todo falló', async () => {
  const calls = []
  const summary = await applyUsuarioEditSaves({
    changes: usuarioEditDiff(original, {
      nombreUsuario: 'martin.nuevo',
      correo: original.correo,
      rol: 'ADMIN',
    }),
    saveIdentidad: async () => {
      calls.push('identidad')
      return { ok: true }
    },
    saveRol: async () => {
      calls.push('rol')
      throw Object.assign(new Error('El rol no se pudo actualizar.'), { status: 500 })
    },
  })
  assert.deepEqual(calls, ['identidad', 'rol'])
  assert.equal(summary.status, 'partial')
  assert.deepEqual(summary.succeeded, ['identidad'])
  assert.equal(summary.failed[0].kind, 'rol')
  const feedback = usuarioEditSaveFeedback(summary)
  assert.match(feedback.message, /Se aplicó la modificación de los datos de acceso/)
  assert.match(feedback.message, /No se pudo aplicar la modificación del rol/)
  assert.equal(feedback.message.includes('todo falló'), false)
  assert.equal(feedback.tone, 'warning')
  assert.match(read('src/components/usuario-edit-panel.js'), /finished = true/)
  assert.match(read('src/components/usuario-edit-panel.js'), /outcome\.status === 'ok'/)
  assert.match(read('src/views/administracion.js'), /await loadUsuarios\(\)/)
})

await check('error completo conserva el detalle de cada operación', async () => {
  const summary = await applyUsuarioEditSaves({
    changes: usuarioEditDiff(original, {
      nombreUsuario: 'martin.nuevo',
      correo: original.correo,
      rol: 'ADMIN',
    }),
    saveIdentidad: async () => {
      throw Object.assign(new Error('No se actualizó el correo.'), { status: 409 })
    },
    saveRol: async () => {
      throw Object.assign(new Error('No se actualizó el rol.'), { status: 500 })
    },
  })
  assert.equal(summary.status, 'error')
  assert.deepEqual(summary.succeeded, [])
  assert.equal(summary.failed.length, 2)
  const feedback = usuarioEditSaveFeedback(summary)
  assert.equal(feedback.tone, 'error')
  assert.match(feedback.message, /No se pudo aplicar la modificación de los datos de acceso: No se actualizó el correo/)
  assert.match(feedback.message, /No se pudo aplicar la modificación del rol: No se actualizó el rol/)
  assert.equal(feedback.message.includes('Usuario actualizado correctamente'), false)
})

await check('acciones superiores según estado y permisos', () => {
  const sa = superadmin()
  const operadorAdmin = admin()
  const activo = usuarioEditHeaderActionsMarkup({
    usuario: usuarioApi({ bloqueado: true }),
    operador: sa,
  })
  const inactivo = usuarioEditHeaderActionsMarkup({
    usuario: usuarioApi({ activo: false, bloqueado: true }),
    operador: sa,
  })
  const sinBloqueo = usuarioEditHeaderActionsMarkup({
    usuario: usuarioApi(),
    operador: sa,
  })
  const adminSobreRrhh = usuarioEditHeaderActionsMarkup({
    usuario: usuarioApi({ bloqueado: true }),
    operador: operadorAdmin,
  })
  const adminSobreAdmin = usuarioEditHeaderActionsMarkup({
    usuario: usuarioApi({ id: 10, rol: 'ADMIN', bloqueado: true }),
    operador: operadorAdmin,
  })

  assert.match(activo, /Restablecer clave/)
  assert.match(activo, /Desactivar cuenta/)
  assert.match(activo, /Desbloquear/)
  assert.match(activo, /bg-red-600/)
  assert.equal(activo.includes('border-red-200 bg-red-50'), false)
  assert.match(inactivo, /Reactivar cuenta/)
  assert.equal(inactivo.includes('Restablecer clave'), false)
  assert.equal(inactivo.includes('Desbloquear'), false)
  assert.equal(inactivo.includes('Desactivar cuenta'), false)
  assert.match(inactivo, /text-emerald-800/)
  assert.equal(sinBloqueo.includes('Desbloquear'), false)
  assert.match(sinBloqueo, /Restablecer clave/)
  assert.match(adminSobreRrhh, /Desactivar cuenta/)
  assert.equal(adminSobreAdmin.includes('Restablecer clave'), false)
  assert.equal(adminSobreAdmin.includes('Desactivar cuenta'), false)

  assert.equal(USUARIO_EDIT_TOOLTIPS.restablecer, 'Genera una clave temporal de un solo uso e invalida las sesiones actuales del usuario.')
  assert.equal(
    USUARIO_EDIT_TOOLTIPS.desactivar,
    'Impide el acceso, revoca las sesiones actuales y conserva los datos y registros históricos.',
  )
  assert.equal(USUARIO_EDIT_TOOLTIPS.desbloquear, 'Elimina el bloqueo temporal y restablece los intentos fallidos.')
  assert.match(activo, /data-tooltip="/)
  assert.match(activo, /tabindex="0"/)
  assert.match(read('src/components/usuario-edit-panel.js'), /bindTooltipRoot/)
  assert.match(read('src/components/tooltip.js'), /focusin/)
  assert.match(read('src/components/tooltip.js'), /pointerenter/)
  assert.match(read('src/components/tooltip.js'), /role', 'tooltip/)
})

await check('la confirmación muestra solo campos modificados y el aviso de sesiones', () => {
  const changes = usuarioEditDiff(original, {
    nombreUsuario: 'martin.nuevo',
    correo: original.correo,
    rol: original.rol,
  })
  const markup = usuarioModificacionesConfirmMarkup({ changes })
  assert.match(markup, /DATO/)
  assert.match(markup, /ANTES/)
  assert.match(markup, /DESPUES/)
  assert.match(markup, /Nombre de usuario/)
  assert.match(markup, /martin\.eloy/)
  assert.match(markup, /martin\.nuevo/)
  assert.equal(markup.includes('Correo electrónico'), false)
  assert.equal(markup.includes('Rol'), false)
  assert.match(markup, new RegExp(USUARIO_EDIT_SAVE_WARNING.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  assert.match(markup, /Cancelar/)
  assert.match(markup, /Confirmar cambios/)
  assert.match(markup, /Guardando cambios/)
  assert.equal(USUARIO_EDIT_SAVE_WARNING, 'Estos cambios invalidarán las sesiones activas del usuario. Deberá volver a iniciar sesión.')

  const panelMarkup = usuarioEditPanelMarkup({ usuario: original, operador: superadmin() })
  assert.match(panelMarkup, /Datos de acceso y permisos/)
  assert.equal(panelMarkup.includes('Guardar información'), false)
  assert.equal(panelMarkup.includes('Guardar rol'), false)
  assert.match(read('src/views/administracion.js'), /title: USUARIO_EDIT_TITLE/)
  assert.match(read('src/components/usuario-edit-panel.js'), /closeOnEscape: \(\) => !busy/)
  assert.match(read('src/components/usuario-edit-panel.js'), /canClose: \(\) => !busy/)
  assert.match(read('src/components/modal.js'), /canClose/)
})

await check('el resumen unifica acceso y el rol queda en una fila con Guardar cambios', () => {
  const markup = usuarioEditPanelMarkup({ usuario: original, operador: superadmin(), empresaLabel: 'devs' })
  assert.match(markup, />Empresa</)
  assert.match(markup, />Rol</)
  assert.match(markup, />Estado</)
  assert.match(markup, />Acceso</)
  assert.match(markup, /devs/)
  assert.match(markup, /Recursos Humanos/)
  assert.match(markup, /lg:whitespace-nowrap/)
  assert.match(markup, /Cuenta activa/)
  assert.match(markup, /bg-emerald-500/)
  assert.match(markup, /Normal/)
  assert.equal(markup.includes('Sin bloqueo'), false)
  assert.equal(markup.includes('>Contraseña<'), false)
  assert.equal(markup.includes('>Bloqueo<'), false)
  assert.match(markup, /min-\[28rem\]:grid-cols-2 lg:grid-cols-\[minmax\(0,1fr\)_minmax\(0,1.5fr\)_minmax\(0,1.2fr\)_minmax\(0,1.6fr\)\]/)
  assert.match(markup, /sm:flex-row sm:items-end/)
  assert.match(markup, /id="usuario-edit-rol"/)
  assert.match(markup, /data-action="guardar-cambios"[^>]*disabled/)
  assert.match(markup, /text-white/)
  assert.match(markup, /disabled:text-white/)
  assert.equal(USUARIO_EDIT_FORM_HELP, 'Modificá la identificación, el correo o el rol.')
  assert.match(markup, /Modificá la identificación, el correo o el rol\./)
  assert.match(markup, /Se utiliza para iniciar sesión\./)
  assert.equal(markup.includes('Identificador visible de la cuenta'), false)
  assert.equal(markup.includes('Si lo modificás, el usuario deberá ingresar con el nuevo correo'), false)
  assert.equal(markup.includes('Actualizá el identificador'), false)

  const bloqueado = usuarioEditPanelMarkup({
    usuario: usuarioApi({ activo: false, bloqueado: true, requiereCambioPassword: true }),
    operador: superadmin(),
  })
  assert.match(bloqueado, /Cuenta inactiva/)
  assert.match(bloqueado, /bg-red-500/)
  assert.match(bloqueado, /Cambio requerido · Bloqueado/)
})

console.log(`${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
