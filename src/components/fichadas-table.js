import {
  displayMetodoLabel,
  displayTipoLabel,
  displayValue,
  esMetodoBiometrico,
  escapeHtml,
  formatFichadaFecha,
  formatFichadaHora,
} from '../utils/format.js'
import { TIPO_INFORMADO_TOOLTIP } from '../utils/movimientos.js'
import {
  hasObservacionHumana,
  observacionAddAriaLabel,
} from '../utils/fichada-observacion.js'
import { allColumnIds, visibleColumns } from '../utils/fichadas-columns.js'
import { badgeHtml, movementBadge } from './badge.js'
import { observacionHumanaBadgeButton } from './observacion-badge.js'
import { bindTooltipRoot } from './tooltip.js'
import { FICHADAS_BODY_CLASS } from './fichadas-frame.js'

const COMPACT_BADGE = 'h-6 px-2 py-0 text-[11px] leading-none'
const COLUMN_WEIGHT = {
  empleado: 22,
  legajo: 9,
  fecha: 13,
  hora: 9,
  tipo: 13,
  metodo: 14,
  observacion: 16,
}
const CENTERED = new Set(['legajo', 'fecha', 'hora', 'tipo', 'metodo'])

function alignClass(columnId) {
  return CENTERED.has(columnId) ? 'text-center' : 'text-left'
}

function columnWidth(columnId, columns) {
  const total = columns.reduce((sum, column) => sum + (COLUMN_WEIGHT[column.id] ?? 10), 0)
  const weight = COLUMN_WEIGHT[columnId] ?? 10
  return `${((weight / total) * 100).toFixed(2)}%`
}

function movimientoVisualBadge(item) {
  const visual = displayTipoLabel(item.movimientoVisual ?? item.tipo)
  const informed = displayTipoLabel(item.movimientoInformado ?? item.tipo)
  const differs = informed && visual && informed !== visual
  const tooltip = differs ? `Informado originalmente: ${informed}` : TIPO_INFORMADO_TOOLTIP
  return movementBadge(visual, { tooltip, ariaLabel: tooltip, className: COMPACT_BADGE })
}

function metodoBadge(metodo) {
  const isBiometric = esMetodoBiometrico(metodo)
  const label = displayMetodoLabel(metodo)
  return badgeHtml(label, isBiometric ? 'info' : 'neutral', { className: COMPACT_BADGE })
}

function observacionCell(item, { canEditObservacion } = {}) {
  const hasNote = hasObservacionHumana(item)

  if (!hasNote && !canEditObservacion) {
    return '<span class="text-slate-400">—</span>'
  }

  if (!hasNote) {
    return `<button
      type="button"
      data-action="observacion-fichada"
      data-id="${escapeHtml(String(item.id ?? ''))}"
      class="inline-flex h-8 min-w-8 items-center rounded-md px-2 text-xs font-medium text-blue-700 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-blue-300 dark:hover:bg-blue-950/40"
      aria-label="${escapeHtml(observacionAddAriaLabel(item))}"
    >+ Agregar</button>`
  }

  return observacionHumanaBadgeButton({
    item,
    canEdit: canEditObservacion,
    action: 'observacion-fichada',
    layout: 'table',
  })
}

function cellClass(columnId, extra = '') {
  const align = alignClass(columnId)
  return `h-12 px-3 py-1.5 align-middle text-sm whitespace-nowrap ${align} ${extra}`.trim()
}

export function movimientoCellHtml(item, columnId, options = {}) {
  switch (columnId) {
    case 'empleado':
      return `<td class="${cellClass(columnId, 'max-w-0 truncate font-medium text-slate-900 dark:text-slate-100')}">${displayValue(item.empleado)}</td>`
    case 'legajo':
      return `<td class="${cellClass(columnId, 'text-slate-600 dark:text-slate-300')}">${displayValue(item.legajo)}</td>`
    case 'fecha':
      return `<td class="${cellClass(columnId, 'text-slate-600 dark:text-slate-300')}">${item.fechaHora ? formatFichadaFecha(item.fechaHora) : '—'}</td>`
    case 'hora':
      return `<td class="${cellClass(columnId, 'text-slate-600 dark:text-slate-300')}">${item.fechaHora ? formatFichadaHora(item.fechaHora) : '—'}</td>`
    case 'tipo':
      return `<td class="${cellClass(columnId)}">${movimientoVisualBadge(item)}</td>`
    case 'metodo':
      return `<td class="${cellClass(columnId)}">${metodoBadge(item.metodo)}</td>`
    case 'observacion':
      return `<td class="${cellClass(columnId, 'max-w-0')}">${observacionCell(item, options)}</td>`
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
  {
    visibleColumnIds = allColumnIds('movimientos'),
    placeholder,
    onPlaceholderAction,
    onObservacion,
    canEditObservacion = false,
  } = {},
) {
  const columns = visibleColumns('movimientos', visibleColumnIds)
  const colspan = columns.length
  const section = document.createElement('section')
  section.className = 'min-w-0'
  section.dataset.visibleColumns = columns.map((column) => column.id).join(',')
  section.dataset.colspan = String(colspan)

  const headers = columns
    .map((column) => {
      const title = column.id === 'tipo' ? ` title="${escapeHtml(TIPO_INFORMADO_TOOLTIP)}"` : ''
      return `<th scope="col" class="h-10 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 ${alignClass(column.id)}" data-column="${column.id}"${title}>${column.label}</th>`
    })
    .join('')

  const rows =
    placeholder || fichadas.length === 0
      ? placeholderRow(colspan, placeholder ?? { title: 'Sin resultados', message: 'No hay fichadas que coincidan con los filtros seleccionados.' })
      : fichadas
          .map(
            (item) => `
        <tr class="border-b border-slate-100 transition-colors hover:bg-slate-50 focus-within:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/70 dark:focus-within:bg-slate-800/70">
          ${columns.map((column) => movimientoCellHtml(item, column.id, { canEditObservacion })).join('')}
        </tr>
      `,
          )
          .join('')

  section.innerHTML = `
    <div class="${FICHADAS_BODY_CLASS}">
      <table class="w-full table-fixed max-lg:min-w-[40rem]">
        <colgroup>${columns.map((column) => `<col data-column="${column.id}" style="width:${columnWidth(column.id, columns)}" />`).join('')}</colgroup>
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
  if (onObservacion) {
    section.addEventListener('click', (event) => {
      const button = event.target.closest('[data-action="observacion-fichada"]')
      if (!button || !section.contains(button)) return
      const id = String(button.dataset.id ?? '')
      const fichada = fichadas.find((item) => String(item?.id) === id)
      if (fichada) onObservacion(fichada)
    })
  }
  bindTooltipRoot(section)

  return section
}
