import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { paginateItems } from '../src/utils/paginate.js'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const read = (path) => readFileSync(join(root, path), 'utf8')
const view = read('src/views/empleados.js')
const app = read('src/app.js')

const labelAt = view.indexOf('const FILTER_LABEL_CLASS = ')
const templateAt = view.indexOf('id="empleados-search"')
assert.ok(labelAt > 0 && labelAt < templateAt)
assert.match(view, /\$\{FILTER_LABEL_CLASS\}/)

const loadAt = view.indexOf('async function loadEmpleados')
const load = view.slice(loadAt, view.indexOf('async function verEmpleadosDepartamento'))
assert.match(load, /createTableSkeleton/)
assert.match(load, /empleados = await getEmpleados/)
assert.match(load, /loaded = true/)
assert.match(load, /renderResults\(\)/)
assert.match(load, /catch \(error\)/)
assert.match(load, /results\.replaceChildren\(\)/)
assert.match(load, /No se pudo cargar la lista/)
assert.match(load, /No pudimos consultar los empleados/)
assert.match(load, /actionLabel: 'Reintentar'/)
assert.equal(load.includes('message: error.message'), false)
assert.match(view, /No hay empleados/)
assert.match(view, /EMPLEADOS_DEFAULT_PAGE_SIZE = 10/)
assert.match(view, /EMPLEADOS_PAGE_SIZES = \[10, 25, 50\]/)

const renderView = app.slice(app.indexOf('async function renderView'))
assert.match(renderView, /createViewSkeleton\(\)/)
assert.match(renderView, /catch \(error\)/)
assert.match(renderView, /No se pudo abrir la sección/)
assert.match(renderView, /Reintentar/)
assert.match(renderView, /console\.error\(error\)/)

assert.equal(paginateItems([], 1, 10).pageCount, 1)
assert.equal(paginateItems(Array.from({ length: 10 }, (_, index) => index), 1, 10).pageCount, 1)
assert.equal(paginateItems(Array.from({ length: 11 }, (_, index) => index), 1, 10).pageCount, 2)

console.log('check-empleados-carga: ok')
