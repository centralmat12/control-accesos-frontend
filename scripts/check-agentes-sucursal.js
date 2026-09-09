import { resetBrowserGlobals } from './browser-globals.js'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  AGENTE_API_PATHS,
  AGENTE_CLIENT_ID_MAX,
  AGENTE_CREAR_FIELDS,
  AGENTE_DESACTIVAR_CONFIRM,
  AGENTE_DESACTIVAR_MESSAGE,
  AGENTE_DESACTIVAR_TITLE,
  AGENTE_ROTAR_CONFIRM,
  AGENTE_ROTAR_MESSAGE,
  AGENTE_ROTAR_TITLE,
  AGENTE_SECRET_ACK_LABEL,
  AGENTE_SECRET_COPIED,
  AGENTE_SECRET_MODAL,
  AGENTE_SECRET_ONCE_WARNING,
  buildAgenteCrearDto,
  createAgente,
  discardAgenteSecret,
  filterAgentesBySucursal,
  getAgentes,
  getLoadedAgenteClientIds,
  mapAgente,
  rotarSecretAgente,
  secretLeakedToStorage,
  slugifyClientIdPart,
  suggestClientId,
  validateAgenteAlta,
} from '../src/api/agentes.js'
import { setEmpresaContexto } from '../src/api/empresa-context.js'
import { updateSucursal } from '../src/api/sucursales.js'
import {
  puedeAdministrarAgentes,
  puedeCrearAgentes,
  puedeDesactivarAgente,
  puedeEditarSucursales,
  puedeRotarSecretAgente,
} from '../src/config/administracion.js'
import { getActivityLogs } from '../src/utils/activity-log.js'

const SESSION_TOKEN = 'session-jwt'
const ONE_TIME_SECRET = 'one-time-agent-secret-value'
let passed = 0
let failed = 0
const fetchCalls = []

function superadmin() {
  return { nombre: 'SA', email: 'sa@example.com', rol: 'SuperAdmin' }
}

function admin(empresaId = 9) {
  return { nombre: 'Admin', email: 'admin@example.com', rol: 'ADMIN', empresaId }
}

function rrhh(empresaId = 9) {
  return { nombre: 'Rrhh', email: 'rrhh@example.com', rol: 'RRHH', empresaId }
}

function writeSession(user, token = SESSION_TOKEN) {
  sessionStorage.setItem('ca.auth.user', JSON.stringify(user))
  sessionStorage.setItem('ca.auth.token', token)
}

function jsonResponse(status, payload) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
    text: async () => JSON.stringify(payload ?? {}),
  }
}

function installFetch(handler) {
  fetchCalls.length = 0
  globalThis.fetch = async (url, options = {}) => {
    fetchCalls.push({ url, options })
    return handler({ url, options, count: fetchCalls.length })
  }
}

function readSrc(relativePath) {
  return readFileSync(join(dirname(fileURLToPath(import.meta.url)), relativePath), 'utf8')
}

async function check(name, fn) {
  resetBrowserGlobals()
  fetchCalls.length = 0
  try {
    await fn()
    passed += 1
    console.log(`ok - ${name}`)
  } catch (error) {
    failed += 1
    console.error(`not ok - ${name}`)
    console.error(error)
  }
}

await check('1. El listado filtra por empresa y sucursal de contexto', async () => {
  writeSession(superadmin())
  installFetch(async () =>
    jsonResponse(200, [
      {
        id: 1,
        empresaId: 4,
        sucursalId: 12,
        clientId: 'terminal_sede_central',
        nombre: 'Recepción',
        activo: true,
        clientSecret: ONE_TIME_SECRET,
      },
      {
        id: 2,
        empresaId: 4,
        sucursalId: 99,
        clientId: 'terminal_otra',
        nombre: 'Otra',
        activo: true,
      },
      {
        id: 3,
        empresaId: 8,
        sucursalId: 12,
        clientId: 'terminal_otra_empresa',
        nombre: 'Ajena',
        activo: true,
      },
    ]),
  )

  const agentes = await getAgentes({ sucursalId: 12, empresaId: 4 })
  assert.equal(agentes.length, 1)
  assert.equal(agentes[0].id, 1)
  assert.equal(agentes[0].sucursalId, 12)
  assert.equal(agentes[0].empresaId, 4)
  assert.match(String(fetchCalls[0].url), /\/api\/agentes$/)
  assert.equal(String(fetchCalls[0].url).includes('sucursalId='), false)
})

