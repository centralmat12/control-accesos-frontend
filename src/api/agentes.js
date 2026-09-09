/**
 * Agentes de instalación (credenciales del programa en la sucursal).
 *
 * Contratos reales de AgentesController (policy SoloSuperadmin, token_use=web):
 * - GET    /api/agentes                      → AgenteDto[] (global, sin clientSecret)
 * - POST   /api/agentes                      → 201 AgenteCreadoDto (incluye clientSecret)
 * - GET    /api/agentes/{id}                 → AgenteDto
 * - POST   /api/agentes/{id}/rotar-secret   → 200 AgenteCreadoDto (nuevo clientSecret)
 * - PATCH  /api/agentes/{id}/desactivar    → 204
 *
 * AgenteCrearDto: sucursalId, clientId (max 100), nombre (max 100).
 * El clientId es único a nivel sistema. Una sucursal puede tener varios agentes.
 * No hay GET por sucursal: el panel filtra GET global por sucursalId de contexto.
 * No hay PUT, activar, DELETE ni DTO de configuración para descargar.
 */
import { pick } from '../utils/pick.js'
import {
  puedeCrearAgentes,
  puedeDesactivarAgente,
  puedeListarAgentes,
  puedeRotarSecretAgente,
} from '../config/administracion.js'
import { getCurrentUser } from './auth.js'
import { apiFetch, createApiError, readErrorMessage } from './http.js'

export const AGENTE_CLIENT_ID_MAX = 100
export const AGENTE_NOMBRE_MAX = 100

export const AGENTE_API_PATHS = Object.freeze({
  listar: '/api/agentes',
  crear: '/api/agentes',
  obtener: (id) => `/api/agentes/${id}`,
  rotarSecret: (id) => `/api/agentes/${id}/rotar-secret`,
  desactivar: (id) => `/api/agentes/${id}/desactivar`,
})

export const AGENTE_CREAR_FIELDS = Object.freeze(['sucursalId', 'clientId', 'nombre'])

export const AGENTE_SECRET_ONCE_WARNING =
  'Este secreto se muestra una sola vez. Guardalo antes de continuar.'
export const AGENTE_SECRET_ACK_LABEL = 'Ya guardé el secreto'
export const AGENTE_SECRET_COPIED = 'Secreto copiado'
export const AGENTE_ROTAR_TITLE = '¿Rotar el secreto del agente?'
export const AGENTE_ROTAR_MESSAGE =
  'El secreto anterior dejará de funcionar inmediatamente. El agente instalado no podrá autenticarse hasta que configures el nuevo secreto.'
export const AGENTE_ROTAR_CONFIRM = 'Rotar secreto'
export const AGENTE_DESACTIVAR_TITLE = '¿Desactivar este agente?'
export const AGENTE_DESACTIVAR_MESSAGE =
  'El agente dejará de autenticarse y de enviar información. Actualmente la API no permite reactivarlo desde el panel.'
export const AGENTE_DESACTIVAR_CONFIRM = 'Desactivar agente'

export const AGENTE_SECRET_MODAL = Object.freeze({
  closeOnBackdrop: false,
  closeOnEscape: false,
  hideCloseButton: true,
  unsavedChanges: false,
})

let agenteCreateInflight = null
let agenteRotarInflight = null
let loadedAgenteClientIds = []

function parseId(value) {
  const id = Number(value)
  return Number.isFinite(id) && id > 0 ? id : null
}

function looksInternalMessage(message) {
  const text = String(message ?? '')
  return text.length > 280 || /stack|exception|at\s+\w+\.\w+/i.test(text)
}

async function publicApiMessage(response, fallback) {
  const message = await readErrorMessage(response, fallback)
  if (!message || looksInternalMessage(message)) return fallback
  return message
}

function jsonRequest(path, options = {}) {
  return apiFetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
    missingAuthMessage: 'No hay sesión activa. Iniciá sesión para administrar agentes.',
    logLabel: 'Agentes',
  })
}

export function slugifyClientIdPart(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/-+/g, '-')
    .replace(/^[-_]+|[-_]+$/g, '')
}

