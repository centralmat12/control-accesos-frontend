/**
 * Sesión del panel web.
 *
 * El JWT se guarda solo en sessionStorage. El frontend lee claims para adaptar
 * la interfaz. La autorización real corresponde a la API; no se valida la firma
 * del token en el navegador.
 */
import { apiUrl } from '../config/api.js'
import { isAgenteSucursal, isSuperadmin } from '../config/roles.js'
import { showToast } from '../components/toast.js'
import { clearActivityLogs, logApiNetworkError, logApiResponse, logInfo } from '../utils/activity-log.js'
import { sanitizePublicErrorMessage } from '../utils/public-error.js'
import { clearEmpresaContexto } from './empresa-context.js'
import {
  crearSesionCoordinada,
  MENSAJE_CIERRE_SIN_CONFIRMAR,
  MENSAJE_COMPATIBILIDAD,
  MENSAJE_OPERACION_NO_REPETIDA,
  MENSAJE_SESION_CAMBIADA,
} from './sesion-coordinada.js'

export { MENSAJE_CIERRE_SIN_CONFIRMAR }

const SESSION_KEY = 'ca.auth.user'
const TOKEN_KEY = 'ca.auth.token'
const LOGIN_NOTICE_KEY = 'ca.auth.notice'

export const SESSION_EXPIRED_CATCH_MESSAGE = 'Sesión expirada o no autorizada.'
export const SESSION_EXPIRED_USER_MESSAGE = 'Tu sesión ya no es válida. Iniciá sesión nuevamente.'
export const PASSWORD_CHANGE_REQUIRED_API_MESSAGE = 'Debés cambiar tu contraseña antes de continuar.'
export const PASSWORD_CHANGED_LOGIN_MESSAGE =
  'Contraseña actualizada. Iniciá sesión nuevamente con tu nueva contraseña.'
export const PASSWORD_CHANGE_REQUIRED_CODE = 'PASSWORD_CHANGE_REQUIRED'
export const AUTH_CAMBIAR_PASSWORD_PATH = '/api/Auth/cambiar-password'
export { MENSAJE_COMPATIBILIDAD, MENSAJE_SESION_CAMBIADA, MENSAJE_OPERACION_NO_REPETIDA }

let unauthorizedNotified = false
let passwordChangeNotified = false

function readSession() {
  const raw = sessionStorage.getItem(SESSION_KEY)
  if (!raw) return null

  try {
    return JSON.parse(raw)
  } catch {
    sessionStorage.removeItem(SESSION_KEY)
    return null
  }
}

function writeSession(user) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(user))
}

function writeToken(token) {
  sessionStorage.setItem(TOKEN_KEY, token)
}

function clearSession() {
  sessionStorage.removeItem(SESSION_KEY)
  sessionStorage.removeItem(TOKEN_KEY)
}

export function getToken() {
  return sessionStorage.getItem(TOKEN_KEY)
}

export function getCurrentUser() {
  return readSession()
}

export function isAuthenticated() {
  return Boolean(getToken())
}

export function requiresPasswordChange(user = getCurrentUser()) {
  return Boolean(user?.requiereCambioPassword) && isAuthenticated()
}

export function isSessionExpiredError(error) {
  return error?.code === 'UNAUTHORIZED' || error?.message === SESSION_EXPIRED_CATCH_MESSAGE
}

export function isPasswordChangeRequiredError(error) {
  return error?.code === PASSWORD_CHANGE_REQUIRED_CODE
}

export function setLoginNotice(message) {
  const text = String(message ?? '').trim()
  if (text) sessionStorage.setItem(LOGIN_NOTICE_KEY, text)
}

export function consumeLoginNotice() {
  const text = sessionStorage.getItem(LOGIN_NOTICE_KEY)
  sessionStorage.removeItem(LOGIN_NOTICE_KEY)
  return text
}

export function resetSessionGuards() {
  unauthorizedNotified = false
  passwordChangeNotified = false
}

