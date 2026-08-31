import { displayValue, formatDate } from '../utils/format.js'

export function createJornadasTable(jornadas) {
  const section = document.createElement('section')
  section.className =
    'overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm'

  const rows = jornadas
    .map(
      (item) => `
        <tr class="hover:bg-slate-50">
          <td class="whitespace-nowrap px-4 py-3 text-sm font-medium text-slate-900">${displayValue(item.empleado)}</td>
          <td class="whitespace-nowrap px-4 py-3 text-sm text-slate-600">${displayValue(item.legajo)}</td>
          <td class="whitespace-nowrap px-4 py-3 text-sm text-slate-600">${item.fecha ? formatDate(new Date(`${item.fecha}T12:00:00`)) : '—'}</td>
          <td class="whitespace-nowrap px-4 py-3 text-sm text-slate-600">${displayValue(item.horarioPrevisto)}</td>
          <td class="whitespace-nowrap px-4 py-3 text-sm text-slate-600">${displayValue(item.ingresoHora)}</td>
          <td class="whitespace-nowrap px-4 py-3 text-sm text-slate-600">${displayValue(item.egresoHora)}</td>
          <td class="whitespace-nowrap px-4 py-3 text-sm text-slate-600">${displayValue(item.metodoIngreso)}</td>
          <td class="whitespace-nowrap px-4 py-3 text-sm text-slate-600">${displayValue(item.metodoEgreso)}</td>
        </tr>
      `,
    )
    .join('')

  section.innerHTML = `
    <div class="overflow-x-auto">
      <table class="min-w-full divide-y divide-slate-200">
        <thead class="bg-slate-50">
          <tr>
            <th scope="col" class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Empleado</th>
            <th scope="col" class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Legajo</th>
            <th scope="col" class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Fecha</th>
            <th scope="col" class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Horario previsto</th>
            <th scope="col" class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Hora de ingreso</th>
            <th scope="col" class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Hora de egreso</th>
            <th scope="col" class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Método de ingreso</th>
            <th scope="col" class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Método de egreso</th>
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
