import assert from 'node:assert/strict'
import { crearSesionCoordinada, ESTADO_SESION_KEY } from '../src/api/sesion-coordinada.js'

function jwt(payload) {
  const cuerpo = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `eyJhbGciOiJub25lIn0.${cuerpo}.firma`
}

function identificar(token) {
  const json = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'))
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
  const llamadas = []
  const locks = mutex()
  const control = { verificar: null, pausa: null }
  function coordinar(indice) {
    return crearSesionCoordinada({
      local,
      locks,
      canal,
      esperaRevisionMs: 20,
      timeoutMs: 50,
      uuid: () => crypto.randomUUID(),
      identificar,
      guardarAccess: (token) => sesiones[indice].setItem('token', token),
      leerAccess: () => sesiones[indice].getItem('token'),
      limpiarAccess: () => sesiones[indice].removeItem('token'),
      urlLogin: '/api/Auth/Login',
      urlVerificar: '/api/Auth/mfa/verificar',
      urlVinculacionInicio: '/api/Auth/mfa/vinculacion/iniciar',
      urlVinculacionConfirmar: '/api/Auth/mfa/vinculacion/confirmar',
      urlRefresh: '/api/Auth/refresh',
      urlCierre: '/api/Auth/cerrar-sesion',
      fetch: async (url, init) => {
        llamadas.push({ url, generacion: init.headers['X-CF-Generacion'] })
        if (url.endsWith('/Login')) {
          if (control.loginVinculacion) {
            return {
              ok: false,
              status: 401,
              json: async () => ({ codigo: 'vinculacion_mfa_pendiente', desafio: control.desafio, expiraEn: control.expiraEn }),
            }
          }
          if (control.loginMfa) {
            return {
              ok: false,
              status: 401,
              json: async () => ({ codigo: 'mfa_requerido', desafio: control.desafio, expiraEn: control.expiraEn }),
            }
          }
          const generacion = init.headers['X-CF-Generacion']
          return {
            ok: true,
            status: 200,
            json: async () => ({ token: jwt({ nameid: 8, sid: generacion }), requiereCambioPassword: false }),
          }
        }
        if (url.endsWith('/vinculacion/iniciar')) {
          return { ok: true, status: 200, json: async () => ({ operacion: 'op', uri: 'otpauth://totp/lab', claveManual: 'MANUAL', expiraEn: control.expiraEn }) }
        }
        if (url.endsWith('/vinculacion/confirmar')) {
          if (control.pausa) await control.pausa
          return { ok: true, status: 200, json: async () => ({ mensaje: 'listo', codigos: ['codigo-prueba'] }) }
        }
        if (!url.endsWith('/verificar')) return { ok: false, status: 404, json: async () => ({}) }
        if (control.pausa) await control.pausa
        if (control.verificar === 'red') return null
        if (control.verificar === 'invalido') {
          return { ok: false, status: 401, json: async () => ({ codigo: 'mfa_invalido' }) }
        }
        const generacion = init.headers['X-CF-Generacion']
        return {
          ok: true,
          status: 200,
          json: async () => ({ token: jwt({ nameid: 21, sid: generacion }), requiereCambioPassword: false }),
        }
      },
    })
  }
  return { local, sesiones, llamadas, control, coordinar }
}

const checks = []
function check(nombre, fn) {
  checks.push(fn().then(() => null, (error) => `${nombre}: ${error.message}`))
}

check('el desafío no se publica y el lock queda libre', async () => {
  const lab = laboratorio()
  lab.control.loginMfa = true
  lab.control.desafio = 'desafio-de-prueba'
  lab.control.expiraEn = new Date(Date.now() + 60_000).toISOString()
  const a = lab.coordinar(0)
  const pendiente = await a.iniciar({ email: 'a@local.test', password: 'x' })
  assert.equal(pendiente.modo, 'mfa')
  assert.equal(pendiente.desafio, undefined)
  assert.equal(lab.local.getItem(ESTADO_SESION_KEY), null)
  const b = lab.coordinar(1)
  lab.control.loginMfa = false
  const ingreso = await b.iniciar({ email: 'b@local.test', password: 'x' })
  assert.equal(ingreso.modo, 'renovable')
  assert.equal(lab.llamadas.filter((item) => item.url.endsWith('/Login')).length, 2)
})

check('verificar reutiliza la generación y publica solo el éxito', async () => {
  const lab = laboratorio()
  lab.control.loginMfa = true
  lab.control.desafio = 'desafio-de-prueba'
  lab.control.expiraEn = new Date(Date.now() + 60_000).toISOString()
  const a = lab.coordinar(0)
  const pendiente = await a.iniciar({ email: 'a@local.test', password: 'x' })
  const ok = await a.verificar({ intento: pendiente.intento, codigo: '123456' })
  assert.equal(ok.modo, 'renovable')
  const verificacion = lab.llamadas.find((item) => item.url.endsWith('/verificar'))
  assert.equal(verificacion.generacion, pendiente.generacion)
  assert.equal(JSON.parse(lab.local.getItem(ESTADO_SESION_KEY)).generacion, pendiente.generacion)
  assert.equal(lab.local.getItem(ESTADO_SESION_KEY).includes(lab.control.desafio), false)
  assert.ok(lab.sesiones[0].getItem('token'))
})