export function notifyUnauthorized() {
  if (unauthorizedNotified) return
  unauthorizedNotified = true
  clearSession()
  void logout()
  try {
    showToast({ message: SESSION_EXPIRED_USER_MESSAGE, tone: 'error' })
  } catch {
    /* El toast requiere DOM; las pruebas de Node no lo montan. */
  }
  window.dispatchEvent(new CustomEvent('ca:unauthorized'))
}

export function markPasswordChangeRequired() {
  const user = getCurrentUser()
  if (user && !user.requiereCambioPassword) {
    writeSession({ ...user, requiereCambioPassword: true })
  }
}

export function notifyPasswordChangeRequired() {
  markPasswordChangeRequired()
  if (passwordChangeNotified) return
  passwordChangeNotified = true
  window.dispatchEvent(new CustomEvent('ca:password-change-required'))
}

function decodeJwtPayload(token) {
  // Decodifica el payload para la UI. No verifica firma ni expiración criptográfica.
  try {
    const parts = String(token).split('.')
    if (parts.length < 2) return null

    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=')
    const json = decodeURIComponent(
      Array.from(atob(padded), (char) => `%${char.charCodeAt(0).toString(16).padStart(2, '0')}`).join(''),
    )
    const payload = JSON.parse(json)
    return payload && typeof payload === 'object' ? payload : null
  } catch {
    return null
  }
}

function readClaim(payload, ...keys) {
  if (!payload) return null

  for (const key of keys) {
    const value = payload[key]
    if (value === undefined || value === null) continue

    const resolved = Array.isArray(value) ? value[0] : value
    const text = String(resolved).trim()
    if (text) return text
  }

  return null
}

function userFromToken(token, fallbackEmail) {
  const payload = decodeJwtPayload(token)
  const email =
    readClaim(
      payload,
      'email',
      'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress',
    ) || fallbackEmail
  const nombre =
    readClaim(
      payload,
      'unique_name',
      'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name',
      'name',
    ) || email || 'Usuario'
  const rol =
    readClaim(
      payload,
      'role',
      'http://schemas.microsoft.com/ws/2008/06/identity/claims/role',
    ) || 'Usuario'
  const empresaIdRaw = readClaim(payload, 'empresa_id', 'empresaId', 'EmpresaId')
  const empresaId = Number(empresaIdRaw)
  const userIdRaw = readClaim(
    payload,
    'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier',
    'nameid',
    'sub',
  )
  const userId = Number(userIdRaw)
  const user = {
    nombre,
    email,
    rol: rol || 'Usuario',
  }

  if (Number.isFinite(userId) && userId > 0) {
    user.id = userId
  }

  if (Number.isFinite(empresaId) && empresaId > 0) {
    user.empresaId = empresaId
  }

  const sid = readClaim(payload, 'sid')
  if (sid) user.sid = sid

  return user
}

function isAgentCredential(token, user) {
  if (isAgenteSucursal(user)) return true
  const payload = decodeJwtPayload(token)
  const tokenUse = String(readClaim(payload, 'token_use', 'tokenUse') ?? '')
    .trim()
    .toLowerCase()
  return tokenUse === 'agent'
}

function identificarAccess(token) {
  const payload = decodeJwtPayload(token)
  const userId = Number(readClaim(
    payload,
    'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier',
    'nameid',
    'sub',
  ))
  return {
    usuarioId: Number.isFinite(userId) && userId > 0 ? userId : null,
    sid: readClaim(payload, 'sid'),
  }
}

function almacenamientoCompartido() {
  try {
    return globalThis.localStorage || null
  } catch {
    return null
  }
}