await check('2. SuperAdmin envía X-Empresa-Id en alta y listado', async () => {
  writeSession(superadmin())
  setEmpresaContexto({ id: 1, nombre: 'Contexto distinto' })
  installFetch(async ({ url }) => {
    if (String(url).includes('/api/agentes') && !String(url).match(/agentes\/\d/)) {
      return jsonResponse(201, {
        id: 7,
        empresaId: 4,
        sucursalId: 12,
        clientId: 'terminal_sede_central',
        clientSecret: ONE_TIME_SECRET,
      })
    }
    return jsonResponse(200, [])
  })

  await createAgente({
    sucursalId: 12,
    empresaId: 4,
    nombre: 'Recepción',
    clientId: 'terminal_sede_central',
  })
  assert.equal(fetchCalls[0].options.headers['X-Empresa-Id'], '4')
  assert.equal(JSON.parse(fetchCalls[0].options.body).sucursalId, 12)

  fetchCalls.length = 0
  installFetch(async () => jsonResponse(200, []))
  await getAgentes({ sucursalId: 12, empresaId: 4 })
  assert.equal(fetchCalls[0].options.headers['X-Empresa-Id'], '4')
})

await check('3. ADMIN no administra agentes ni cambia de tenant', async () => {
  writeSession(admin(9))
  setEmpresaContexto({ id: 2, nombre: 'No debe usarse' })
  installFetch(async () => jsonResponse(201, { id: 1, sucursalId: 12, clientId: 'x', clientSecret: ONE_TIME_SECRET }))

  assert.equal(puedeAdministrarAgentes(admin(9), 9), false)
  assert.equal(puedeCrearAgentes(admin(9), 9), false)
  await assert.rejects(() => createAgente({ sucursalId: 12, empresaId: 9, nombre: 'T', clientId: 'terminal_a' }), (error) => {
    assert.equal(error.status, 403)
    return true
  })
  assert.equal(fetchCalls.length, 0)

  await assert.rejects(() => getAgentes({ sucursalId: 12, empresaId: 4 }), (error) => {
    assert.equal(error.status, 403)
    return true
  })
  assert.equal(fetchCalls.length, 0)
})

await check('4. sucursalId sale del contexto, no de texto libre', async () => {
  writeSession(superadmin())
  installFetch(async () =>
    jsonResponse(201, {
      id: 7,
      empresaId: 4,
      sucursalId: 12,
      clientId: 'terminal_sede_central',
      clientSecret: ONE_TIME_SECRET,
    }),
  )

  const dto = buildAgenteCrearDto({
    sucursalId: 12,
    clientId: 'terminal_sede_central',
    nombre: 'Recepción',
  })
  assert.deepEqual(Object.keys(dto).sort(), [...AGENTE_CREAR_FIELDS].sort())
  assert.equal(dto.sucursalId, 12)

  await createAgente({
    sucursalId: 12,
    empresaId: 4,
    nombre: 'Recepción',
    clientId: 'terminal_sede_central',
  })
  const body = JSON.parse(fetchCalls[0].options.body)
  assert.equal(body.sucursalId, 12)
  assert.equal(body.empresaId, undefined)
  assert.equal(typeof body.sucursalId, 'number')
})

await check('5. Un clic doble genera un solo POST simulado', async () => {
  writeSession(superadmin())
  let started = 0
  let release
  const gate = new Promise((resolve) => {
    release = resolve
  })

  installFetch(async () => {
    started += 1
    await gate
    return jsonResponse(201, {
      id: 7,
      empresaId: 4,
      sucursalId: 12,
      clientId: 'terminal_sede_central',
      clientSecret: ONE_TIME_SECRET,
    })
  })

  const dto = {
    sucursalId: 12,
    empresaId: 4,
    nombre: 'Recepción',
    clientId: 'terminal_sede_central',
  }
  const first = createAgente(dto)
  const second = createAgente(dto)
  release()
  await Promise.all([first, second])
  assert.equal(fetchCalls.length, 1)
  assert.equal(started, 1)
  assert.equal(String(fetchCalls[0].options.method).toUpperCase(), 'POST')
})

