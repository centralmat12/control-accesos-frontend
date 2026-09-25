import { resetBrowserGlobals } from './browser-globals.js'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  deleteDepartamento,
  updateDepartamento,
  validateDepartamentoNombre,
} from '../src/api/departamentos.js'
import {
  mensajeConfirmacionEliminar,
  mensajeRechazoEliminacion,
  MENSAJE_ELIMINACION_ASIGNADOS,
  MENSAJE_ELIMINACION_TITULO,
} from '../src/components/departamentos-admin.js'
import { MENSAJE_ELIMINACION_GENERICO } from '../src/api/departamentos.js'
import { puedeMostrarAltaDepartamento } from '../src/config/administracion.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
let passed = 0
let failed = 0

function read(relative) {
  return readFileSync(join(root, relative), 'utf8')
}

function check(name, fn) {
  resetBrowserGlobals()
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

function user(rol, empresaId = 9) {
  return { nombre: rol, email: `${rol}@example.com`, rol, empresaId }
}

function writeSession(current) {
  sessionStorage.setItem('ca.auth.user', JSON.stringify(current))
  sessionStorage.setItem('ca.auth.token', 'session-jwt')
}

function jsonResponse(status, payload) {
  const body = payload == null ? '' : JSON.stringify(payload)
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

check('el botón Administrar no muestra una leyenda persistente', () => {
  const form = read('src/components/empleado-form.js')
  assert.match(form, /Agregar, editar o eliminar departamentos/)
  assert.equal(/id="empleado-admin-departamentos"[\s\S]{0,400}data-tooltip/.test(form), false)
  const modal = read('src/components/modal.js')
  assert.match(modal, /hideTooltip\(\)/)
  assert.equal(puedeMostrarAltaDepartamento(user('SuperAdmin')), true)
  assert.equal(puedeMostrarAltaDepartamento(user('ADMIN')), true)
  assert.match(form, /id="empleado-admin-departamentos"/)
  assert.match(form, />Administrar</)
  assert.match(form, /iconSettings/)
  assert.match(form, /BTN_SECONDARY_CLASS/)
  assert.equal(form.includes('id="empleado-add-departamento"'), false)
  assert.equal(form.includes('iconPlus'), false)
})

check('el botón queda oculto para RRHH', () => {
  assert.equal(puedeMostrarAltaDepartamento(user('RRHH')), false)
  const form = read('src/components/empleado-form.js')
  assert.match(form, /showAddDepartamento[\s\S]*empleado-admin-departamentos/)
})

check('el selector y el botón comparten la fila y el modal concentra el alta', () => {
  const form = read('src/components/empleado-form.js')
  const admin = read('src/components/departamentos-admin.js')
  assert.match(form, /sm:col-span-2/)
  assert.match(form, /flex-col gap-2 sm:flex-row/)
  assert.match(form, /w-full flex-1/)
  assert.match(form, /sm:w-auto/)
  assert.match(form, /scrollBody: false/)
  assert.equal(form.includes('headerActions'), false)
  assert.match(admin, /Agregar departamento/)
  assert.match(admin, /grid-cols-\[minmax\(0,320px\)_max-content\]/)
  assert.match(admin, /items-end/)
  assert.match(admin, /self-end/)
  assert.match(admin, /w-auto/)
  assert.equal(admin.includes('sm:w-[20rem]'), false)
  assert.equal(admin.includes('margin-top'), false)
  assert.match(admin, /La sucursal no se modifica/)
  assert.equal(admin.includes('headerActions'), false)
  assert.equal(admin.includes('Empleados asignados'), false)
  assert.match(admin, /createDepartamento\(/)
  assert.match(admin, /openFormModal/)
  assert.match(admin, /flex-nowrap items-center gap-2/)
  assert.match(admin, /grid-cols-\[minmax\(0,320px\)_max-content\]/)
  assert.match(admin, /data-departamento-id="\$\{item\.id\}"/)
  assert.equal(admin.includes('ADMIN_TABLE_ROW_CLASS(item.id)'), false)
  assert.match(read('src/api/departamentos.js'), /MENSAJE_DEPARTAMENTOS_403/)
  assert.match(read('src/api/departamentos.js'), /inflightDepartamentos/)
  assert.match(admin, /console\.error\(error\)/)
  assert.match(admin, /minmax\(220px,1fr\)_180px_auto/)
  assert.match(admin, /items-end/)
  assert.match(read('src/components/admin-panel-layout.js'), /self-end/)
  assert.match(admin, /overflow-x-hidden/)
  assert.match(read('src/components/admin-panel-layout.js'), /sticky top-0/)
  assert.match(admin, /max-w-\[880px\]/)
  assert.match(admin, /sm:h-\[50px\]/)
  assert.match(read('src/views/administracion.js'), /max-w-\[1080px\]/)
  assert.match(read('src/views/administracion.js'), /minmax\(320px,1fr\)_auto/)
  assert.match(read('src/components/admin-panel-layout.js'), /ADMIN_CARD_CLASS/)
  assert.equal(admin.includes('>Asignados<'), false)
  assert.equal(admin.includes('Asignados:'), false)
  assert.equal(admin.includes('>Empleados<'), false)
  assert.equal(admin.includes('Sin empleados'), false)
  assert.match(admin, /cantidadEmpleados/)
  assert.equal(admin.includes('badgeHtml'), false)
  assert.equal(/departamentoSelect[\s\S]{0,200}Eliminar/.test(form), false)
})

check('la confirmación no afirma que el departamento esté vacío y el 409 no lo borra', () => {
  const message = mensajeConfirmacionEliminar('Marketing', 'Sede Central', null)
  assert.match(message, /¿Querés eliminar “Marketing” de “Sede Central”\?/)
  assert.match(message, /Esta acción no se puede deshacer/)
  assert.equal(message.includes('no tiene empleados'), false)
  assert.equal(mensajeRechazoEliminacion(''), MENSAJE_ELIMINACION_ASIGNADOS)
  assert.equal(mensajeRechazoEliminacion('Bad Request'), MENSAJE_ELIMINACION_ASIGNADOS)
  assert.equal(
    mensajeRechazoEliminacion('No se puede eliminar el departamento porque tiene empleados asignados. Reasigná esos empleados antes de eliminarlo.'),
    MENSAJE_ELIMINACION_ASIGNADOS,
  )
  assert.equal(MENSAJE_ELIMINACION_TITULO, 'No se puede eliminar el departamento')
  const admin = read('src/components/departamentos-admin.js')
  assert.match(admin, /Eliminando\.\.\./)
  assert.match(admin, /dataset\.deleting === 'true'/)
  assert.match(admin, /closeNotice\(\{ force: true \}\)/)
  assert.match(admin, /Entendido/)
  assert.match(admin, /dataset\.errorScope = 'delete'/)
  assert.match(admin, /errorEl\.textContent = ''/)
  assert.equal(admin.includes('statusText'), false)
  const deleteFlow = admin.slice(admin.indexOf('function requestDelete'))
  assert.equal(deleteFlow.includes('departamento-edit-error'), false)
  assert.equal(/status === 409[\s\S]*await load\(/.test(deleteFlow), true)
  assert.match(admin, /cantidadEmpleados > 0/)
  assert.equal(admin.includes('Sin empleados'), false)
  assert.match(admin, /await load\(\)/)
  const deleteCalls = admin.match(/await deleteDepartamento/g) ?? []
  assert.equal(deleteCalls.length, 1)
})

check('la edición conserva la selección y el alta de la misma sucursal la selecciona', () => {
  const form = read('src/components/empleado-form.js')
  assert.match(form, /event\.type === 'delete'/)
  assert.match(form, /event\.type === 'create'/)
  assert.match(form, /preserveDepartamentoId: selected/)
  assert.equal(form.includes('sameSucursal'), false)
  const admin = read('src/components/departamentos-admin.js')
  assert.match(admin, /errorEl\.classList\.remove\('hidden'\)/)
  assert.match(admin, /closeEdit\?\.\(\{ force: true \}\)/)
})

check('valida el nombre, evita el doble envío y no cierra ante un error', () => {
  assert.equal(validateDepartamentoNombre('  '), 'Ingresá el nombre del departamento.')
  assert.equal(validateDepartamentoNombre(` ${'a'.repeat(101)} `).includes('100'), true)
  assert.equal(validateDepartamentoNombre(' Sistemas '), '')
  const admin = read('src/components/departamentos-admin.js')
  assert.match(admin, /dataset\.submitting === 'true'/)
  assert.match(admin, /dataset\.deleting === 'true'/)
  assert.match(admin, /role="alert"/)
  assert.match(admin, /role="status"/)
  assert.match(admin, /input\?\.focus\(\)/)
})

await checkAsync('la edición envía solo nombre y acepta 204', async () => {
  writeSession(user('ADMIN'))
  const calls = []
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), method: options.method, body: options.body })
    if (options.body?.includes('Caja')) return jsonResponse(204, null)
    return jsonResponse(400, { mensaje: 'El nombre del departamento es obligatorio.' })
  }
  const updated = await updateDepartamento({ id: 4, nombre: ' Caja ', sucursalId: 4, empresaId: 9 })
  assert.equal(updated.nombre, 'Caja')
  assert.equal(calls[0].method, 'PUT')
  assert.deepEqual(JSON.parse(calls[0].body), { nombre: 'Caja', sucursalId: 4 })
  assert.equal(JSON.parse(calls[0].body).id, undefined)
  calls.length = 0
  await assert.rejects(() => updateDepartamento({ id: 4, nombre: '   ', sucursalId: 4, empresaId: 9 }))
  await assert.rejects(() => updateDepartamento({ id: 4, nombre: 'a'.repeat(101), sucursalId: 4, empresaId: 9 }))
  assert.equal(calls.length, 0)
  globalThis.fetch = async () => jsonResponse(400, { mensaje: 'El nombre del departamento es obligatorio.' })
  await assert.rejects(() => updateDepartamento({ id: 4, nombre: 'Sistemas', sucursalId: 4, empresaId: 9 }), (error) => {
    assert.equal(error.status, 400)
    assert.match(error.message, /obligatorio/)
    assert.equal(error.message.includes('Bad Request'), false)
    return true
  })
  const admin = read('src/components/departamentos-admin.js')
  assert.match(admin, /sucursalId: item\.sucursalId/)
  assert.equal(/name="sucursalId"/.test(admin.slice(admin.indexOf('function openEdit'))), false)
})

