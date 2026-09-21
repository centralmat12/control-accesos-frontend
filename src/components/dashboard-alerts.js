import { escapeHtml } from '../utils/format.js'
import { dashboardAlertasHeading } from '../utils/dashboard-alertas.js'
import { formatAttentionIssue } from '../utils/empleado-alerts.js'
import { iconAlertTriangle, iconChevronRight } from './icons.js'

export const DASHBOARD_ALERTS_SCROLL_AFTER = 3
export const DASHBOARD_SEE_ALL_PENDIENTES_LABEL = 'Ver todos los empleados con pendientes'

const SECTION_CLASS =
  'dashboard-alerts-panel flex h-auto w-full min-w-0 flex-col overflow-hidden rounded-xl border-2 border-amber-500 bg-red-50 p-5 shadow-sm lg:self-start dark:border-amber-500 dark:bg-red-950'

const ICON_WRAP =
  'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-200 text-amber-900 ring-1 ring-inset ring-amber-600/50 dark:bg-amber-800 dark:text-amber-200 dark:ring-amber-400/50'

const TITLE_CLASS = 'text-base font-semibold text-red-900 dark:text-red-50'
const SUMMARY_CLASS = 'mt-1 text-sm font-medium text-red-800 dark:text-amber-200'

const OTHER_ITEM_TONE = {
  danger:
    'dashboard-alerts-card border-red-600/70 text-red-800 dark:border-amber-600 dark:text-amber-300',
  warning:
    'dashboard-alerts-card border-red-600/70 text-red-800 dark:border-amber-600 dark:text-amber-300',
  info:
    'dashboard-alerts-card text-red-900 dark:text-red-100',
}

const EMPLOYEE_CARD_CLASS =
  'dashboard-alerts-card w-full rounded-lg px-3 py-3 text-left shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 focus-visible:ring-offset-red-100 dark:focus-visible:ring-offset-red-950'

const EMPLOYEE_NAME_CLASS = 'min-w-0 text-sm font-semibold text-red-950 dark:text-red-50'
const BADGE_CLASS =
  'shrink-0 rounded-full bg-amber-200 px-2 py-0.5 text-xs font-semibold text-amber-950 ring-1 ring-inset ring-amber-700/40 dark:bg-amber-800 dark:text-amber-100 dark:ring-amber-400/50'

const ISSUE_TONE = {
  danger: 'text-red-700 dark:text-red-300',
  warning: 'text-amber-800 dark:text-amber-200',
}

const REVIEW_ACTION_CLASS =
  'mt-3 inline-flex items-center gap-1 text-xs font-semibold text-amber-800 dark:text-amber-300'

const EXPLICIT_ACTION_CLASS =
  'inline-flex items-center gap-1 rounded-md text-xs font-semibold text-amber-800 underline-offset-2 hover:text-amber-950 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 focus-visible:ring-offset-red-100 dark:text-amber-300 dark:hover:text-amber-200 dark:focus-visible:ring-amber-400 dark:focus-visible:ring-offset-red-950'

const SEE_ALL_CLASS =
  'mt-4 inline-flex shrink-0 items-center gap-1 self-start rounded-md text-xs font-semibold text-amber-800 underline-offset-2 hover:text-amber-950 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 focus-visible:ring-offset-red-100 dark:text-amber-300 dark:hover:text-amber-200 dark:focus-visible:ring-amber-400 dark:focus-visible:ring-offset-red-950'

const LIST_COMPACT_CLASS = 'space-y-3 overflow-visible'
const LIST_SCROLL_CLASS =
  'dashboard-alerts-scroll min-h-0 max-h-[min(22rem,50vh)] space-y-3 overflow-x-hidden overflow-y-auto pr-1'

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

export function dashboardAlertsListClass(employeeCount) {
  return Number(employeeCount) > DASHBOARD_ALERTS_SCROLL_AFTER ? LIST_SCROLL_CLASS : LIST_COMPACT_CLASS
}

export function focusDashboardAlertasPanel() {
  const title = document.getElementById('dashboard-alertas-title')
  if (!(title instanceof HTMLElement)) return false
  title.scrollIntoView({ behavior: 'smooth', block: 'start' })
  title.focus({ preventScroll: true })
  return true
}

function otherItemsMarkup(item, index) {
  const tone = OTHER_ITEM_TONE[item.tone] ?? OTHER_ITEM_TONE.info
  const clickable = Boolean(item.action)
  const detailHtml = String(item.detail ?? '')
    .split('\n')
    .filter(Boolean)
    .map((line) => `<span class="mt-1 block text-xs leading-5 opacity-80">${escapeHtml(line)}</span>`)
    .join('')
  const actionHtml = item.action?.label
    ? `<span class="mt-2 block text-xs font-semibold underline-offset-2">${escapeHtml(item.action.label)}</span>`
    : ''

  return `
    <li>
      <${clickable ? 'button type="button"' : 'div'}
        data-alert-index="${index}"
        class="dashboard-alerts-card w-full rounded-lg border px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 ${tone} ${clickable ? 'cursor-pointer' : ''}"
      >
        <span class="block text-sm font-semibold">${escapeHtml(item.title ?? '')}</span>
        ${detailHtml}
        ${actionHtml}
      </${clickable ? 'button' : 'div'}>
    </li>
  `
}

function employeeActions(item) {
  if (Array.isArray(item.actions) && item.actions.length) return item.actions
  return item.action ? [item.action] : []
}

