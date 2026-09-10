import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  departamentoOptionLabel,
  filterDepartamentosForSucursalSelection,
  uniqueDepartamentosById,
} from '../src/api/departamentos.js'
import {
  SUCURSAL_UNASSIGNED,
  sucursalFilterSummary,
  uniqueSortedSucursales,
} from '../src/components/sucursal-multi-select.js'
import { filterEmpleados } from '../src/utils/empleado-list.js'

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

const empleados = [
  { id: 1, nombre: 'Ana', apellido: 'Perez', sucursalId: 2, sucursal: 'Centro', departamentoId: 10, dni: '1', legajo: 'A1' },
  { id: 2, nombre: 'Bruno', apellido: 'Diaz', sucursalId: 5, sucursal: 'Norte', departamentoId: 11, dni: '2', legajo: 'B2' },
  { id: 3, nombre: 'Carla', apellido: 'Lopez', sucursalId: null, sucursal: null, departamentoId: null, dni: '3', legajo: 'C3' },
  { id: 4, nombre: 'Diego', apellido: 'Sosa', sucursalId: 2, sucursal: 'Centro', departamentoId: 12, dni: '4', legajo: 'D4' },
]

check('Opciones únicas, ordenadas y sin duplicados', () => {
  const catalog = uniqueSortedSucursales([
    { id: 5, nombre: 'Norte' },
    { id: 2, nombre: 'Centro' },
    { id: 2, nombre: 'Centro duplicada' },
    { id: 0, nombre: 'inválida' },
    { id: 'x', nombre: 'no' },
  ])
  assert.deepEqual(
    catalog.map((item) => item.nombre),
    ['Centro', 'Norte'],
  )
})

check('Resumen de selección', () => {
  assert.equal(sucursalFilterSummary({ sucursalIds: [], includeUnassigned: false }), 'Todas las sucursales')
  assert.equal(sucursalFilterSummary({ sucursalIds: [2], includeUnassigned: false }), '1 sucursal seleccionada')
  assert.equal(sucursalFilterSummary({ sucursalIds: [2, 5], includeUnassigned: true }), '3 sucursales seleccionadas')
})

check('Sin selección incluye a todos, también sin sucursal', () => {
  const filtered = filterEmpleados(empleados, { sucursalIds: [], includeUnassigned: false, estado: 'todos' })
  assert.equal(filtered.length, 4)
})

check('Una sucursal filtra por sucursalId, no por texto', () => {
  const filtered = filterEmpleados(empleados, { sucursalIds: [2], includeUnassigned: false, estado: 'todos' })
  assert.deepEqual(
    filtered.map((item) => item.id),
    [1, 4],
  )
})

check('Varias sucursales', () => {
  const filtered = filterEmpleados(empleados, { sucursalIds: [2, 5], includeUnassigned: false, estado: 'todos' })
  assert.deepEqual(
    filtered.map((item) => item.id),
    [1, 2, 4],
  )
})

check('Sin sucursal asignada', () => {
  const filtered = filterEmpleados(empleados, { sucursalIds: [], includeUnassigned: true, estado: 'todos' })
  assert.deepEqual(
    filtered.map((item) => item.id),
    [3],
  )
})

check('Combinación con búsqueda sobre el conjunto cargado', () => {
  const filtered = filterEmpleados(empleados, {
    query: 'ana',
    sucursalIds: [2, 5],
    includeUnassigned: true,
    estado: 'todos',
  })
  assert.deepEqual(
    filtered.map((item) => item.id),
    [1],
  )
})

check('Cero resultados', () => {
  const filtered = filterEmpleados(empleados, { query: 'zzz', sucursalIds: [2], includeUnassigned: false, estado: 'todos' })
  assert.equal(filtered.length, 0)
})

const departamentos = [
  { id: 10, nombre: 'RRHH', sucursalId: 2 },
  { id: 11, nombre: 'RRHH', sucursalId: 5 },
  { id: 12, nombre: 'Operaciones', sucursalId: 2 },
  { id: 10, nombre: 'RRHH duplicado', sucursalId: 2 },
]

check('Una sucursal muestra solo sus departamentos', () => {
  assert.deepEqual(
    filterDepartamentosForSucursalSelection(departamentos, { sucursalIds: [2] }).map((item) => item.id),
    [12, 10],
  )
})

check('Varias sucursales unen departamentos por sucursalId', () => {
  assert.deepEqual(
    filterDepartamentosForSucursalSelection(departamentos, { sucursalIds: [2, 5] }).map((item) => item.id),
    [12, 10, 11],
  )
})

check('Todas las sucursales muestran el catálogo completo', () => {
  assert.deepEqual(
    filterDepartamentosForSucursalSelection(departamentos, { sucursalIds: [], includeUnassigned: false }).map(
      (item) => item.id,
    ),
    [12, 10, 11],
  )
})

check('Sin sucursal no inventa departamentos', () => {
  assert.deepEqual(
    filterDepartamentosForSucursalSelection(departamentos, { sucursalIds: [], includeUnassigned: true }),
    [],
  )
})

check('No fusiona IDs distintos aunque el nombre coincida', () => {
  const unique = uniqueDepartamentosById(departamentos)
  assert.equal(unique.filter((item) => item.nombre === 'RRHH').length, 2)
  const names = new Map([
    [2, 'Centro'],
    [5, 'Norte'],
  ])
  assert.equal(departamentoOptionLabel({ id: 10, nombre: 'RRHH', sucursalId: 2 }, { sucursalNames: names, duplicateName: true }), 'RRHH (Centro)')
  assert.equal(departamentoOptionLabel({ id: 11, nombre: 'RRHH', sucursalId: 5 }, { sucursalNames: names, duplicateName: true }), 'RRHH (Norte)')
})

check('El filtro de departamento usa departamentoId con varias sucursales', () => {
  const filtered = filterEmpleados(empleados, {
    sucursalIds: [2, 5],
    includeUnassigned: false,
    departamentoId: '11',
    estado: 'todos',
  })
  assert.deepEqual(
    filtered.map((item) => item.id),
    [2],
  )
})

check('La vista usa IDs, checkbox accesible, limpiar y destroy', () => {
  const view = read('src/views/empleados.js')
  const multi = read('src/components/sucursal-multi-select.js')
  assert.match(view, /createSucursalMultiSelect/)
  assert.match(view, /Limpiar filtros/)
  assert.match(view, /sucursalFilter\.destroy\(\)/)
  assert.match(view, /sucursalIds/)
  assert.match(view, /filterDepartamentosForSucursalSelection/)
  assert.equal(/Disponible al elegir una sola sucursal/.test(view), false)
  assert.match(multi, /input\.type = 'checkbox'/)
  assert.match(read('src/components/dropdown.js'), /AbortController/)
  assert.match(multi, /Sin sucursal asignada/)
  assert.equal(SUCURSAL_UNASSIGNED, '__unassigned__')
  assert.equal(/empleados-sucursal"/.test(view), false)
})

if (failed) {
  console.error(`\n${failed} failed, ${passed} passed`)
  process.exit(1)
}

console.log(`\n${passed} passed`)
