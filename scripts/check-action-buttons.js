import '../scripts/browser-globals.js'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { actionButtonMarkup } from '../src/components/button-styles.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (path) => readFileSync(join(root, path), 'utf8')
const styles = read('src/components/button-styles.js')
const css = read('src/style.css')
const turnos = read('src/components/turnos-panel.js')
const table = turnos.slice(turnos.indexOf('function renderTable'), turnos.indexOf('function openEliminarTurnoConfirm'))

assert.match(styles, /iconPencil/)
assert.match(styles, /iconTrash/)
assert.equal(styles.includes('✏'), false)
assert.equal(styles.includes('🗑'), false)
assert.match(css, /\.btn-action-edit/)
assert.match(css, /\.btn-action-delete/)
assert.match(css, /focus-visible/)
assert.match(css, /background-color: transparent/)

const edit = actionButtonMarkup({ label: 'Editar', ariaLabel: 'Editar sucursal', attrs: 'data-action="edit-sucursal"' })
const remove = actionButtonMarkup({ variant: 'delete', label: 'Eliminar', ariaLabel: 'Eliminar departamento' })
assert.match(edit, /class="btn-action-edit"/)
assert.match(edit, /aria-label="Editar sucursal"/)
assert.match(edit, /<span>Editar<\/span>/)
assert.match(edit, /type="button"/)
assert.match(edit, /<svg/)
assert.match(remove, /class="btn-action-delete"/)
assert.match(remove, /<span>Eliminar<\/span>/)
assert.equal(edit.includes('w-full'), false)
assert.equal(remove.includes('w-full'), false)

assert.match(styles, /button.type = 'button'/)
assert.match(styles, /button\.className = `\$\{isDelete \? BTN_DELETE_CLASS : BTN_EDIT_CLASS\}/)
assert.match(styles, /setAttribute\('aria-label'/)

for (const file of [
  'src/components/empleados-table.js',
  'src/components/empleado-form.js',
  'src/components/departamentos-admin.js',
  'src/components/jornada-detalle.js',
  'src/components/turnos-panel.js',
  'src/views/administracion.js',
]) {
  const source = read(file)
  assert.match(source, /actionButtonMarkup|createActionButton/)
}

assert.match(read('src/components/empleados-table.js'), /ariaLabel: 'Editar empleado'/)
assert.match(read('src/components/empleado-form.js'), /ariaLabel: 'Editar datos'/)
assert.match(read('src/components/empleado-form.js'), /id="empleado-edit"/)
assert.match(read('src/components/jornada-detalle.js'), /ariaLabel: 'Editar observación'/)
assert.match(read('src/components/departamentos-admin.js'), /ariaLabel: 'Eliminar departamento'/)
assert.match(read('src/views/administracion.js'), /ariaLabel: 'Editar sucursal'/)
assert.match(read('src/views/administracion.js'), /ariaLabel: 'Editar usuario'/)
assert.equal(table.includes('Eliminar'), false)
assert.match(table, /actionButtonMarkup/)
assert.match(turnos, /createActionButton/)
assert.match(turnos, /variant: 'delete'/)
assert.match(turnos, /label: 'Eliminar turno'/)
assert.match(turnos, /minmax\(240px,320px\)_100px/)
assert.match(turnos, /grid-cols-1 items-end/)
assert.match(turnos, /dialogClass: 'max-w-\[45rem\]'/)
assert.equal((turnos.match(/Ingresá la cantidad de minutos de descanso/g) || []).length, 1)
assert.match(turnos, /deleteTurno\(turno\.id\)/)
assert.match(read('src/api/turnos.js'), /\/api\/Turnos\/\$\{id\}/)
assert.match(read('src/views/administracion.js'), /data-usuario-accion="editar"/)
