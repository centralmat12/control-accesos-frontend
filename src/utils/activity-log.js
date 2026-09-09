/**
 * Registro de actividad del panel, solo en sessionStorage.
 * No guarda tokens, passwords, bodies ni datos biométricos.
 */

export const ACTIVITY_LOG_KEY = 'ca.activity.logs'
export const ACTIVITY_LOG_EVENT = 'ca:activity-log'
export const ACTIVITY_LOG_LIMIT = 250

export const LOG_LEVELS = {
  INFO: 'INFO',
  OK: 'OK',
  WARNING: 'WARNING',
  ERROR: 'ERROR',
}

const SENSITIVE_PATTERN =
  /authorization|bearer|password|passwd|pwd|clientsecret|client_secret|jwt|token|template|huella|biometric|connectionstring|connection_string|cookie/i

function safeText(value, max = 240) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
}

function looksSensitive(value) {
  return SENSITIVE_PATTERN.test(String(value ?? ''))
}

export function sanitizeActivityRoute(path) {
  const raw = String(path ?? '').trim()
  if (!raw) return '/'

  const withoutOrigin = raw.replace(/^https?:\/\/[^/]+/i, '')
  const [pathname, query = ''] = withoutOrigin.split('?')
  const route = pathname || '/'
  if (!query) return route

  const kept = []
  const params = new URLSearchParams(query)
  for (const [key, value] of params.entries()) {
    if (looksSensitive(key) || looksSensitive(value)) continue
    kept.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
  }

  return kept.length ? `${route}?${kept.join('&')}` : route
}

function readLogs() {
  const raw = sessionStorage.getItem(ACTIVITY_LOG_KEY)
  if (!raw) return []

  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    sessionStorage.removeItem(ACTIVITY_LOG_KEY)
    return []
  }
}

function writeLogs(logs) {
  const trimmed = logs.slice(-ACTIVITY_LOG_LIMIT)
  sessionStorage.setItem(ACTIVITY_LOG_KEY, JSON.stringify(trimmed))
  window.dispatchEvent(new CustomEvent(ACTIVITY_LOG_EVENT, { detail: { count: trimmed.length } }))
  return trimmed
}

const DEDUP_WINDOW_MS = 5_000

function pathnameOnly(path) {
  return sanitizeActivityRoute(path).split('?')[0]
}

function resourceFromPath(path) {
  const route = pathnameOnly(path).toLowerCase()

  if (route.includes('/auth')) {
    return { action: 'Autenticación', noun: 'autenticación', consulting: 'iniciar sesión' }
  }
  if (route.includes('/empleados')) {
    return { action: 'Empleados', noun: 'empleados', consulting: 'consultar empleados' }
  }
  if (route.includes('/fichadas')) {
    return { action: 'Fichadas', noun: 'fichadas', consulting: 'consultar fichadas' }
  }
  if (route.includes('/empresas')) {
    return { action: 'Empresas', noun: 'empresas', consulting: 'consultar empresas' }
  }
  if (route.includes('/sucursales')) {
    return { action: 'Sucursales', noun: 'sucursales', consulting: 'consultar sucursales' }
  }
  if (route.includes('/departamentos')) {
    return { action: 'Empleados', noun: 'departamentos', consulting: 'consultar departamentos' }
  }
  if (route.includes('/usuarios')) {
    return { action: 'Usuarios', noun: 'usuarios', consulting: 'administrar usuarios' }
  }
  if (route.includes('/agentes')) {
    return { action: 'Agentes', noun: 'agentes', consulting: 'administrar agentes' }
  }

  return { action: 'Sistema', noun: 'datos', consulting: 'consultar la API' }
}

