process.env.TZ = 'America/Argentina/Buenos_Aires'

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// Dynamic import after TZ so Date + Intl see America/Argentina/Buenos_Aires.
const {
  formatApiDateTime,
  formatDate,
  formatTime,
  parseApiLocalDate,
  parseApiUtcDate,
  toDateKey,
} = await import('../src/utils/format.js')
const { startOfDayIso, exclusiveHastaIso } = await import('../src/utils/period.js')

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const TEST_ZONE = 'America/Argentina/Buenos_Aires'

function read(rel) {
  return readFileSync(join(root, rel), 'utf8')
}

function check(name, fn) {
  try {
    fn()
    console.log(`ok - ${name}`)
  } catch (error) {
    console.error(`FAIL - ${name}`)
    console.error(error)
    process.exitCode = 1
  }
}

check('0. Zona de prueba fija America/Argentina/Buenos_Aires (UTC−3)', () => {
  assert.equal(process.env.TZ, TEST_ZONE)
  // getTimezoneOffset: minutes to add to local to get UTC → UTC−3 ⇒ 180.
  const probe = new Date('2026-09-15T12:00:00')
  assert.equal(probe.getTimezoneOffset(), 180)
})

check('1. UTC sin zona equivale al mismo instante con Z', () => {
  const bare = parseApiUtcDate('2026-09-15T22:30:00')
  const withZ = parseApiUtcDate('2026-09-15T22:30:00Z')
  assert.ok(bare)
  assert.ok(withZ)
  assert.equal(bare.getTime(), withZ.getTime())
  assert.equal(bare.getTime(), Date.parse('2026-09-15T22:30:00Z'))
})

check('2. UTC con Z no se altera ni recibe otra Z', () => {
  const value = '2026-09-15T22:30:00.0000000Z'
  const date = parseApiUtcDate(value)
  assert.ok(date)
  assert.equal(date.getTime(), Date.parse(value))
  assert.equal(date.toISOString(), '2026-09-15T22:30:00.000Z')
})

check('3. Valor con offset conserva el instante', () => {
  const date = parseApiUtcDate('2026-09-15T19:30:00-03:00')
  assert.ok(date)
  assert.equal(date.getTime(), Date.parse('2026-09-15T22:30:00Z'))
})

check('4. Fecha inválida no produce excepción', () => {
  assert.equal(parseApiUtcDate('no-es-fecha'), null)
  assert.equal(parseApiLocalDate('no-es-fecha'), null)
  assert.equal(formatApiDateTime('no-es-fecha'), '')
})

check('5. null y vacío no producen excepción', () => {
  assert.equal(parseApiUtcDate(null), null)
  assert.equal(parseApiUtcDate(''), null)
  assert.equal(parseApiUtcDate('   '), null)
  assert.equal(parseApiLocalDate(undefined), null)
  assert.equal(formatApiDateTime(null), '')
  assert.equal(formatApiDateTime(''), '')
})

