import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'url'
import { validateUsuarioNombre } from '../src/api/usuarios.js'
import { INTERMEDIATE_MOVIMIENTO_TOOLTIP } from '../src/utils/movimientos.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
let passed = 0
let failed = 0

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

check('Nombre de usuario: ayuda, placeholder y patrón', () => {
  const form = read('src/components/usuario-form.js')
  const api = read('src/api/usuarios.js')
  assert.match(form, /Nombre de usuario/)
  assert.match(form, /Ej\.: martin\.eloy/)
  assert.match(form, /identificar la cuenta dentro del panel/)
  assert.match(form, /Usá entre 3 y 50 caracteres/)
  assert.match(form, /usuario-nombreUsuario-help-format/)
  assert.match(read('src/components/form-field.js'), /aria-invalid/)
  assert.match(form, /nombreUsuario: String\(form\.querySelector\('\[name="nombreUsuario"\]'\)\?\.value \?\? ''\)/)
  assert.match(api, /\^\[A-Za-z\]\[A-Za-z0-9\]\*\(\?:\[\._-\]\[A-Za-z0-9\]\+\)\*\$/)
  assert.equal(validateUsuarioNombre('martin'), '')
  assert.equal(Boolean(validateUsuarioNombre('martin!!!')), true)
})

check('Desplegables unificados: base, select y multi', () => {
  const dropdown = read('src/components/dropdown.js')
  assert.match(dropdown, /export function createDropdownBase/)
  assert.match(dropdown, /export function enhanceSelect/)
  assert.match(dropdown, /export function createMultiSelectDropdown/)
  assert.match(dropdown, /createSelectDropdown/)
  assert.match(dropdown, /positionDropdownPanel/)
  assert.match(dropdown, /claimOpenDropdown/)
  assert.match(dropdown, /aria-expanded/)
  assert.match(dropdown, /AbortController/)
  assert.match(read('src/app.js'), /enhanceSelectsIn\(main\)/)
  assert.match(read('src/components/modal.js'), /enhanceSelectsIn\(overlay\)/)
  assert.match(read('src/components/header.js'), /enhanceSelect\(/)
  assert.match(read('src/components/sucursal-multi-select.js'), /createDropdownBase/)
  assert.match(read('src/components/column-picker.js'), /createDropdownBase/)
})

check('Inputs date y time permanecen nativos', () => {
  assert.match(read('src/views/fichadas.js'), /type="date"/)
  assert.match(read('src/components/empleado-form.js'), /type="time"/)
  assert.equal(read('src/components/dropdown.js').includes('type="date"'), false)
})

check('Textos de usuario sin endpoints', () => {
  const admin = read('src/views/administracion.js')
  assert.match(admin, /Gestioná usuarios/)
  assert.match(admin, /No se pudieron cargar los usuarios/)
  assert.equal(admin.includes('GET /api/usuarios'), false)
  // Ninguna ruta de la API como literal de texto en la vista.
  assert.equal(/'\/api\//.test(admin), false)
  assert.equal(read('src/config/administracion.js').includes('Esta acción todavía no está disponible.'), true)
  assert.match(read('src/components/sucursal-departamento-selects.js'), /Seleccioná una sucursal/)
})

check('Tooltip reutilizable y texto de movimiento intermedio', () => {
  assert.match(INTERMEDIATE_MOVIMIENTO_TOOLTIP, /no modifica el ingreso ni el egreso calculados/)
  const tooltip = read('src/components/tooltip.js')
  assert.match(tooltip, /setAttribute\('role', 'tooltip'\)/)
  assert.match(tooltip, /bindTooltipRoot/)
  assert.match(tooltip, /documentBound/)
})

console.log(`${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