await check('6. El secret devuelto no reemplaza el JWT de sesión', async () => {
  writeSession(superadmin(), SESSION_TOKEN)
  installFetch(async () =>
    jsonResponse(201, {
      id: 7,
      empresaId: 4,
      sucursalId: 12,
      clientId: 'terminal_sede_central',
      clientSecret: ONE_TIME_SECRET,
      token: 'agent-jwt-should-not-be-used',
    }),
  )

  const created = await createAgente({
    sucursalId: 12,
    empresaId: 4,
    nombre: 'Recepción',
    clientId: 'terminal_sede_central',
  })
  assert.equal(sessionStorage.getItem('ca.auth.token'), SESSION_TOKEN)
  assert.notEqual(sessionStorage.getItem('ca.auth.token'), created.clientSecret)
  assert.notEqual(sessionStorage.getItem('ca.auth.token'), 'agent-jwt-should-not-be-used')
})

await check('7. El secret no se guarda en storage', async () => {
  writeSession(superadmin(), SESSION_TOKEN)
  installFetch(async () =>
    jsonResponse(201, {
      id: 7,
      empresaId: 4,
      sucursalId: 12,
      clientId: 'terminal_sede_central',
      clientSecret: ONE_TIME_SECRET,
    }),
  )

  await createAgente({
    sucursalId: 12,
    empresaId: 4,
    nombre: 'Recepción',
    clientId: 'terminal_sede_central',
  })
  assert.equal(secretLeakedToStorage(ONE_TIME_SECRET), false)
  assert.equal(sessionStorage.getItem('ca.auth.token'), SESSION_TOKEN)
  assert.equal(String(sessionStorage.getItem('ca.auth.user') ?? '').includes(ONE_TIME_SECRET), false)
})

