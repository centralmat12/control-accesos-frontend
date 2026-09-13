import { closeOpenDropdown, enhanceSelectsIn, destroyDisconnectedSelects } from './dropdown.js'
import { BTN_SECONDARY_CLASS } from './button-styles.js'

export const DISCARD_UNSAVED_TITLE = '¿Descartar los cambios?'
export const DISCARD_UNSAVED_MESSAGE = 'Los datos ingresados todavía no fueron guardados.'
export const DISCARD_UNSAVED_CONTINUE = 'Seguir editando'
export const DISCARD_UNSAVED_DISCARD = 'Descartar cambios'

export function shouldAskUnsavedClose({ force = false, unsavedChanges = false, dirty = false } = {}) {
  return !force && unsavedChanges && dirty
}

function focusableElements(root) {
  if (!root) return []
  return [...root.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter(
    (element) => !element.disabled && element.getAttribute('aria-hidden') !== 'true',
  )
}

function trapFocus(event, root) {
  const elements = focusableElements(root)
  if (elements.length === 0) return
  const first = elements[0]
  const last = elements.at(-1)
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last.focus()
    return
  }
  if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}

function applyBackgroundInert(host, overlay) {
  const locked = []
  for (const child of [...host.children]) {
    if (child === overlay || child.inert) continue
    child.inert = true
    locked.push(child)
  }
  return () => {
    locked.forEach((element) => {
      element.inert = false
    })
  }
}

function promptDiscardUnsaved(prompt = {}) {
  return new Promise((resolve) => {
    let settled = false
    const title = prompt.title || DISCARD_UNSAVED_TITLE
    const message = prompt.message || DISCARD_UNSAVED_MESSAGE
    const continueLabel = prompt.continueLabel || DISCARD_UNSAVED_CONTINUE
    const discardLabel = prompt.discardLabel || DISCARD_UNSAVED_DISCARD

    const content = document.createElement('div')
    const messageNode = document.createElement('p')
    messageNode.className = 'text-sm text-slate-600'
    messageNode.textContent = message

    const actions = document.createElement('div')
    actions.className = 'mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end'
    actions.innerHTML = `
      <button type="button" data-action="continue" data-autofocus class="${BTN_SECONDARY_CLASS}"></button>
      <button type="button" data-action="discard" class="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"></button>
    `
    actions.querySelector('[data-action="continue"]').textContent = continueLabel
    actions.querySelector('[data-action="discard"]').textContent = discardLabel
    content.append(messageNode, actions)

    const finish = (value) => {
      if (settled) return
      settled = true
      modal.close({ force: true })
      resolve(value)
    }

    const modal = openModal({
      title,
      content,
      labelledBy: 'discard-unsaved-title',
      stacked: true,
      closeOnBackdrop: false,
      unsavedChanges: false,
      onClose: () => {
        if (!settled) resolve(false)
      },
    })

    content.querySelector('[data-action="continue"]')?.addEventListener('click', () => finish(false))
    content.querySelector('[data-action="discard"]')?.addEventListener('click', () => finish(true))
  })
}