let coordinador
function sesion() {
  if (!coordinador) {
    const canalNativo = typeof document !== 'undefined' && typeof BroadcastChannel === 'function'
      ? new BroadcastChannel('ca-auth')
      : null
    const oidores = new Set()
    if (canalNativo) {
      canalNativo.onmessage = (event) => {
        for (const fn of oidores) fn(event.data)
      }
    }
    coordinador = crearSesionCoordinada({
      local: almacenamientoCompartido(),
      locks: globalThis.navigator?.locks?.request
        ? { exclusivo: (nombre, fn) => navigator.locks.request(nombre, fn) }
        : null,
      canal: canalNativo
        ? {
          publicar(mensaje) { canalNativo.postMessage(mensaje) },
          suscribir(fn) {
            oidores.add(fn)
            return () => oidores.delete(fn)
          },
        }
        : null,
      fetch: (...args) => globalThis.fetch(...args),
      identificar: identificarAccess,
      uuid: () => globalThis.crypto.randomUUID(),
      guardarAccess: writeToken,
      leerAccess: getToken,
      limpiarAccess: () => sessionStorage.removeItem(TOKEN_KEY),
      urlLogin: apiUrl('/api/Auth/Login'),
      urlVerificar: apiUrl('/api/Auth/mfa/verificar'),
      urlVinculacionInicio: apiUrl('/api/Auth/mfa/vinculacion/iniciar'),
      urlVinculacionConfirmar: apiUrl('/api/Auth/mfa/vinculacion/confirmar'),
      urlRefresh: apiUrl('/api/Auth/refresh'),
      urlCierre: apiUrl('/api/Auth/cerrar-sesion'),
      alCambiarRemoto: () => {
        clearSession()
        clearEmpresaContexto({ silent: true })
        window.dispatchEvent(new CustomEvent('ca:session-reset'))
      },
    })
  }
  return coordinador
}

export function mensajeCompatibilidadSesion() {
  return sesion().soporta() ? '' : MENSAJE_COMPATIBILIDAD
}

export async function prepararArranque() {
  const resultado = await sesion().preparar()
  if (resultado.modo === 'login') {
    clearSession()
    return resultado
  }
  const token = getToken()
  if (token && !getCurrentUser()) writeSession(userFromToken(token))
  return resultado
}

export function olvidarIdentidadLocal() {
  clearEmpresaContexto({ silent: true })
  clearSession()
  setLoginNotice(MENSAJE_SESION_CAMBIADA)
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('ca:session-reset'))
  }
}

export function descartarAccessLocal() {
  clearSession()
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('ca:session-reset'))
  }
}

export async function intentarRenovar() {
  return sesion().renovar()
}

async function leerJson(response) {
  try {
    return await response.json()
  } catch {
    return null
  }
}

export const LOGIN_TEMPORARY_LOCK_MESSAGE =
  'Por seguridad, la cuenta se encuentra temporalmente bloqueada. Intentá nuevamente más tarde o contactá a un administrador.'

export const LOGIN_RATE_LIMIT_MESSAGE =
  'Se realizaron demasiados intentos. Esperá unos minutos antes de volver a intentar.'

export const MFA_INVALID_MESSAGE = 'El código no es válido.'
export const MFA_LOCKED_MESSAGE = 'Demasiados intentos. Esperá unos minutos e iniciá sesión de nuevo.'
export const MFA_EXPIRED_MESSAGE = 'El tiempo para ingresar el código venció. Iniciá sesión de nuevo.'
export const MFA_UNCERTAIN_MESSAGE = 'No se pudo confirmar el ingreso. Iniciá sesión de nuevo. El código no se reenvió.'
export const MFA_REPLACED_MESSAGE = 'La sesión cambió. Iniciá sesión de nuevo.'
export const MFA_UNAVAILABLE_MESSAGE = 'El segundo factor no está disponible en este momento.'

const MFA_VOLVER = new Set(['vencido', 'incierto', 'reemplazado', 'descartado', 'mfa_bloqueado'])
let mfaTradicional = null

export function encabezadosRenovables() {
  if (!sesion().soporta()) return {}
  const generacion = sesion().identidad()?.generacion || sesion().leer()?.generacion || null
  if (!generacion) return {}
  return {
    'X-CF-Solicitud': '1',
    'X-CF-Generacion': generacion,
  }
}

