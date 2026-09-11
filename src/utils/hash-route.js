import { DEFAULT_VIEW, NAV_ITEMS } from '../config/navigation.js'

export const HASH_VIEW_IDS = Object.freeze(
  NAV_ITEMS.filter((item) => !item.hidden).map((item) => item.id),
)

function normalizeHash(hash) {
  const raw = String(hash ?? '').trim()
  if (!raw || raw === '#') return ''
  return raw.startsWith('#') ? raw : `#${raw}`
}

export function viewHash(viewId = DEFAULT_VIEW) {
  const id = HASH_VIEW_IDS.includes(viewId) ? viewId : DEFAULT_VIEW
  return `#/${id}`
}

export function parseHashView(hash) {
  const normalized = normalizeHash(hash)
  const path = normalized.replace(/^#/, '').replace(/^\/+/, '').split(/[?#]/)[0].replace(/\/+$/, '')
  if (!path) {
    return { viewId: DEFAULT_VIEW, valid: true, empty: true }
  }

  const id = path.split('/')[0]
  if (!HASH_VIEW_IDS.includes(id)) {
    return { viewId: DEFAULT_VIEW, valid: false, empty: false }
  }

  return { viewId: id, valid: true, empty: false }
}

export function hashesMatch(left, right) {
  return normalizeHash(left) === normalizeHash(right)
}

export function writeViewHash(viewId, { replace = false, history = globalThis.history, location = globalThis.location } = {}) {
  const next = viewHash(viewId)
  const current = location?.hash ?? ''
  if (hashesMatch(current, next)) return 'unchanged'

  if (replace) {
    history?.replaceState?.({ view: viewId }, '', next)
    return 'replace'
  }

  history?.pushState?.({ view: viewId }, '', next)
  return 'push'
}

export function assignViewHash(viewId, { location = globalThis.location } = {}) {
  const next = viewHash(viewId)
  if (hashesMatch(location?.hash, next)) return 'unchanged'
  location.hash = next
  return 'assign'
}