await checkAsync('un 409 de eliminación muestra el mensaje y no repite el DELETE', async () => {
  writeSession(user('SuperAdmin'))
  const calls = []
  globalThis.fetch = async (url, options = {}) => {
    calls.push(options.method || 'GET')
    return jsonResponse(409, {
      mensaje: 'No se puede eliminar el departamento porque tiene 5 empleados asignados. Reasigná esos empleados antes de eliminarlo.',
      cantidadEmpleados: 5,
      title: 'Bad Request',
    })
  }
  const admin = read('src/components/departamentos-admin.js')
  assert.match(admin, /error\.status === 409/)
  assert.match(admin, /mensajeRechazoEliminacion\(error\.message\)/)
  assert.equal(admin.includes('Bad Request'), false)
  await assert.rejects(() => deleteDepartamento({ id: 3, empresaId: 9 }), (error) => {
    assert.equal(error.status, 409)
    assert.equal(error.message.includes('Bad Request'), false)
    assert.match(error.message, /Reasigná esos empleados/)
    return true
  })
  assert.deepEqual(calls, ['DELETE'])

  calls.length = 0
  globalThis.fetch = async (_url, options = {}) => {
    calls.push(options.method || 'GET')
    return jsonResponse(400, { title: 'Bad Request', status: 400 })
  }
  await assert.rejects(() => deleteDepartamento({ id: 3, empresaId: 9 }), (error) => {
    assert.equal(error.message, MENSAJE_ELIMINACION_GENERICO)
    assert.equal(error.message.includes('Bad Request'), false)
    return true
  })
  assert.deepEqual(calls, ['DELETE'])
})