function errorMfa(codigo, status = 0) {
  const mensajes = {
    mfa_invalido: MFA_INVALID_MESSAGE,
    mfa_bloqueado: MFA_LOCKED_MESSAGE,
    vencido: MFA_EXPIRED_MESSAGE,
    incierto: MFA_UNCERTAIN_MESSAGE,
    reemplazado: MFA_REPLACED_MESSAGE,
    descartado: MFA_REPLACED_MESSAGE,
    mfa_no_disponible: MFA_UNAVAILABLE_MESSAGE,
  }
  const error = new Error(mensajes[codigo] || 'No se pudo comprobar el segundo factor.')
  error.code = codigo
  error.status = status
  error.volver = MFA_VOLVER.has(codigo)
  return error
}

function publicarIngreso(token, payload, email, mismoUsuario) {
  const user = userFromToken(token, email)
  if (isAgentCredential(token, user)) {
    clearSession()
    void logout()
    throw new Error('Esta cuenta no puede usar el panel web.')
  }
  user.requiereCambioPassword = Boolean(
    payload?.requiereCambioPassword ?? payload?.RequiereCambioPassword,
  )
  if (!(mismoUsuario && isSuperadmin(user))) {
    clearEmpresaContexto({ silent: true })
  }
  resetSessionGuards()
  writeSession(user)
  return user
}

function traducirVerificacion(resultado) {
  if (resultado?.modo === 'incierto' || resultado?.status === 500 || resultado?.status === 503) {
    return errorMfa(resultado?.codigo === 'mfa_no_disponible' ? 'mfa_no_disponible' : 'incierto', resultado.status || 0)
  }
  if (resultado?.status === 429) {
    const error = new Error(LOGIN_RATE_LIMIT_MESSAGE)
    error.status = 429
    error.code = 'limite'
    return error
  }
  if (resultado?.codigo === 'mfa_invalido') return errorMfa('mfa_invalido', 401)
  if (resultado?.codigo === 'mfa_bloqueado') return errorMfa('mfa_bloqueado', 401)
  if (resultado?.modo === 'vencido') return errorMfa('vencido', 401)
  if (resultado?.modo === 'reemplazado' || resultado?.status === 403) return errorMfa('reemplazado', resultado.status || 403)
  return errorMfa(resultado?.modo || 'descartado', resultado?.status || 0)
}

export async function login({ email, password }) {
  const normalizedEmail = String(email ?? '').trim()
  const normalizedPassword = String(password ?? '')
  const loginUrl = apiUrl('/api/Auth/Login')
  mfaTradicional = null

  if (sesion().soporta()) {
    const resultado = await sesion().iniciar({ email: normalizedEmail, password: normalizedPassword })
    const statusLogin = resultado.modo === 'mfa' || resultado.modo === 'vinculacion'
      ? 401
      : (resultado.status || (resultado.modo === 'renovable' ? 200 : 0))
    logApiResponse('POST', '/api/Auth/Login', statusLogin)
    if (resultado.modo === 'mfa') {
      return { pendienteMfa: true, intento: resultado.intento, expiraEn: resultado.expiraEn }
    }
    if (resultado.modo === 'vinculacion') {
      return { vinculacion: true, intento: resultado.intento, expiraEn: resultado.expiraEn }
    }
    if (resultado.modo === 'red' || resultado.modo === 'ilegible') {
      logApiNetworkError('POST', '/api/Auth/Login')
      throw new Error(
        `No se pudo conectar con la API (${loginUrl}). Si el servidor responde, suele ser CORS o que el navegador no llega a esa URL.`,
      )
    }
    if (resultado.modo === 'http') {
      throw loginError(resultado.status, resultado.codigo)
    }
    if (resultado.modo !== 'renovable' || !resultado.token) {
      throw new Error('La API no devolvió un token de acceso.')
    }
    return publicarIngreso(resultado.token, resultado.payload, normalizedEmail, resultado.mismoUsuario)
  }

  let response
  try {
    response = await fetch(loginUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: normalizedEmail, password: normalizedPassword }),
    })
  } catch (error) {
    logApiNetworkError('POST', '/api/Auth/Login')
    console.error('Login: error de red o CORS', { url: loginUrl, error })
    throw new Error(
      `No se pudo conectar con la API (${loginUrl}). Si el servidor responde, suele ser CORS o que el navegador no llega a esa URL.`,
    )
  }
  logApiResponse('POST', '/api/Auth/Login', response.status)
  if (response.status === 401) {
    const cuerpo = await leerJson(response)
    if (cuerpo?.codigo === 'mfa_requerido' && cuerpo.desafio && cuerpo.expiraEn) {
      mfaTradicional = {
        id: globalThis.crypto.randomUUID(),
        tipo: 'login',
        desafio: cuerpo.desafio,
        expiraEn: cuerpo.expiraEn,
        email: normalizedEmail,
      }
      return { pendienteMfa: true, intento: mfaTradicional.id, expiraEn: cuerpo.expiraEn }
    }
    if (cuerpo?.codigo === 'vinculacion_mfa_pendiente' && cuerpo.desafio && cuerpo.expiraEn) {
      mfaTradicional = {
        id: globalThis.crypto.randomUUID(),
        tipo: 'vinculacion',
        desafio: cuerpo.desafio,
        expiraEn: cuerpo.expiraEn,
        operacion: null,
        email: normalizedEmail,
      }
      return { vinculacion: true, intento: mfaTradicional.id, expiraEn: cuerpo.expiraEn }
    }
    throw loginError(401, cuerpo?.codigo)
  }
  if (response.status === 503) {
    const cuerpo = await leerJson(response)
    throw loginError(503, cuerpo?.codigo)
  }
  if (!response.ok) throw loginError(response.status)
  const payload = await leerJson(response)
  const token = payload?.token ?? payload?.Token
  if (!token) throw new Error('La API no devolvió un token de acceso.')
  writeToken(token)
  return publicarIngreso(token, payload, normalizedEmail, false)
}

