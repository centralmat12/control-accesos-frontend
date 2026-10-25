import { apiFetch } from './http.js'
import { getOperativeEmpresaId } from './empresa-context.js'
import { EMPRESA_CONTEXTO_EVENT } from './empresa-context.js'
import { getCurrentUser } from './auth.js'
import { isAdmin, isSuperadmin } from '../config/roles.js'

/**
 * Único registro de capacidades de la API nueva.
 * No sondea con POST, PUT, PATCH ni DELETE.
 *
 * Samuel, para activar la clasificación del servidor, la API debe responder:
 * GET /api/capabilities
 * { "classification": "daily-first-last-v1" }
 * y cada fichada debe traer `movimientoVisual` y `jornadaEstado`
 * con los valores que ya usa el frontend. Un campo `estado` de fichada
 * (Completada / Incompleto) no alcanza.
 */
export const CAPABILITY = Object.freeze({
  turnosRead: 'turnos.read',
  turnosWrite: 'turnos.write',
  jornadasAssignments: 'jornadas.assignments',
  jornadasCalendar: 'jornadas.calendar',
  jornadasSummary: 'jornadas.summary',
  jornadasExceptions: 'jornadas.exceptions',
  jornadasRepositions: 'jornadas.repositions',
  fichadasIncompleteAlerts: 'fichadas.incompleteAlerts',
  fichadasManual: 'fichadas.manual',
  fichadasExtendedMetadata: 'fichadas.extendedMetadata',
  fichadasServerClassification: 'fichadas.serverClassification',
})

export const CAPABILITY_STATUS = Object.freeze({
  available: 'available',
  unavailable: 'unavailable',
  forbidden: 'forbidden',
  unauthorized: 'unauthorized',
  temporarilyUnavailable: 'temporarilyUnavailable',
  unknown: 'unknown',
})

export const SERVER_CLASSIFICATION_ID = 'daily-first-last-v1'
export const SESSION_RESET_EVENT = 'ca:session-reset'

const CACHEABLE = new Set([
  CAPABILITY_STATUS.available,
  CAPABILITY_STATUS.unavailable,
  CAPABILITY_STATUS.forbidden,
])

const cache = new Map()
const inflight = new Map()

function devLog(message, detail) {
  try {
    if (import.meta.env?.DEV) console.info(message, detail ?? '')
  } catch {
    /* entorno de pruebas sin import.meta */
  }
}

export function resetCapabilities() {
  cache.clear()
  inflight.clear()
}

function sessionKey(capability) {
  const empresaId = getOperativeEmpresaId(getCurrentUser()) ?? 'none'
  return `${empresaId}:${capability}`
}

export function interpretProbeResponse(response, { mode = 'read', valid = true } = {}) {
  const status = Number(response?.status)
  if (!Number.isFinite(status) || status === 0) {
    return { status: CAPABILITY_STATUS.temporarilyUnavailable, reason: 'network' }
  }
  if (status === 401) return { status: CAPABILITY_STATUS.unauthorized, reason: 'session' }
  if (status === 403) return { status: CAPABILITY_STATUS.forbidden, reason: 'forbidden' }
  if (status >= 500) return { status: CAPABILITY_STATUS.temporarilyUnavailable, reason: 'server' }
  if (mode === 'write-probe') {
    if (status === 404) return { status: CAPABILITY_STATUS.unavailable, reason: 'missing' }
    if (status === 405) {
      const allow = String(response.headers?.get?.('Allow') ?? response.allow ?? '')
      const methods = allow.split(',').map((item) => item.trim().toUpperCase())
      if (methods.includes('POST')) return { status: CAPABILITY_STATUS.available, reason: 'allow-post' }
      return { status: CAPABILITY_STATUS.unavailable, reason: 'method' }
    }
  }
  if (status === 404) {
    return { status: CAPABILITY_STATUS.unavailable, reason: 'missing' }
  }
  if (status === 405) {
    return { status: CAPABILITY_STATUS.unavailable, reason: 'method' }
  }
  if (status === 200) {
    if (valid === false) {
      devLog('Capacidad con contrato inválido', { mode })
      return { status: CAPABILITY_STATUS.temporarilyUnavailable, reason: 'contract' }
    }
    return { status: CAPABILITY_STATUS.available, reason: 'ok' }
  }
  if (status >= 400) return { status: CAPABILITY_STATUS.temporarilyUnavailable, reason: 'server' }
  return { status: CAPABILITY_STATUS.unknown, reason: 'unexpected' }
}

export function isTurnoListPayload(payload) {
  return Array.isArray(payload) && payload.every((item) => item == null || typeof item === 'object')
}

export function isAssignmentListPayload(payload) {
  return Array.isArray(payload)
}

export function isCalendarPayload(payload) {
  return Array.isArray(payload)
}

export function isSummaryPayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return false
  return 'minutosProgramados' in payload || 'MinutosProgramados' in payload || 'saldoMinutos' in payload || 'SaldoMinutos' in payload
}

