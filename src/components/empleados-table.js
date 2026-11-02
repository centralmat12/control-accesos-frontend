import { displayValue, escapeHtml } from '../utils/format.js'
import { listLegajoWarnings } from '../utils/empleado-data.js'
import { employeeStatusBadge } from './badge.js'
import { actionButtonMarkup } from './button-styles.js'
import { iconAlertTriangle } from './icons.js'
import { bindTooltipRoot, tooltipTriggerAttributes } from './tooltip.js'

export function fullName(empleado) {
  return [empleado.nombre, empleado.apellido].filter(Boolean).join(' ')
}

function sortIndicator(active, direction) {
  if (!active) return '<span class="text-slate-300" aria-hidden="true">↕</span>'
  return `<span class="text-slate-700" aria-hidden="true">${direction === 'desc' ? '↓' : '↑'}</span>`
}

export function legajoCellHtml(empleado, catalog = []) {
  const shown = displayValue(empleado.legajo)
  const warnings = listLegajoWarnings(empleado, catalog)
  if (warnings.length === 0) return shown

  const indicators = warnings
    .map(
      (warning) => `
      <span
        class="inline-flex shrink-0 text-amber-600 dark:text-amber-400"
        role="img"
        aria-label="${escapeHtml(warning.message)}"
        ${tooltipTriggerAttributes(warning.message)}
      >
        ${iconAlertTriangle('h-4 w-4')}
      </span>
    `,
    )
    .join('')

  return `
    <span class="inline-flex items-center gap-1.5">
      <span>${shown}</span>
      ${indicators}
    </span>
  `
}

function sortHeader(key, label, sortKey, sortDir) {
  const active = sortKey === key
  const ariaSort = active ? (sortDir === 'desc' ? 'descending' : 'ascending') : 'none'

  return `
    <th scope="col" aria-sort="${ariaSort}" class="px-3 py-2 text-left text-sm font-medium text-slate-500 dark:text-slate-400">
      <button
        type="button"
        data-sort="${key}"
        class="inline-flex items-center gap-1 rounded-md hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      >
        ${label}
        ${sortIndicator(active, sortDir)}
      </button>
    </th>
  `
}

export function createEmpleadosTable(
  empleados,
  { onView, onSort, sortKey = 'nombre', sortDir = 'asc', highlightId, catalog } = {},
) {
  const section = document.createElement('section')
  section.className = 'min-w-0'
  const usageCatalog = Array.isArray(catalog) ? catalog : empleados

  const rows = empleados
    .map((empleado) => {
      const highlighted = highlightId != null && Number(empleado.id) === Number(highlightId)
      const inactive = empleado.activo === false
      const rowClass = highlighted
        ? 'bg-blue-50 hover:bg-blue-50 dark:bg-blue-950/50 dark:hover:bg-blue-950/50'
        : inactive
          ? 'bg-slate-50/80 text-slate-600 hover:bg-slate-100 dark:bg-slate-900/40 dark:text-slate-400 dark:hover:bg-slate-800/50'
          : 'hover:bg-slate-50 dark:hover:bg-slate-800/70'
      const primaryCell = inactive
        ? 'h-11 whitespace-nowrap px-3 py-1 align-middle text-sm font-medium text-slate-600 dark:text-slate-300'
        : 'h-11 whitespace-nowrap px-3 py-1 align-middle text-sm font-medium text-slate-900 dark:text-slate-100'
      const nameCell = inactive
        ? 'h-11 whitespace-nowrap px-3 py-1 align-middle text-sm text-slate-600 dark:text-slate-300'
        : 'h-11 whitespace-nowrap px-3 py-1 align-middle text-sm text-slate-900 dark:text-slate-100'

      return `
        <tr class="h-11 border-b border-slate-100 transition-colors last:border-b-0 dark:border-slate-800 ${rowClass}">
          <td class="${primaryCell}">${legajoCellHtml(empleado, usageCatalog)}</td>
          <td class="${nameCell}">${displayValue(fullName(empleado))}</td>
          <td class="h-11 whitespace-nowrap px-3 py-1 align-middle text-sm text-slate-600 dark:text-slate-300">${displayValue(empleado.dni)}</td>
          <td class="h-11 whitespace-nowrap px-3 py-1 align-middle text-sm text-slate-600 dark:text-slate-300">${displayValue(empleado.departamento)}</td>
          <td class="h-11 whitespace-nowrap px-3 py-1 align-middle">${employeeStatusBadge(empleado.activo)}</td>
          <td class="h-11 whitespace-nowrap px-3 py-1 align-middle text-right">
        ${actionButtonMarkup({
          label: 'Editar',
          ariaLabel: 'Editar empleado',
          attrs: `data-action="view" data-id="${Number(empleado.id)}"`,
          compact: true,
        })}
          </td>
        </tr>
      `
    })
    .join('')

  section.innerHTML = `
    <div class="overflow-x-auto">
      <table class="w-full min-w-[720px] border-collapse">
        <thead class="bg-slate-50 dark:bg-slate-800">
          <tr class="border-b border-slate-200 dark:border-slate-700">
            ${sortHeader('legajo', 'Legajo', sortKey, sortDir)}
            ${sortHeader('nombre', 'Empleado', sortKey, sortDir)}
            ${sortHeader('dni', 'DNI', sortKey, sortDir)}
            ${sortHeader('departamento', 'Departamento', sortKey, sortDir)}
            <th scope="col" class="px-3 py-2 text-left text-sm font-medium text-slate-500 dark:text-slate-400">Estado</th>
            <th scope="col" class="w-28 px-3 py-2 text-right text-sm font-medium text-slate-500 dark:text-slate-400">Acciones</th>
          </tr>
        </thead>
        <tbody class="bg-white dark:bg-slate-900">
          ${rows}
        </tbody>
      </table>
    </div>
  `

  bindTooltipRoot(section)

  section.addEventListener('click', (event) => {
    const sortButton = event.target.closest('[data-sort]')
    if (sortButton) {
      onSort?.(sortButton.dataset.sort)
      return
    }

    const button = event.target.closest('[data-action]')
    if (!button) return

    const id = Number(button.dataset.id)
    const empleado = empleados.find((item) => Number(item.id) === id)
    if (!empleado) return

    if (button.dataset.action === 'view') onView?.(empleado)
  })

  return section
}
