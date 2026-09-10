import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  NATIVE_SELECT_HIDE_CLASS,
  addClassTokens,
  classTokenList,
} from '../src/components/dropdown-styles.js'

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

check('1. Header: enhanceSelect, ancho estable y refresh asíncrono', () => {
  const header = read('src/components/header.js')
  assert.match(header, /enhanceSelect\(select/)
  assert.match(header, /refreshEnhancedSelect\(select\)/)
  assert.match(header, /min-w-\[10rem\]/)
  assert.match(header, /Cargando empresas\.\.\./)
  assert.match(header, /Seleccioná una empresa/)
  assert.match(header, /No hay empresas disponibles/)
  assert.equal((header.match(/refreshEnhancedSelect\(select\)/g) || []).length >= 4, true)
})

check('2. Registros: select migrado por enhanceSelectsIn', () => {
  const registros = read('src/views/registros.js')
  const app = read('src/app.js')
  assert.match(registros, /<select id="registros-nivel"/)
  assert.match(app, /enhanceSelectsIn\(main\)/)
  assert.equal(registros.includes('createDropdownBase'), false)
})

check('3. Nuevo usuario abre modal después de crear el formulario', () => {
  const admin = read('src/views/administracion.js')
  const usuarioStart = admin.indexOf('function openUsuarioCreate')
  const empresaStart = admin.indexOf('function openEmpresaCreate')
  const usuarioBlock = admin.slice(usuarioStart, empresaStart)
  const empresaBlock = admin.slice(empresaStart, empresaStart + 800)
  assert.match(usuarioBlock, /createUsuarioForm\(/)
  assert.match(usuarioBlock, /openFormModal\(/)
  assert.match(usuarioBlock, /title: 'Nuevo usuario'/)
  assert.match(empresaBlock, /createEmpresaForm\(/)
  assert.match(empresaBlock, /openFormModal\(/)
})

check('4. Selects del modal de usuario se inicializan', () => {
  const form = read('src/components/usuario-form.js')
  const modal = read('src/components/modal.js')
  assert.match(form, /enhanceSelectsIn\(form\)/)
  assert.match(form, /refreshEnhancedSelect\(empresaSelect\)/)
  assert.match(form, /name: 'rol'/)
  assert.match(form, /name: 'empresaId'/)
  assert.match(modal, /enhanceSelectsIn\(overlay\)/)
  assert.match(modal, /destroyDisconnectedSelects\(\)/)
})

check('5. Cerrar modal limpia paneles portales', () => {
  const modal = read('src/components/modal.js')
  const dropdown = read('src/components/dropdown.js')
  assert.match(modal, /overlay\.remove\(\)/)
  assert.match(modal, /destroyDisconnectedSelects\(\)/)
  assert.match(dropdown, /destroyDisconnectedSelects/)
  assert.match(dropdown, /panel\.remove\(\)/)
})

check('6. Cambio de pestaña reatacha un listener al botón Nuevo usuario', () => {
  const admin = read('src/views/administracion.js')
  assert.match(admin, /function renderUsuarios/)
  assert.match(admin, /id: 'admin-usuario-new'/)
  assert.equal((admin.match(/addEventListener\('click', openUsuarioCreate\)/g) || []).length, 1)
})

check('7. Un único dropdown abierto y AbortController por instancia', () => {
  const dropdown = read('src/components/dropdown.js')
  assert.match(dropdown, /let openInstance = null/)
  assert.match(dropdown, /claimOpenDropdown/)
  assert.match(dropdown, /closeActive\(except\)/)
  assert.match(dropdown, /new AbortController/)
})

check('8. classList.add no recibe la clase nativa como un solo token con espacios', () => {
  const dropdown = read('src/components/dropdown.js')
  assert.equal(dropdown.includes('classList.add(NATIVE_SELECT_HIDE_CLASS)'), false)
  assert.equal(dropdown.includes('classList.remove(NATIVE_SELECT_HIDE_CLASS)'), false)
  assert.match(dropdown, /addClassTokens\(select, NATIVE_SELECT_HIDE_CLASS\)/)
  assert.match(dropdown, /removeClassTokens\(select, NATIVE_SELECT_HIDE_CLASS\)/)

  const tokens = classTokenList(NATIVE_SELECT_HIDE_CLASS)
  assert.equal(tokens.length > 1, true)
  assert.equal(tokens.every((token) => !/\s/.test(token)), true)

  const added = []
  const fake = {
    classList: {
      add(...args) {
        for (const token of args) {
          if (/\s/.test(token)) {
            throw new Error(
              `Failed to execute 'add' on 'DOMTokenList': The token provided ('${token}') contains HTML space characters, which are not valid in tokens.`,
            )
          }
          added.push(token)
        }
      },
    },
  }
  addClassTokens(fake, NATIVE_SELECT_HIDE_CLASS)
  assert.deepEqual(added, tokens)
  assert.throws(() => fake.classList.add(NATIVE_SELECT_HIDE_CLASS), /DOMTokenList/)
})

check('9. Limpieza de paneles al cambiar de vista', () => {
  const app = read('src/app.js')
  assert.match(app, /destroyDisconnectedSelects\(\)/)
  assert.match(app, /closeOpenDropdown\(\)/)
})

check('10. Dropdowns no envían POST/PUT/PATCH/DELETE', () => {
  const dropdown = read('src/components/dropdown.js')
  const header = read('src/components/header.js')
  const form = read('src/components/usuario-form.js')
  assert.equal(/\b(POST|PUT|PATCH|DELETE)\b/.test(dropdown), false)
  assert.equal(dropdown.includes('fetch('), false)
  assert.equal(header.includes('fetch('), false)
  assert.equal(form.includes("method: 'POST'"), false)
})

check('11. Nueva empresa sigue el mismo patrón de modal sin enhance en el form', () => {
  const empresaForm = read('src/components/empresa-form.js')
  assert.equal(empresaForm.includes('enhanceSelectsIn'), false)
  assert.match(read('src/views/administracion.js'), /function openEmpresaCreate/)
})

check('12. Fichadas no cambia cálculos en dropdown.js', () => {
  const dropdown = read('src/components/dropdown.js')
  assert.equal(dropdown.includes('buildJornadas'), false)
  assert.equal(dropdown.includes('annotateMovimientos'), false)
  assert.match(read('src/utils/jornadas.js'), /export function buildJornadas/)
})

check('Header: trigger se actualiza tras cargar opciones (contrato refresh)', () => {
  const dropdown = read('src/components/dropdown.js')
  assert.match(dropdown, /export function refreshEnhancedSelect/)
  assert.match(dropdown, /refresh: paint/)
  assert.match(read('src/components/header.js'), /select\.value = /)
  assert.match(read('src/components/header.js'), /refreshEnhancedSelect\(select\)/)
})

console.log(`${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
