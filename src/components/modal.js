export function openModal({ title, content, onClose, labelledBy = 'app-modal-title', stacked = false }) {
  const overlay = document.createElement('div')
  overlay.className = stacked
    ? 'fixed inset-0 z-[60] flex items-end justify-center bg-slate-950/50 p-4 sm:items-center'
    : 'fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-4 sm:items-center'
  overlay.setAttribute('role', 'presentation')
  overlay.dataset.caModal = 'true'

  const dialog = document.createElement('div')
  dialog.className =
    'flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl'
  dialog.setAttribute('role', 'dialog')
  dialog.setAttribute('aria-modal', 'true')
  dialog.setAttribute('aria-labelledby', labelledBy)

  const header = document.createElement('div')
  header.className =
    'flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4'

  const heading = document.createElement('h2')
  heading.id = labelledBy
  heading.className = 'text-lg font-semibold text-slate-900'
  heading.textContent = title

  const closeButton = document.createElement('button')
  closeButton.type = 'button'
  closeButton.className =
    'rounded-lg px-2 py-1 text-lg leading-none text-slate-500 hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500'
  closeButton.setAttribute('aria-label', 'Cerrar')
  closeButton.textContent = '×'

  const body = document.createElement('div')
  body.className = 'overflow-y-auto px-5 py-4'
  body.append(content)

  header.append(heading, closeButton)
  dialog.append(header, body)
  overlay.append(dialog)

  let closed = false
  const previousFocus = document.activeElement

  const close = () => {
    if (closed) return
    closed = true
    document.removeEventListener('keydown', onKeyDown)
    overlay.remove()
    if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus()
    onClose?.()
  }

  function onKeyDown(event) {
    if (!overlay.isConnected) {
      document.removeEventListener('keydown', onKeyDown)
      return
    }
    if (event.key !== 'Escape') return

    const overlays = [...document.querySelectorAll('[data-ca-modal]')]
    if (overlays.at(-1) !== overlay) return

    event.preventDefault()
    close()
  }

  closeButton.addEventListener('click', close)
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) close()
  })
  document.addEventListener('keydown', onKeyDown)

  const host = document.getElementById('app') ?? document.body
  host.append(overlay)
  queueMicrotask(() => {
    const preferredFocus = dialog.querySelector('[data-autofocus]')
    if (preferredFocus) preferredFocus.focus()
    else if (!dialog.contains(document.activeElement)) closeButton.focus()
  })

  return { overlay, dialog, close }
}
