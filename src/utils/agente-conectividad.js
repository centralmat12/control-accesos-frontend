import { elapsedMinutes, formatElapsedLabel, parseContactDate } from './relative-time.js'

export const AGENTE_CONTACTO_FIELDS = Object.freeze([
  'ultimoAcceso',
  'ultimoContacto',
  'ultimaConexion',
  'ultimoHeartbeat',
])

const RANK = { danger: 3, warning: 2, success: 1, error: 3, neutral: 0 }

function hasContactValue(value) {
  return !(value == null || value === '')
}

export function extractAgenteContacto(agente) {
  if (!agente || typeof agente !== 'object') return null
  for (const field of AGENTE_CONTACTO_FIELDS) {
    const date = parseContactDate(agente[field])
    if (date) return { field, date }
  }
  return null
}

export function hasInvalidAgenteContacto(agente) {
  if (!agente || typeof agente !== 'object') return false
  for (const field of AGENTE_CONTACTO_FIELDS) {
    const value = agente[field]
    if (!hasContactValue(value)) continue
    if (!parseContactDate(value)) return true
  }
  return false
}

export function agenteConectividad(agente, now = new Date()) {
  if (hasInvalidAgenteContacto(agente) && !extractAgenteContacto(agente)) {
    return {
      tone: 'neutral',
      label: 'Sin información',
      detail: 'el último contacto no es válido',
      minutes: null,
    }
  }

  const contact = extractAgenteContacto(agente)
  if (!contact) {
    return {
      tone: 'neutral',
      label: 'Sin actividad registrada',
      detail: 'sin actividad registrada',
      minutes: null,
    }
  }

  const minutes = elapsedMinutes(contact.date, now)
  if (minutes == null || minutes < 0) {
    return {
      tone: 'neutral',
      label: 'Sin información',
      detail: 'el último contacto no es válido',
      minutes: null,
    }
  }

  const elapsed = formatElapsedLabel(minutes)
  if (minutes < 60) {
    return {
      tone: 'success',
      label: 'Conectado',
      detail: `último contacto hace ${elapsed}`,
      minutes,
    }
  }

  if (minutes < 120) {
    return {
      tone: 'warning',
      label: 'Sin actividad reciente',
      detail: `sin conectividad desde hace ${elapsed}`,
      minutes,
    }
  }

  return {
    tone: 'danger',
    label: 'Desconectado',
    detail: `sin conexión desde hace ${elapsed}`,
    minutes,
  }
}

function namedDetail(nombre, status) {
  return `${nombre}: ${status.detail}`
}

export function resumenAgentesConectividad(agentes, now = new Date()) {
  const items = (Array.isArray(agentes) ? agentes : []).map((agente) => {
    const nombre = String(agente?.nombre || 'Agente').trim() || 'Agente'
    const status = agenteConectividad(agente, now)
    return {
      id: agente?.id ?? null,
      nombre,
      activo: Boolean(agente?.activo),
      status: {
        ...status,
        detail: namedDetail(nombre, status),
      },
    }
  })

  if (items.length === 0) {
    return {
      tone: 'neutral',
      label: 'Sin información',
      detail: 'No hay agentes para evaluar en este contexto.',
      items,
    }
  }

  const known = items.filter((item) => item.status.label !== 'Sin información' && item.status.label !== 'Sin actividad registrada')
  const withoutContact = items.filter((item) => item.status.label === 'Sin actividad registrada')

  if (known.length === 0) {
    if (withoutContact.length > 0) {
      return {
        tone: 'neutral',
        label: 'Sin actividad registrada',
        detail: items.map((item) => item.status.detail).join(' '),
        items,
      }
    }
    return {
      tone: 'neutral',
      label: 'Sin información',
      detail: items.map((item) => item.status.detail).join(' '),
      items,
    }
  }

  const worst = known.reduce((current, item) =>
    RANK[item.status.tone] > RANK[current.status.tone] ? item : current,
  )
  const problematic = items.filter((item) => item.status.tone === 'warning' || item.status.tone === 'danger')
  const detail =
    problematic.length === 0
      ? worst.status.detail
      : problematic.map((item) => item.status.detail).join(' ')

  return {
    tone: worst.status.tone,
    label: worst.status.label,
    detail,
    items,
  }
}
