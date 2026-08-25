import { formatDateTime } from '../utils/format.js'

function movementBadge(tipo) {
  const isEntry = tipo === 'Entrada'
  const classes = isEntry
    ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/10'
    : 'bg-amber-50 text-amber-700 ring-amber-600/10'

  return `<span class="inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${classes}">${tipo}</span>`
}

export function createRecentPunchesTable(fichadas) {
  const section = document.createElement('section')
  section.className =
    'overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm'

  const rows = fichadas
    .map(
      (item) => `
        <tr class="hover:bg-slate-50">
          <td class="whitespace-nowrap px-4 py-3 text-sm font-medium text-slate-900">${item.empleado}</td>
          <td class="whitespace-nowrap px-4 py-3 text-sm text-slate-600">${item.area}</td>
          <td class="whitespace-nowrap px-4 py-3">${movementBadge(item.tipoMovimiento)}</td>
          <td class="whitespace-nowrap px-4 py-3 text-sm text-slate-600">${formatDateTime(item.fechaHora)}</td>
          <td class="whitespace-nowrap px-4 py-3 text-sm text-slate-600">${item.dispositivo}</td>
        </tr>
      `,
    )
    .join('')

  section.innerHTML = `
    <div class="border-b border-slate-200 px-5 py-4">
      <h2 class="text-base font-semibold text-slate-900">Últimas fichadas</h2>
      <p class="mt-1 text-sm text-slate-500">Movimientos recientes registrados en los dispositivos.</p>
    </div>
    <div class="overflow-x-auto">
      <table class="min-w-full divide-y divide-slate-200">
        <thead class="bg-slate-50">
          <tr>
            <th scope="col" class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Empleado</th>
            <th scope="col" class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Área</th>
            <th scope="col" class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Tipo de movimiento</th>
            <th scope="col" class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Fecha y hora</th>
            <th scope="col" class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Dispositivo</th>
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