function clampClientId(base, suffix = '') {
  const maxBase = AGENTE_CLIENT_ID_MAX - suffix.length
  let truncated = String(base ?? '').slice(0, Math.max(0, maxBase))
  truncated = truncated.replace(/[-_]+$/g, '')
  const next = `${truncated}${suffix}`.replace(/_+/g, '_')
  return next.slice(0, AGENTE_CLIENT_ID_MAX).replace(/^[-_]+|[-_]+$/g, '') || 'terminal'
}

export function getLoadedAgenteClientIds() {
  return [...loadedAgenteClientIds]
}

/**
 * Sugerencia de clientId único a nivel sistema.
 * Incluye empresa, sucursal y el nombre de la terminal si existe.
 */
export function suggestClientId(options = {}, existingClientIds = []) {
  const params = typeof options === 'string' ? { sucursalNombre: options, existingClientIds } : options
  const knownIds = params.existingClientIds ?? existingClientIds
  const parts = ['terminal']
  const empresa = slugifyClientIdPart(params.empresaNombre)
  const sucursal = slugifyClientIdPart(params.sucursalNombre)
  const agente = slugifyClientIdPart(params.agenteNombre)

  if (empresa) parts.push(empresa)
  if (sucursal) parts.push(sucursal)
  if (agente) parts.push(agente)
  if (parts.length === 1) parts.push('sucursal')

  const base = clampClientId(parts.join('_'))
  const existing = new Set(
    [...knownIds].map((item) => String(item ?? '').trim().toLowerCase()).filter(Boolean),
  )

  if (!existing.has(base)) return base

  for (let n = 2; n < 1000; n += 1) {
    const suffix = `_${n}`
    const candidate = clampClientId(base, suffix)
    if (!existing.has(candidate.toLowerCase())) return candidate
  }

  return base
}

export function validateAgenteNombre(value) {
  const text = String(value ?? '').trim()
  if (!text) return 'Ingresá un nombre para identificar la terminal.'
  if (text.length > AGENTE_NOMBRE_MAX) return 'El nombre no puede superar 100 caracteres.'
  if (!/\p{L}/u.test(text)) return 'El nombre debe contener al menos una letra.'
  return ''
}

export function validateAgenteClientId(value, existingClientIds = []) {
  const text = String(value ?? '').trim()
  if (!text) return 'Ingresá el clientId del agente.'
  if (text.length > AGENTE_CLIENT_ID_MAX) return 'El clientId no puede superar 100 caracteres.'

  const taken = new Set(
    [...existingClientIds].map((item) => String(item ?? '').trim().toLowerCase()).filter(Boolean),
  )
  if (taken.has(text.toLowerCase())) return 'Ya existe un agente con este clientId.'
  return ''
}

export function validateAgenteAlta({ nombre, clientId, existingClientIds = [] } = {}) {
  return {
    nombre: validateAgenteNombre(nombre),
    clientId: validateAgenteClientId(clientId, existingClientIds),
  }
}

export function buildAgenteCrearDto({ sucursalId, clientId, nombre }) {
  return {
    sucursalId: Number(sucursalId),
    clientId: String(clientId ?? '').trim(),
    nombre: String(nombre ?? '').trim(),
  }
}

/**
 * Quita el secreto de un objeto en memoria. No escribe storage.
 */
export function discardAgenteSecret(payload) {
  if (!payload || typeof payload !== 'object') return null

  if (typeof payload.clientSecret === 'string') payload.clientSecret = ''
  if (typeof payload.ClientSecret === 'string') payload.ClientSecret = ''
  delete payload.clientSecret
  delete payload.ClientSecret
  return payload
}

export function mapAgente(item) {
  const id = parseId(pick(item, 'id', 'Id'))
  if (!id) return null

  return {
    id,
    empresaId: parseId(pick(item, 'empresaId', 'EmpresaId')),
    sucursalId: parseId(pick(item, 'sucursalId', 'SucursalId')),
    clientId: String(pick(item, 'clientId', 'ClientId') ?? '').trim(),
    nombre: String(pick(item, 'nombre', 'Nombre') ?? '').trim(),
    activo: Boolean(pick(item, 'activo', 'Activo')),
    ultimoAcceso: pick(item, 'ultimoAcceso', 'UltimoAcceso') ?? null,
  }
}

