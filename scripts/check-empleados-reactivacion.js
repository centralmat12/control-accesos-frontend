import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildEmpleadoAlertas, summarizeEmpleadoDatos } from '../src/utils/empleado-alerts.js'

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

check('La API de empleados documenta listado optativo y reactivación', () => {
  const api = read('src/api/empleados.js')
  assert.match(api, /incluirInactivos === true/)
  assert.match(api, /\/api\/empleados\?incluirInactivos=true/)
  assert.match(api, /export async function reactivateEmpleado/)
  assert.match(api, /\/api\/empleados\/\$\{id\}\/reactivar/)
  assert.match(api, /response.status === 409/)
  assert.equal(api.includes('localStorage'), false)
})

check('Dashboard y fichadas no piden inactivos', () => {
  assert.match(read('src/views/dashboard.js'), /getEmpleados\(\)/)
  assert.equal(read('src/views/dashboard.js').includes('incluirInactivos'), false)
  assert.equal(read('src/views/fichadas.js').includes('incluirInactivos'), false)
})

check('Popup inactivo solo ofrece activar; activo conserva desactivar y editar', () => {
  const record = read('src/components/empleado-form.js')
  assert.match(record, /Activar empleado/)
  assert.match(record, /createReactivateConfirm/)
  assert.match(record, /¿Querés volver a activar a/)
  assert.match(record, /El empleado volverá a aparecer entre los empleados activos/)
  assert.match(record, /if \(confirmButton.disabled\) return/)
  assert.match(read('src/views/empleados.js'), /inactive \? Promise.resolve\(empleado\) : getEmpleadoById/)
})

check('Badge inactivo es gris y el botón de activar es verde', () => {
  assert.match(read('src/components/badge.js'), /active \? 'success' : 'neutral'/)
  assert.match(read('src/components/button-styles.js'), /BTN_POSITIVE_CLASS/)
  assert.match(read('src/components/button-styles.js'), /bg-emerald-50/)
})

check('Contadores y alertas ignoran inactivos', () => {
  const empleados = [
    { id: 1, nombre: 'Ana', apellido: 'Perez', activo: true, dni: '1', cuil: '20', tieneHuella: true },
    {
      id: 2,
      nombre: 'Bruno',
      apellido: 'Diaz',
      activo: false,
      dni: '',
      cuil: '',
      sucursal: '',
      departamento: '',
      tieneHuella: false,
    },
  ]
  const stats = summarizeEmpleadoDatos(empleados)
  assert.equal(stats.activos, 1)
  const alerts = buildEmpleadoAlertas(empleados)
  assert.equal(
    alerts.items.some((item) => Number(item.empleado.id) === 2),
    false,
  )
  const reactivado = { ...empleados[1], activo: true }
  assert.equal(buildEmpleadoAlertas([reactivado]).count > 0, true)
})

check('Cliente de reactivación: ruta, sin body y errores seguros', () => {
  const api = read('src/api/empleados.js')
  const http = read('src/api/http.js')
  assert.match(api, /method: 'POST'/)
  assert.equal(api.includes("body: JSON.stringify"), true)
  const reactivateBlock = api.slice(api.indexOf('export async function reactivateEmpleado'))
  assert.equal(reactivateBlock.includes('JSON.stringify'), false)
  assert.match(reactivateBlock, /response.status === 404/)
  assert.match(reactivateBlock, /response.status === 403/)
  assert.match(reactivateBlock, /response.status === 409/)
  assert.match(http, /response.status === 401/)
  assert.match(http, /notifyUnauthorized/)
  assert.match(http, /isSuperadmin\(user\)/)
  assert.match(http, /headers\['X-Empresa-Id'\]/)
})

check('Tabla inactiva no tacha y Ver/Editar conserva la acción', () => {
  const table = read('src/components/empleados-table.js')
  assert.equal(table.includes('line-through'), false)
  assert.match(table, /data-action="view"/)
  assert.match(table, /Ver\/Editar/)
  assert.match(table, /empleado.activo === false/)
})

check('Popup activo vs inactivo no mezcla acciones', () => {
  const record = read('src/components/empleado-form.js')
  const view = read('src/views/empleados.js')
  assert.match(record, /canReactivateEmpleado/)
  assert.match(record, /canDeactivateEmpleado/)
  assert.match(view, /title: 'Activar empleado'/)
  assert.match(view, /await reactivateEmpleado/)
  assert.match(record, /if \(confirmButton.disabled\) return/)
  assert.equal(view.includes('localStorage'), false)
  assert.equal(record.includes('localStorage'), false)
})

console.log(`${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