await check('8. El secret desaparece al cerrar', () => {
  const payload = { clientId: 'terminal_sede_central', clientSecret: ONE_TIME_SECRET }
  discardAgenteSecret(payload)
  assert.equal(payload.clientSecret, undefined)
  assert.equal(payload.ClientSecret, undefined)
  assert.match(readSrc('../src/views/administracion.js'), /discardAgenteSecret/)
  assert.match(readSrc('../src/components/agente-secret-panel.js'), /discard\(\)/)
  assert.match(readSrc('../src/views/administracion.js'), /onClose: \(\) => \{[\s\S]*discardAgenteSecret/)
})

await check('9. El listado no muestra clientSecret', async () => {
  writeSession(superadmin())
  installFetch(async () =>
    jsonResponse(200, [
      {
        id: 1,
        empresaId: 4,
        sucursalId: 12,
        clientId: 'terminal_sede_central',
        nombre: 'Recepción',
        activo: true,
        clientSecret: ONE_TIME_SECRET,
        ClientSecret: ONE_TIME_SECRET,
      },
    ]),
  )

  const mapped = mapAgente({
    id: 1,
    sucursalId: 12,
    clientId: 'terminal_sede_central',
    nombre: 'Recepción',
    activo: true,
    clientSecret: ONE_TIME_SECRET,
  })
  assert.equal(Object.hasOwn(mapped, 'clientSecret'), false)
  assert.equal(JSON.stringify(mapped).includes(ONE_TIME_SECRET), false)

  const agentes = await getAgentes({ sucursalId: 12, empresaId: 4 })
  assert.equal(Object.hasOwn(agentes[0], 'clientSecret'), false)
  assert.equal(JSON.stringify(agentes).includes(ONE_TIME_SECRET), false)

  const adminSrc = readSrc('../src/views/administracion.js')
  assert.equal(adminSrc.includes('agente.clientSecret'), false)
  assert.match(adminSrc, /displayValue\(agente\.clientId\)/)
})

await check('10. Editar sucursal no crea un agente', async () => {
  writeSession(superadmin())
  installFetch(async () => ({
    ok: false,
    status: 204,
    json: async () => ({}),
    text: async () => '',
  }))

  await updateSucursal({
    id: 12,
    nombre: 'Sede Central',
    empresaId: 4,
    serialLector: 'SN-001',
  })
  assert.equal(fetchCalls.length, 1)
  assert.match(String(fetchCalls[0].url), /\/api\/sucursales\/12$/)
  assert.equal(String(fetchCalls[0].options.method).toUpperCase(), 'PUT')
  assert.equal(String(fetchCalls[0].url).includes('/api/agentes'), false)

  const sucursalForm = readSrc('../src/components/sucursal-form.js')
  assert.equal(sucursalForm.includes('clientId'), false)
  assert.equal(sucursalForm.includes('clientSecret'), false)
  assert.match(sucursalForm, /serialLector/)

  const adminSrc = readSrc('../src/views/administracion.js')
  assert.match(adminSrc, /Editar sucursal/)
  assert.match(adminSrc, /Administrar agentes/)
  assert.match(adminSrc, /updateSucursal/)
})

await check('11. Los roles no autorizados no ven acciones de agentes', () => {
  assert.equal(puedeAdministrarAgentes(admin(9), 9), false)
  assert.equal(puedeCrearAgentes(admin(9), 9), false)
  assert.equal(puedeRotarSecretAgente(admin(9), 9), false)
  assert.equal(puedeDesactivarAgente(admin(9), 9), false)
  assert.equal(puedeEditarSucursales(admin(9), 9), true)
  assert.equal(puedeAdministrarAgentes(rrhh(9), 9), false)
  assert.equal(puedeAdministrarAgentes(superadmin(), 4), true)
  assert.equal(puedeCrearAgentes(superadmin(), 4), true)
  assert.equal(puedeEditarSucursales(rrhh(9), 9), false)
})

await check('12. No existen llamadas a endpoints inventados', () => {
  const files = [
    '../src/api/agentes.js',
    '../src/views/administracion.js',
    '../src/components/agente-form.js',
    '../src/components/agente-secret-panel.js',
  ].map(readSrc)
  const joined = files.join('\n')
  const invented = [
    '/api/agentes/sucursal',
    '/activar',
    '/revoke',
    '/revocar',
    '/download',
    '/configuracion',
    '/config.json',
    '/api/Auth/agente',
    '/heartbeat',
  ]
  invented.forEach((path) => {
    assert.equal(joined.includes(path), false, path)
  })
  assert.match(joined, /\/api\/agentes/)
  assert.match(joined, /rotar-secret/)
  assert.match(joined, /desactivar/)
  assert.equal(AGENTE_API_PATHS.listar, '/api/agentes')
  assert.equal(AGENTE_API_PATHS.crear, '/api/agentes')
  assert.equal(AGENTE_API_PATHS.rotarSecret(3), '/api/agentes/3/rotar-secret')
  assert.equal(AGENTE_API_PATHS.desactivar(3), '/api/agentes/3/desactivar')
})

await check('Sugerencias distintas por empresa, sucursal y nombre', () => {
  const devs = suggestClientId({
    empresaNombre: 'Devs',
    sucursalNombre: 'Sede Central',
    agenteNombre: 'Recepción',
  })
  const acme = suggestClientId({
    empresaNombre: 'Acme',
    sucursalNombre: 'Sede Central',
    agenteNombre: 'Recepción',
  })
  assert.equal(devs, 'terminal_devs_sede_central_recepcion')
  assert.equal(acme, 'terminal_acme_sede_central_recepcion')
  assert.notEqual(devs, acme)

  const first = suggestClientId({
    empresaNombre: 'Devs',
    sucursalNombre: 'Sede Central',
  })
  assert.equal(first, 'terminal_devs_sede_central')
  const second = suggestClientId(
    { empresaNombre: 'Devs', sucursalNombre: 'Sede Central' },
    ['terminal_devs_sede_central'],
  )
  assert.equal(second, 'terminal_devs_sede_central_2')
  const withName = suggestClientId({
    empresaNombre: 'Devs',
    sucursalNombre: 'Sede Central',
    agenteNombre: 'Recepción',
    existingClientIds: ['terminal_devs_sede_central'],
  })
  assert.equal(withName, 'terminal_devs_sede_central_recepcion')

  const longEmpresa = 'Empresa '.repeat(40)
  const long = suggestClientId({
    empresaNombre: longEmpresa,
    sucursalNombre: 'Sede Central muy larga para forzar recorte',
    agenteNombre: 'Recepción principal planta baja',
  })
  assert.ok(long.length <= AGENTE_CLIENT_ID_MAX)
  assert.equal(/^[-_]|[-_]$/.test(long), false)
  assert.equal(/__/.test(long), false)
  assert.equal(/^[a-z0-9]+(?:[_-][a-z0-9]+)*$/.test(long), true)

  assert.equal(slugifyClientIdPart('Recepción'), 'recepcion')
  const errors = validateAgenteAlta({ nombre: '', clientId: '' })
  assert.equal(Boolean(errors.nombre), true)
  assert.equal(Boolean(errors.clientId), true)
})

await check('Advertencia de secreto de un solo uso', () => {
  assert.equal(
    AGENTE_SECRET_ONCE_WARNING,
    'Este secreto se muestra una sola vez. Guardalo antes de continuar.',
  )
  assert.equal(AGENTE_SECRET_ACK_LABEL, 'Ya guardé el secreto')
  assert.equal(AGENTE_SECRET_COPIED, 'Secreto copiado')
  assert.match(readSrc('../src/components/agente-secret-panel.js'), /AGENTE_SECRET_ONCE_WARNING/)
  assert.match(readSrc('../src/components/agente-secret-panel.js'), /AGENTE_SECRET_ACK_LABEL/)
  assert.match(readSrc('../src/components/agente-secret-panel.js'), /AGENTE_SECRET_COPIED/)
})

await check('Filtro de sucursal no mezcla empresas', () => {
  const filtered = filterAgentesBySucursal(
    [
      { id: 1, sucursalId: 12, empresaId: 4 },
      { id: 2, sucursalId: 12, empresaId: 8 },
    ],
    { sucursalId: 12, empresaId: 4 },
  )
  assert.equal(filtered.length, 1)
  assert.equal(filtered[0].id, 1)
})

await check('El secreto no se pierde con backdrop, Escape o X', () => {
  assert.equal(AGENTE_SECRET_MODAL.closeOnBackdrop, false)
  assert.equal(AGENTE_SECRET_MODAL.closeOnEscape, false)
  assert.equal(AGENTE_SECRET_MODAL.hideCloseButton, true)
  const adminSrc = readSrc('../src/views/administracion.js')
  const secretSrc = readSrc('../src/components/agente-secret-panel.js')
  const modalSrc = readSrc('../src/components/modal.js')
  assert.match(adminSrc, /AGENTE_SECRET_MODAL/)
  assert.match(adminSrc, /\.\.\.AGENTE_SECRET_MODAL/)
  assert.match(modalSrc, /hideCloseButton/)
  assert.equal(secretSrc.includes('data-action="close"'), false)
  assert.equal(secretSrc.includes('aria-label="Cerrar"'), false)
  assert.equal(secretSrc.includes('>Cerrar<'), false)
  assert.match(secretSrc, /AGENTE_SECRET_ACK_LABEL/)
  assert.equal(secretSrc.includes('data-action="ack"'), true)
  assert.match(modalSrc, /if \(hideCloseButton\)/)
})

await check('El secreto se elimina al confirmar el cierre', () => {
  const payload = { clientId: 'terminal_devs_sede_central', clientSecret: ONE_TIME_SECRET }
  discardAgenteSecret(payload)
  assert.equal(payload.clientSecret, undefined)
  const secretSrc = readSrc('../src/components/agente-secret-panel.js')
  assert.match(secretSrc, /data-action="ack"/)
  assert.match(secretSrc, /discard\(\)/)
  assert.match(readSrc('../src/views/administracion.js'), /panelSecret\.discard\(\)/)
})

await check('Rotar muestra la advertencia y evita doble envío', async () => {
  assert.equal(AGENTE_ROTAR_TITLE, '¿Rotar el secreto del agente?')
  assert.equal(
    AGENTE_ROTAR_MESSAGE,
    'El secreto anterior dejará de funcionar inmediatamente. El agente instalado no podrá autenticarse hasta que configures el nuevo secreto.',
  )
  assert.equal(AGENTE_ROTAR_CONFIRM, 'Rotar secreto')
  const adminSrc = readSrc('../src/views/administracion.js')
  assert.match(adminSrc, /AGENTE_ROTAR_TITLE/)
  assert.match(adminSrc, /AGENTE_ROTAR_MESSAGE/)
  assert.match(adminSrc, /AGENTE_ROTAR_CONFIRM/)
  assert.match(adminSrc, /cancelLabel: 'Cancelar'/)

  writeSession(superadmin())
  let started = 0
  let release
  const gate = new Promise((resolve) => {
    release = resolve
  })
  installFetch(async () => {
    started += 1
    await gate
    return jsonResponse(200, {
      id: 7,
      empresaId: 4,
      sucursalId: 12,
      clientId: 'terminal_devs_sede_central',
      clientSecret: ONE_TIME_SECRET,
    })
  })
  const first = rotarSecretAgente({ id: 7, empresaId: 4 })
  const second = rotarSecretAgente({ id: 7, empresaId: 4 })
  release()
  await Promise.all([first, second])
  assert.equal(started, 1)
  assert.equal(fetchCalls.length, 1)
})

await check('Desactivar muestra la advertencia y no se ofrece si ya está inactivo', () => {
  assert.equal(AGENTE_DESACTIVAR_TITLE, '¿Desactivar este agente?')
  assert.equal(
    AGENTE_DESACTIVAR_MESSAGE,
    'El agente dejará de autenticarse y de enviar información. Actualmente la API no permite reactivarlo desde el panel.',
  )
  assert.equal(AGENTE_DESACTIVAR_CONFIRM, 'Desactivar agente')
  const adminSrc = readSrc('../src/views/administracion.js')
  assert.match(adminSrc, /AGENTE_DESACTIVAR_TITLE/)
  assert.match(adminSrc, /AGENTE_DESACTIVAR_MESSAGE/)
  assert.match(adminSrc, /AGENTE_DESACTIVAR_CONFIRM/)
  assert.match(adminSrc, /canDeactivate && agente\.activo/)
})

await check('Ningún secreto aparece en logs, bitácora, toast ni URL', async () => {
  writeSession(superadmin(), SESSION_TOKEN)
  installFetch(async () =>
    jsonResponse(201, {
      id: 7,
      empresaId: 4,
      sucursalId: 12,
      clientId: 'terminal_devs_sede_central',
      clientSecret: ONE_TIME_SECRET,
    }),
  )
  await createAgente({
    sucursalId: 12,
    empresaId: 4,
    nombre: 'Recepción',
    clientId: 'terminal_devs_sede_central',
  })
  const logs = getActivityLogs()
  const serialized = JSON.stringify(logs)
  assert.equal(serialized.includes(ONE_TIME_SECRET), false)
  assert.equal(secretLeakedToStorage(ONE_TIME_SECRET), false)
  assert.equal(String(fetchCalls[0].url).includes(ONE_TIME_SECRET), false)
  const adminSrc = readSrc('../src/views/administracion.js')
  const secretSrc = readSrc('../src/components/agente-secret-panel.js')
  const toasts = [...adminSrc.matchAll(/showToast\(\{[\s\S]*?\}\)/g)].map((match) => match[0])
  assert.ok(toasts.length > 0)
  toasts.forEach((toast) => {
    assert.equal(toast.includes('clientSecret'), false)
    assert.equal(toast.includes(ONE_TIME_SECRET), false)
  })
  assert.match(secretSrc, /showToast\(\{ message: AGENTE_SECRET_COPIED/)
})

await check('No se hacen llamadas reales', async () => {
  writeSession(superadmin())
  const realFetch = globalThis.fetch
  let called = 0
  globalThis.fetch = async (url, options) => {
    called += 1
    fetchCalls.push({ url, options })
    return jsonResponse(200, [])
  }
  try {
    await getAgentes({ sucursalId: 12, empresaId: 4 })
  } finally {
    globalThis.fetch = realFetch
  }
  assert.equal(called, 1)
  assert.equal(String(fetchCalls[0].url).startsWith('http://') || String(fetchCalls[0].url).startsWith('https://'), false)
})

await check('El listado cargado conserva clientId globales para la sugerencia', async () => {
  writeSession(superadmin())
  installFetch(async () =>
    jsonResponse(200, [
      { id: 1, empresaId: 4, sucursalId: 12, clientId: 'terminal_devs_sede_central', nombre: 'A', activo: true },
      { id: 2, empresaId: 8, sucursalId: 99, clientId: 'terminal_acme_sede_central', nombre: 'B', activo: true },
    ]),
  )
  await getAgentes({ sucursalId: 12, empresaId: 4 })
  const loaded = getLoadedAgenteClientIds()
  assert.deepEqual(loaded.sort(), ['terminal_acme_sede_central', 'terminal_devs_sede_central'])
})

console.log(`${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