export function cancelarSegundoFactor(intento) {
  if (sesion().soporta()) sesion().cancelar(intento)
  if (mfaTradicional?.id === intento) mfaTradicional = null
}

export async function iniciarVinculacion(intento) {
  if (sesion().soporta()) {
    const resultado = await sesion().iniciarVinculacion({ intento })
    if (resultado.status) logApiResponse('POST', '/api/Auth/mfa/vinculacion/iniciar', resultado.status)
    if (resultado.modo === 'inicio') {
      logApiResponse('POST', '/api/Auth/mfa/vinculacion/iniciar', 200)
      return resultado
    }
    throw traducirVerificacion(resultado)
  }
  return vinculacionTradicional('iniciar', intento)
}

export async function confirmarVinculacion({ intento, codigo }) {
  if (sesion().soporta()) {
    const resultado = await sesion().confirmarVinculacion({ intento, codigo })
    if (resultado.status) logApiResponse('POST', '/api/Auth/mfa/vinculacion/confirmar', resultado.status)
    if (resultado.modo === 'codigos') {
      logApiResponse('POST', '/api/Auth/mfa/vinculacion/confirmar', 200)
      return resultado
    }
    throw traducirVerificacion(resultado)
  }
  return vinculacionTradicional('confirmar', intento, codigo)
}

