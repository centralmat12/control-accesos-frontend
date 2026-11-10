import assert from 'node:assert/strict'
import { resetBrowserGlobals } from './browser-globals.js'
import { crearSesionCoordinada, decidirReintento, ESTADO_SESION_KEY } from '../src/api/sesion-coordinada.js'

function jwt(payload) {
  const cuerpo = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `eyJhbGciOiJub25lIn0.${cuerpo}.firma`
}

function identificar(token) {
  const cuerpo = token.split('.')[1]
  const json = JSON.parse(Buffer.from(cuerpo, 'base64url').toString('utf8'))
  return { usuarioId: Number(json.nameid), sid: json.sid || null }
}

function memoria() {
  const datos = new Map()
  return {
    getItem: (clave) => (datos.has(clave) ? datos.get(clave) : null),
    setItem: (clave, valor) => datos.set(clave, String(valor)),
    removeItem: (clave) => datos.delete(clave),
  }
}

function mutex() {
  let cola = Promise.resolve()
  return {
    async exclusivo(_nombre, fn) {
      const anterior = cola
      let liberar
      cola = new Promise((resolve) => { liberar = resolve })
      await anterior
      try {
        return await fn()
      } finally {
        liberar()
      }
    },
  }
}

function laboratorio() {
  const local = memoria()
  const sesiones = [memoria(), memoria()]
  const oidores = new Set()
  const canal = {
    publicar(mensaje) {
      for (const fn of [...oidores]) fn(structuredClone(mensaje))
    },
    suscribir(fn) {
      oidores.add(fn)
      return () => oidores.delete(fn)
    },
  }
  const locks = mutex()
  const llamadas = []
  const control = { falloRed: false, refreshStatus: 0 }
  function coordinar(indice) {
    return crearSesionCoordinada({
      local,
      locks,
      canal,
      esperaRevisionMs: 30,
      timeoutMs: 50,
      uuid: () => crypto.randomUUID(),
      identificar,
      guardarAccess: (token) => sesiones[indice].setItem('ca.auth.token', token),
      leerAccess: () => sesiones[indice].getItem('ca.auth.token'),
      limpiarAccess: () => sesiones[indice].removeItem('ca.auth.token'),
      urlLogin: '/api/Auth/Login',
      urlRefresh: '/api/Auth/refresh',
      urlCierre: '/api/Auth/cerrar-sesion',
      fetch: async (url, init) => {
        llamadas.push({ url, generacion: init.headers['X-CF-Generacion'] })
        if (url.endsWith('/Login')) {
          const generacion = init.headers['X-CF-Generacion']
          const token = jwt({ nameid: 21, sid: generacion })
          return { ok: true, status: 200, json: async () => ({ token, mensaje: 'Autenticación exitosa', requiereCambioPassword: false }) }
        }
        if (url.endsWith('/refresh')) {
          if (control.falloRed) return null
          if (control.refreshStatus) {
            return { ok: control.refreshStatus === 200, status: control.refreshStatus, json: async () => ({}) }
          }
          const generacion = init.headers['X-CF-Generacion']
          const token = jwt({ nameid: 21, sid: generacion })
          return { ok: true, status: 200, json: async () => ({ token }) }
        }
        return { ok: true, status: 204, json: async () => ({}) }
      },
    })
  }
  return { local, sesiones, llamadas, control, a: coordinar(0), b: coordinar(1) }
}

let passed = 0
function check(nombre, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => {
      passed += 1
      console.log(`ok - ${nombre}`)
    })
    .catch((error) => {
      console.error(`not ok - ${nombre}`)
      console.error(error)
      process.exitCode = 1
    })
}

await check('dos pestañas adoptan una sola renovación', async () => {
  const lab = laboratorio()
  const ingreso = await lab.a.iniciar({ email: 'etapa6a.sesion@local.test', password: 'x' })
  assert.equal(ingreso.modo, 'renovable')
  assert.equal(ingreso.estado.revision, 1)
  const antes = lab.llamadas.filter((item) => item.url.endsWith('/refresh')).length
  const renovada = await lab.a.renovar()
  assert.equal(renovada.codigo, 'renovado')
  assert.equal(renovada.estado.revision, 2)
  const adoptada = await lab.b.renovar()
  assert.equal(adoptada.codigo, 'adoptado')
  assert.equal(lab.llamadas.filter((item) => item.url.endsWith('/refresh')).length, antes + 1)
  assert.equal(localIncluyeToken(lab.local), false)
})

await check('si el canal no responde no hay otro refresh', async () => {
  const lab = laboratorio()
  await lab.a.iniciar({ email: 'a@local.test', password: 'x' })
  await lab.a.renovar()
  lab.b.asegurarEscucha = undefined
  const oidores = []
  const original = lab.b
  const aislada = crearAislada(lab, original)
  const resultado = await aislada.renovar()
  assert.equal(resultado.codigo, 'incierta')
  assert.equal(lab.llamadas.filter((item) => item.url.endsWith('/refresh')).length, 1)
  assert.ok(oidores.length === 0)
  const otra = await lab.a.renovar()
  assert.notEqual(otra.codigo, 'renovado')
})

