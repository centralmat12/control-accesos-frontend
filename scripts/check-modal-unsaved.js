import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  DISCARD_UNSAVED_CONTINUE,
  DISCARD_UNSAVED_DISCARD,
  DISCARD_UNSAVED_MESSAGE,
  DISCARD_UNSAVED_TITLE,
  shouldAskUnsavedClose,
} from '../src/components/modal.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
let passed = 0
let failed = 0

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

function read(relative) {
  return readFileSync(join(root, relative), 'utf8')
}

check('Sin cambios no pide confirmación', () => {
  assert.equal(shouldAskUnsavedClose({ force: false, unsavedChanges: true, dirty: false }), false)
})

check('Con cambios pide confirmación', () => {
  assert.equal(shouldAskUnsavedClose({ force: false, unsavedChanges: true, dirty: true }), true)
})

check('Un envío exitoso cierra sin preguntar', () => {
  assert.equal(shouldAskUnsavedClose({ force: true, unsavedChanges: true, dirty: true }), false)
})

check('Modales informativos no usan la guarda de cambios', () => {
  assert.equal(shouldAskUnsavedClose({ force: false, unsavedChanges: false, dirty: true }), false)
})

check('Textos de confirmación', () => {
  assert.equal(DISCARD_UNSAVED_TITLE, '¿Descartar los cambios?')
  assert.equal(DISCARD_UNSAVED_MESSAGE, 'Los datos ingresados todavía no fueron guardados.')
  assert.equal(DISCARD_UNSAVED_CONTINUE, 'Seguir editando')
  assert.equal(DISCARD_UNSAVED_DISCARD, 'Descartar cambios')
})

check('El modal reutilizable evita el cierre por backdrop en formularios', () => {
  const modalSrc = read('src/components/modal.js')
  assert.match(modalSrc, /closeOnBackdrop/)
  assert.match(modalSrc, /unsavedChanges/)
  assert.match(modalSrc, /export function openFormModal/)
  assert.equal(modalSrc.includes('window.confirm'), false)
  assert.match(modalSrc, /confirming/)
})

check('Formularios de administración usan openFormModal y force al guardar', () => {
  const src = read('src/views/administracion.js')
  assert.match(src, /openFormModal/)
  assert.equal((src.match(/openFormModal\(/g) || []).length, 6)
  assert.match(src, /closeActiveModal\(\{ force: true \}\)/)
  assert.match(src, /title: 'Contraseña temporal'/)
  assert.match(src, /openModal\(/)
})

check('Alta de empleado usa openFormModal; detalle y baja no se tratan como el mismo caso', () => {
  const src = read('src/views/empleados.js')
  assert.match(src, /openFormModal\(/)
  assert.match(src, /unsavedChanges: true/)
  assert.match(src, /closeOnBackdrop: \(\) => !modal\.dialog\.querySelector\('form'\)/)
  assert.match(src, /title: 'Desactivar empleado'/)
})

check('No se limpian contraseñas al pedir cancelar', () => {
  const src = read('src/components/usuario-form.js')
  assert.match(src, /cancelButton\.addEventListener\('click', \(\) => \{\s*onCancel\(\)/)
  assert.match(src, /clearPasswords\(\)/)
})

console.log(`${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