function successDetail(method, path) {
  const verb = String(method || 'GET').toUpperCase()
  const route = pathnameOnly(path).toLowerCase()
  const { noun } = resourceFromPath(path)

  if (route.includes('/auth')) return 'Inicio de sesión correcto.'
  if (verb === 'POST') {
    if (noun === 'empleados') return 'Empleado creado correctamente.'
    if (noun === 'usuarios') return 'Usuario creado correctamente.'
    if (noun === 'empresas') return 'Empresa creada correctamente.'
    if (noun === 'sucursales') return 'Sucursal creada correctamente.'
    if (noun === 'agentes' && route.includes('rotar-secret')) return 'Operación de agente registrada correctamente.'
    if (noun === 'agentes') return 'Agente creado correctamente.'
    return `Alta de ${noun} registrada correctamente.`
  }
  if (verb === 'PATCH' || verb === 'PUT') {
    if (noun === 'empleados') return 'Empleado actualizado correctamente.'
    return `Datos de ${noun} actualizados correctamente.`
  }
  if (verb === 'DELETE') {
    if (noun === 'empleados') return 'Empleado desactivado correctamente.'
    return `Baja de ${noun} registrada correctamente.`
  }

  if (noun === 'empleados' && /\/empleados\/\d+/i.test(route)) {
    return 'Datos del empleado cargados correctamente.'
  }

  return `Listado de ${noun} cargado correctamente.`
}

function errorDetail(method, path, status) {
  const code = Number(status)
  const route = pathnameOnly(path)
  const { noun, consulting } = resourceFromPath(path)

  if (!Number.isFinite(code)) {
    return `No fue posible completar la operación al ${consulting}.`
  }

  if (code === 403) {
    return `Error 403 al ${consulting} (${route}). Posible problema de permisos o autorización en la API.`
  }

  if (code === 401) {
    if (route.toLowerCase().includes('/auth')) {
      return 'Error 401 al iniciar sesión. La cuenta no está autorizada o las credenciales no son válidas.'
    }
    return `Error 401 al ${consulting}. La sesión no está autorizada o expiró.`
  }

  if (code === 404) {
    return `Error 404 al ${consulting}. El recurso no está disponible.`
  }

  if (code >= 500) {
    return `Error ${code} al ${consulting}. Posible error interno del servicio.`
  }

  if (code === 400) {
    return `Error 400 al ${consulting}. Los datos enviados no son válidos.`
  }

  return `Error ${code} al ${consulting}.`
}

function networkDetail(path) {
  const { consulting } = resourceFromPath(path)
  return `No fue posible conectar con la API al ${consulting}.`
}

function isDuplicate(logs, level, action, detail) {
  const now = Date.now()

  for (let index = logs.length - 1; index >= 0; index -= 1) {
    const entry = logs[index]
    const then = new Date(entry.at).getTime()
    if (Number.isNaN(then) || now - then >= DEDUP_WINDOW_MS) break
    if (entry.level === level && entry.action === action && entry.detail === detail) {
      return true
    }
  }

  return false
}

function appendLog(level, action, detail) {
  const normalizedAction = safeText(action, 40) || 'Sistema'
  const normalizedDetail = safeText(detail, 280)

  if (!normalizedDetail || looksSensitive(normalizedAction) || looksSensitive(normalizedDetail)) {
    return null
  }

  const logs = readLogs()

  if (isDuplicate(logs, level, normalizedAction, normalizedDetail)) {
    return logs[logs.length - 1]
  }

  const entry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    at: new Date().toISOString(),
    level,
    action: normalizedAction,
    detail: normalizedDetail,
  }

  logs.push(entry)
  writeLogs(logs)
  return entry
}

export function logInfo(action, detail = '') {
  return appendLog(LOG_LEVELS.INFO, action, detail)
}

export function logSuccess(action, detail = '') {
  return appendLog(LOG_LEVELS.OK, action, detail)
}

export function logWarning(action, detail = '') {
  return appendLog(LOG_LEVELS.WARNING, action, detail)
}

export function logError(action, detail = '') {
  return appendLog(LOG_LEVELS.ERROR, action, detail)
}

export function getActivityLogs() {
  return [...readLogs()].reverse()
}

export function clearActivityLogs() {
  writeLogs([])
}

export function countActivityByLevel(logs = getActivityLogs()) {
  return logs.reduce(
    (acc, entry) => {
      if (entry.level === LOG_LEVELS.ERROR) acc.error += 1
      if (entry.level === LOG_LEVELS.WARNING) acc.warning += 1
      return acc
    },
    { error: 0, warning: 0 },
  )
}

export function logApiResponse(method, path, status) {
  const { action } = resourceFromPath(path)
  const code = Number(status)

  if (!Number.isFinite(code) || code >= 400) {
    logError(action, errorDetail(method, path, code))
    return
  }

  logSuccess(action, successDetail(method, path))
}

export function logApiNetworkError(method, path) {
  void method
  const { action } = resourceFromPath(path)
  logError(action, networkDetail(path))
}
