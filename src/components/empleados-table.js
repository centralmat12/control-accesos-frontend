import { displayValue } from '../utils/format.js'
import { employeeStatusBadge } from './badge.js'

export function fullName(empleado) {
  return [empleado.nombre, empleado.apellido].filter(Boolean).join(' ')
}

function sortIndicator(active, direction) {
  if (!active) return '<span class="text-slate-300" aria-hidden="true">↕</span>'
  return `<span class="text-slate-700" aria-hidden="true">${direction === 'desc' ? '↓' : '↑'}</span>`
}

function sortHeader(key, label, sortKey, sortDir) {
  const active = sortKey === key
  const ariaSort = active ? (sortDir === 'desc' ? 'descending' : 'ascending') : 'none'

  return `
    <th scope="col" aria-sort="${ariaSort}" class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
      <button
        type="button"
        data-sort="${key}"
        class="inline-flex items-center gap-1 rounded-md hover:text-slate-800"
      >
        ${label}
        ${sortIndicator(active, sortDir)}
      </button>
    </th>
  `
}

export function createEmpleadosTable(
  empleados,
  { onView, onSort, sortKey = 'nombre', sortDir = 'asc', highlightId } = {},
) {
  const section = document.createElement('section')
  section.className = 'overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm'

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
        ? 'whitespace-nowrap px-4 py-3 text-sm font-medium text-slate-600 dark:text-slate-300'
        : 'whitespace-nowrap px-4 py-3 text-sm font-medium text-slate-900'
      const nameCell = inactive
        ? 'whitespace-nowrap px-4 py-3 text-sm text-slate-600 dark:text-slate-300'
        : 'whitespace-nowrap px-4 py-3 text-sm text-slate-900'

      return `
        <tr class="transition-colors ${rowClass}">
          <td class="${primaryCell}">${displayValue(empleado.legajo)}</td>
          <td class="${nameCell}">${displayValue(fullName(empleado))}</td>
          <td class="whitespace-nowrap px-4 py-3 text-sm text-slate-600">${displayValue(empleado.dni)}</td>
          <td class="whitespace-nowrap px-4 py-3 text-sm text-slate-600">${displayValue(empleado.departamento)}</td>
          <td class="whitespace-nowrap px-4 py-3">${employeeStatusBadge(empleado.activo)}</td>
          <td class="w-28 whitespace-nowrap px-4 py-3 text-right">
        <button
  type="button"
  data-action="view"
  data-id="${Number(empleado.id)}"
  class="inline-flex items-center justify-center rounded-lg bg-blue-50 px-2.5 py-1.5 text-xs font-semibold text-blue-700 ring-1 ring-inset ring-blue-200 transition-all duration-150 ease-out hover:bg-blue-100 hover:ring-blue-300 hover:shadow-sm active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-blue-500/10 dark:text-blue-300 dark:ring-blue-500/40 dark:hover:bg-blue-500/20 dark:hover:ring-blue-400/60 motion-reduce:transform-none motion-reduce:transition-none"
>
  Ver/Editar
</button>
          </td>
        </tr>
      `
    })
    .join('')

  section.innerHTML = `
    <div class="max-h-[65vh] overflow-auto">
      <table class="min-w-full divide-y divide-slate-200">
        <thead class="sticky top-0 z-10 bg-slate-50 shadow-[0_1px_0_0_var(--color-slate-200)] dark:bg-slate-800 dark:shadow-[0_1px_0_0_var(--color-slate-700)]">
          <tr>
            ${sortHeader('legajo', 'Legajo', sortKey, sortDir)}
            ${sortHeader('nombre', 'Nombre y apellido', sortKey, sortDir)}
            ${sortHeader('dni', 'DNI', sortKey, sortDir)}
            ${sortHeader('departamento', 'Departamento', sortKey, sortDir)}
            <th scope="col" class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Estado</th>
            <th scope="col" class="w-28 px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Acciones</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100 bg-white">
          ${rows}
        </tbody>
      </table>
    </div>
  `

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
