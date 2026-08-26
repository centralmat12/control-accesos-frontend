import { displayValue } from '../utils/format.js'

function statusBadge(activo) {
  const isActive = Boolean(activo)
  const classes = isActive
    ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/10'
    : 'bg-slate-100 text-slate-600 ring-slate-500/10'
  const label = isActive ? 'Activo' : 'Inactivo'

  return `<span class="inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${classes}">${label}</span>`
}

function fullName(empleado) {
  return [empleado.nombre, empleado.apellido].filter(Boolean).join(' ')
}

export function createEmpleadosTable(empleados) {
  const section = document.createElement('section')
  section.className =
    'overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm'

  const rows = empleados
    .map(
      (empleado) => `
        <tr class="hover:bg-slate-50">
          <td class="whitespace-nowrap px-4 py-3 text-sm font-medium text-slate-900">${displayValue(empleado.legajo)}</td>
          <td class="whitespace-nowrap px-4 py-3 text-sm text-slate-900">${displayValue(fullName(empleado))}</td>
          <td class="whitespace-nowrap px-4 py-3 text-sm text-slate-600">${displayValue(empleado.dni)}</td>
          <td class="whitespace-nowrap px-4 py-3 text-sm text-slate-600">${displayValue(empleado.departamento)}</td>
          <td class="whitespace-nowrap px-4 py-3 text-sm text-slate-600">${displayValue(empleado.categoria)}</td>
          <td class="whitespace-nowrap px-4 py-3 text-sm text-slate-600">${displayValue(empleado.sucursal)}</td>
          <td class="whitespace-nowrap px-4 py-3 text-sm text-slate-600">${displayValue(empleado.horario)}</td>
          <td class="whitespace-nowrap px-4 py-3">${statusBadge(empleado.activo)}</td>
        </tr>
      `,
    )
    .join('')

  section.innerHTML = `
    <div class="overflow-x-auto">
      <table class="min-w-full divide-y divide-slate-200">
        <thead class="bg-slate-50">
          <tr>
            <th scope="col" class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Legajo</th>
            <th scope="col" class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Nombre y apellido</th>
            <th scope="col" class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">DNI</th>
            <th scope="col" class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Departamento</th>
            <th scope="col" class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Categoría</th>
            <th scope="col" class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Sucursal</th>
            <th scope="col" class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Horario</th>
            <th scope="col" class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Estado</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100 bg-white">
          ${rows}
        </tbody>
      </table>
    </div>
  `

  return section
}