await check('respuesta perdida deja el marcador y el login nuevo no se cierra', async () => {
  const lab = laboratorio()
  const ingreso = await lab.a.iniciar({ email: 'a@local.test', password: 'x' })
  lab.control.falloRed = true
  const perdida = await lab.a.renovar()
  assert.equal(perdida.codigo, 'red')
  assert.equal(lab.local.getItem(ESTADO_SESION_KEY).includes('"fase":"incierta"'), true)
  lab.control.falloRed = false
  const nueva = await lab.b.iniciar({ email: 'a@local.test', password: 'x' })
  assert.equal(nueva.modo, 'renovable')
  assert.notEqual(nueva.estado.generacion, ingreso.estado.generacion)
  assert.equal(nueva.estado.fase, 'habilitada')
  const cierreViejo = await lab.a.cerrar({ generacion: ingreso.estado.generacion })
  assert.equal(cierreViejo.omitido, true)
  assert.equal(lab.b.leer().generacion, nueva.estado.generacion)
  assert.equal(lab.b.leer().fase, 'habilitada')
})

await check('un 401 cierra solo esa generación y un 5xx no reintenta', async () => {
  const lab = laboratorio()
  await lab.a.iniciar({ email: 'a@local.test', password: 'x' })
  lab.control.refreshStatus = 401
  const cerrado = await lab.a.renovar()
  assert.equal(cerrado.codigo, 'cerrado')
  assert.equal(lab.a.leer().fase, 'cerrada')
  const deNuevo = await lab.a.renovar()
  assert.notEqual(deNuevo.codigo, 'renovado')
  const otra = await lab.b.iniciar({ email: 'a@local.test', password: 'x' })
  lab.control.refreshStatus = 500
  const ambiguo = await lab.b.renovar()
  assert.equal(ambiguo.codigo, 'incierta')
  assert.equal(lab.b.leer().marcador.generacion, otra.estado.generacion)
  lab.control.refreshStatus = 200
  const sinReintento = await lab.b.renovar()
  assert.equal(sinReintento.codigo, 'incierta')
})

await check('reintento de negocio y ausencia de token compartido', () => {
  assert.equal(decidirReintento({ method: 'GET', intento: false, renovacion: { ok: true } }), 'reintentar')
  assert.equal(decidirReintento({ method: 'GET', intento: true, renovacion: { ok: true } }), 'cerrar')
  assert.equal(decidirReintento({ method: 'POST', intento: false, renovacion: { ok: true } }), 'no-repetir')
  assert.equal(decidirReintento({ method: 'PATCH', intento: false, renovacion: { ok: true } }), 'no-repetir')
  assert.equal(decidirReintento({ method: 'GET', intento: false, renovacion: { ok: true, identidadDistinta: true } }), 'cancelar')
  assert.equal(decidirReintento({ method: 'GET', intento: false, renovacion: { ok: false, codigo: 'limite' } }), 'limite')
  assert.equal(decidirReintento({ method: 'GET', intento: false, renovacion: { ok: false, codigo: 'red' } }), 'incierta')
  assert.equal(decidirReintento({ method: 'GET', intento: false, renovacion: { ok: false, codigo: 'legado' } }), 'cerrar')
})

await check('sin bloqueo compartido el ingreso queda tradicional', async () => {
  const local = memoria()
  const sesion = crearSesionCoordinada({
    local,
    locks: null,
    canal: null,
    uuid: () => crypto.randomUUID(),
    identificar,
    guardarAccess() {},
    leerAccess: () => null,
    urlLogin: '/api/Auth/Login',
    fetch: async () => { throw new Error('no debe llamar') },
  })
  assert.equal(sesion.soporta(), false)
  assert.equal((await sesion.preparar()).modo, 'tradicional')
  assert.equal((await sesion.iniciar({ email: 'a@local.test', password: 'x' })).modo, 'tradicional')
  assert.equal(local.getItem(ESTADO_SESION_KEY), null)
})

await check('un login nuevo no se cierra ni se refresca por la sesión anterior', async () => {
  const lab = laboratorio()
  const primero = await lab.a.iniciar({ email: 'a@local.test', password: 'x' })
  const segundo = await lab.b.iniciar({ email: 'b@local.test', password: 'x' })
  const refrescos = lab.llamadas.filter((item) => item.url.endsWith('/refresh')).length
  const viejo = await lab.a.renovar()
  assert.equal(viejo.codigo, 'obsoleto')
  assert.equal(viejo.identidadDistinta, true)
  assert.equal(lab.b.leer().fase, 'habilitada')
  assert.equal(lab.b.leer().generacion, segundo.estado.generacion)
  assert.notEqual(segundo.estado.generacion, primero.estado.generacion)
  assert.equal(lab.llamadas.filter((item) => item.url.endsWith('/refresh')).length, refrescos)
  assert.equal(decidirReintento({ method: 'POST', intento: false, renovacion: viejo }), 'cancelar')
})