async function vinculacionTradicional(paso, intento, codigo) {
  const pendiente = mfaTradicional
  if (!pendiente || pendiente.id !== intento || pendiente.tipo !== 'vinculacion') throw errorMfa('descartado')
  if (Number.isNaN(Date.parse(pendiente.expiraEn)) || Date.parse(pendiente.expiraEn) <= Date.now()) {
    mfaTradicional = null
    throw errorMfa('vencido', 401)
  }
  const path = paso === 'iniciar'
    ? '/api/Auth/mfa/vinculacion/iniciar'
    : '/api/Auth/mfa/vinculacion/confirmar'
  const body = paso === 'iniciar'
    ? { desafio: pendiente.desafio }
    : { desafio: pendiente.desafio, operacion: pendiente.operacion, codigo: String(codigo ?? '').trim() }
  let response
  try {
    response = await fetch(apiUrl(path), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch {
    mfaTradicional = null
    logApiNetworkError('POST', path)
    throw errorMfa('incierto', 0)
  }
  logApiResponse('POST', path, response.status)
  if (response.status === 500 || response.status === 503) {
    mfaTradicional = null
    throw errorMfa('incierto', response.status)
  }
  const payload = await leerJson(response)
  if (!response.ok) {
    if (response.status === 401 && payload?.codigo === 'mfa_invalido') throw errorMfa('mfa_invalido', 401)
    mfaTradicional = null
    throw errorMfa(payload?.codigo || 'descartado', response.status)
  }
  if (paso === 'iniciar' && payload?.operacion && payload?.uri && payload?.claveManual) {
    pendiente.operacion = payload.operacion
    return {
      modo: 'inicio',
      operacion: payload.operacion,
      uri: payload.uri,
      claveManual: payload.claveManual,
      expiraEn: payload.expiraEn || pendiente.expiraEn,
    }
  }
  mfaTradicional = null
  return {
    modo: 'codigos',
    mensaje: payload?.mensaje || '',
    codigos: Array.isArray(payload?.codigos) ? payload.codigos.map((item) => String(item)) : [],
  }
}

export async function verificarSegundoFactor({ intento, codigo, codigoRecuperacion }) {
  const totp = String(codigo ?? '').trim()
  const recuperacion = String(codigoRecuperacion ?? '').trim()
  if (Boolean(totp) === Boolean(recuperacion)) {
    throw errorMfa('mfa_codigo_requerido', 400)
  }

  if (sesion().soporta()) {
    const resultado = await sesion().verificar({ intento, codigo: totp, codigoRecuperacion: recuperacion })
    if (resultado.status) logApiResponse('POST', '/api/Auth/mfa/verificar', resultado.status)
    if (resultado.modo === 'renovable' && resultado.token) {
      logApiResponse('POST', '/api/Auth/mfa/verificar', 200)
      const email = userFromToken(resultado.token).email
      return publicarIngreso(resultado.token, resultado.payload, email, resultado.mismoUsuario)
    }
    throw traducirVerificacion(resultado)
  }

  const pendiente = mfaTradicional
  if (!pendiente || pendiente.id !== intento) throw errorMfa('descartado')
  if (Number.isNaN(Date.parse(pendiente.expiraEn)) || Date.parse(pendiente.expiraEn) <= Date.now()) {
    mfaTradicional = null
    throw errorMfa('vencido', 401)
  }
  let response
  try {
    response = await fetch(apiUrl('/api/Auth/mfa/verificar'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(totp
        ? { desafio: pendiente.desafio, codigo: totp }
        : { desafio: pendiente.desafio, codigoRecuperacion: recuperacion }),
    })
  } catch (error) {
    mfaTradicional = null
    logApiNetworkError('POST', '/api/Auth/mfa/verificar')
    console.error('Verificación MFA: error de red', { error })
    throw errorMfa('incierto')
  }
  logApiResponse('POST', '/api/Auth/mfa/verificar', response.status)
  if (mfaTradicional?.id !== intento) throw errorMfa('descartado', response.status)
  if (response.status === 500 || response.status === 503) {
    mfaTradicional = null
    throw errorMfa('incierto', response.status)
  }
  if (!response.ok) {
    const cuerpo = await leerJson(response)
    if (response.status === 401 && cuerpo?.codigo === 'mfa_invalido') throw errorMfa('mfa_invalido', 401)
    mfaTradicional = null
    throw traducirVerificacion({ modo: 'http', status: response.status, codigo: cuerpo?.codigo || null })
  }
  const payload = await leerJson(response)
  const token = payload?.token ?? payload?.Token
  if (mfaTradicional?.id !== intento) throw errorMfa('descartado')
  if (!token) {
    mfaTradicional = null
    throw errorMfa('incierto', response.status)
  }
  mfaTradicional = null
  writeToken(token)
  return publicarIngreso(token, payload, pendiente.email, false)
}

function loginError(status, codigo) {
  console.error('Login: respuesta HTTP no exitosa', { status })
  if (codigo === 'vinculacion_no_disponible') {
    return new Error('El enrolamiento de doble factor está deshabilitado en este entorno. No se abrió una sesión.')
  }
  if (codigo === 'mfa_no_disponible' || status === 503) return errorMfa('mfa_no_disponible', status)
  if (status === 401) return new Error('Correo o contraseña incorrectos.')
  if (status === 400) return new Error('Los datos de inicio de sesión no son válidos.')
  if (status === 403) return new Error('No tenés permiso para iniciar sesión.')
  if (status === 423) return new Error(LOGIN_TEMPORARY_LOCK_MESSAGE)
  if (status === 429) return new Error(LOGIN_RATE_LIMIT_MESSAGE)
  return new Error(`No se pudo iniciar sesión (${status}).`)
}

export async function cambiarPassword({ passwordActual, nuevaPassword, confirmarPassword }) {
  const token = getToken()
  if (!token) {
    throw new Error('No hay sesión activa. Iniciá sesión para cambiar la contraseña.')
  }

  const generacion = sesion().identidad()?.generacion || sesion().leer()?.generacion || null
  const path = AUTH_CAMBIAR_PASSWORD_PATH
  const url = apiUrl(path)
  let response

  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        passwordActual,
        nuevaPassword,
        confirmarPassword,
      }),
    })
  } catch (error) {
    logApiNetworkError('POST', path)
    console.error('Cambio de contraseña: error de red o CORS', { url, error })
    throw new Error(
      `No se pudo conectar con la API (${url}). Si el servidor responde, suele ser CORS o que el navegador no llega a esa URL.`,
    )
  }

  logApiResponse('POST', path, response.status)

  if (response.status === 401) {
    const renovacion = sesion().soporta() ? await intentarRenovar() : null
    if (renovacion?.ok && !renovacion.identidadDistinta) {
      const error = new Error(MENSAJE_OPERACION_NO_REPETIDA)
      error.status = 401
      error.code = 'NO_REINTENTAR'
      throw error
    }
    if (renovacion?.codigo === 'identidad' || renovacion?.identidadDistinta) {
      const error = new Error(MENSAJE_SESION_CAMBIADA)
      error.status = 401
      error.code = 'SESION_CAMBIADA'
      throw error
    }
    if (renovacion?.codigo === 'incierta' || renovacion?.codigo === 'limite' || renovacion?.codigo === 'red') {
      const error = new Error('No se pudo confirmar la sesión. Volvé a intentar el cambio cuando inicies sesión.')
      error.status = response.status
      throw error
    }
    notifyUnauthorized()
    const error = new Error(SESSION_EXPIRED_CATCH_MESSAGE)
    error.status = 401
    error.code = 'UNAUTHORIZED'
    throw error
  }

  if (!response.ok) {
    const fallback = 'No se pudo cambiar la contraseña.'
    let message = fallback
    try {
      const text = (await response.text()).trim()
      if (text) {
        const parsed = JSON.parse(text)
        const apiMessage = parsed?.mensaje ?? parsed?.message
        message = sanitizePublicErrorMessage(apiMessage, fallback)
      }
    } catch {
      message = fallback
    }

    const error = new Error(message)
    error.status = response.status
    throw error
  }

  return { mensaje: PASSWORD_CHANGED_LOGIN_MESSAGE, generacion }
}

export function finishPasswordChange(generacion) {
  setLoginNotice(PASSWORD_CHANGED_LOGIN_MESSAGE)
  return logout({ generacion })
}

export async function logout(opciones = {}) {
  logInfo('Autenticación', 'Cierre de sesión.')
  const pedido = opciones.generacion || null
  const actual = sesion().leer()
  if (pedido && actual?.generacion && pedido !== actual.generacion) {
    return { confirmado: true, omitido: true }
  }
  passwordChangeNotified = false
  clearEmpresaContexto({ silent: true })
  clearSession()
  clearActivityLogs()
  const resultado = await sesion().cerrar({ generacion: pedido || actual?.generacion })
  if (resultado?.confirmado === false) setLoginNotice(MENSAJE_CIERRE_SIN_CONFIRMAR)
  return resultado
}
