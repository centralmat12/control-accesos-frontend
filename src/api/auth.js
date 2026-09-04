import { apiUrl } from '../config/api.js'
import { isSuperadmin } from '../config/roles.js'
import { clearEmpresaContexto } from './empresa-context.js'

const SESSION_KEY = 'ca.auth.user'
const TOKEN_KEY = 'ca.auth.token'

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

function decodeJwtPayload(token) {
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
  const user = {
    nombre,
    email,
    rol: rol || 'Usuario',
  }

  if (Number.isFinite(empresaId) && empresaId > 0) {
    user.empresaId = empresaId
  }

  return user
}

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
    console.error('Login: error de red o CORS', { url: loginUrl, error })
    throw new Error(
      `No se pudo conectar con la API (${loginUrl}). Si el servidor responde, suele ser CORS o que el navegador no llega a esa URL.`,
    )
  }

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

    throw new Error(`No se pudo iniciar sesión (${response.status}).`)
  }

  const payload = await response.json()
  const token = payload?.token ?? payload?.Token

  if (!token) {
    throw new Error('La API no devolvió un token de acceso.')
  }

  writeToken(token)

  const user = userFromToken(token, normalizedEmail)
  if (!isSuperadmin(user)) {
    clearEmpresaContexto({ silent: true })
  }
  writeSession(user)
  return user
}

export function logout() {
  clearEmpresaContexto({ silent: true })
  clearSession()
}
