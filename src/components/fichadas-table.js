import {
  displayMetodoLabel,
  displayValue,
  esMetodoBiometrico,
  formatDate,
  formatTime,
} from '../utils/format.js'
import { badgeHtml, movementBadge } from './badge.js'

function tipoBadge(tipo) {
  return movementBadge(tipo)
}

function metodoBadge(metodo) {
  const isBiometric = esMetodoBiometrico(metodo)
  const label = displayMetodoLabel(metodo)
  return badgeHtml(label, isBiometric ? 'info' : 'neutral')
}

export function createFichadasTable(fichadas) {
  const section = document.createElement('section')
  section.className =
    'overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm'

  const rows = fichadas
    .map(
      (item) => `
        <tr class="transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/70">
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
    <div class="max-h-[65vh] overflow-auto">
      <table class="min-w-full divide-y divide-slate-200">
        <thead class="sticky top-0 z-10 bg-slate-50 shadow-[0_1px_0_0_var(--color-slate-200)] dark:bg-slate-800 dark:shadow-[0_1px_0_0_var(--color-slate-700)]">
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
