import { displayValue } from '../utils/format.js'

function statusBadge(activo) {
  const isActive = Boolean(activo)
  const classes = isActive
    ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/10'
    : 'bg-slate-100 text-slate-600 ring-slate-500/10'
  const label = isActive ? 'Activo' : 'Inactivo'

  return `<span class="inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${classes}">${label}</span>`
}

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
  { onView, onDeactivate, onSort, sortKey = 'nombre', sortDir = 'asc', highlightId } = {},
) {
  const section = document.createElement('section')
  section.className = 'overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm'

  const rows = empleados
    .map((empleado) => {
      const highlighted = highlightId != null && Number(empleado.id) === Number(highlightId)
      const rowClass = highlighted ? 'bg-blue-50 hover:bg-blue-50' : 'hover:bg-slate-50'

      return `
        <tr class="${rowClass}">
          <td class="whitespace-nowrap px-4 py-3 text-sm font-medium text-slate-900">${displayValue(empleado.legajo)}</td>
          <td class="whitespace-nowrap px-4 py-3 text-sm text-slate-900">${displayValue(fullName(empleado))}</td>
          <td class="whitespace-nowrap px-4 py-3 text-sm text-slate-600">${displayValue(empleado.dni)}</td>
          <td class="whitespace-nowrap px-4 py-3 text-sm text-slate-600">${displayValue(empleado.departamento)}</td>
          <td class="whitespace-nowrap px-4 py-3">${statusBadge(empleado.activo)}</td>
          <td class="whitespace-nowrap px-4 py-3 text-right">
            <div class="flex justify-end gap-2">
              <button
                type="button"
                data-action="view"
                data-id="${Number(empleado.id)}"
                class="rounded-lg px-2.5 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-50"
              >
                Ver
              </button>
              <button
                type="button"
                data-action="deactivate"
                data-id="${Number(empleado.id)}"
                class="rounded-lg px-2.5 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50"
              >
                Desactivar
              </button>
            </div>
          </td>
        </tr>
      `
    })
    .join('')

  section.innerHTML = `
    <div class="overflow-x-auto">
      <table class="min-w-full divide-y divide-slate-200">
        <thead class="bg-slate-50">
          <tr>
            ${sortHeader('legajo', 'Legajo', sortKey, sortDir)}
            ${sortHeader('nombre', 'Nombre y apellido', sortKey, sortDir)}
            ${sortHeader('dni', 'DNI', sortKey, sortDir)}
            ${sortHeader('departamento', 'Departamento', sortKey, sortDir)}
            <th scope="col" class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Estado</th>
            <th scope="col" class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Acciones</th>
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
    if (button.dataset.action === 'deactivate') onDeactivate?.(empleado)
  })

  return section
}
