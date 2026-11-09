/**
 * Coordina la sesión renovable entre pestañas.
 * localStorage guarda solo metadatos. El access no entra en ese almacén.
 */
export const LOCK_SESION = 'ca-auth-sesion'
export const CANAL_SESION = 'ca-auth'
export const ESTADO_SESION_KEY = 'ca.auth.coordinacion'
export const ESPERA_REVISION_MS = 800
export const TIMEOUT_SESION_MS = 10000
export const HEADER_SOLICITUD = 'X-CF-Solicitud'
export const HEADER_GENERACION = 'X-CF-Generacion'
export const VALOR_SOLICITUD = '1'

export const MENSAJE_COMPATIBILIDAD =
  'Este navegador no admite la sesión renovable. La sesión queda en esta pestaña y no se renueva sola.'
export const MENSAJE_CIERRE_SIN_CONFIRMAR =
  'La sesión local quedó cerrada, pero no se pudo confirmar el cierre en el servidor.'
export const MENSAJE_SESION_CAMBIADA =
  'La sesión cambió. Revisá los datos y volvé a realizar la acción.'
export const MENSAJE_OPERACION_NO_REPETIDA =
  'La sesión se actualizó. La acción no se repitió: volvé a realizarla.'

const FASES = new Set(['habilitada', 'cerrada', 'incierta'])
const sondeoAlmacen = new WeakMap()

function almacenamientoUtil(local) {
  try {
    if (!local || typeof local.getItem !== 'function' || typeof local.setItem !== 'function') return false
    const previo = sondeoAlmacen.get(local)
    if (previo !== undefined) return previo
    const clave = 'ca.auth.compat'
    let ok = false
    try {
      local.setItem(clave, '1')
      ok = local.getItem(clave) === '1'
    } catch {
      ok = false
    } finally {
      try {
        local.removeItem?.(clave)
      } catch {
        ok = false
      }
    }
    sondeoAlmacen.set(local, ok)
    return ok
  } catch {
    return false
  }
}

export function decidirReintento({ method, intento, renovacion }) {
  if (!renovacion?.ok) {
    if (renovacion?.codigo === 'limite') return 'limite'
    if (renovacion?.codigo === 'incierta' || renovacion?.codigo === 'red') return 'incierta'
    if (renovacion?.codigo === 'identidad' || renovacion?.codigo === 'obsoleto') return 'cancelar'
    if (renovacion?.codigo === 'legado') return 'cerrar'
    return 'cerrar'
  }
  if (renovacion.identidadDistinta) return 'cancelar'
  const verbo = String(method || 'GET').toUpperCase()
  if (verbo !== 'GET' && verbo !== 'HEAD') return 'no-repetir'
  if (intento) return 'cerrar'
  return 'reintentar'
}

async function leerCuerpo(response) {
  try {
    const cuerpo = await response.json()
    return cuerpo && typeof cuerpo === 'object' ? cuerpo : null
  } catch {
    return null
  }
}

