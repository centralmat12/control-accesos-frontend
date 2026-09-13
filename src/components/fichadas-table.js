import {
  displayMetodoLabel,
  displayValue,
  esMetodoBiometrico,
  escapeHtml,
  formatDate,
  formatTime,
} from '../utils/format.js'
import { TIPO_INFORMADO_TOOLTIP, INTERMEDIATE_MOVIMIENTO_TOOLTIP } from '../utils/movimientos.js'
import { allColumnIds, visibleColumns } from '../utils/fichadas-columns.js'
import { badgeHtml, movementBadge } from './badge.js'
import { bindTooltipRoot } from './tooltip.js'

const TH_CLASS = 'px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500'
const TD_CLASS = 'px-4 py-3 text-sm text-slate-600 dark:text-slate-300'
const TD_NAME = 'px-4 py-3 text-sm font-medium text-slate-900 dark:text-slate-100'

function metodoBadge(metodo) {
  const isBiometric = esMetodoBiometrico(metodo)
  const label = displayMetodoLabel(metodo)
  return badgeHtml(label, isBiometric ? 'info' : 'neutral')
}

function observacionCell(item) {
  if (item.esPosibleDuplicado) {
    return badgeHtml(item.observacionLabel, 'yellow', {
      title: item.observacionLabel,
      ariaLabel: item.observacionLabel,
    })
  }
  if (item.esMovimientoIntermedio) {
    return badgeHtml('Movimiento intermedio', 'neutral', {
      tooltip: INTERMEDIATE_MOVIMIENTO_TOOLTIP,
      ariaLabel: 'Movimiento intermedio',
    })
  }
  return '<span class="text-slate-400">—</span>'
}

export function movimientoCellHtml(item, columnId) {
  switch (columnId) {
    case 'empleado':
      return `<td class="${TD_NAME}">${displayValue(item.empleado)}</td>`
    case 'legajo':
      return `<td class="${TD_CLASS}">${displayValue(item.legajo)}</td>`
    case 'fecha':
      return `<td class="${TD_CLASS}">${item.fechaHora ? formatDate(item.fechaHora) : '—'}</td>`
    case 'hora':
      return `<td class="${TD_CLASS}">${item.fechaHora ? formatTime(item.fechaHora) : '—'}</td>`
    case 'tipo':
      return `<td class="px-4 py-3">${movementBadge(item.tipo, {
        tooltip: TIPO_INFORMADO_TOOLTIP,
        ariaLabel: TIPO_INFORMADO_TOOLTIP,
      })}</td>`
    case 'metodo':
      return `<td class="px-4 py-3">${metodoBadge(item.metodo)}</td>`
    case 'observacion':
      return `<td class="px-4 py-3">${observacionCell(item)}</td>`
    default:
      return ''
  }
}

function placeholderRow(colspan, placeholder) {
  if (!placeholder) return ''
  const action = placeholder.actionLabel
    ? `<button type="button" data-action="table-placeholder" class="mt-3 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500">${escapeHtml(placeholder.actionLabel)}</button>`
    : ''
  return `
    <tr>
      <td colspan="${colspan}" class="px-4 py-10 text-center">
        <p class="text-sm font-semibold text-slate-900 dark:text-slate-100">${escapeHtml(placeholder.title ?? '')}</p>
        <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">${escapeHtml(placeholder.message ?? '')}</p>
        ${action}
      </td>
    </tr>
  `
}

export function createFichadasTable(
  fichadas,
  { visibleColumnIds = allColumnIds('movimientos'), placeholder, onPlaceholderAction } = {},
) {
  const columns = visibleColumns('movimientos', visibleColumnIds)
  const colspan = columns.length
  const section = document.createElement('section')
  section.className =
    'overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900'
  section.dataset.visibleColumns = columns.map((column) => column.id).join(',')
  section.dataset.colspan = String(colspan)

  const headers = columns
    .map((column) => {
      const title = column.id === 'tipo' ? ` title="${escapeHtml(TIPO_INFORMADO_TOOLTIP)}"` : ''
      return `<th scope="col" class="${TH_CLASS}" data-column="${column.id}"${title}>${column.label}</th>`
    })
    .join('')

  const rows =
    placeholder || fichadas.length === 0
      ? placeholderRow(colspan, placeholder ?? { title: 'Sin resultados', message: 'No hay fichadas que coincidan con los filtros seleccionados.' })
      : fichadas
          .map(
            (item) => `
        <tr class="transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/70">
          ${columns.map((column) => movimientoCellHtml(item, column.id)).join('')}
        </tr>
      `,
          )
          .join('')

  section.innerHTML = `
    <div class="max-h-[65vh] overflow-auto">
      <table class="w-full divide-y divide-slate-200 dark:divide-slate-700">
        <thead class="sticky top-0 z-10 bg-slate-50 shadow-[0_1px_0_0_var(--color-slate-200)] dark:bg-slate-800 dark:shadow-[0_1px_0_0_var(--color-slate-700)]">
          <tr>${headers}</tr>
        </thead>
        <tbody class="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-900">
          ${rows}
        </tbody>
      </table>
    </div>
  `

  if (placeholder?.actionLabel && onPlaceholderAction) {
    section.querySelector('[data-action="table-placeholder"]')?.addEventListener('click', onPlaceholderAction)
  }
  bindTooltipRoot(section)

  return section
}