export function mapAgenteCreado(item) {
  if (!item || typeof item !== 'object') return null

  const id = parseId(pick(item, 'id', 'Id'))
  const sucursalId = parseId(pick(item, 'sucursalId', 'SucursalId'))
  const clientId = String(pick(item, 'clientId', 'ClientId') ?? '').trim()
  const clientSecret = String(pick(item, 'clientSecret', 'ClientSecret') ?? '')

  if (!id || !sucursalId || !clientId || !clientSecret) return null

  return {
    id,
    empresaId: parseId(pick(item, 'empresaId', 'EmpresaId')),
    sucursalId,
    clientId,
    clientSecret,
  }
}

export function filterAgentesBySucursal(agentes, { sucursalId, empresaId } = {}) {
  const sucursal = parseId(sucursalId)
  const empresa = parseId(empresaId)
  if (!sucursal) return []

  return (Array.isArray(agentes) ? agentes : []).filter((agente) => {
    if (Number(agente.sucursalId) !== sucursal) return false
    if (empresa && agente.empresaId && Number(agente.empresaId) !== empresa) return false
    return true
  })
}

function normalizeAgentes(payload) {
  const items = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.items)
      ? payload.items
      : Array.isArray(payload?.data)
        ? payload.data
        : []

  return items.map(mapAgente).filter(Boolean)
}

function readStorageSnapshots(storage) {
  const snapshots = []
  if (!storage) return snapshots

  if (typeof storage.length === 'number' && typeof storage.key === 'function') {
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index)
      snapshots.push(String(key ?? ''), String(storage.getItem(key) ?? ''))
    }
    return snapshots
  }

  for (const key of ['ca.auth.token', 'ca.auth.user', 'ca.auth.empresaContexto', 'ca.activity.logs']) {
    snapshots.push(key, String(storage.getItem?.(key) ?? ''))
  }
  return snapshots
}

function storageContainsSecret(secret) {
  const needle = String(secret ?? '')
  if (!needle) return false

  try {
    for (const storage of [globalThis.sessionStorage, globalThis.localStorage]) {
      if (readStorageSnapshots(storage).some((value) => value.includes(needle))) return true
    }
  } catch {
    return false
  }

  return false
}

export function secretLeakedToStorage(secret) {
  return storageContainsSecret(secret)
}

export async function getAgentes({ sucursalId, empresaId } = {}) {
  const sucursal = parseId(sucursalId)
  const empresa = parseId(empresaId)

  if (!sucursal) {
    throw createApiError('No se pueden listar agentes sin sucursal de contexto.', 400)
  }

  if (!puedeListarAgentes(getCurrentUser(), empresa)) {
    throw createApiError('No tenés permiso para consultar agentes.', 403)
  }

  const { url, response } = await apiFetch(AGENTE_API_PATHS.listar, {
    empresaId: empresa,
    missingAuthMessage: 'No hay sesión activa. Iniciá sesión para consultar agentes.',
    logLabel: 'Agentes',
  })

  if (response.status === 403) {
    throw createApiError('No tenés permiso para consultar agentes.', 403)
  }

  if (response.status >= 500) {
    throw createApiError('La API no pudo listar los agentes. Intentá nuevamente más tarde.', response.status)
  }

  if (!response.ok) {
    throw createApiError(
      await publicApiMessage(response, `No se pudieron cargar los agentes (${response.status}).`),
      response.status,
    )
  }

  const agentes = normalizeAgentes(await response.json())
  loadedAgenteClientIds = agentes.map((item) => item.clientId).filter(Boolean)
  return filterAgentesBySucursal(agentes, { sucursalId: sucursal, empresaId: empresa })
}

