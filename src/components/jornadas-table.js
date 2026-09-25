import { displayValue, escapeHtml, formatFichadaFecha } from '../utils/format.js'
import { allColumnIds, visibleColumns } from '../utils/fichadas-columns.js'
import {
  countObservacionesJornada,
  describeObservacionesJornada,
} from '../utils/fichada-observacion.js'
import { indicadorObservacionesHtml, bindObservacionesJornada } from './jornada-observaciones.js'
import { jornadaEstadoBadge } from './badge.js'
import { iconEye } from './icons.js'
import { FICHADAS_BODY_CLASS } from './fichadas-frame.js'

const TH_CLASS = 'px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500'
const TD_CLASS = 'px-4 py-3 text-sm text-slate-600 dark:text-slate-300'
const INGRESO_HEADER = 'Primera fichada'
const EGRESO_HEADER = 'Última fichada'

const HEADER_LABELS = {
  ingreso: INGRESO_HEADER,
  egreso: EGRESO_HEADER,
}

function headerLabel(column) {
  return HEADER_LABELS[column.id] ?? column.label
}

export function jornadaCellHtml(item, columnId, index) {
  switch (columnId) {
    case 'empleado':
      return `<td class="max-w-[14rem] px-4 py-3 text-sm font-medium text-slate-900 dark:text-slate-100"><div class="flex min-w-0 items-center gap-2"><span class="line-clamp-2 min-w-0">${displayValue(item.empleado)}</span>${indicadorObservacionesHtml(item, index)}</div></td>`
    case 'legajo':
      return `<td class="${TD_CLASS}">${displayValue(item.legajo)}</td>`
    case 'fecha':
      return `<td class="${TD_CLASS}">${item.fecha ? formatFichadaFecha(item.fecha) : '—'}</td>`
    case 'horarioPrevisto':
      return `<td class="${TD_CLASS}">${displayValue(item.horarioPrevisto)}</td>`
    case 'ingreso':
      return `<td class="${TD_CLASS}">${displayValue(item.ingresoHora)}</td>`
    case 'egreso':
      return `<td class="${TD_CLASS}">${displayValue(item.egresoHora)}</td>`
    case 'intermedias': {
      const count = Number(item.fichadasIntermedias) || 0
      const badge = count
        ? `<span class="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-slate-100 px-1.5 py-0.5 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">${count}</span>`
        : '—'
      return `<td class="${TD_CLASS}">${badge}</td>`
    }
    case 'estado':
      return `<td class="min-w-[8.5rem] whitespace-nowrap px-4 py-3">${jornadaEstadoBadge(item.estado)}</td>`
    case 'detalle': {
      const observacionesCount = countObservacionesJornada(item)
      const observacionesLabel = describeObservacionesJornada(observacionesCount)
      const countBadge =
        observacionesCount > 0
          ? `<span
              class="inline-flex min-w-[1.15rem] items-center justify-center rounded-full bg-violet-600 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white dark:bg-violet-500"
              aria-label="${escapeHtml(`${observacionesLabel} en esta jornada`)}"
            >${observacionesCount}</span>`
          : ''
      const observacionesAria =
        observacionesCount > 0 ? `. ${observacionesLabel}` : ''
      return `<td class="px-4 py-3">
            <button
              type="button"
              data-action="ver-movimientos"
              data-index="${index}"
              class="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
              aria-label="Ver movimientos de ${escapeHtml(item.empleado ?? 'la jornada')} del ${escapeHtml(item.fecha ?? '')}${escapeHtml(observacionesAria)}"
            >
              ${iconEye()}
              <span>Ver movimientos</span>
              ${countBadge}
            </button>
          </td>`
    }
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

export function createJornadasTable(
  jornadas,
  {
    onVerMovimientos,
    visibleColumnIds = allColumnIds('jornadas'),
    placeholder,
    onPlaceholderAction,
  } = {},
) {
  const columns = visibleColumns('jornadas', visibleColumnIds)
  const colspan = columns.length
  const section = document.createElement('section')
  section.className = 'min-w-0'
  section.dataset.visibleColumns = columns.map((column) => column.id).join(',')
  section.dataset.colspan = String(colspan)

  const headers = columns
    .map((column) => {
      const label = headerLabel(column)
      return `<th scope="col" class="${TH_CLASS}" data-column="${column.id}" title="${escapeHtml(label)}">${escapeHtml(label)}</th>`
    })
    .join('')

  const rows =
    placeholder || jornadas.length === 0
      ? placeholderRow(
          colspan,
          placeholder ?? {
            title: 'Sin resultados',
            message: 'No hay jornadas para los filtros seleccionados.',
          },
        )
      : jornadas
          .map(
            (item, index) => `
        <tr class="transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/70">
          ${columns.map((column) => jornadaCellHtml(item, column.id, index)).join('')}
        </tr>
      `,
          )
          .join('')

  section.innerHTML = `
    <div class="${FICHADAS_BODY_CLASS}">
      <table class="min-w-[48rem] w-full divide-y divide-slate-200 dark:divide-slate-700">
        <thead class="sticky top-0 z-10 bg-slate-50 shadow-[0_1px_0_0_var(--color-slate-200)] dark:bg-slate-800 dark:shadow-[0_1px_0_0_var(--color-slate-700)]">
          <tr>${headers}</tr>
        </thead>
        <tbody class="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-900">
          ${rows}
        </tbody>
      </table>
    </div>
  `

  bindObservacionesJornada(section, jornadas)
  section.addEventListener('click', (event) => {
    const retry = event.target.closest('[data-action="table-placeholder"]')
    if (retry && section.contains(retry)) {
      onPlaceholderAction?.()
      return
    }
    const button = event.target.closest('[data-action="ver-movimientos"]')
    if (button && section.contains(button)) {
      const index = Number(button.dataset.index)
      const jornada = jornadas[index]
      if (jornada) onVerMovimientos?.(jornada)
    }
  })

  return section
}
