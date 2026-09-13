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
  logout()
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

export const LOGIN_TEMPORARY_LOCK_MESSAGE =
  'Por seguridad, la cuenta se encuentra temporalmente bloqueada. Intentá nuevamente más tarde o contactá a un administrador.'

export const LOGIN_RATE_LIMIT_MESSAGE =
  'Se realizaron demasiados intentos. Esperá unos minutos antes de volver a intentar.'

export async function login({ email, password }) {
  const normalizedEmail = String(email ?? '').trim()
  const normalizedPassword = String(password ?? '')

  const loginUrl = apiUrl('/api/Auth/Login')
  let response

  try {
    response = await fetch(loginUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: normalizedEmail,
        password: normalizedPassword,
      }),
    })
  } catch (error) {
    logApiNetworkError('POST', '/api/Auth/Login')
    console.error('Login: error de red o CORS', { url: loginUrl, error })
    throw new Error(
      `No se pudo conectar con la API (${loginUrl}). Si el servidor responde, suele ser CORS o que el navegador no llega a esa URL.`,
    )
  }

  logApiResponse('POST', '/api/Auth/Login', response.status)

  if (!response.ok) {
    console.error('Login: respuesta HTTP no exitosa', { url: loginUrl, status: response.status })

    if (response.status === 401) {
      throw new Error('Correo o contraseña incorrectos.')
    }

    if (response.status === 400) {
      throw new Error('Los datos de inicio de sesión no son válidos.')
    }

    if (response.status === 403) {
      throw new Error('No tenés permiso para iniciar sesión.')
    }

    if (response.status === 423) {
      throw new Error(LOGIN_TEMPORARY_LOCK_MESSAGE)
    }

    if (response.status === 429) {
      throw new Error(LOGIN_RATE_LIMIT_MESSAGE)
    }

    throw new Error(`No se pudo iniciar sesión (${response.status}).`)
  }

  const payload = await response.json()
  const token = payload?.token ?? payload?.Token

  if (!token) {
    throw new Error('La API no devolvió un token de acceso.')
  }

  const user = userFromToken(token, normalizedEmail)
  if (isAgentCredential(token, user)) {
    throw new Error('Esta cuenta no puede usar el panel web.')
  }

  writeToken(token)
  user.requiereCambioPassword = Boolean(
    payload?.requiereCambioPassword ?? payload?.RequiereCambioPassword,
  )
  if (!isSuperadmin(user)) {
    clearEmpresaContexto({ silent: true })
  }
  resetSessionGuards()
  writeSession(user)
  return user
}

export async function cambiarPassword({ passwordActual, nuevaPassword, confirmarPassword }) {
  const token = getToken()
  if (!token) {
    throw new Error('No hay sesión activa. Iniciá sesión para cambiar la contraseña.')
  }

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

  return { mensaje: PASSWORD_CHANGED_LOGIN_MESSAGE }
}

export function finishPasswordChange() {
  setLoginNotice(PASSWORD_CHANGED_LOGIN_MESSAGE)
  logout()
}

export function logout() {
  logInfo('Autenticación', 'Cierre de sesión.')
  passwordChangeNotified = false
  clearEmpresaContexto({ silent: true })
  clearSession()
  clearActivityLogs()
}
