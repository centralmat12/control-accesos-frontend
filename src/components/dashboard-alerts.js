import { escapeHtml } from '../utils/format.js'
import { dashboardAlertasHeading } from '../utils/dashboard-alertas.js'
import { iconAlertTriangle } from './icons.js'

const ATTENTION_CHROME = {
  section:
    'flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-red-600 bg-red-100 p-5 shadow-sm dark:border-amber-600 dark:bg-amber-800/20',
  iconWrap:
    'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-200 text-red-800 ring-1 ring-inset ring-red-600/40 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-600/40',
  title: 'text-base font-semibold text-red-800 dark:text-amber-300',
  count: 'mt-1 text-sm font-medium text-red-800 dark:text-amber-300',
}

const INFO_CHROME = {
  section:
    'flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-slate-50 p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900/70',
  iconWrap:
    'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-100 text-sky-800 ring-1 ring-inset ring-sky-600/20 dark:bg-sky-900/60 dark:text-sky-200',
  title: 'text-base font-semibold text-slate-900 dark:text-slate-100',
  count: 'mt-1 text-sm font-medium text-slate-600 dark:text-slate-300',
}

const CHROME = {
  critical: ATTENTION_CHROME,
  warning: ATTENTION_CHROME,
  important: ATTENTION_CHROME,
  pending: INFO_CHROME,
  info: INFO_CHROME,
}

const ITEM_TONE = {
    danger:
        'border-red-600 bg-red-50 text-red-800 hover:border-red-700 hover:bg-red-100 dark:border-amber-600 dark:bg-amber-950/20 dark:text-amber-300 dark:hover:border-amber-500',
    warning:
        'border-red-600 bg-red-50 text-red-800 hover:border-red-700 hover:bg-red-100 dark:border-amber-600 dark:bg-amber-950/20 dark:text-amber-300 dark:hover:border-amber-500',
    info:
        'border-slate-200 bg-white/70 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-950/30 dark:hover:border-slate-600',
}

/**
 * La huella solo se muestra pendiente cuando `tieneHuella` es false.
 * El estado de agente/lector no se infiere a partir de fichadas.
 */
export function dashboardHasAlertas(alertas) {
  return Array.isArray(alertas?.items) && alertas.items.length > 0
}

export function dashboardContentLayout({ hasDataError = false, alertas } = {}) {
  if (hasDataError) return 'error'
  if (dashboardHasAlertas(alertas)) return 'split'
  return 'wide'
}

export function createDashboardAlerts(alertas, { onAction } = {}) {
  const items = Array.isArray(alertas?.items) ? alertas.items : []
  if (!dashboardHasAlertas(alertas)) return null

  const count = alertas?.count ?? items.length
  const chrome = CHROME[alertas?.worst] ?? CHROME.pending
  const section = document.createElement('section')
  section.className = chrome.section

  const heading = document.createElement('div')
  heading.className = 'mb-4 shrink-0'
  heading.innerHTML = `
    <div class="flex items-start gap-3">
      <span class="${chrome.iconWrap}">
        ${iconAlertTriangle()}
      </span>
      <div class="min-w-0">
        <h2 class="${chrome.title}">Alertas y pendientes</h2>
        <p class="${chrome.count}">${escapeHtml(dashboardAlertasHeading(count))}</p>
      </div>
    </div>
  `
  section.append(heading)

  const list = document.createElement('ul')
  list.className =
    'min-h-0 flex-1 space-y-2 overflow-y-auto pr-1 [scrollbar-color:#fca5a5_transparent] dark:[scrollbar-color:#d97706_transparent]'

  items.forEach((item, index) => {
    const li = document.createElement('li')
    const tone = ITEM_TONE[item.tone] ?? ITEM_TONE.info
    const clickable = Boolean(item.action)
    const detailHtml = String(item.detail ?? '')
      .split('\n')
      .filter(Boolean)
      .map((line) => `<span class="mt-1 block text-xs leading-5 opacity-80">${escapeHtml(line)}</span>`)
      .join('')
    const actionHtml = item.action?.label
      ? `<span class="mt-2 block text-xs font-semibold underline-offset-2">${escapeHtml(item.action.label)}</span>`
      : ''

    li.innerHTML = `
      <${clickable ? 'button type="button"' : 'div'}
        data-alert-index="${index}"
        class="w-full rounded-lg border px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${tone} ${clickable ? 'cursor-pointer' : ''}"
      >
        <span class="block text-sm font-semibold">${escapeHtml(item.title ?? '')}</span>
        ${detailHtml}
        ${actionHtml}
      </${clickable ? 'button' : 'div'}>
    `

    if (clickable) {
      li.querySelector('[data-alert-index]')?.addEventListener('click', () => {
        onAction?.(item.action)
      })
    }
    list.append(li)
  })

  section.append(list)
  return section
}
