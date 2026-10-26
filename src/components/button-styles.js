import { escapeHtml } from '../utils/format.js'
import { iconPencil, iconTrash } from './icons.js'

export const BTN_SECONDARY_CLASS = 'btn-secondary'
export const BTN_EDIT_CLASS = 'btn-action-edit'
export const BTN_DELETE_CLASS = 'btn-action-delete'

export function actionButtonMarkup({
  variant = 'edit',
  label,
  ariaLabel,
  attrs = '',
  compact = false,
} = {}) {
  const isDelete = variant === 'delete'
  const text = label || (isDelete ? 'Eliminar' : 'Editar')
  const accessible = ariaLabel || text
  const icon = isDelete ? iconTrash('h-3.5 w-3.5 shrink-0') : iconPencil('h-3.5 w-3.5 shrink-0')
  const className = `${isDelete ? BTN_DELETE_CLASS : BTN_EDIT_CLASS}${compact ? ' btn-action-compact' : ''}`
  const extra = attrs ? ` ${attrs}` : ''
  return `<button type="button" class="${className}" aria-label="${escapeHtml(accessible)}"${extra}>${icon}<span>${escapeHtml(text)}</span></button>`
}

export function createActionButton({ variant = 'edit', label, ariaLabel, compact = false } = {}) {
  const isDelete = variant === 'delete'
  const text = label || (isDelete ? 'Eliminar' : 'Editar')
  const button = document.createElement('button')
  button.type = 'button'
  button.className = `${isDelete ? BTN_DELETE_CLASS : BTN_EDIT_CLASS}${compact ? ' btn-action-compact' : ''}`
  button.setAttribute('aria-label', ariaLabel || text)
  button.innerHTML = `${isDelete ? iconTrash('h-3.5 w-3.5 shrink-0') : iconPencil('h-3.5 w-3.5 shrink-0')}<span></span>`
  button.querySelector('span').textContent = text
  return button
}

export const BTN_DANGER_CLASS =
  'inline-flex items-center justify-center gap-2 rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 transition-colors hover:border-red-400 hover:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-500/50 dark:bg-red-500/10 dark:text-red-300 dark:hover:border-red-400/60 dark:hover:bg-red-500/20'

export const BTN_POSITIVE_CLASS =
  'inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 transition-colors hover:border-emerald-400 hover:bg-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-emerald-500/50 dark:bg-emerald-500/10 dark:text-emerald-300 dark:hover:border-emerald-400/60 dark:hover:bg-emerald-500/20'
