process.env.TZ = 'UTC'

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const {
  toDateKey,
  todayDateKey,
} = await import('../src/utils/format.js')
const {
  FICHADAS_PERIODO_HOY,
  FICHADAS_PERIODO_INICIAL,
  FICHADAS_PERIODO_TODOS,
  exclusiveHastaIso,
  resolvePeriodRange,
  startOfDayIso,
} = await import('../src/utils/period.js')
const { hasFichadasServerFilters } = await import('../src/utils/fichadas-export.js')

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

function expectedLocalKey(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

check('El período inicial es Hoy', () => {
  assert.equal(FICHADAS_PERIODO_INICIAL, FICHADAS_PERIODO_HOY)
  const view = read('src/views/fichadas.js')
  assert.match(view, /FICHADAS_PERIODO_INICIAL/)
  assert.match(view, /periodoSelect.value = FICHADAS_PERIODO_INICIAL/)
  assert.match(view, /option value="\$\{FICHADAS_PERIODO_HOY\}"/)
  assert.match(view, /Todos \/ Sin filtro de fecha/)
})

check('La primera carga arma rango de hoy y no consulta sin filtro', () => {
  const today = todayDateKey()
  const range = resolvePeriodRange(FICHADAS_PERIODO_INICIAL)
  assert.equal(range.desde, startOfDayIso(today))
  assert.equal(range.hasta, exclusiveHastaIso(today))
  assert.equal(Object.keys(range).length, 2)
  assert.equal(hasFichadasServerFilters({ periodo: FICHADAS_PERIODO_INICIAL }), true)
  assert.equal(hasFichadasServerFilters({ periodo: FICHADAS_PERIODO_TODOS }), false)

  const view = read('src/views/fichadas.js')
  assert.match(view, /await loadFichadas\(\)/)
  assert.match(view, /getFichadas\(apiFilters\(filters\)\)/)
  assert.match(view, /resolvePeriodRange\(filters.periodo/)
  const loadIndex = view.indexOf('await loadFichadas()')
  const initIndex = view.indexOf('periodoSelect.value = FICHADAS_PERIODO_INICIAL')
  assert.equal(initIndex >= 0 && initIndex < loadIndex, true)
})

check('Limpiar filtros vuelve a Hoy', () => {
  const view = read('src/views/fichadas.js')
  const clearStart = view.indexOf('function clearFilters()')
  const clearBlock = view.slice(clearStart, clearStart + 400)
  assert.match(clearBlock, /periodoSelect.value = FICHADAS_PERIODO_INICIAL/)
  assert.equal(clearBlock.includes("periodoSelect.value = 'todos'"), false)
  assert.match(clearBlock, /tipoSelect.value = 'todos'/)
  assert.match(clearBlock, /metodoSelect.value = 'todos'/)
  assert.match(clearBlock, /empleadoCombobox.reset\(\)/)
})

check('La selección manual de Todos sigue disponible', () => {
  const view = read('src/views/fichadas.js')
  assert.match(view, /FICHADAS_PERIODO_TODOS/)
  assert.match(view, /Todos \/ Sin filtro de fecha/)
  const empty = resolvePeriodRange(FICHADAS_PERIODO_TODOS)
  assert.deepEqual(empty, {})
  assert.equal(hasFichadasServerFilters({ periodo: FICHADAS_PERIODO_TODOS }), false)
})

check('La fecha local no cambia por conversión UTC (host UTC)', () => {
  assert.equal(process.env.TZ, 'UTC')
  const localEvening = new Date(2026, 8, 21, 23, 30, 0)
  assert.equal(toDateKey(localEvening), '2026-09-21')
  assert.equal(toDateKey(localEvening), expectedLocalKey(localEvening))

  const nearUtcMidnight = new Date(Date.UTC(2026, 8, 22, 2, 0, 0))
  const isoDay = nearUtcMidnight.toISOString().slice(0, 10)
  assert.equal(isoDay, '2026-09-22')
  assert.equal(toDateKey(nearUtcMidnight), expectedLocalKey(nearUtcMidnight))

  const formatSrc = read('src/utils/format.js')
  assert.match(formatSrc, /export function todayDateKey/)
  assert.match(formatSrc, /date.getFullYear\(\)/)
  assert.match(formatSrc, /date.getMonth\(\)/)
  assert.match(formatSrc, /date.getDate\(\)/)
  assert.equal(formatSrc.includes("toISOString().slice(0, 10)"), false)
  assert.equal(formatSrc.includes('toISOString().slice(0,10)'), false)

  const periodSrc = read('src/utils/period.js')
  assert.match(periodSrc, /todayDateKey\(\)/)
  assert.equal(periodSrc.includes('toISOString()'), false)
  assert.equal(periodSrc.includes("parseApiUtcDate"), false)
})

check('Últimos 7/15/30/60 días conservan el rango inclusivo local', () => {
  const today = todayDateKey()
  for (const days of [7, 15, 30, 60]) {
    const range = resolvePeriodRange(String(days))
    assert.equal(range.hasta, exclusiveHastaIso(today))
    assert.ok(range.desde.endsWith('T00:00:00'))
  }
})

console.log(`${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
