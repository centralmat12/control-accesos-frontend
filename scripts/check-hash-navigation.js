import { resetBrowserGlobals } from './browser-globals.js'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  assignViewHash,
  hashesMatch,
  parseHashView,
  viewHash,
  writeViewHash,
} from '../src/utils/hash-route.js'

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

function createMemoryLocation(initialHash = '') {
  const entries = [{ hash: initialHash, state: null }]
  let index = 0
  const location = {
    get hash() {
      return entries[index].hash
    },
    set hash(value) {
      const next = String(value || '')
      const normalized = next && !next.startsWith('#') ? `#${next}` : next
      if (normalized === entries[index].hash) return
      entries.splice(index + 1)
      entries.push({ hash: normalized, state: { view: parseHashView(normalized).viewId } })
      index = entries.length - 1
    },
  }
  const history = {
    pushState(state, _title, url) {
      entries.splice(index + 1)
      entries.push({ hash: String(url), state })
      index = entries.length - 1
    },
    replaceState(state, _title, url) {
      entries[index] = { hash: String(url), state }
    },
    back() {
      if (index > 0) index -= 1
    },
    forward() {
      if (index < entries.length - 1) index += 1
    },
  }
  return {
    location,
    history,
    get index() {
      return index
    },
    get length() {
      return entries.length
    },
    snapshot() {
      return entries.map((entry) => entry.hash)
    },
  }
}

resetBrowserGlobals()

check('Las rutas hash conocidas se reconocen y las inválidas van al Dashboard', () => {
  assert.equal(viewHash('dashboard'), '#/dashboard')
  assert.equal(viewHash('empleados'), '#/empleados')
  assert.equal(viewHash('fichadas'), '#/fichadas')
  assert.equal(viewHash('administracion'), '#/administracion')
  assert.deepEqual(parseHashView('#/empleados'), { viewId: 'empleados', valid: true, empty: false })
  assert.deepEqual(parseHashView('#/no-existe'), { viewId: 'dashboard', valid: false, empty: false })
  assert.deepEqual(parseHashView('#/areas'), { viewId: 'dashboard', valid: false, empty: false })
  assert.equal(parseHashView('').viewId, 'dashboard')
  assert.equal(parseHashView('').valid, true)
  assert.equal(hashesMatch('#/fichadas', '#/fichadas'), true)
})

check('El menú registra vistas en el historial; Atrás y Adelante restauran', () => {
  const mem = createMemoryLocation()
  assert.equal(writeViewHash('dashboard', { replace: true, history: mem.history, location: mem.location }), 'replace')
  assert.equal(mem.length, 1)
  assert.equal(assignViewHash('empleados', { location: mem.location }), 'assign')
  assert.equal(assignViewHash('fichadas', { location: mem.location }), 'assign')
  assert.equal(assignViewHash('administracion', { location: mem.location }), 'assign')
  assert.equal(mem.length, 4)
  assert.equal(parseHashView(mem.location.hash).viewId, 'administracion')

  mem.history.back()
  assert.equal(parseHashView(mem.location.hash).viewId, 'fichadas')
  mem.history.back()
  assert.equal(parseHashView(mem.location.hash).viewId, 'empleados')
  mem.history.forward()
  assert.equal(parseHashView(mem.location.hash).viewId, 'fichadas')
})

check('Un hash inválido se corrige con replaceState y no agrega una entrada', () => {
  const mem = createMemoryLocation('#/empleados')
  assignViewHash('fichadas', { location: mem.location })
  const lengthAfterNav = mem.length
  mem.location.hash = '#/ruta-inventada'
  const parsed = parseHashView(mem.location.hash)
  assert.equal(parsed.valid, false)
  assert.equal(parsed.viewId, 'dashboard')
  assert.equal(
    writeViewHash(parsed.viewId, { replace: true, history: mem.history, location: mem.location }),
    'replace',
  )
  assert.equal(mem.length, lengthAfterNav + 1)
  assert.equal(mem.location.hash, '#/dashboard')
})

check('hashchange y popstate no hacen pushState', () => {
  const app = read('src/app.js')
  const handlerAt = app.indexOf('function onHistoryNavigation')
  const handler = app.slice(handlerAt)
  assert.match(app, /addEventListener\('hashchange'/)
  assert.match(app, /addEventListener\('popstate'/)
  assert.match(handler, /writeViewHash\(viewId, \{ replace: true \}\)/)
  assert.equal(handler.includes('assignViewHash'), false)
  assert.equal(handler.includes("location.hash ="), false)
  assert.match(app, /historyLock/)
})

check('La sesión cerrada no recupera contenido protegido y dispose la vista anterior', () => {
  const app = read('src/app.js')
  const dashboard = read('src/views/dashboard.js')
  const historyHandler = app.slice(app.indexOf('function onHistoryNavigation'))
  const renderViewSrc = app.slice(app.indexOf('async function renderView'))
  assert.match(app, /function clearActiveView/)
  assert.match(app, /renderLogin\(root/)
  assert.match(app, /onLogout: \(\) => \{/)
  assert.match(app, /logout\(\)/)
  assert.match(app, /writeViewHash\(DEFAULT_VIEW, \{ replace: true \}\)/)
  assert.match(historyHandler, /if \(!isAuthenticated\(\)\)/)
  assert.match(historyHandler, /clearActiveView\(\)/)
  assert.match(renderViewSrc, /clearActiveView\(\)/)
  assert.match(dashboard, /stopAutoRefresh\(\)/)
  assert.match(dashboard, /stopLabelClock\(\)/)
  assert.match(read('src/components/sidebar.js'), /href="#\/\$\{item\.id\}"/)
})

console.log(`${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
