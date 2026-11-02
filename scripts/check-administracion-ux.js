import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const read = (path) => readFileSync(join(root, path), 'utf8')

const admin = read('src/views/administracion.js')
const layout = read('src/components/admin-panel-layout.js')
const departamentos = read('src/components/departamentos-admin.js')
const turnos = read('src/components/turnos-panel.js')

assert.match(layout, /max-w-\[1200px\]/)
assert.match(admin, /ADMIN_PAGE_CLASS/)
assert.match(admin, /Administración de la organización/)
assert.match(admin, /Gestioná los accesos y la estructura de la empresa\./)
assert.equal(admin.includes('Gestioná usuarios y empresas'), false)
assert.equal(admin.includes('Gestioná los departamentos'), false)
assert.equal(admin.includes('Usuarios de la empresa seleccionada'), false)

for (const title of [
  'Usuarios',
  'Empresas',
  'Departamentos',
  'Turnos de trabajo',
]) {
  assert.equal(admin.includes(title) || turnos.includes(title), true)
}

assert.equal(/Usuarios ·/.test(admin), false)
assert.equal(/Empresas ·/.test(admin), false)
assert.equal(/Departamentos ·/.test(admin), false)
assert.equal(/Turnos de trabajo ·/.test(turnos), false)
assert.equal(admin.includes('empresaContextoTexto'), false)
assert.equal(admin.includes('Empresa: ${'), false)
assert.match(admin, /Administrá los accesos, roles y estados\./)
assert.match(admin, /Nuevo usuario/)
assert.match(admin, /Nueva empresa/)
assert.match(admin, /Nuevo departamento/)
assert.match(turnos, /Nuevo turno/)
assert.match(admin, /adminSectionHeaderMarkup/)
assert.match(turnos, /adminSectionHeaderMarkup/)
assert.match(admin, /id="admin-usuarios-search"/)
assert.match(admin, /id="admin-empresas-search"/)
assert.match(departamentos, /departamentos-admin-search/)
assert.match(turnos, /admin-turnos-search/)
assert.match(admin, /Limpiar/)
assert.match(layout, /createAdminEmptyState/)
assert.match(admin, /No hay usuarios/)
assert.match(admin, /No hay empresas/)
assert.match(departamentos, /No hay departamentos/)
assert.match(turnos, /No hay turnos de trabajo/)
assert.match(admin, /No encontramos resultados/)
assert.match(layout, /setAttribute\('role', 'status'\)/)
assert.match(admin, /role="tablist"/)
assert.match(admin, /aria-selected/)
assert.match(admin, /ArrowRight/)
assert.match(layout, /ADMIN_TABLE_FRAME_CLASS/)
assert.match(admin, /overflow-x-auto/)
assert.equal(admin.includes('max-w-[1080px]'), false)
assert.equal(admin.includes('max-w-[880px]'), false)
assert.equal(turnos.includes('max-w-[min(100%,65rem)]'), false)
assert.match(admin, /Ver sucursales/)
assert.match(turnos, />Acciones</)
console.log('check-administracion-ux: ok')