async function createAgenteOnce({ sucursalId, empresaId, clientId, nombre }) {
  const sucursal = parseId(sucursalId)
  const empresa = parseId(empresaId)

  if (!sucursal) {
    throw createApiError('No se puede crear un agente sin sucursal de contexto.', 400)
  }

  if (!puedeCrearAgentes(getCurrentUser(), empresa)) {
    throw createApiError('No tenés permiso para crear agentes.', 403)
  }

  const dto = buildAgenteCrearDto({ sucursalId: sucursal, clientId, nombre })
  if (!dto.clientId || !dto.nombre) {
    throw createApiError('El nombre y el clientId son obligatorios.', 400)
  }

  const { url, response } = await jsonRequest(AGENTE_API_PATHS.crear, {
    method: 'POST',
    empresaId: empresa,
    body: JSON.stringify(dto),
  })

  if (response.status === 400) {
    throw createApiError(await publicApiMessage(response, 'Los datos del agente no son válidos.'), 400)
  }

  if (response.status === 403) {
    throw createApiError('No tenés permiso para crear agentes.', 403)
  }

  if (response.status === 404) {
    throw createApiError('La sucursal ya no existe.', 404)
  }

  if (response.status === 409) {
    throw createApiError(
      await publicApiMessage(response, 'El clientId ya existe o la sucursal no existe.'),
      409,
    )
  }

  if (response.status >= 500) {
    console.error('Agentes: la API no pudo completar el alta', { url, status: response.status })
    throw createApiError('La API no pudo crear el agente. Intentá nuevamente más tarde.', response.status)
  }

  if (response.status !== 201) {
    throw createApiError(
      await publicApiMessage(response, `No se pudo crear el agente (${response.status}).`),
      response.status,
    )
  }

  const created = mapAgenteCreado(await response.json())
  if (!created) {
    throw createApiError('La API no devolvió el secreto del agente.', 500)
  }

  return created
}

export async function createAgente(dto) {
  if (agenteCreateInflight) return agenteCreateInflight

  agenteCreateInflight = createAgenteOnce(dto).finally(() => {
    agenteCreateInflight = null
  })

  return agenteCreateInflight
}

export async function rotarSecretAgente(dto) {
  if (agenteRotarInflight) return agenteRotarInflight

  agenteRotarInflight = rotarSecretAgenteOnce(dto).finally(() => {
    agenteRotarInflight = null
  })

  return agenteRotarInflight
}

async function rotarSecretAgenteOnce({ id, empresaId }) {
  const agenteId = parseId(id)
  const empresa = parseId(empresaId)

  if (!agenteId) {
    throw createApiError('El agente no tiene un ID válido.', 400)
  }

  if (!puedeRotarSecretAgente(getCurrentUser(), empresa)) {
    throw createApiError('No tenés permiso para regenerar el secreto.', 403)
  }

  const { url, response } = await apiFetch(AGENTE_API_PATHS.rotarSecret(agenteId), {
    method: 'POST',
    empresaId: empresa,
    missingAuthMessage: 'No hay sesión activa. Iniciá sesión para administrar agentes.',
    logLabel: 'Agentes',
  })

  if (response.status === 403) {
    throw createApiError('No tenés permiso para regenerar el secreto.', 403)
  }

  if (response.status === 404) {
    throw createApiError('El agente ya no existe.', 404)
  }

  if (response.status >= 500) {
    console.error('Agentes: la API no pudo rotar el secreto', { url, status: response.status })
    throw createApiError('La API no pudo regenerar el secreto. Intentá nuevamente más tarde.', response.status)
  }

  if (!response.ok) {
    throw createApiError(
      await publicApiMessage(response, `No se pudo regenerar el secreto (${response.status}).`),
      response.status,
    )
  }

  const created = mapAgenteCreado(await response.json())
  if (!created) {
    throw createApiError('La API no devolvió el nuevo secreto del agente.', 500)
  }

  return created
}

export async function desactivarAgente({ id, empresaId }) {
  const agenteId = parseId(id)
  const empresa = parseId(empresaId)

  if (!agenteId) {
    throw createApiError('El agente no tiene un ID válido.', 400)
  }

  if (!puedeDesactivarAgente(getCurrentUser(), empresa)) {
    throw createApiError('No tenés permiso para desactivar agentes.', 403)
  }

  const { url, response } = await apiFetch(AGENTE_API_PATHS.desactivar(agenteId), {
    method: 'PATCH',
    empresaId: empresa,
    missingAuthMessage: 'No hay sesión activa. Iniciá sesión para administrar agentes.',
    logLabel: 'Agentes',
  })

  if (response.status === 403) {
    throw createApiError('No tenés permiso para desactivar este agente.', 403)
  }

  if (response.status === 404) {
    throw createApiError('El agente ya no existe.', 404)
  }

  if (response.status >= 500) {
    console.error('Agentes: la API no pudo desactivar el agente', { url, status: response.status })
    throw createApiError('La API no pudo desactivar el agente. Intentá nuevamente más tarde.', response.status)
  }

  if (response.status !== 204) {
    throw createApiError(
      await publicApiMessage(response, `No se pudo desactivar el agente (${response.status}).`),
      response.status,
    )
  }
}
