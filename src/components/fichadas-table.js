import { displayValue, formatDate, formatTime } from '../utils/format.js'

function tipoBadge(tipo) {
  const isEntry = tipo === 'Entrada'
  const classes = isEntry
    ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/10'
    : 'bg-amber-50 text-amber-700 ring-amber-600/10'
  const label = tipo === 'Entrada' || tipo === 'Salida' ? tipo : displayValue(tipo)

  return `<span class="inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${classes}">${label}</span>`
}

function metodoBadge(metodo) {
  const isManual = metodo === 'Manual'
  const classes = isManual
    ? 'bg-slate-100 text-slate-700 ring-slate-500/10'
    : 'bg-indigo-50 text-indigo-700 ring-indigo-600/10'
  const label = metodo === 'Manual' || metodo === 'Biométrico' ? metodo : displayValue(metodo)

  return `<span class="inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${classes}">${label}</span>`
}

export function createFichadasTable(fichadas) {
  const section = document.createElement('section')
  section.className =
    'overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm'

  const rows = fichadas
    .map(
      (item) => `
        <tr class="hover:bg-slate-50">
          <td class="whitespace-nowrap px-4 py-3 text-sm font-medium text-slate-900">${displayValue(item.empleado)}</td>
          <td class="whitespace-nowrap px-4 py-3 text-sm text-slate-600">${displayValue(item.legajo)}</td>
          <td class="whitespace-nowrap px-4 py-3 text-sm text-slate-600">${item.fechaHora ? formatDate(item.fechaHora) : '—'}</td>
          <td class="whitespace-nowrap px-4 py-3 text-sm text-slate-600">${item.fechaHora ? formatTime(item.fechaHora) : '—'}</td>
          <td class="whitespace-nowrap px-4 py-3">${tipoBadge(item.tipo)}</td>
          <td class="whitespace-nowrap px-4 py-3">${metodoBadge(item.metodo)}</td>
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
            <th scope="col" class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Hora</th>
            <th scope="col" class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Tipo</th>
            <th scope="col" class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Método</th>
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
