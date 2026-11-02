import { escapeHtml } from '../utils/format.js'

export function createFichadasEmptyState({ title, description, icon = '' } = {}) {
  const section = document.createElement('section')
  section.dataset.fichadasEmpty = 'true'
  section.className = 'flex min-h-52 flex-col items-center justify-center px-6 py-10 text-center'
  section.setAttribute('role', 'status')
  section.innerHTML = `
    <span class="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300" aria-hidden="true">${icon}</span>
    <h3 class="max-w-md text-sm font-semibold text-slate-800 dark:text-slate-100">${escapeHtml(title ?? '')}</h3>
    <p class="mt-1 max-w-md text-sm text-slate-500 dark:text-slate-400">${escapeHtml(description ?? '')}</p>
  `
  return section
}
