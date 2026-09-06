import { isSuperadmin } from '../config/roles.js'

export const EMPRESA_CONTEXTO_KEY = 'ca.auth.empresaContexto'
export const EMPRESA_CONTEXTO_EVENT = 'ca:empresa-contexto'

function parseId(value) {
  const id = Number(value)
  return Number.isFinite(id) && id > 0 ? id : null
}

function normalizeEmpresa(empresa) {
  if (!empresa || typeof empresa !== 'object') return null

  const id = parseId(empresa.id ?? empresa.Id)
  if (!id) return null

  const nombre = String(
    empresa.nombre || empresa.nombreFantasia || empresa.razonSocial || '',
  ).trim()

  return {
    id,
    nombre,
    cuit: String(empresa.cuit ?? '').trim(),
    direccion: String(empresa.direccion ?? '').trim(),
    nombreFantasia: String(empresa.nombreFantasia ?? nombre).trim(),
    razonSocial: String(empresa.razonSocial ?? '').trim(),
  }
}

export function getEmpresaContexto() {
  const raw = sessionStorage.getItem(EMPRESA_CONTEXTO_KEY)
  if (!raw) return null

  try {
    return normalizeEmpresa(JSON.parse(raw))
  } catch {
    sessionStorage.removeItem(EMPRESA_CONTEXTO_KEY)
    return null
  }
}

export function setEmpresaContexto(empresa) {
  const normalized = normalizeEmpresa(empresa)
  if (!normalized) {
    clearEmpresaContexto()
    return null
  }

  sessionStorage.setItem(EMPRESA_CONTEXTO_KEY, JSON.stringify(normalized))
  window.dispatchEvent(new CustomEvent(EMPRESA_CONTEXTO_EVENT, { detail: normalized }))
  return normalized
}

export function clearEmpresaContexto(options = {}) {
  const silent = options.silent === true
  const hadValue = Boolean(sessionStorage.getItem(EMPRESA_CONTEXTO_KEY))
  sessionStorage.removeItem(EMPRESA_CONTEXTO_KEY)
  if (hadValue && !silent) {
    window.dispatchEvent(new CustomEvent(EMPRESA_CONTEXTO_EVENT, { detail: null }))
  }
}

export function getOperativeEmpresaId(user) {
  if (isSuperadmin(user)) {
    return getEmpresaContexto()?.id ?? null
  }

  return parseId(user?.empresaId)
}

export function canLoadTenantData(user) {
  if (isSuperadmin(user)) {
    return Boolean(getEmpresaContexto()?.id)
  }

  return true
}
