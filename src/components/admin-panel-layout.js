/** Shared presentation for Administración cards. Layout only. */

import { escapeHtml } from '../utils/format.js'

export const ADMIN_CARD_CLASS =
  'flex w-full flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900'

export const ADMIN_CARD_HEADER_CLASS =
  'flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between'

export const ADMIN_CARD_TITLE_CLASS =
  'text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100'

export const ADMIN_CARD_DESCRIPTION_CLASS = 'mt-1 text-sm text-slate-500 dark:text-slate-400'

export const ADMIN_CARD_META_CLASS = 'text-sm text-slate-500 dark:text-slate-400'

export const ADMIN_SECTION_GAP_CLASS = 'mt-4'

export const ADMIN_TABLE_SHELL_CLASS =
  '-mx-4 mt-4 overflow-x-hidden border-t border-slate-200 dark:border-slate-700'

export const ADMIN_TABLE_HEADER_CELL_CLASS =
  'sticky top-0 z-10 hidden h-10 items-center bg-slate-50 px-4 text-xs font-medium text-slate-500 dark:bg-slate-800 sm:flex'

export const ADMIN_PAGE_CLASS = 'mx-auto w-full max-w-[1200px] space-y-4'

export const ADMIN_PRIMARY_BUTTON_CLASS =
  'inline-flex h-10 w-full shrink-0 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto'

export const ADMIN_FILTER_GRID_CLASS =
  'grid items-end gap-3 sm:grid-cols-[minmax(16rem,1.5fr)_repeat(auto-fit,minmax(9.5rem,0.7fr))]'

export const ADMIN_TABLE_FRAME_CLASS =
  'overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900'

export const ADMIN_TH_CLASS =
  'px-3 py-2 text-xs font-medium text-slate-500 dark:text-slate-400'

export function adminSectionHeaderMarkup({ titleId, title, description, context = '', actionHtml = '' }) {
  return `
    <div class="flex min-h-[4.5rem] flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div class="min-w-0">
        <h3 id="${escapeHtml(titleId)}" class="text-base font-semibold text-slate-900 dark:text-slate-100">${escapeHtml(title)}</h3>
        <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">${escapeHtml(description)}</p>
        ${context ? `<p class="mt-1 text-sm text-slate-500 dark:text-slate-400">${escapeHtml(context)}</p>` : ''}
      </div>
      <div data-admin-action class="w-full sm:w-auto">${actionHtml}</div>
    </div>
  `
}

export function createAdminEmptyState({ title, detail, actionLabel = '', onAction } = {}) {
  const box = document.createElement('div')
  box.className = `${ADMIN_TABLE_FRAME_CLASS} px-6 py-10 text-center`
  box.setAttribute('role', 'status')
  box.innerHTML = `
    <h3 class="text-sm font-semibold text-slate-800 dark:text-slate-100">${escapeHtml(title)}</h3>
    <p class="mx-auto mt-1 max-w-md text-sm text-slate-500 dark:text-slate-400">${escapeHtml(detail)}</p>
  `
  if (actionLabel && onAction) {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = `${ADMIN_PRIMARY_BUTTON_CLASS} mt-4`
    button.textContent = actionLabel
    button.addEventListener('click', onAction)
    box.append(button)
  }
  return box
}

export const ADMIN_TABLE_ROW_CLASS =
  'col-span-1 grid grid-cols-1 items-center gap-2 border-b border-slate-100 px-4 py-2.5 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/60'

export const ADMIN_FIELD_CONTROL_CLASS = 'h-10 py-0'

export const ADMIN_TOOLBAR_BUTTON_CLASS =
  'inline-flex h-10 w-full shrink-0 items-center justify-center gap-2 self-end whitespace-nowrap rounded-lg bg-blue-600 px-3 text-sm font-semibold text-white hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto'