function issueListMarkup(issues) {
  return (Array.isArray(issues) ? issues : [])
    .map((issue) => {
      const tone = ISSUE_TONE[issue.tone] ?? ISSUE_TONE.warning
      return `<li class="${tone}">${escapeHtml(formatAttentionIssue(issue))}</li>`
    })
    .join('')
}

function employeeCardMarkup(item, index) {
  const badge = item.badge || ''
  const name = item.title ?? ''
  const actions = employeeActions(item)
  const cardAction = item.cardAction ?? (actions.length === 1 ? actions[0] : null)
  const issueList = issueListMarkup(item.issues)
  const header = `
        <div class="flex items-start justify-between gap-2">
          <h3 class="${EMPLOYEE_NAME_CLASS}">${escapeHtml(name)}</h3>
          <span class="${BADGE_CLASS}">${escapeHtml(badge)}</span>
        </div>
        <ul class="mt-2 list-disc space-y-1 pl-4 text-xs leading-5">
          ${issueList}
        </ul>`

  if (cardAction) {
    const actionLabel = cardAction.label || 'Revisar empleado'
    return `
    <li>
      <button
        type="button"
        data-alert-index="${index}"
        data-alert-action="0"
        class="${EMPLOYEE_CARD_CLASS} cursor-pointer"
        aria-label="${escapeHtml(`${actionLabel}: ${name}`)}"
      >
        ${header}
        <span class="${REVIEW_ACTION_CLASS}">
          ${escapeHtml(actionLabel)}
          ${iconChevronRight()}
        </span>
      </button>
    </li>
  `
  }

  const explicitActions = actions
    .map((action, actionIndex) => {
      const label = action.label || ''
      return `
        <button
          type="button"
          data-alert-index="${index}"
          data-alert-action="${actionIndex}"
          class="${EXPLICIT_ACTION_CLASS}"
          aria-label="${escapeHtml(`${label}: ${name}`)}"
        >
          ${escapeHtml(label)}
          ${iconChevronRight()}
        </button>`
    })
    .join('')

  return `
    <li>
      <article class="${EMPLOYEE_CARD_CLASS}">
        ${header}
        ${explicitActions ? `<div class="mt-3 flex flex-col items-start gap-2">${explicitActions}</div>` : ''}
      </article>
    </li>
  `
}

export function createDashboardAlerts(alertas, { onAction } = {}) {
  const items = Array.isArray(alertas?.items) ? alertas.items : []
  if (!items.length) return null

  const employeeItems = items.filter((item) => item.type === 'empleado')
  const otherItems = items.filter((item) => item.type !== 'empleado')

  const employeeCount = alertas?.employeeCount ?? employeeItems.length
  const pendingCount = alertas?.pendingCount ?? employeeItems.reduce((total, item) => total + (item.pendingCount || 0), 0)
  const headingText = employeeItems.length
    ? dashboardAlertasHeading(employeeCount, pendingCount)
    : otherItems.length === 1
      ? String(otherItems[0].title || 'Hay alertas que requieren atención')
      : 'Hay alertas que requieren atención'

  const section = document.createElement('section')
  section.className = SECTION_CLASS
  section.setAttribute('aria-labelledby', 'dashboard-alertas-title')
  section.dataset.employeeCount = String(employeeCount)

  const heading = document.createElement('div')
  heading.className = 'mb-4 shrink-0'
  heading.innerHTML = `
    <div class="flex items-start gap-3">
      <span class="${ICON_WRAP}">
        ${iconAlertTriangle()}
      </span>
      <div class="min-w-0">
        <h2 id="dashboard-alertas-title" class="${TITLE_CLASS}" tabindex="-1">Alertas y pendientes</h2>
        <p class="${SUMMARY_CLASS}">${escapeHtml(headingText)}</p>
      </div>
    </div>
  `
  section.append(heading)

  const list = document.createElement('ul')
  list.className = dashboardAlertsListClass(employeeCount)

  otherItems.forEach((item) => {
    const index = items.indexOf(item)
    list.insertAdjacentHTML('beforeend', otherItemsMarkup(item, index))
  })

  employeeItems.forEach((item) => {
    const index = items.indexOf(item)
    list.insertAdjacentHTML('beforeend', employeeCardMarkup(item, index))
  })

  list.querySelectorAll('[data-alert-index]').forEach((control) => {
    control.addEventListener('click', (event) => {
      event.preventDefault()
      event.stopPropagation()
      const item = items[Number(control.getAttribute('data-alert-index'))]
      if (!item) return
      const actions = employeeActions(item)
      const actionIndex = Number(control.getAttribute('data-alert-action'))
      const action = Number.isFinite(actionIndex) ? actions[actionIndex] : item.cardAction || item.action
      if (action) onAction?.(action)
    })
  })

  section.append(list)

  if (employeeItems.length > 1) {
    const seeAll = document.createElement('button')
    seeAll.type = 'button'
    seeAll.className = SEE_ALL_CLASS
    seeAll.innerHTML = `${escapeHtml(DASHBOARD_SEE_ALL_PENDIENTES_LABEL)}${iconChevronRight()}`
    seeAll.addEventListener('click', (event) => {
      event.preventDefault()
      event.stopPropagation()
      onAction?.({
        view: 'empleados',
        label: DASHBOARD_SEE_ALL_PENDIENTES_LABEL,
        estadoDatos: 'pendientes',
      })
    })
    section.append(seeAll)
  }

  return section
}