export function openModal({
  title,
  subtitle = '',
  content,
  onClose,
  labelledBy = 'app-modal-title',
  stacked = false,
  closeOnBackdrop = true,
  closeOnEscape = true,
  unsavedChanges = false,
  hideCloseButton = false,
  isDirty,
  discardPrompt,
  dialogClass = '',
  canClose,
} = {}) {
  closeOpenDropdown()

  const overlay = document.createElement('div')
  overlay.className = stacked
    ? 'fixed inset-0 z-[60] flex items-end justify-center bg-slate-950/50 p-4 sm:items-center'
    : 'fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-4 sm:items-center'
  overlay.setAttribute('role', 'presentation')
  overlay.dataset.caModal = 'true'

  const dialog = document.createElement('div')
  dialog.className =
    `flex max-h-[90vh] w-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900 ${dialogClass || 'max-w-lg'}`.trim()
  dialog.setAttribute('role', 'dialog')
  dialog.setAttribute('aria-modal', 'true')
  dialog.setAttribute('aria-labelledby', labelledBy)

  const header = document.createElement('div')
  header.className = 'flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 dark:border-slate-700'

  const headingBlock = document.createElement('div')
  headingBlock.className = 'min-w-0'

  const heading = document.createElement('h2')
  heading.id = labelledBy
  heading.className = 'text-lg font-semibold text-slate-900 dark:text-slate-100'
  heading.textContent = title
  headingBlock.append(heading)

  const subtitleNode = document.createElement('p')
  subtitleNode.className = 'mt-0.5 truncate text-sm text-slate-500 dark:text-slate-400'
  subtitleNode.textContent = String(subtitle ?? '')
  subtitleNode.hidden = !String(subtitle ?? '').trim()
  headingBlock.append(subtitleNode)

  const closeButton = document.createElement('button')
  closeButton.type = 'button'
  closeButton.className =
    'rounded-lg px-2 py-1 text-lg leading-none text-slate-500 hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500'
  closeButton.setAttribute('aria-label', 'Cerrar')
  closeButton.textContent = '×'

  const body = document.createElement('div')
  body.className = 'overflow-y-auto px-5 py-4'
  if (content) body.append(content)

  if (hideCloseButton) {
    header.append(headingBlock)
  } else {
    header.append(headingBlock, closeButton)
  }
  dialog.append(header, body)
  overlay.append(dialog)

  let closed = false
  let confirming = false
  let dirty = false
  let restoreInert = () => {}
  const previousFocus = document.activeElement

  function readDirty() {
    if (typeof isDirty === 'function') return Boolean(isDirty())
    if (!unsavedChanges) return false
    return dirty && Boolean(dialog.querySelector('form'))
  }

  function allowsBackdropClose() {
    if (typeof closeOnBackdrop === 'function') return Boolean(closeOnBackdrop())
    return closeOnBackdrop !== false
  }

  function allowsEscapeClose() {
    if (typeof closeOnEscape === 'function') return Boolean(closeOnEscape())
    return closeOnEscape !== false
  }

  function allowsUserClose() {
    if (typeof canClose === 'function') return Boolean(canClose())
    return true
  }

  function finalizeClose() {
    if (closed) return
    closed = true
    document.removeEventListener('keydown', onKeyDown)
    overlay.removeEventListener('input', onFieldChange)
    overlay.removeEventListener('change', onFieldChange)
    restoreInert()
    overlay.remove()
    destroyDisconnectedSelects()
    if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus()
    onClose?.()
  }

  function onFieldChange(event) {
    if (!(event.target instanceof HTMLElement)) return
    if (!event.target.closest('form')) return
    dirty = true
  }

  async function close(options = {}) {
    if (closed) return
    if (confirming) return
    if (options.force !== true && !allowsUserClose()) return

    if (shouldAskUnsavedClose({ force: options.force === true, unsavedChanges, dirty: readDirty() })) {
      confirming = true
      let discard = false
      try {
        discard = await promptDiscardUnsaved(discardPrompt)
      } finally {
        confirming = false
      }
      if (!discard || closed) return
    }

    finalizeClose()
  }

  function onKeyDown(event) {
    if (!overlay.isConnected) {
      document.removeEventListener('keydown', onKeyDown)
      return
    }

    const overlays = [...document.querySelectorAll('[data-ca-modal]')]
    if (overlays.at(-1) !== overlay) return

    if (event.key === 'Tab') {
      trapFocus(event, dialog)
      return
    }

    if (event.key !== 'Escape' || !allowsEscapeClose()) return
    event.preventDefault()
    event.stopPropagation()
    void close()
  }

  if (!hideCloseButton) {
    closeButton.addEventListener('click', () => {
      void close()
    })
  }
  overlay.addEventListener('click', (event) => {
    if (event.target !== overlay) return
    if (!allowsBackdropClose()) return
    void close()
  })
  if (unsavedChanges) {
    overlay.addEventListener('input', onFieldChange)
    overlay.addEventListener('change', onFieldChange)
  }
  document.addEventListener('keydown', onKeyDown)

  const host = document.getElementById('app') ?? document.body
  host.append(overlay)
  restoreInert = applyBackgroundInert(host, overlay)
  enhanceSelectsIn(overlay)
  queueMicrotask(() => {
    const preferredFocus = dialog.querySelector('[data-autofocus]')
    if (preferredFocus) preferredFocus.focus()
    else if (!dialog.contains(document.activeElement)) {
      const fallback = hideCloseButton ? focusableElements(dialog)[0] : closeButton
      fallback?.focus()
    }
  })

  return {
    overlay,
    dialog,
    close,
    setSubtitle(text) {
      const value = String(text ?? '')
      subtitleNode.textContent = value
      subtitleNode.hidden = !value.trim()
    },
  }
}

export function openFormModal(options = {}) {
  return openModal({
    closeOnBackdrop: false,
    closeOnEscape: true,
    unsavedChanges: true,
    ...options,
  })
}

export function openConfirmModal({
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  danger = false,
} = {}) {
  return new Promise((resolve) => {
    let settled = false

    const content = document.createElement('div')
    const confirmClass = danger
        ? 'rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500'
        : 'rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500'

    const titleNode = document.createElement('p')
    titleNode.className = 'text-sm text-slate-600'
    titleNode.textContent = String(message ?? '')

    const actions = document.createElement('div')
    actions.className = 'mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end'
    actions.innerHTML = `
      <button type="button" data-action="cancel" data-autofocus class="${BTN_SECONDARY_CLASS}">
      </button>
      <button type="button" data-action="confirm" class="${confirmClass}">
      </button>
    `
    actions.querySelector('[data-action="cancel"]').textContent = cancelLabel
    actions.querySelector('[data-action="confirm"]').textContent = confirmLabel
    content.append(titleNode, actions)

    const finish = (value) => {
      if (settled) return
      settled = true
      modal.close({ force: true })
      resolve(value)
    }

    const modal = openModal({
      title,
      content,
      labelledBy: 'confirm-modal-title',
      stacked: true,
      closeOnBackdrop: false,
      unsavedChanges: false,
      onClose: () => {
        if (!settled) resolve(false)
      },
    })

    content.querySelector('[data-action="cancel"]')?.addEventListener('click', () => finish(false))
    content.querySelector('[data-action="confirm"]')?.addEventListener('click', () => finish(true))
  })
}