export function crearSesionCoordinada(opciones) {
  const local = opciones.local
  const locks = opciones.locks
  const canal = opciones.canal
  const pedir = opciones.fetch
  const identificar = opciones.identificar
  const uuid = opciones.uuid
  const guardarAccess = opciones.guardarAccess
  const leerAccess = opciones.leerAccess
  const limpiarAccess = opciones.limpiarAccess
  const esperaRevisionMs = opciones.esperaRevisionMs ?? ESPERA_REVISION_MS
  const timeoutMs = opciones.timeoutMs ?? TIMEOUT_SESION_MS
  let memoria = null
  let suscripcion = null
  let pendienteMfa = null

  function soporta() {
    return Boolean(almacenamientoUtil(local) && locks?.exclusivo && canal?.publicar && canal?.suscribir && uuid && pedir)
  }

  function leer() {
    try {
      const raw = local.getItem(ESTADO_SESION_KEY)
      if (!raw) return null
      const parsed = JSON.parse(raw)
      if (!parsed || typeof parsed !== 'object' || !FASES.has(parsed.fase)) return null
      return {
        fase: parsed.fase,
        generacion: parsed.generacion || null,
        revision: Number(parsed.revision) || 0,
        usuarioId: Number(parsed.usuarioId) || null,
        sid: parsed.sid || null,
        marcador: parsed.marcador?.generacion
          ? { generacion: parsed.marcador.generacion, revision: Number(parsed.marcador.revision) || 0 }
          : null,
      }
    } catch {
      return null
    }
  }

  function escribir(estado) {
    const cuerpo = {
      fase: estado.fase,
      generacion: estado.generacion || null,
      revision: Number(estado.revision) || 0,
      usuarioId: estado.usuarioId || null,
      sid: estado.sid || null,
      marcador: estado.marcador
        ? { generacion: estado.marcador.generacion, revision: Number(estado.marcador.revision) || 0 }
        : null,
    }
    local.setItem(ESTADO_SESION_KEY, JSON.stringify(cuerpo))
    return cuerpo
  }

  function recordar(token, estado) {
    if (!token || !estado) {
      memoria = null
      return
    }
    memoria = {
      token,
      generacion: estado.generacion,
      revision: estado.revision,
      usuarioId: estado.usuarioId,
      sid: estado.sid,
    }
  }

  function coincide(mensaje, esperado) {
    if (!mensaje || !esperado) return false
    return mensaje.generacion === esperado.generacion
      && Number(mensaje.revision) === Number(esperado.revision)
      && Number(mensaje.usuarioId) === Number(esperado.usuarioId)
      && (mensaje.sid || null) === (esperado.sid || null)
  }

  function asegurarEscucha() {
    if (suscripcion || !canal?.suscribir) return
    suscripcion = canal.suscribir((mensaje) => {
      if (mensaje?.tipo === 'pedir' && memoria && coincide(mensaje, memoria)) {
        canal.publicar({
          tipo: 'access',
          generacion: memoria.generacion,
          revision: memoria.revision,
          usuarioId: memoria.usuarioId,
          sid: memoria.sid,
          token: memoria.token,
        })
        return
      }
      if (mensaje?.tipo === 'fase' && (mensaje.fase === 'cerrada' || mensaje.fase === 'incierta')) {
        const actual = leer()
        if (mensaje.generacion && actual?.generacion && mensaje.generacion !== actual.generacion) return
        if (memoria?.generacion && mensaje.generacion && memoria.generacion !== mensaje.generacion) return
        memoria = null
        limpiarAccess?.()
        opciones.alCambiarRemoto?.({ fase: mensaje.fase, generacion: mensaje.generacion || null })
      }
    })
  }

  function pedirRevision(esperado) {
    return new Promise((resolve) => {
      let cerrado = false
      const terminar = (token) => {
        if (cerrado) return
        cerrado = true
        clearTimeout(timer)
        baja()
        resolve(token || null)
      }
      const baja = canal.suscribir((mensaje) => {
        if (mensaje?.tipo !== 'access' || !coincide(mensaje, esperado) || !mensaje.token) return
        const ident = identificar(mensaje.token)
        if (!ident || ident.usuarioId !== esperado.usuarioId || (ident.sid || null) !== (esperado.sid || null)) return
        terminar(mensaje.token)
      })
      const timer = setTimeout(() => terminar(null), esperaRevisionMs)
      canal.publicar({
        tipo: 'pedir',
        generacion: esperado.generacion,
        revision: esperado.revision,
        usuarioId: esperado.usuarioId,
        sid: esperado.sid,
      })
    })
  }

  async function exclusivo(fn) {
    return locks.exclusivo(LOCK_SESION, fn)
  }

  async function solicitar(url, init, generacion) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      return await pedir(url, {
        ...init,
        credentials: 'include',
        signal: controller.signal,
        headers: {
          ...(init.headers || {}),
          [HEADER_SOLICITUD]: VALOR_SOLICITUD,
          [HEADER_GENERACION]: generacion,
        },
      })
    } catch {
      return null
    } finally {
      clearTimeout(timer)
    }
  }

  async function preparar() {
    asegurarEscucha()
    if (!soporta()) return { modo: 'tradicional' }
    return exclusivo(async () => {
      const estado = leer()
      const token = leerAccess?.() || null
      const ident = token ? identificar(token) : null
      if (!estado) {
        if (token && ident && !ident.sid) return { modo: 'legado' }
        if (token) limpiarAccess?.()
        return { modo: 'login' }
      }
      if (estado.fase !== 'habilitada' || estado.marcador) {
        limpiarAccess?.()
        memoria = null
        return { modo: 'login' }
      }
      if (ident && ident.usuarioId === estado.usuarioId && (ident.sid || null) === (estado.sid || null)) {
        recordar(token, estado)
        return { modo: 'continua', estado }
      }
      const recibido = await pedirRevision(estado)
      if (!recibido) return { modo: 'login' }
      const actual = leer()
      if (!coincide(actual, estado) || actual.fase !== 'habilitada' || actual.marcador) return { modo: 'login' }
      guardarAccess(recibido)
      recordar(recibido, actual)
      return { modo: 'adoptado', token: recibido, estado: actual }
    })
  }

  async function iniciar({ email, password }) {
    asegurarEscucha()
    if (!soporta()) return { modo: 'tradicional' }
    const generacion = uuid()
    return exclusivo(async () => {
      const previo = leer()
      const response = await solicitar(opciones.urlLogin, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      }, generacion)
      if (!response) return { modo: 'red', generacion }
      if (response.status === 429) return { modo: 'http', status: 429, generacion }
      if (response.status === 401) {
        const cuerpo = await leerCuerpo(response)
        if (cuerpo?.codigo === 'mfa_requerido' && cuerpo.desafio && cuerpo.expiraEn) {
          const id = uuid()
          pendienteMfa = {
            id,
            generacion,
            desafio: cuerpo.desafio,
            expiraEn: cuerpo.expiraEn,
            previoUsuarioId: previo?.usuarioId || null,
          }
          return { modo: 'mfa', intento: id, expiraEn: cuerpo.expiraEn, generacion }
        }
        return { modo: 'http', status: 401, generacion }
      }
      if (!response.ok) return { modo: 'http', status: response.status, generacion }
      let payload = null
      try {
        payload = await response.json()
      } catch {
        return { modo: 'ilegible', generacion }
      }
      const token = payload?.token ?? payload?.Token
      const ident = token ? identificar(token) : null
      if (!token || !ident?.usuarioId) return { modo: 'sin-token', generacion }
      const estado = {
        fase: 'habilitada',
        generacion,
        revision: 1,
        usuarioId: ident.usuarioId,
        sid: ident.sid || null,
        marcador: null,
      }
      escribir(estado)
      guardarAccess(token)
      recordar(token, estado)
      canal.publicar({ tipo: 'access', token, ...estado })
      return {
        modo: 'renovable',
        token,
        payload,
        estado,
        mismoUsuario: Boolean(previo?.usuarioId && previo.usuarioId === ident.usuarioId),
      }
    })
  }

  function cancelar(intento) {
    if (pendienteMfa?.id === intento) pendienteMfa = null
    return { cancelado: true }
  }

  async function verificar({ intento, codigo, codigoRecuperacion }) {
    asegurarEscucha()
    if (!soporta()) return { modo: 'tradicional' }
    return exclusivo(async () => {
      const pendiente = pendienteMfa
      if (!pendiente || pendiente.id !== intento) return { modo: 'descartado' }
      const estado = leer()
      if (estado?.fase === 'habilitada') return { modo: 'reemplazado' }
      if (Number.isNaN(Date.parse(pendiente.expiraEn)) || Date.parse(pendiente.expiraEn) <= Date.now()) {
        pendienteMfa = null
        return { modo: 'vencido' }
      }
      const totp = String(codigo ?? '').trim()
      const recuperacion = String(codigoRecuperacion ?? '').trim()
      if (Boolean(totp) === Boolean(recuperacion)) return { modo: 'http', status: 400, codigo: 'mfa_codigo_requerido' }
      const response = await solicitar(opciones.urlVerificar, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(totp
          ? { desafio: pendiente.desafio, codigo: totp }
          : { desafio: pendiente.desafio, codigoRecuperacion: recuperacion }),
      }, pendiente.generacion)
      const vigente = pendienteMfa
      const despues = leer()
      if (!vigente || vigente.id !== intento || (despues?.fase === 'habilitada' && despues.generacion !== pendiente.generacion)) {
        return { modo: 'descartado' }
      }
      if (!response) {
        pendienteMfa = null
        return { modo: 'incierto' }
      }
      if (response.status === 500 || response.status === 503) {
        pendienteMfa = null
        return { modo: 'incierto', status: response.status }
      }
      if (!response.ok) {
        const cuerpo = await leerCuerpo(response)
        if (response.status === 401 && cuerpo?.codigo === 'mfa_invalido') {
          return { modo: 'http', status: 401, codigo: 'mfa_invalido' }
        }
        pendienteMfa = null
        return { modo: 'http', status: response.status, codigo: cuerpo?.codigo || null }
      }
      let payload = null
      try {
        payload = await response.json()
      } catch {
        pendienteMfa = null
        return { modo: 'incierto', status: response.status }
      }
      const token = payload?.token ?? payload?.Token
      const ident = token ? identificar(token) : null
      const actual = pendienteMfa
      const publicado = leer()
      if (!actual || actual.id !== intento || (publicado?.fase === 'habilitada' && publicado.generacion !== pendiente.generacion)) {
        return { modo: 'descartado' }
      }
      if (!token || !ident?.usuarioId) return { modo: 'sin-token', generacion: pendiente.generacion }
      const siguiente = {
        fase: 'habilitada',
        generacion: pendiente.generacion,
        revision: 1,
        usuarioId: ident.usuarioId,
        sid: ident.sid || null,
        marcador: null,
      }
      pendienteMfa = null
      escribir(siguiente)
      guardarAccess(token)
      recordar(token, siguiente)
      canal.publicar({ tipo: 'access', token, ...siguiente })
      return {
        modo: 'renovable',
        token,
        payload,
        estado: siguiente,
        mismoUsuario: Boolean(pendiente.previoUsuarioId && pendiente.previoUsuarioId === ident.usuarioId),
      }
    })
  }

  function puedeRenovar(estado) {
    return Boolean(estado && estado.fase === 'habilitada' && estado.generacion && !estado.marcador)
  }

  async function renovar() {
    asegurarEscucha()
    if (!soporta()) return { ok: false, codigo: 'tradicional' }
    return exclusivo(async () => {
      const inicio = leer()
      if (!inicio) {
        const token = leerAccess?.() || null
        const ident = token ? identificar(token) : null
        if (token && ident && !ident.sid) return { ok: false, codigo: 'legado' }
      }
      if (!puedeRenovar(inicio)) return { ok: false, codigo: inicio?.fase === 'cerrada' ? 'cerrado' : 'incierta' }
      const local = memoria
      if (local?.generacion && inicio.generacion && local.generacion !== inicio.generacion) {
        memoria = null
        limpiarAccess?.()
        return { ok: false, codigo: 'obsoleto', identidadDistinta: true }
      }
      if (!local || local.revision !== inicio.revision || local.generacion !== inicio.generacion) {
        const recibido = await pedirRevision(inicio)
        if (recibido) {
          guardarAccess(recibido)
          recordar(recibido, inicio)
          return { ok: true, codigo: 'adoptado', token: recibido, estado: inicio }
        }
        escribir({
          ...inicio,
          fase: 'incierta',
          marcador: { generacion: inicio.generacion, revision: inicio.revision },
        })
        limpiarAccess?.()
        memoria = null
        canal.publicar({ tipo: 'fase', fase: 'incierta', generacion: inicio.generacion })
        return { ok: false, codigo: 'incierta' }
      }
      const vigente = leer()
      escribir({
        ...vigente,
        fase: 'incierta',
        marcador: { generacion: vigente.generacion, revision: vigente.revision },
      })
      const response = await solicitar(opciones.urlRefresh, { method: 'POST' }, vigente.generacion)
      const actual = leer()
      if (!actual || actual.generacion !== vigente.generacion) return { ok: false, codigo: 'obsoleto' }
      if (!response) return { ok: false, codigo: 'red' }
      if (response.status === 401) {
        escribir({ ...actual, fase: 'cerrada', marcador: null })
        limpiarAccess?.()
        memoria = null
        canal.publicar({ tipo: 'fase', fase: 'cerrada', generacion: vigente.generacion })
        return { ok: false, codigo: 'cerrado' }
      }
      if (response.status === 429) {
        escribir({ ...vigente, fase: 'habilitada', marcador: null })
        return { ok: false, codigo: 'limite' }
      }
      if (response.status >= 500) return { ok: false, codigo: 'incierta' }
      if (!response.ok) return { ok: false, codigo: 'incierta' }
      let payload = null
      try {
        payload = await response.json()
      } catch {
        return { ok: false, codigo: 'incierta' }
      }
      const token = payload?.token ?? payload?.Token
      const ident = token ? identificar(token) : null
      if (!token || !ident || ident.usuarioId !== vigente.usuarioId || (ident.sid || null) !== (vigente.sid || null)) {
        return { ok: false, codigo: 'identidad', identidadDistinta: true }
      }
      const siguiente = {
        fase: 'habilitada',
        generacion: vigente.generacion,
        revision: vigente.revision + 1,
        usuarioId: vigente.usuarioId,
        sid: vigente.sid,
        marcador: null,
      }
      escribir(siguiente)
      guardarAccess(token)
      recordar(token, siguiente)
      canal.publicar({ tipo: 'access', ...siguiente, token })
      return { ok: true, codigo: 'renovado', token, estado: siguiente }
    })
  }

  async function cerrar({ generacion } = {}) {
    asegurarEscucha()
    if (!soporta()) {
      limpiarAccess?.()
      memoria = null
      return { confirmado: true, local: true }
    }
    return exclusivo(async () => {
      const estado = leer()
      if (generacion && estado?.generacion && generacion !== estado.generacion) {
        return { confirmado: true, omitido: true }
      }
      const gen = estado?.generacion || null
      if (estado) {
        escribir({ ...estado, fase: 'cerrada', marcador: null })
      }
      memoria = null
      limpiarAccess?.()
      if (gen) canal.publicar({ tipo: 'fase', fase: 'cerrada', generacion: gen })
      if (!gen || !opciones.urlCierre) return { confirmado: true, local: true }
      const response = await solicitar(opciones.urlCierre, { method: 'POST' }, gen)
      const despues = leer()
      if (despues?.generacion && despues.generacion !== gen) return { confirmado: true, omitido: true }
      if (!response || response.status >= 500) return { confirmado: false, generacion: gen }
      return { confirmado: true, generacion: gen }
    })
  }

  return {
    soporta,
    leer,
    preparar,
    iniciar,
    verificar,
    cancelar,
    renovar,
    cerrar,
    asegurarEscucha,
    identidad() {
      return memoria
        ? { usuarioId: memoria.usuarioId, sid: memoria.sid, generacion: memoria.generacion, revision: memoria.revision }
        : null
    },
  }
}