check('6. fechaHora local AR 19:30 vs UTC bare 19:30 → 16:30 en Argentina', () => {
  const local = '2026-09-15T19:30:00'
  const parsedLocal = parseApiLocalDate(local)
  const parsedUtc = parseApiUtcDate(local)
  assert.ok(parsedLocal)
  assert.ok(parsedUtc)

  // Local wall clock in Buenos Aires.
  assert.equal(parsedLocal.getHours(), 19)
  assert.equal(parsedLocal.getMinutes(), 30)
  assert.equal(parsedLocal.getTime(), Date.parse('2026-09-15T22:30:00Z'))

  // Same digits as UTC instant → 19:30Z → 16:30 in Argentina.
  assert.equal(parsedUtc.getUTCHours(), 19)
  assert.equal(parsedUtc.getUTCMinutes(), 30)
  assert.equal(parsedUtc.getHours(), 16)
  assert.equal(parsedUtc.getMinutes(), 30)
  assert.equal(parsedUtc.getTime(), Date.parse('2026-09-15T19:30:00Z'))
  assert.notEqual(parsedLocal.getTime(), parsedUtc.getTime())

  // Explicit zone + 24h clock (host Intl may use 12h for es-AR).
  const timeAr = new Intl.DateTimeFormat('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: TEST_ZONE,
  })
  assert.equal(timeAr.format(parsedLocal), '19:30')
  assert.equal(timeAr.format(parsedUtc), '16:30')

  const formatSrc = read('src/utils/format.js')
  assert.match(formatSrc, /export function formatDate\([\s\S]*?parseApiLocalDate/)
  assert.match(formatSrc, /export function formatTime\([\s\S]*?parseApiLocalDate/)
  assert.match(formatSrc, /Do NOT use for `fechaHora`/)

  const movimientos = read('src/utils/movimientos.js')
  const jornadas = read('src/utils/jornadas.js')
  const fichadasTable = read('src/components/fichadas-table.js')
  assert.match(movimientos, /fechaHora/)
  assert.match(jornadas, /formatFichadaHora\(ingreso\.fechaHora\)/)
  assert.match(fichadasTable, /formatFichadaHora\(item\.fechaHora\)/)
  assert.equal(movimientos.includes('parseApiUtcDate'), false)
  assert.equal(jornadas.includes('parseApiUtcDate'), false)
  assert.equal(fichadasTable.includes('parseApiUtcDate'), false)

  assert.equal(formatTime(local), formatTime(parsedLocal))
  assert.equal(formatDate(local), formatDate(parsedLocal))
})

check('7. Calendario y filtros desde/hasta no desplazan el día', () => {
  assert.equal(startOfDayIso('2026-09-15'), '2026-09-15T00:00:00')
  assert.equal(exclusiveHastaIso('2026-09-15'), '2026-09-16T00:00:00')
  assert.equal(toDateKey('2026-09-15T12:00:00'), '2026-09-15')

  const evening = new Date(2026, 8, 15, 23, 30, 0)
  assert.equal(toDateKey(evening), '2026-09-15')
  const isoDay = evening.toISOString().slice(0, 10)
  if (isoDay !== '2026-09-15') {
    assert.notEqual(toDateKey(evening), isoDay)
  }

  const formatSrc = read('src/utils/format.js')
  assert.match(formatSrc, /export function todayDateKey\([\s\S]*?toDateKey\(new Date\(\)\)/)
  assert.equal(formatSrc.includes('toISOString().slice(0, 10)'), false)
  assert.equal(formatSrc.includes('toISOString().slice(0,10)'), false)

  const period = read('src/utils/period.js')
  assert.match(period, /\$\{dateKey\}T00:00:00/)
  assert.match(period, /todayDateKey\(\)/)
  assert.equal(period.includes('parseApiUtcDate'), false)
  assert.equal(period.includes('Z`'), false)
  assert.equal(period.includes('toISOString()'), false)
})

check('8. No existe normalización global que agregue Z a todas las fechas', () => {
  const formatSrc = read('src/utils/format.js')
  assert.match(formatSrc, /Temporary compatibility|compatibilidad temporal|temporary UTC/i)
  assert.match(formatSrc, /Do NOT use for `fechaHora`|Do NOT use for fechaHora/)

  const srcFiles = [
    'src/utils/movimientos.js',
    'src/utils/jornadas.js',
    'src/utils/fichadas-export.js',
    'src/utils/period.js',
    'src/components/fichadas-table.js',
    'src/components/recent-punches-table.js',
    'src/api/fichadas.js',
  ]
  for (const file of srcFiles) {
    const text = read(file)
    assert.equal(text.includes('parseApiUtcDate'), false, `${file} no debe usar parseApiUtcDate`)
    assert.equal(/\+ ['"]Z['"]|`\$\{[^}]+\}Z`/.test(text), false, `${file} no debe concatenar Z`)
  }

  const relative = read('src/utils/relative-time.js')
  assert.match(relative, /parseApiUtcDate/)
  assert.match(relative, /ultimoAcceso/)

  const admin = read('src/views/administracion.js')
  assert.match(admin, /formatUltimoAcceso[\s\S]*formatApiDateTime/)
})

check('formatApiDateTime convierte UTC bare a zona del dispositivo', () => {
  const bare = formatApiDateTime('2026-09-15T22:30:00')
  const withZ = formatApiDateTime('2026-09-15T22:30:00Z')
  assert.ok(bare)
  assert.equal(bare, withZ)
  const shown = new Intl.DateTimeFormat('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: TEST_ZONE,
  }).format(parseApiUtcDate('2026-09-15T22:30:00'))
  assert.equal(shown, '19:30')
})

if (process.exitCode) {
  console.error('\ncheck-fechas-zona-horaria failed')
  process.exit(1)
}

console.log('\ncheck-fechas-zona-horaria passed')