check('otra pestaña con sesión reemplaza el intento antes de enviarlo', async () => {
  const lab = laboratorio()
  lab.control.loginMfa = true
  lab.control.desafio = 'desafio-de-prueba'
  lab.control.expiraEn = new Date(Date.now() + 60_000).toISOString()
  const a = lab.coordinar(0)
  const pendiente = await a.iniciar({ email: 'a@local.test', password: 'x' })
  lab.control.loginMfa = false
  const b = lab.coordinar(1)
  await b.iniciar({ email: 'b@local.test', password: 'x' })
  const antes = lab.llamadas.filter((item) => item.url.endsWith('/verificar')).length
  const resultado = await a.verificar({ intento: pendiente.intento, codigo: '123456' })
  assert.equal(resultado.modo, 'reemplazado')
  assert.equal(lab.llamadas.filter((item) => item.url.endsWith('/verificar')).length, antes)
  assert.equal(lab.sesiones[0].getItem('token'), null)
})

check('un código vencido no se envía', async () => {
  const lab = laboratorio()
  lab.control.loginMfa = true
  lab.control.desafio = 'desafio-de-prueba'
  lab.control.expiraEn = new Date(Date.now() - 1000).toISOString()
  const a = lab.coordinar(0)
  const pendiente = await a.iniciar({ email: 'a@local.test', password: 'x' })
  const resultado = await a.verificar({ intento: pendiente.intento, codigo: '123456' })
  assert.equal(resultado.modo, 'vencido')
  assert.equal(lab.llamadas.some((item) => item.url.endsWith('/verificar')), false)
})

check('la respuesta tardía de un intento cancelado no publica la sesión', async () => {
  const lab = laboratorio()
  lab.control.loginMfa = true
  lab.control.desafio = 'desafio-de-prueba'
  lab.control.expiraEn = new Date(Date.now() + 60_000).toISOString()
  let soltar
  lab.control.pausa = new Promise((resolve) => { soltar = resolve })
  const a = lab.coordinar(0)
  const pendiente = await a.iniciar({ email: 'a@local.test', password: 'x' })
  const tarea = a.verificar({ intento: pendiente.intento, codigo: '123456' })
  await new Promise((resolve) => setTimeout(resolve, 20))
  a.cancelar(pendiente.intento)
  soltar()
  const resultado = await tarea
  assert.equal(resultado.modo, 'descartado')
  assert.equal(lab.sesiones[0].getItem('token'), null)
  assert.equal(lab.local.getItem(ESTADO_SESION_KEY), null)
})

check('una verificación incierta no se reenvía', async () => {
  const lab = laboratorio()
  lab.control.loginMfa = true
  lab.control.desafio = 'desafio-de-prueba'
  lab.control.expiraEn = new Date(Date.now() + 60_000).toISOString()
  lab.control.verificar = 'red'
  const a = lab.coordinar(0)
  const pendiente = await a.iniciar({ email: 'a@local.test', password: 'x' })
  const resultado = await a.verificar({ intento: pendiente.intento, codigo: '123456' })
  assert.equal(resultado.modo, 'incierto')
  const otra = await a.verificar({ intento: pendiente.intento, codigo: '123456' })
  assert.equal(otra.modo, 'descartado')
  assert.equal(lab.llamadas.filter((item) => item.url.endsWith('/verificar')).length, 1)
})

check('un código incorrecto deja el mismo intento', async () => {
  const lab = laboratorio()
  lab.control.loginMfa = true
  lab.control.desafio = 'desafio-de-prueba'
  lab.control.expiraEn = new Date(Date.now() + 60_000).toISOString()
  lab.control.verificar = 'invalido'
  const a = lab.coordinar(0)
  const pendiente = await a.iniciar({ email: 'a@local.test', password: 'x' })
  const malo = await a.verificar({ intento: pendiente.intento, codigo: '000000' })
  assert.equal(malo.codigo, 'mfa_invalido')
  lab.control.verificar = null
  const bueno = await a.verificar({ intento: pendiente.intento, codigo: '123456' })
  assert.equal(bueno.modo, 'renovable')
})

check('la vinculación no publica sesión y una respuesta tardía se descarta', async () => {
  const lab = laboratorio()
  lab.control.loginVinculacion = true
  lab.control.desafio = 'desafio-vinculo'
  lab.control.expiraEn = new Date(Date.now() + 60_000).toISOString()
  let soltar
  lab.control.pausa = new Promise((resolve) => { soltar = resolve })
  const a = lab.coordinar(0)
  const pendiente = await a.iniciar({ email: 'a@local.test', password: 'x' })
  assert.equal(pendiente.modo, 'vinculacion')
  const inicio = await a.iniciarVinculacion({ intento: pendiente.intento })
  assert.equal(inicio.modo, 'inicio')
  assert.equal(lab.sesiones[0].getItem('token'), null)
  const tarea = a.confirmarVinculacion({ intento: pendiente.intento, codigo: '123456' })
  await new Promise((resolve) => setTimeout(resolve, 20))
  a.cancelar(pendiente.intento)
  soltar()
  const resultado = await tarea
  assert.equal(resultado.modo, 'descartado')
  assert.equal(lab.local.getItem(ESTADO_SESION_KEY), null)
  assert.equal(JSON.stringify(lab.local).includes('codigo-prueba'), false)
})

const fallos = (await Promise.all(checks)).filter(Boolean)
if (fallos.length) {
  console.error(fallos.join('\n'))
  process.exit(1)
}
console.log('check-mfa-web ok')
