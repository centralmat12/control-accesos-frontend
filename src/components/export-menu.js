import { BTN_SECONDARY_CLASS } from './button-styles.js'
import { iconChevronDown } from './icons.js'
import { showToast } from './toast.js'

const EXPORT_ERROR_MESSAGE = 'No pudimos generar el archivo. Intentá nuevamente.'
const ITEM_CLASS = 'flex w-full cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-slate-700 transition-colors hover:bg-blue-800 hover:text-white focus-visible:bg-blue-800 focus-visible:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400 active:bg-blue-950 active:text-white disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-slate-700 dark:text-slate-100 dark:disabled:hover:text-slate-100'

function iconTable() {
  return `<svg class="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M4 6.5h16M4 12h16M4 17.5h16M8 4v16M16 4v16" /></svg>`
}

function iconDocument() {
  return `<svg class="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M7 3.5h7l5 5V20.5H7z" /><path stroke-linecap="round" stroke-linejoin="round" d="M14 3.5V9h5.5M9 13h6M9 17h6" /></svg>`
}

export function createExportMenu({ id = 'exportar', onCsv, onPdf } = {}) {
  const root = document.createElement('div')
  root.className = 'relative'
  const trigger = document.createElement('button')
  trigger.type = 'button'
  trigger.id = id
  trigger.className = BTN_SECONDARY_CLASS
  trigger.classList.add('gap-2', 'export-menu-trigger')
  trigger.innerHTML = `<span data-export-label>Exportar</span><span data-export-chevron aria-hidden="true">${iconChevronDown('h-4 w-4')}</span>`
  trigger.setAttribute('aria-haspopup', 'menu')
  trigger.setAttribute('aria-expanded', 'false')
  trigger.setAttribute('aria-controls', `${id}-menu`)

  const hint = document.createElement('span')
  hint.id = `${id}-hint`
  hint.className = 'sr-only'

  const menu = document.createElement('div')
  menu.id = `${id}-menu`
  menu.setAttribute('role', 'menu')
  menu.hidden = true
  menu.className = 'fixed z-[80] w-[200px] rounded-lg border border-slate-300 bg-white p-1.5 shadow-xl shadow-slate-950/20 dark:border-slate-600 dark:bg-slate-900 dark:shadow-black/50'
  menu.innerHTML = `
    <button type="button" role="menuitem" data-export="csv" class="${ITEM_CLASS}">${iconTable()}<span>Exportar CSV</span></button>
    <button type="button" role="menuitem" data-export="pdf" class="${ITEM_CLASS}">${iconDocument()}<span>Exportar PDF</span></button>
  `
  const csvButton = menu.querySelector('[data-export="csv"]')
  const pdfButton = menu.querySelector('[data-export="pdf"]')
  const label = trigger.querySelector('[data-export-label]')
  const chevron = trigger.querySelector('[data-export-chevron]')
  const items = [csvButton, pdfButton]
  root.append(trigger, hint)
  document.body.append(menu)

  let busy = false
  let allowCsv = true
  let allowPdf = true
  let reason = ''

  function applyAvailability() {
    csvButton.disabled = !allowCsv
    pdfButton.disabled = !allowPdf
    const blocked = !allowCsv && !allowPdf
    trigger.disabled = busy || blocked
    trigger.classList.toggle('export-menu-trigger-disabled', blocked && !busy)
    if (blocked && reason) {
      hint.textContent = reason
      trigger.setAttribute('aria-describedby', hint.id)
    } else {
      hint.textContent = ''
      trigger.removeAttribute('aria-describedby')
    }
  }

  function place() {
    const rect = trigger.getBoundingClientRect()
    menu.hidden = false
    const width = menu.offsetWidth || 200
    const height = menu.offsetHeight || 88
    let left = rect.right - width
    if (left < 8) left = 8
    if (left + width > window.innerWidth - 8) left = window.innerWidth - width - 8
    let top = rect.bottom + 8
    if (top + height > window.innerHeight - 8) top = Math.max(8, rect.top - height - 8)
    menu.style.left = `${left}px`
    menu.style.top = `${top}px`
  }

  function close({ focusTrigger = false } = {}) {
    menu.hidden = true
    trigger.setAttribute('aria-expanded', 'false')
    trigger.classList.remove('export-menu-open')
    chevron.classList.remove('rotate-180')
    if (focusTrigger && !trigger.disabled) trigger.focus()
  }

  function open() {
    if (trigger.disabled || busy) return
    place()
    trigger.setAttribute('aria-expanded', 'true')
    trigger.classList.add('export-menu-open')
    chevron.classList.add('rotate-180')
    items.find((item) => !item.disabled)?.focus()
  }

  async function choose(handler) {
    if (busy || trigger.disabled) return
    busy = true
    trigger.setAttribute('aria-busy', 'true')
    label.textContent = 'Generando…'
    close()
    applyAvailability()
    try {
      await handler?.()
    } catch (error) {
      console.error(error)
      showToast({ message: EXPORT_ERROR_MESSAGE, tone: 'error' })
    } finally {
      busy = false
      label.textContent = 'Exportar'
      trigger.removeAttribute('aria-busy')
      applyAvailability()
      if (!trigger.disabled) trigger.focus()
    }
  }

  trigger.addEventListener('click', (event) => {
    event.preventDefault()
    event.stopPropagation()
    if (trigger.disabled) return
    if (menu.hidden) open()
    else close({ focusTrigger: true })
  })
  csvButton.addEventListener('click', (event) => {
    event.preventDefault()
    event.stopPropagation()
    void choose(onCsv)
  })
  pdfButton.addEventListener('click', (event) => {
    event.preventDefault()
    event.stopPropagation()
    void choose(onPdf)
  })
  menu.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      close({ focusTrigger: true })
      return
    }
    const enabled = items.filter((item) => !item.disabled)
    const index = enabled.indexOf(document.activeElement)
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const delta = event.key === 'ArrowDown' ? 1 : -1
      const next = index < 0 ? 0 : (index + delta + enabled.length) % enabled.length
      enabled[next]?.focus()
    }
  })

  const abort = new AbortController()
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !menu.hidden) {
      event.preventDefault()
      close({ focusTrigger: true })
    }
  }, { signal: abort.signal })
  document.addEventListener('click', (event) => {
    if (!root.contains(event.target) && !menu.contains(event.target)) close()
  }, { signal: abort.signal })
  window.addEventListener('resize', () => {
    if (!menu.hidden) place()
  }, { signal: abort.signal })
  window.addEventListener('scroll', () => {
    if (!menu.hidden) place()
  }, { capture: true, signal: abort.signal })

  return {
    root,
    trigger,
    csvButton,
    pdfButton,
    close,
    setEnabled({ csv = true, pdf = true, reason: nextReason = '' } = {}) {
      allowCsv = csv
      allowPdf = pdf
      reason = nextReason
      if (!busy) applyAvailability()
    },
    destroy() {
      abort.abort()
      menu.remove()
    },
  }
}