await checkAsync('403 y 404 de eliminación usan mensajes específicos', async () => {
  writeSession(user('ADMIN'))
  globalThis.fetch = async () => jsonResponse(403, { mensaje: 'forbid' })
  await assert.rejects(() => deleteDepartamento({ id: 3, empresaId: 9 }), (error) => {
    assert.equal(error.status, 403)
    assert.equal(error.message, 'No tenés permiso para administrar departamentos.')
    return true
  })
  globalThis.fetch = async () => jsonResponse(204, null)
  await deleteDepartamento({ id: 3, empresaId: 9 })
  globalThis.fetch = async () => jsonResponse(404, {})
  await assert.rejects(() => deleteDepartamento({ id: 3, empresaId: 9 }), (error) => {
    assert.equal(error.status, 404)
    assert.equal(error.message, 'El departamento ya no existe o fue eliminado.')
    return true
  })
  const admin = read('src/components/departamentos-admin.js')
  assert.match(admin, /Departamento actualizado correctamente/)
  assert.match(admin, /Departamento eliminado correctamente/)
  assert.match(admin, /Editar departamento/)
  assert.match(admin, /Guardar nombre/)
})

check('Administración y Empleados comparten el mismo administrador', () => {
  const admin = read('src/views/administracion.js')
  const form = read('src/components/empleado-form.js')
  assert.match(admin, /createDepartamentosAdmin\(/)
  assert.match(form, /createDepartamentosAdmin\(/)
  assert.match(admin, /data-section="\$\{SECTIONS\.departamentos\}"/)
  assert.match(admin, /Gestioná los departamentos/)
  assert.match(admin, /Administrá los departamentos disponibles en cada sucursal/)
  assert.match(admin, /#\/administracion\?tab=/)
  assert.match(admin, /next === SECTIONS\.departamentos && !canViewDepartamentosSection/)
  assert.equal(puedeMostrarAltaDepartamento(user('SuperAdmin')), true)
  assert.equal(puedeMostrarAltaDepartamento(user('ADMIN')), true)
  assert.equal(puedeMostrarAltaDepartamento(user('RRHH')), false)
  assert.equal(puedeMostrarAltaDepartamento(user('RRHHADMIN')), false)
  assert.equal(puedeMostrarAltaDepartamento({ rol: 'administrador', empresaId: 9 }), false)
  assert.equal(admin.includes('>Asignados<'), false)
})

check('el selector conserva la edición y limpia la selección eliminada', () => {
  const form = read('src/components/empleado-form.js')
  assert.match(form, /event\.type === 'delete'/)
  assert.match(form, /selected === event\.departamentoId \? null : selected/)
  assert.match(form, /event\.type === 'create'/)
})

if (failed > 0) {
  console.error(`\n${failed} failed, ${passed} passed`)
  process.exit(1)
}
console.log(`\n${passed} passed`)
