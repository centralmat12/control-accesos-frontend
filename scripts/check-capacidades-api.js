/**
 * Capacidades progresivas, metadatos y clasificación.
 * No contacta servicios externos: el request se inyecta.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const memory = new Map()
const storage = {
  getItem: (key) => (memory.has(key) ? memory.get(key) : null),
  setItem: (key, value) => memory.set(key, String(value)),
  removeItem: (key) => memory.delete(key),
  clear: () => memory.clear(),
}
globalThis.sessionStorage = storage
globalThis.window = new EventTarget()

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const {
  CAPABILITY,
  CAPABILITY_STATUS,
  SERVER_CLASSIFICATION_ID,
  interpretProbeResponse,
  noteExtendedMetadata,
  resetCapabilities,
  resolveCapability,
} = await import('../src/api/capabilities.js')
const { mapFichada } = await import('../src/api/fichadas.js')
const { mapResumen } = await import('../src/api/jornadas.js')
const {
  CLASSIFICATION_SOURCE,
  applyClassificationDeclaration,
  clasificarSegunFuente,
  construirJornadasSegunFuente,
  resetClassificationSource,
} = await import('../src/utils/classification-source.js')
const { buildJornadas } = await import('../src/utils/jornadas.js')
const { fichadaDateKey } = await import('../src/utils/format.js')
const { duracionReloj, formatMinutosInformados } = await import('../src/utils/labor-format.js')
const { MAINTENANCE_MESSAGE, MAINTENANCE_TITLE } = await import('../src/components/maintenance-panel.js')
const {
  puedeAdministrarTurnos,
  puedeConsultarTurnos,
  puedeRegistrarFichadaManual,
  puedeVerAlertasJornada,
} = await import('../src/config/labor-access.js')
const { setEmpresaContexto } = await import('../src/api/empresa-context.js')
const { logout } = await import('../src/api/auth.js')
const { selectHorarioLaboralMode } = await import('../src/components/horario-laboral.js')
const { optionalMetadataColumns } = await import('../src/utils/fichadas-export.js')

let passed = 0
let failed = 0

function check(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => {
      passed += 1
      console.log(`ok - ${name}`)
    })
    .catch((error) => {
      failed += 1
      console.error(`not ok - ${name}`)
      console.error(error)
    })
}

function response(status, body, headers = {}) {
  return {
    response: {
      status,
      allow: headers.Allow ?? '',
      headers: { get: (name) => headers[name] ?? headers[name.toLowerCase()] ?? null },
      json: async () => body,
    },
  }
}

function router(routes) {
  const calls = []
  async function request(path, options = {}) {
    calls.push({ path, method: options.method || 'GET' })
    const key = `${options.method || 'GET'} ${path}`
    const found = routes[key] ?? routes[path]
    if (!found) throw Object.assign(new Error('sin ruta'), { status: 404 })
    if (found.throw) throw found.throw
    return found
  }
  request.calls = calls
  return request
}

function login(user) {
  memory.set('ca.auth.user', JSON.stringify(user))
}

await check('404 de turnos es mantenimiento, no error genérico', async () => {
  resetCapabilities()
  login({ rol: 'ADMIN', empresaId: 3 })
  const request = router({ 'GET /api/Turnos': response(404, null) })
  const result = await resolveCapability(CAPABILITY.turnosRead, { request })
  assert.equal(result.status, CAPABILITY_STATUS.unavailable)
  assert.equal(request.calls.every((call) => call.method === 'GET'), true)
})

await check('405 de jornadas es mantenimiento', async () => {
  resetCapabilities()
  login({ rol: 'ADMIN', empresaId: 3 })
  const request = router({
    'GET /api/Turnos': response(200, []),
    'GET /api/jornadas/empleados/9/calendario?desde=2000-01-01&hasta=2000-01-02': response(405, null),
  })
  const result = await resolveCapability(CAPABILITY.jornadasCalendar, {
    request,
    context: { empleadoId: 9 },
  })
  assert.equal(result.status, CAPABILITY_STATUS.unavailable)
  assert.equal(result.reason, 'method')
})

await check('turnos 200 vacío queda disponible', async () => {
  resetCapabilities()
  login({ rol: 'ADMIN', empresaId: 3 })
  const result = await resolveCapability(CAPABILITY.turnosRead, {
    request: router({ 'GET /api/Turnos': response(200, []) }),
  })
  assert.equal(result.status, CAPABILITY_STATUS.available)
})

await check('turnos 200 con datos y campos extra no rompe el cliente', async () => {
  resetCapabilities()
  login({ rol: 'ADMIN', empresaId: 3 })
  const result = await resolveCapability(CAPABILITY.turnosRead, {
    request: router({
      'GET /api/Turnos': response(200, [{ id: 1, nombre: 'Mañana', extra: true }]),
    }),
  })
  assert.equal(result.status, CAPABILITY_STATUS.available)
})

await check('contrato inválido degrada sin cachear éxito', async () => {
  resetCapabilities()
  login({ rol: 'ADMIN', empresaId: 3 })
  const request = router({ 'GET /api/Turnos': response(200, { id: 1 }) })
  const result = await resolveCapability(CAPABILITY.turnosRead, { request, force: true })
  assert.equal(result.status, CAPABILITY_STATUS.temporarilyUnavailable)
  assert.equal(result.reason, 'contract')
})

await check('401 es sesión y 403 es prohibido', async () => {
  assert.equal(interpretProbeResponse(response(401, null).response).status, CAPABILITY_STATUS.unauthorized)
  assert.equal(interpretProbeResponse(response(403, null).response).status, CAPABILITY_STATUS.forbidden)
})

await check('500 y red no son mantenimiento', async () => {
  resetCapabilities()
  login({ rol: 'ADMIN', empresaId: 3 })
  const server = await resolveCapability(CAPABILITY.turnosRead, {
    request: router({ 'GET /api/Turnos': response(503, null) }),
    force: true,
  })
  assert.equal(server.status, CAPABILITY_STATUS.temporarilyUnavailable)
  assert.equal(server.reason, 'server')
  const network = await resolveCapability(CAPABILITY.turnosRead, {
    request: router({ 'GET /api/Turnos': { throw: new Error('offline') } }),
    force: true,
  })
  assert.equal(network.status, CAPABILITY_STATUS.temporarilyUnavailable)
  assert.equal(network.reason, 'network')
})

await check('alertas y manual se detectan por GET', async () => {
  resetCapabilities()
  login({ rol: 'ADMIN', empresaId: 3 })
  const request = router({
    'GET /api/fichadas/alertas/incompletas?limite=1': response(200, []),
    'GET /api/FichadasManuales': response(405, null, { Allow: 'POST' }),
  })
  const alerts = await resolveCapability(CAPABILITY.fichadasIncompleteAlerts, { request })
  const manual = await resolveCapability(CAPABILITY.fichadasManual, { request })
  assert.equal(alerts.status, CAPABILITY_STATUS.available)
  assert.equal(manual.status, CAPABILITY_STATUS.available)
  assert.equal(request.calls.some((call) => call.method !== 'GET'), false)
})

await check('RRHH no recibe escritura de turnos ni fichada manual', async () => {
  resetCapabilities()
  login({ rol: 'RRHH', empresaId: 3 })
  const request = router({})
  const write = await resolveCapability(CAPABILITY.turnosWrite, { request })
  const manual = await resolveCapability(CAPABILITY.fichadasManual, { request })
  assert.equal(write.status, CAPABILITY_STATUS.forbidden)
  assert.equal(manual.status, CAPABILITY_STATUS.forbidden)
  assert.equal(request.calls.length, 0)
  assert.equal(puedeAdministrarTurnos({ rol: 'RRHH' }), false)
  assert.equal(puedeConsultarTurnos({ rol: 'RRHH' }), true)
  assert.equal(puedeRegistrarFichadaManual({ rol: 'RRHH' }), false)
  assert.equal(puedeVerAlertasJornada({ rol: 'RRHH' }), false)
})

await check('cambio de empresa y cierre de sesión invalidan la cache', async () => {
  resetCapabilities()
  login({ rol: 'SuperAdmin' })
  let turnos = 0
  const request = async (path) => {
    turnos += 1
    return response(200, [])
  }
  setEmpresaContexto({ id: 1, nombre: 'Uno' })
  await resolveCapability(CAPABILITY.turnosRead, { request })
  setEmpresaContexto({ id: 2, nombre: 'Dos' })
  await resolveCapability(CAPABILITY.turnosRead, { request })
  assert.equal(turnos, 2)
  await resolveCapability(CAPABILITY.turnosRead, { request })
  assert.equal(turnos, 2)
  logout()
  login({ rol: 'SuperAdmin' })
  setEmpresaContexto({ id: 2, nombre: 'Dos' })
  await resolveCapability(CAPABILITY.turnosRead, { request })
  assert.equal(turnos, 3)
})

await check('la misma petición en curso no se duplica', async () => {
  resetCapabilities()
  login({ rol: 'ADMIN', empresaId: 4 })
  let turnos = 0
  const request = async () => {
    turnos += 1
    await new Promise((resolve) => setTimeout(resolve, 20))
    return response(200, [])
  }
  await Promise.all([
    resolveCapability(CAPABILITY.turnosRead, { request }),
    resolveCapability(CAPABILITY.turnosRead, { request }),
  ])
  assert.equal(turnos, 1)
})

await check('metadatos nuevos se conservan y los ausentes no se afirman', () => {
  const legacy = mapFichada({ id: 1, tipo: 'Entrada', fechaHora: '2026-10-23T12:00:00', extra: 1 })
  assert.equal(legacy.tipo, 'Entrada')
  assert.equal(legacy.esManual, undefined)
  assert.equal(legacy.estado, undefined)
  assert.equal(legacy.minutosHastaCorte, undefined)
  const nuevo = mapFichada({
    id: 2,
    tipo: 'Salida',
    esManual: true,
    estado: 'Incompleto',
    minutosHastaCorte: 15,
    origen: 'nuevo',
  })
  assert.equal(nuevo.esManual, true)
  assert.equal(nuevo.estado, 'Incompleto')
  assert.equal(nuevo.minutosHastaCorte, 15)
  assert.equal(nuevo.tipo, 'Salida')
  const falso = mapFichada({ id: 3, tipo: 'Entrada', esManual: false, estado: null, minutosHastaCorte: null })
  assert.equal(falso.esManual, false)
  assert.equal(falso.estado, null)
  assert.equal(falso.minutosHastaCorte, null)
  assert.equal(noteExtendedMetadata([legacy]).status, CAPABILITY_STATUS.unavailable)
  assert.equal(noteExtendedMetadata([nuevo]).status, CAPABILITY_STATUS.available)
  const columns = optionalMetadataColumns('movimientos', [nuevo])
  assert.equal(columns.some((column) => column.id === 'esManual'), true)
  assert.equal(optionalMetadataColumns('movimientos', [legacy]).length, 0)
})

await check('sin declaración compatible la fuente sigue siendo frontend', () => {
  resetClassificationSource()
  const fichadas = [{ empleadoId: 1, fechaHora: '2026-10-23T12:00:00', tipo: 'Entrada', estado: 'Incompleto' }]
  assert.equal(applyClassificationDeclaration(null, fichadas), CLASSIFICATION_SOURCE.frontend)
  assert.equal(applyClassificationDeclaration('otra', fichadas), CLASSIFICATION_SOURCE.frontend)
  const viaFuente = construirJornadasSegunFuente(fichadas)
  const viaActual = buildJornadas(fichadas)
  assert.deepEqual(viaFuente, viaActual)
  assert.equal(clasificarSegunFuente(fichadas).every((item) => item.fuente !== 'api'), true)
})

await check('daily-first-last-v1 activa la fuente api y no la mezcla', () => {
  resetClassificationSource()
  const fichadas = [{
    empleadoId: 1,
    fechaHora: '2026-10-23T12:00:00',
    tipo: 'Salida',
    movimientoVisual: 'Entrada',
    jornadaEstado: 'Completa',
  }]
  assert.equal(applyClassificationDeclaration(SERVER_CLASSIFICATION_ID, fichadas), CLASSIFICATION_SOURCE.api)
  const jornadas = construirJornadasSegunFuente(fichadas)
  assert.equal(jornadas[0].fuente, CLASSIFICATION_SOURCE.api)
  assert.equal(jornadas[0].estado, 'Completa')
  assert.equal(jornadas[0].actividadRegistrada, '—')
  assert.equal(jornadas.every((item) => item.fuente === 'api'), true)
  resetClassificationSource()
  const front = construirJornadasSegunFuente(fichadas)
  assert.equal(front[0].fuente, undefined)
})

await check('actividad registrada y minutos trabajados quedan separados', () => {
  const exacta = mapResumen({
    minutosProgramados: 480,
    actividadRegistrada: 540,
    minutosTrabajados: 480,
    minutosRepuestos: 0,
    saldoMinutos: 0,
    dias: [{ fecha: '2026-10-23', actividadRegistrada: 540, minutosTrabajados: 480, minutosProgramados: 480 }],
  })
  assert.equal(exacta.actividadRegistrada, 540)
  assert.equal(exacta.minutosTrabajados, 480)
  assert.equal(exacta.dias[0].actividadRegistrada, 540)
  assert.equal(exacta.dias[0].minutosTrabajados, 480)
  assert.notEqual(exacta.actividadRegistrada, exacta.minutosTrabajados)
  const tarde = mapResumen({
    actividadRegistrada: 530,
    minutosTrabajados: 470,
    minutosProgramados: 480,
    dias: [{ fecha: '2026-10-24', actividadRegistrada: 530, minutosTrabajados: 470 }],
  })
  assert.equal(tarde.actividadRegistrada, 530)
  assert.equal(tarde.minutosTrabajados, 470)
  assert.equal(tarde.dias[0].actividadRegistrada, 530)
  const cero = mapResumen({ actividadRegistrada: 0, minutosTrabajados: 0, minutosRepuestos: 0, saldoMinutos: 0 })
  assert.equal(cero.actividadRegistrada, 0)
  assert.equal(cero.minutosTrabajados, 0)
  assert.equal(formatMinutosInformados(0), '0 min')
  const vieja = mapResumen({ minutosProgramados: 480, minutosTrabajados: 480, minutosRepuestos: 0, saldoMinutos: 0 })
  assert.equal(vieja.actividadRegistrada, null)
  assert.equal(vieja.minutosTrabajados, 480)
  assert.equal(formatMinutosInformados(vieja.actividadRegistrada), null)
  assert.equal(formatMinutosInformados(540), '9 h')
  assert.equal(formatMinutosInformados(480), '8 h')
  assert.equal(formatMinutosInformados(530), '8 h 50 min')
  assert.equal(formatMinutosInformados(470), '7 h 50 min')
})

await check('la fuente api no recalcula la actividad y la fuente frontend no usa la de la api', () => {
  resetClassificationSource()
  const tramo = [
    {
      empleadoId: 1,
      fechaHora: '2026-10-23T08:00:00',
      movimientoVisual: 'Entrada',
      jornadaEstado: 'Completa',
      jornadaFecha: '2026-10-23',
    },
    {
      empleadoId: 1,
      fechaHora: '2026-10-23T17:00:00',
      movimientoVisual: 'Salida',
      jornadaEstado: 'Completa',
      jornadaFecha: '2026-10-23',
      actividadRegistrada: 100,
    },
  ]
  assert.equal(applyClassificationDeclaration(SERVER_CLASSIFICATION_ID, tramo), CLASSIFICATION_SOURCE.api)
  const desdeApi = construirJornadasSegunFuente(tramo)
  assert.equal(desdeApi[0].fuente, 'api')
  assert.equal(desdeApi[0].actividadRegistrada, '1 h 40 min')
  const sinValor = tramo.map((item) => {
    const copia = { ...item }
    delete copia.actividadRegistrada
    return copia
  })
  assert.equal(construirJornadasSegunFuente(sinValor)[0].actividadRegistrada, '—')
  resetClassificationSource()
  assert.equal(classificationStillFrontend(tramo), true)
})

function classificationStillFrontend(fichadas) {
  const local = buildJornadas(fichadas)
  const viaFuente = construirJornadasSegunFuente(fichadas)
  return viaFuente[0].fuente !== 'api' && viaFuente[0].actividadRegistrada === local[0].actividadRegistrada
}

await check('la fecha laboral no depende de UTC', () => {
  assert.equal(fichadaDateKey('2026-10-24T02:30:00Z'), '2026-10-23')
  assert.equal(fichadaDateKey('2026-10-23T15:00:00Z'), '2026-10-23')
  assert.equal(formatMinutosInformados(90), '1 h 30 min')
  assert.equal(duracionReloj('22:00', '06:00'), null)
  assert.equal(duracionReloj('09:00', '18:00'), '9 h')
})

await check('textos de mantenimiento y horario único', () => {
  assert.equal(MAINTENANCE_TITLE, 'Funcionalidad aún en mantenimiento')
  assert.equal(MAINTENANCE_MESSAGE, 'Esta sección se habilitará automáticamente cuando la API esté disponible.')
  assert.equal(selectHorarioLaboralMode('available', 'available'), 'turno')
  assert.equal(selectHorarioLaboralMode('unavailable', 'unavailable'), 'legacy')
  const source = readFileSync(join(root, 'src/api/capabilities.js'), 'utf8')
  assert.equal(source.includes("method: 'POST'"), false)
  assert.equal(source.includes("method: 'PUT'"), false)
  assert.equal(source.includes("method: 'PATCH'"), false)
  assert.equal(source.includes("method: 'DELETE'"), false)
  const tree = readFileSync(join(root, 'src/views/fichadas.js'), 'utf8')
    + readFileSync(join(root, 'src/api/fichadas-manuales.js'), 'utf8')
  assert.equal(tree.includes('/api/fichadas/biometricas'), false)
  assert.equal(tree.includes('/api/fichadas/bulk'), false)
  assert.equal(readFileSync(join(root, 'src/views/administracion.js'), 'utf8').includes('Turnos de trabajo'), true)
  assert.equal(readFileSync(join(root, 'src/views/fichadas.js'), 'utf8').includes('Calendario de jornadas'), true)
  assert.equal(readFileSync(join(root, 'src/views/dashboard.js'), 'utf8').includes('loadJornadasIncompletas'), true)
  assert.equal(readFileSync(join(root, 'src/views/dashboard.js'), 'utf8').includes('createJornadasPendientesIndicator'), false)
  const calendario = readFileSync(join(root, 'src/components/jornadas-calendar-panel.js'), 'utf8')
    + readFileSync(join(root, 'src/utils/labor-format.js'), 'utf8')
  assert.equal(calendario.includes('Actividad informada'), false)
  assert.equal(calendario.includes('Actividad registrada'), true)
  assert.equal(calendario.includes('Minutos trabajados'), true)
})

if (failed > 0) {
  console.error(`${failed} check(s) failed`)
  process.exit(1)
}
console.log(`${passed} capacidades checks passed`)
