const SESSION_EXPIRED = 'Sesión expirada o no autorizada.'

export function extractHttpStatus(error) {
  const fromProp = Number(error?.status)
  if (Number.isFinite(fromProp) && fromProp > 0) return fromProp
  const match = String(error?.message ?? '').match(/\((\d{3})\)/)
  if (match) return Number(match[1])
  return 0
}

export function classifyApiFailure(error) {
  const message = String(error?.message ?? '')
  const status = extractHttpStatus(error)

  if (message === SESSION_EXPIRED || status === 401 || status === 403 || /No tenés permiso/i.test(message)) {
    return { outcome: 'auth', status: status || 403, reachable: true }
  }

  if (status > 0) {
    return { outcome: 'server_error', status, reachable: true }
  }

  return { outcome: 'network', status: 0, reachable: false }
}

export function queryFromSettled(name, settled, { skipped = false } = {}) {
  if (skipped) {
    return { name, outcome: 'skipped', status: 0, reachable: false }
  }

  if (!settled) {
    return { name, outcome: 'pending', status: 0, reachable: false }
  }

  if (settled.status === 'fulfilled') {
    return { name, outcome: 'success', status: 200, reachable: true }
  }

  return { name, ...classifyApiFailure(settled.reason) }
}

function looksLikeHtml(body) {
  return /<!doctype html|<html[\s>]/i.test(String(body ?? ''))
}

function statusToken(value) {
  return String(value ?? '').trim().toLowerCase()
}

export function interpretHealthResponse({
  status = 0,
  contentType = '',
  body = '',
  networkError = false,
  skipped = false,
} = {}) {
  if (skipped) {
    return {
      verdict: 'skipped',
      connected: null,
      reachable: false,
      status: 0,
      contentType: '',
      body: '',
      reason: 'disabled',
    }
  }
  if (networkError) {
    return {
      verdict: 'inconclusive',
      connected: null,
      reachable: false,
      status: 0,
      contentType,
      body,
      reason: 'network',
    }
  }

  const text = String(body ?? '').trim()
  let token = ''

  if (text && !looksLikeHtml(text)) {
    if (statusToken(text) === 'healthy' || statusToken(text) === 'unhealthy' || statusToken(text) === 'degraded') {
      token = statusToken(text)
    } else {
      try {
        const parsed = JSON.parse(text)
        token = statusToken(parsed?.status ?? parsed?.Status ?? parsed?.estado)
      } catch {
        token = ''
      }
    }
  }

  if ((status === 200 || status === 204) && (token === 'healthy' || token === 'degraded')) {
    return {
      verdict: 'healthy',
      connected: true,
      reachable: true,
      status,
      contentType,
      body: text,
      reason: 'explicit',
    }
  }

  if (status === 503 || token === 'unhealthy') {
    return {
      verdict: 'unhealthy',
      connected: false,
      reachable: true,
      status,
      contentType,
      body: text,
      reason: 'explicit',
    }
  }

  return {
    verdict: 'inconclusive',
    connected: null,
    reachable: status > 0,
    status,
    contentType,
    body: text,
    reason: status === 404 ? 'not_found' : token ? 'unrecognized' : 'unparseable',
  }
}

export function deriveSistemaKind(queries, { settled = false } = {}) {
  if (!settled) return 'unknown'

  const main = (Array.isArray(queries) ? queries : []).filter((item) => item && item.outcome !== 'skipped')
  const success = main.some((item) => item.outcome === 'success')
  const serverError = main.some((item) => item.outcome === 'server_error')
  const reachable = main.some((item) => item.reachable)

  if (success && !serverError) return 'ok'
  if (success && serverError) return 'degraded'
  if (!reachable) return 'offline'
  return 'degraded'
}

export function deriveBaseDatosConnected({
  health = null,
  evidence = [],
  sistemaKind = 'unknown',
} = {}) {
  if (sistemaKind === 'offline') return null
  if (health?.verdict === 'healthy') return true
  if (health?.verdict === 'unhealthy') return false

  const hasEvidence = (Array.isArray(evidence) ? evidence : []).some((item) => item?.outcome === 'success')
  if (hasEvidence) return true
  return null
}

export function sistemaKindToStatus(kind, { errorMessage = '', detailed = false } = {}) {
  if (kind === 'ok') {
    return {
      tone: 'success',
      label: 'Operativo',
      detail: 'Al menos una consulta principal de la API respondió correctamente.',
    }
  }

  if (kind === 'degraded') {
    return {
      tone: 'warning',
      label: 'Con inconvenientes',
      detail: detailed
        ? errorMessage || 'La API respondió, pero alguna consulta principal devolvió un error.'
        : 'La API respondió, pero alguna consulta principal devolvió un error.',
    }
  }

  if (kind === 'offline') {
    return {
      tone: 'danger',
      label: 'No disponible',
      detail: detailed && errorMessage ? errorMessage : 'No pudo establecerse comunicación con la API.',
    }
  }

  return {
    tone: 'neutral',
    label: 'Estado desconocido',
    detail: 'Todavía no terminó la verificación del sistema.',
  }
}

export function baseDatosKindToStatus(connected, { source = '', detailed = false, errorMessage = '' } = {}) {
  if (connected === true) {
    return {
      tone: 'success',
      label: 'Conectada',
      detail: source || 'Una consulta que depende de la base respondió correctamente.',
    }
  }

  if (connected === false) {
    return {
      tone: 'danger',
      label: 'No disponible',
      detail: detailed
        ? errorMessage || 'El chequeo opcional de disponibilidad indicó que la base no está accesible.'
        : 'El chequeo opcional de disponibilidad indicó que la base no está accesible.',
    }
  }

  return {
    tone: 'neutral',
    label: 'Estado desconocido',
    detail: 'No hay una confirmación concluyente de la base de datos.',
  }
}

export function baseDatosEvidenceSource({ health, evidence = [] } = {}) {
  if (health?.verdict === 'healthy') {
    return 'El chequeo opcional de disponibilidad confirmó el acceso a la base de datos.'
  }
  const names = evidence
    .filter((item) => item?.outcome === 'success')
    .map((item) => item.name)
  if (names.includes('empleados') || names.includes('fichadas')) {
    return 'La consulta de empleados o fichadas respondió correctamente.'
  }
  if (names.includes('usuarios')) return 'La consulta de usuarios respondió correctamente.'
  if (names.includes('agentes')) return 'La consulta de agentes respondió correctamente.'
  return ''
}