export function isAlertListPayload(payload) {
  return Array.isArray(payload)
}

export function readClassificationDeclaration(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null
  const value = payload.classification ?? payload.clasificacion ?? payload.classificationVersion
  return typeof value === 'string' ? value.trim() : null
}

function roleCanWriteTurnos() {
  const user = getCurrentUser()
  return isSuperadmin(user) || isAdmin(user)
}

async function defaultRequest(path, options) {
  return apiFetch(path, { ...options, logLabel: false })
}

async function readJsonIfOk(response) {
  if (response.status !== 200) return undefined
  try {
    return await response.json()
  } catch {
    return Symbol.for('invalid-json')
  }
}

const INVALID_JSON = Symbol.for('invalid-json')

async function probeRead(path, validate, request) {
  try {
    const { response } = await request(path, { method: 'GET' })
    const body = await readJsonIfOk(response)
    const valid = response.status !== 200 ? true : body !== INVALID_JSON && validate(body)
    return interpretProbeResponse(response, { mode: 'read', valid })
  } catch (error) {
    if (error?.status === 401) return { status: CAPABILITY_STATUS.unauthorized, reason: 'session' }
    if (error?.status === 403) return { status: CAPABILITY_STATUS.forbidden, reason: 'forbidden' }
    return { status: CAPABILITY_STATUS.temporarilyUnavailable, reason: 'network' }
  }
}

async function probeManual(request) {
  try {
    const { response } = await request('/api/FichadasManuales', { method: 'GET' })
    return interpretProbeResponse(response, { mode: 'write-probe', valid: true })
  } catch (error) {
    if (error?.status === 401) return { status: CAPABILITY_STATUS.unauthorized, reason: 'session' }
    if (error?.status === 403) return { status: CAPABILITY_STATUS.forbidden, reason: 'forbidden' }
    return { status: CAPABILITY_STATUS.temporarilyUnavailable, reason: 'network' }
  }
}

async function probeClassification(request) {
  try {
    const { response } = await request('/api/capabilities', { method: 'GET' })
    if (response.status === 404 || response.status === 405) {
      return { status: CAPABILITY_STATUS.unavailable, reason: 'missing', declaration: null }
    }
    const body = await readJsonIfOk(response)
    if (response.status === 200 && body === INVALID_JSON) {
      devLog('GET /api/capabilities devolvió un contrato inválido')
      return { status: CAPABILITY_STATUS.temporarilyUnavailable, reason: 'contract', declaration: null }
    }
    const base = interpretProbeResponse(response, { mode: 'read', valid: response.status !== 200 || body !== INVALID_JSON })
    const declaration = response.status === 200 ? readClassificationDeclaration(body) : null
    if (base.status === CAPABILITY_STATUS.available && declaration !== SERVER_CLASSIFICATION_ID) {
      return { status: CAPABILITY_STATUS.unavailable, reason: 'undeclared', declaration }
    }
    return { ...base, declaration }
  } catch (error) {
    if (error?.status === 401) return { status: CAPABILITY_STATUS.unauthorized, reason: 'session', declaration: null }
    return { status: CAPABILITY_STATUS.temporarilyUnavailable, reason: 'network', declaration: null }
  }
}

function remember(key, result) {
  if (CACHEABLE.has(result.status)) cache.set(key, result)
  return result
}

