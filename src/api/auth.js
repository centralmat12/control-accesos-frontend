import { mockAdminUser } from '../data/mock/auth.js'

const SESSION_KEY = 'ca.auth.user'

/**
 * Capa de autenticación.
 * Hoy usa un usuario mock; más adelante reemplazar el cuerpo de login por POST /api/auth/login.
 */

function delay(ms = 250) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function toPublicUser(user) {
  return {
    id: user.id,
    nombre: user.nombre,
    email: user.email,
    rol: user.rol,
  }
}

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

export function getCurrentUser() {
  // TODO: GET /api/auth/me
  return readSession()
}

export function isAuthenticated() {
  return getCurrentUser() !== null
}

export async function login({ email, password }) {
  // TODO: POST /api/auth/login
  await delay()

  const normalizedEmail = String(email ?? '').trim().toLowerCase()
  const normalizedPassword = String(password ?? '')

  const matches =
    normalizedEmail === mockAdminUser.email &&
    normalizedPassword === mockAdminUser.password

  if (!matches) {
    throw new Error('Correo o contraseña incorrectos.')
  }

  const user = toPublicUser(mockAdminUser)
  writeSession(user)
  return user
}

export async function logout() {
  // TODO: POST /api/auth/logout
  await delay(80)
  sessionStorage.removeItem(SESSION_KEY)
}
