import { escapeHtml } from '../utils/format.js'

export const PAGE_SHELL_CLASS = 'mx-auto w-full max-w-7xl space-y-6'

export function pageHeadingMarkup({ title, description } = {}) {
  return `
    <section class="space-y-1">
      <h2 class="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">${escapeHtml(title)}</h2>
      ${
        description
          ? `<p class="text-sm text-slate-500 dark:text-slate-400">${escapeHtml(description)}</p>`
          : ''
      }
    </section>
  `
}