await check('arranque cerrado o incierto no renueva', async () => {
  const lab = laboratorio()
  await lab.a.iniciar({ email: 'a@local.test', password: 'x' })
  await lab.a.cerrar()
  const trasCierre = await lab.b.preparar()
  assert.equal(trasCierre.modo, 'login')
  assert.equal(lab.llamadas.filter((item) => item.url.endsWith('/refresh')).length, 0)
})

function localIncluyeToken(local) {
  return String(local.getItem(ESTADO_SESION_KEY) || '').includes('eyJ')
}

function crearAislada(lab, _original) {
  const sesion = memoria()
  const canalVacio = {
    publicar() {},
    suscribir(fn) {
      return () => fn
    },
  }
  return crearSesionCoordinada({
    local: lab.local,
    locks: mutex(),
    canal: canalVacio,
    esperaRevisionMs: 10,
    uuid: () => crypto.randomUUID(),
    identificar,
    guardarAccess: (token) => sesion.setItem('ca.auth.token', token),
    leerAccess: () => sesion.getItem('ca.auth.token'),
    limpiarAccess: () => sesion.removeItem('ca.auth.token'),
    urlRefresh: '/api/Auth/refresh',
    fetch: async () => {
      throw new Error('no debe refrescar')
    },
  })
}

class CanalFalso {
  constructor() {
    this.onmessage = null
  }

  postMessage() {}

  close() {}
}

function definirNavigator(valor) {
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    enumerable: true,
    writable: true,
    value: valor,
  })
}

function locksPresentes() {
  return { locks: { request: async (_nombre, fn) => fn() } }
}

function almacenamientoQueLanza() {
  return {
    getItem() { throw new Error('bloqueado') },
    setItem() { throw new Error('bloqueado') },
    removeItem() { throw new Error('bloqueado') },
  }
}

async function loginTradicional(nombre, preparar) {
  resetBrowserGlobals()
  const llamadas = []
  const token = jwt({ nameid: 21, email: 'etapa6a.sesion@local.test', role: 'RRHH' })
  globalThis.fetch = async (url, init) => {
    llamadas.push({ url, init })
    return {
      ok: true,
      status: 200,
      json: async () => ({ token, requiereCambioPassword: false }),
    }
  }
  preparar()
  const href = new URL('../src/api/auth.js', import.meta.url).href
  const auth = await import(`${href}?compat=${nombre}`)
  const aviso = auth.mensajeCompatibilidadSesion()
  const user = await auth.login({ email: 'etapa6a.sesion@local.test', password: 'clave-de-prueba' })
  assert.equal(aviso, auth.MENSAJE_COMPATIBILIDAD)
  assert.equal(user.rol, 'RRHH')
  assert.equal(llamadas.length, 1)
  const pedido = llamadas[0]
  assert.equal(pedido.url, '/api/Auth/Login')
  assert.equal(pedido.init.method, 'POST')
  assert.equal(pedido.init.credentials, undefined)
  assert.deepEqual(pedido.init.headers, { 'Content-Type': 'application/json' })
  assert.equal(JSON.parse(pedido.init.body).email, 'etapa6a.sesion@local.test')
  assert.equal(JSON.parse(pedido.init.body).password, 'clave-de-prueba')
  assert.equal(pedido.url.includes('refresh'), false)
}

await check('sin Web Locks el login es tradicional', async () => {
  await loginTradicional('locks', () => {
    globalThis.document = {}
    globalThis.BroadcastChannel = CanalFalso
    definirNavigator({})
    globalThis.localStorage = memoria()
  })
})

await check('sin BroadcastChannel el login es tradicional', async () => {
  await loginTradicional('canal', () => {
    globalThis.document = {}
    globalThis.BroadcastChannel = undefined
    definirNavigator(locksPresentes())
    globalThis.localStorage = memoria()
  })
})

await check('localStorage inaccesible deja el login tradicional', async () => {
  await loginTradicional('almacen', () => {
    globalThis.document = {}
    globalThis.BroadcastChannel = CanalFalso
    definirNavigator(locksPresentes())
    globalThis.localStorage = almacenamientoQueLanza()
  })
  await loginTradicional('almacen-getter', () => {
    globalThis.document = {}
    globalThis.BroadcastChannel = CanalFalso
    definirNavigator(locksPresentes())
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() { throw new Error('bloqueado') },
    })
  })
})

if (!process.exitCode) console.log(`${passed} passed`)
