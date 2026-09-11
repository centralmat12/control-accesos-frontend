import { escapeHtml } from '../utils/format.js'
import { closeOpenDropdown } from './dropdown.js'

let activeTooltip = null
const abortMap = new WeakMap()
let documentBound = false

function positionTooltip(anchor, panel) {
  const rect = anchor.getBoundingClientRect()
  panel.style.position = 'fixed'
  panel.style.zIndex = '90'
  panel.style.maxWidth = '18rem'
  const width = Math.min(288, window.innerWidth - 16)
  panel.style.width = `${width}px`

  let left = rect.left
  if (left + width > window.innerWidth - 8) left = window.innerWidth - width - 8
  if (left < 8) left = 8

  const spaceBelow = window.innerHeight - rect.bottom
  if (spaceBelow < 96 && rect.top > spaceBelow) {
    panel.style.top = 'auto'
    panel.style.bottom = `${window.innerHeight - rect.top + 8}px`
  } else {
    panel.style.bottom = 'auto'
    panel.style.top = `${rect.bottom + 8}px`
  }
  panel.style.left = `${left}px`
}

function clearActiveTooltip() {
  if (!activeTooltip) return
  activeTooltip.cleanup?.()
  const { panel, anchor, described } = activeTooltip
  panel.remove()
  if (described) anchor.removeAttribute('aria-describedby')
  activeTooltip = null
}

export function hideTooltip() {
  clearActiveTooltip()
}

export function showTooltip(anchor, text) {
  if (!anchor || !text) return
  clearActiveTooltip()
  closeOpenDropdown()
  const panel = document.createElement('div')
  const tooltipId = `${anchor.id || 'ca-tooltip'}-tip`
  panel.id = tooltipId
  panel.setAttribute('role', 'tooltip')
  panel.className =
    'rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs leading-5 text-slate-700 shadow-lg dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200'
  panel.textContent = text
  document.body.append(panel)
  positionTooltip(anchor, panel)
  anchor.setAttribute('aria-describedby', tooltipId)

  const onReposition = () => {
    if (activeTooltip?.panel === panel) positionTooltip(anchor, panel)
  }
  window.addEventListener('scroll', onReposition, { capture: true })
  window.addEventListener('resize', onReposition)
  activeTooltip = {
    panel,
    anchor,
    described: true,
    cleanup() {
      window.removeEventListener('scroll', onReposition, { capture: true })
      window.removeEventListener('resize', onReposition)
    },
  }
}

function bindDocumentEscape() {
  if (documentBound) return
  documentBound = true
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || !activeTooltip) return
    event.preventDefault()
    event.stopPropagation()
    clearActiveTooltip()
  })
  document.addEventListener('pointerdown', (event) => {
    if (!activeTooltip) return
    const { anchor, panel } = activeTooltip
    if (anchor.contains(event.target) || panel.contains(event.target)) return
    clearActiveTooltip()
  })
}

export function bindTooltipRoot(root) {
  if (!root || root.dataset.caTooltipBound === 'true') return
  root.dataset.caTooltipBound = 'true'
  bindDocumentEscape()
  const abort = new AbortController()
  abortMap.set(root, abort)

  root.addEventListener(
    'pointerenter',
    (event) => {
      const target = event.target.closest('[data-tooltip]')
      if (!target || !root.contains(target)) return
      showTooltip(target, target.getAttribute('data-tooltip'))
    },
    { signal: abort.signal },
  )
  root.addEventListener(
    'pointerleave',
    (event) => {
      if (event.pointerType === 'touch') return
      const target = event.target.closest('[data-tooltip]')
      if (!target) return
      if (event.relatedTarget && target.contains(event.relatedTarget)) return
      clearActiveTooltip()
    },
    { signal: abort.signal },
  )
  root.addEventListener(
    'click',
    (event) => {
      const target = event.target.closest('[data-tooltip]')
      if (!target || !root.contains(target)) return
      showTooltip(target, target.getAttribute('data-tooltip'))
    },
    { signal: abort.signal },
  )
  root.addEventListener(
    'focusin',
    (event) => {
      const target = event.target.closest('[data-tooltip]')
      if (!target || !root.contains(target)) return
      showTooltip(target, target.getAttribute('data-tooltip'))
    },
    { signal: abort.signal },
  )
  root.addEventListener(
    'focusout',
    (event) => {
      const target = event.target.closest('[data-tooltip]')
      if (!target) return
      if (event.relatedTarget && target.contains(event.relatedTarget)) return
      clearActiveTooltip()
    },
    { signal: abort.signal },
  )
}

export function unbindTooltipRoot(root) {
  abortMap.get(root)?.abort()
  abortMap.delete(root)
  if (root) delete root.dataset.caTooltipBound
  clearActiveTooltip()
}

export function tooltipTriggerAttributes(text, id) {
  return `data-tooltip="${escapeHtml(text)}" tabindex="0"${id ? ` id="${escapeHtml(id)}"` : ''}`
}
