import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS, paginateItems } from '../src/utils/paginate.js'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const read = (path) => readFileSync(join(root, path), 'utf8')
const view = read('src/views/empleados.js')
const table = read('src/components/empleados-table.js')
const pagination = read('src/components/pagination.js')

assert.deepEqual(PAGE_SIZE_OPTIONS, [30, 50, 100])
assert.equal(DEFAULT_PAGE_SIZE, 30)
assert.match(view, /EMPLEADOS_PAGE_SIZES = \[10, 25, 50\]/)
assert.match(view, /EMPLEADOS_DEFAULT_PAGE_SIZE = 10/)
assert.match(view, /let sessionPageSize = EMPLEADOS_DEFAULT_PAGE_SIZE/)
assert.equal(view.includes('localStorage'), false)
assert.equal(view.includes('sessionStorage'), false)
assert.match(view, /ml-auto flex items-center justify-end/)
assert.match(view, /summary: textoRangoEmpleados/)
assert.match(view, /Mostrando \$\{from\}–\$\{to\} de \$\{total\}/)
assert.match(view, /if \(paged\.pageCount > 1\)/)
assert.match(table, /<tr class="h-11 /)
assert.match(table, /hover:bg-slate-50/)
assert.match(table, /focus-visible:ring-2 focus-visible:ring-blue-500/)
assert.match(table, /compact: true/)
assert.match(pagination, /summary = ''/)
assert.match(pagination, /sm:hidden/)
assert.match(pagination, /Página \$\{page\} de \$\{pageCount\}/)
assert.match(pagination, /disabled = page <= 1/)
assert.match(pagination, /disabled = page >= pageCount/)

const filters = view.slice(view.indexOf('function onFilterChange'), view.indexOf('async function clearAllFilters'))
assert.match(filters, /resetPage\(\)/)
assert.match(filters, /renderResults\(\)/)
const sort = view.slice(view.indexOf('onSort:'), view.indexOf('onView:'))
assert.match(sort, /resetPage\(\)/)
const size = view.slice(view.indexOf('pageSizeSelect.addEventListener'), view.lastIndexOf('container.replaceChildren'))
assert.match(size, /sessionPageSize = nextSize/)
assert.match(size, /resetPage\(\)/)

function pageOf(total, size, page) {
  return paginateItems(Array.from({ length: total }, (_, index) => index + 1), page, size)
}

assert.deepEqual(
  [0, 1, 10].map((total) => pageOf(total, 10, 1).pageCount),
  [1, 1, 1],
)
assert.equal(pageOf(0, 10, 1).from, 0)
assert.equal(pageOf(1, 10, 1).from, 1)
assert.equal(pageOf(1, 10, 1).to, 1)
assert.deepEqual([pageOf(10, 10, 1).from, pageOf(10, 10, 1).to], [1, 10])

const eleven = pageOf(11, 10, 4)
assert.equal(eleven.pageCount, 2)
assert.equal(eleven.page, 2)
assert.deepEqual([eleven.from, eleven.to], [11, 11])
assert.deepEqual([pageOf(11, 10, 1).from, pageOf(11, 10, 1).to], [1, 10])

const twentyFive = pageOf(25, 10, 3)
assert.equal(twentyFive.pageCount, 3)
assert.deepEqual([twentyFive.from, twentyFive.to], [21, 25])

const thirtyTwo = pageOf(32, 10, 4)
assert.equal(thirtyTwo.pageCount, 4)
assert.deepEqual([thirtyTwo.from, thirtyTwo.to], [31, 32])
assert.equal(pageOf(32, 10, 9).page, 4)

const fifty = pageOf(50, 10, 1)
assert.equal(fifty.pageCount, 5)
assert.deepEqual([fifty.from, fifty.to], [1, 10])
assert.equal(pageOf(50, 25, 2).pageCount, 2)
assert.deepEqual([pageOf(50, 25, 2).from, pageOf(50, 25, 2).to], [26, 50])
assert.equal(pageOf(50, 50, 1).pageCount, 1)
assert.deepEqual([pageOf(50, 50, 1).from, pageOf(50, 50, 1).to], [1, 50])

console.log('check-empleados-paginacion: ok')