async function resolveDirect(capability, request, context) {
  if (capability === CAPABILITY.turnosRead) {
    return probeRead('/api/Turnos', isTurnoListPayload, request)
  }
  if (capability === CAPABILITY.turnosWrite) {
    if (!roleCanWriteTurnos()) return { status: CAPABILITY_STATUS.forbidden, reason: 'role' }
    const read = await resolveCapability(CAPABILITY.turnosRead, { request, context })
    if (read.status !== CAPABILITY_STATUS.available) return read
    return { status: CAPABILITY_STATUS.available, reason: 'role' }
  }
  if (capability === CAPABILITY.fichadasIncompleteAlerts) {
    return probeRead('/api/fichadas/alertas/incompletas?limite=1', isAlertListPayload, request)
  }
  if (capability === CAPABILITY.fichadasManual) {
    if (!roleCanWriteTurnos()) return { status: CAPABILITY_STATUS.forbidden, reason: 'role' }
    return probeManual(request)
  }
  if (capability === CAPABILITY.fichadasServerClassification) {
    return probeClassification(request)
  }
  if (capability === CAPABILITY.fichadasExtendedMetadata) {
    return { status: CAPABILITY_STATUS.unknown, reason: 'observe-fichadas' }
  }

  const empleadoId = Number(context?.empleadoId)
  if (!Number.isFinite(empleadoId) || empleadoId <= 0) {
    return { status: CAPABILITY_STATUS.unknown, reason: 'needs-employee' }
  }
  const turnos = await resolveCapability(CAPABILITY.turnosRead, { request, context })
  const desde = context?.desde ?? '2000-01-01'
  const hasta = context?.hasta ?? '2000-01-02'

  if (capability === CAPABILITY.jornadasAssignments || capability === CAPABILITY.jornadasExceptions) {
    const result = await probeRead(`/api/jornadas/empleados/${empleadoId}/asignaciones`, isAssignmentListPayload, request)
    if (result.status === CAPABILITY_STATUS.unavailable && result.reason === 'missing' && turnos.status === CAPABILITY_STATUS.unavailable) return result
    if (result.status === CAPABILITY_STATUS.unavailable && result.reason === 'missing' && turnos.status === CAPABILITY_STATUS.available) {
      return { status: CAPABILITY_STATUS.temporarilyUnavailable, reason: 'not-found' }
    }
    if (capability === CAPABILITY.jornadasExceptions && result.status === CAPABILITY_STATUS.available && !roleCanWriteTurnos()) {
      return { status: CAPABILITY_STATUS.forbidden, reason: 'role' }
    }
    return result
  }
  if (capability === CAPABILITY.jornadasCalendar) {
    const result = await probeRead(
      `/api/jornadas/empleados/${empleadoId}/calendario?desde=${encodeURIComponent(desde)}&hasta=${encodeURIComponent(hasta)}`,
      isCalendarPayload,
      request,
    )
    if (result.status === CAPABILITY_STATUS.unavailable && result.reason === 'missing' && turnos.status === CAPABILITY_STATUS.available) {
      return { status: CAPABILITY_STATUS.temporarilyUnavailable, reason: 'not-found' }
    }
    return result
  }
  if (capability === CAPABILITY.jornadasSummary) {
    const result = await probeRead(
      `/api/jornadas/empleados/${empleadoId}/resumen?desde=${encodeURIComponent(desde)}&hasta=${encodeURIComponent(hasta)}`,
      isSummaryPayload,
      request,
    )
    if (result.status === CAPABILITY_STATUS.unavailable && result.reason === 'missing' && turnos.status === CAPABILITY_STATUS.available) {
      return { status: CAPABILITY_STATUS.temporarilyUnavailable, reason: 'not-found' }
    }
    return result
  }
  if (capability === CAPABILITY.jornadasRepositions) {
    const result = await probeRead(
      `/api/jornadas/empleados/${empleadoId}/reposiciones?desde=${encodeURIComponent(desde)}&hasta=${encodeURIComponent(hasta)}`,
      isAssignmentListPayload,
      request,
    )
    if (result.status === CAPABILITY_STATUS.available && context?.write === true && !roleCanWriteTurnos()) {
      return { status: CAPABILITY_STATUS.forbidden, reason: 'role' }
    }
    if (result.status === CAPABILITY_STATUS.unavailable && result.reason === 'missing' && turnos.status === CAPABILITY_STATUS.available) {
      return { status: CAPABILITY_STATUS.temporarilyUnavailable, reason: 'not-found' }
    }
    return result
  }
  return { status: CAPABILITY_STATUS.unknown, reason: 'unknown-capability' }
}

export async function resolveCapability(capability, { request = defaultRequest, force = false, context = {} } = {}) {
  const key = `${sessionKey(capability)}:${context.empleadoId ?? ''}:${context.write ? 'w' : 'r'}`
  if (!force && cache.has(key)) return cache.get(key)
  if (!force && inflight.has(key)) return inflight.get(key)

  const task = resolveDirect(capability, request, context)
    .then((result) => remember(key, result))
    .finally(() => {
      inflight.delete(key)
    })
  inflight.set(key, task)
  return task
}

export function canOpenOperativeForm(capability) {
  if (!capability) return false
  if (capability.status === CAPABILITY_STATUS.available) return true
  if (capability.status === CAPABILITY_STATUS.unknown && capability.reason === 'needs-employee') return true
  return false
}

export function noteExtendedMetadata(records) {
  const list = Array.isArray(records) ? records : []
  if (list.length === 0) return { status: CAPABILITY_STATUS.unknown, reason: 'empty' }
  const present = list.some((item) => item && (item.esManual !== undefined || item.estado !== undefined || item.minutosHastaCorte !== undefined))
  const result = present
    ? { status: CAPABILITY_STATUS.available, reason: 'fields' }
    : { status: CAPABILITY_STATUS.unavailable, reason: 'legacy-payload' }
  cache.set(sessionKey(CAPABILITY.fichadasExtendedMetadata), result)
  return result
}

function bindSessionReset() {
  if (typeof window === 'undefined' || window.__caCapabilitiesBound) return
  window.__caCapabilitiesBound = true
  window.addEventListener?.(EMPRESA_CONTEXTO_EVENT, () => resetCapabilities())
  window.addEventListener?.(SESSION_RESET_EVENT, () => resetCapabilities())
}

bindSessionReset()
