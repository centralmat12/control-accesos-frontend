import { escapeHtml } from '../utils/format.js'

export const PAGE_SHELL_CLASS = 'mx-auto w-full max-w-7xl space-y-6'

function headingCopy({ title, description }) {
  return `
      <h2 class="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">${escapeHtml(title)}</h2>
      ${
        description
          ? `<p class="text-sm text-slate-500 dark:text-slate-400">${escapeHtml(description)}</p>`
          : ''
      }
  `
}

export function pageHeadingMarkup({ title, description, actionsId } = {}) {
  if (!actionsId) {
    return `
    <section class="space-y-1">
      ${headingCopy({ title, description })}
    </section>
  `
  }
  return `
    <section class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div class="min-w-0 space-y-1">
        ${headingCopy({ title, description })}
      </div>
      <div id="${escapeHtml(actionsId)}" class="w-full min-w-0 sm:w-auto sm:shrink-0"></div>
    </section>
  `
}
