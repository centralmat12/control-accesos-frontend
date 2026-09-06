const DEFAULT_DURATION_MS = 4_500

const TONES = {
  success: {
    label: 'Éxito',
    symbol: '✓',
    classes:
      'border-emerald-200 bg-white text-slate-900 dark:border-emerald-800 dark:bg-slate-900 dark:text-slate-100',
    icon: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  },
  error: {
    label: 'Error',
    symbol: '!',
    classes:
      'border-red-200 bg-white text-slate-900 dark:border-red-800 dark:bg-slate-900 dark:text-slate-100',
    icon: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
  },
  warning: {
    label: 'Advertencia',
    symbol: '!',
    classes:
      'border-amber-200 bg-white text-slate-900 dark:border-amber-800 dark:bg-slate-900 dark:text-slate-100',
    icon: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  },
  info: {
    label: 'Información',
    symbol: 'i',
    classes:
      'border-blue-200 bg-white text-slate-900 dark:border-blue-800 dark:bg-slate-900 dark:text-slate-100',
    icon: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  },
}

function toastRegion() {
  let region = document.getElementById('app-toast-region')
  if (region) return region

  region = document.createElement('div')
  region.id = 'app-toast-region'
  region.className =
    'pointer-events-none fixed right-3 top-3 z-[80] flex w-[calc(100%-1.5rem)] max-w-sm flex-col gap-2 sm:right-5 sm:top-5'
  region.setAttribute('aria-live', 'polite')
  region.setAttribute('aria-atomic', 'false')
  document.body.append(region)
  return region
}

export function showToast({ message, tone = 'info', duration = DEFAULT_DURATION_MS }) {
  const config = TONES[tone] ?? TONES.info
  const toast = document.createElement('div')
  toast.className = `pointer-events-auto flex translate-y-[-0.25rem] items-start gap-3 rounded-xl border p-3 opacity-0 shadow-lg transition duration-200 ${config.classes}`
  toast.setAttribute('role', tone === 'error' ? 'alert' : 'status')

  const icon = document.createElement('span')
  icon.className = `flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${config.icon}`
  icon.textContent = config.symbol
  icon.setAttribute('aria-hidden', 'true')

  const content = document.createElement('div')
  content.className = 'min-w-0 flex-1'
  const title = document.createElement('p')
  title.className = 'text-xs font-semibold uppercase tracking-wide text-slate-500'
  title.textContent = config.label
  const text = document.createElement('p')
  text.className = 'mt-0.5 text-sm'
  text.textContent = message
  content.append(title, text)

  const close = document.createElement('button')
  close.type = 'button'
  close.className =
    'rounded-md px-1.5 py-0.5 text-lg leading-none text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:hover:bg-slate-800 dark:hover:text-slate-200'
  close.setAttribute('aria-label', 'Cerrar notificación')
  close.textContent = '×'

  let timerId
  function dismiss() {
    window.clearTimeout(timerId)
    toast.classList.add('translate-y-[-0.25rem]', 'opacity-0')
    window.setTimeout(() => {
      toast.remove()
      const region = document.getElementById('app-toast-region')
      if (region && region.childElementCount === 0) region.remove()
    }, 200)
  }

  close.addEventListener('click', dismiss)
  toast.append(icon, content, close)
  toastRegion().append(toast)
  requestAnimationFrame(() => {
    toast.classList.remove('translate-y-[-0.25rem]', 'opacity-0')
  })
  timerId = window.setTimeout(dismiss, Math.max(1_500, duration))

  return { element: toast, dismiss }
}
