import { featureStatusBadge } from './badge.js'
import { escapeHtml } from '../utils/format.js'

const IMPLEMENTATION_ITEMS = [
  { label: 'Asignación por sucursal/departamento', status: 'api' },
  { label: 'Departamentos', status: 'ui' },
]

export function createImplementationStatusSection() {
  const section = document.createElement('section')
  section.className =
    'rounded-xl border border-dashed border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-700 dark:bg-slate-900'
  section.setAttribute('aria-labelledby', 'implementation-status-title')

  section.innerHTML = `
    <div class="mb-2">
      <h2 id="implementation-status-title" class="text-sm font-semibold text-slate-700 dark:text-slate-200">Estado de implementación</h2>
      <p class="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Capacidades del panel todavía no disponibles. No representa datos operativos.</p>
    </div>
    <ul class="divide-y divide-slate-100 dark:divide-slate-800">
      ${IMPLEMENTATION_ITEMS.map(
        (item) => `
          <li class="flex items-center justify-between gap-3 py-2">
            <span class="min-w-0 truncate text-sm text-slate-600 dark:text-slate-300">${escapeHtml(item.label)}</span>
            ${featureStatusBadge(item.status)}
          </li>
        `,
      ).join('')}
    </ul>
  `

  return section
}
