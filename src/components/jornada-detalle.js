import { displayMetodoLabel, displayValue, escapeHtml, formatDate } from '../utils/format.js'
import { describeDetalleLinea, INTERMEDIATE_MOVIMIENTO_TOOLTIP, TIPO_INFORMADO_TOOLTIP } from '../utils/movimientos.js'
import { badgeHtml, movementBadge } from './badge.js'
import { openModal } from './modal.js'
import { bindTooltipRoot } from './tooltip.js'

export function createJornadaDetalleContent(jornada) {
  const content = document.createElement('div')
  const movimientos = [...(jornada?.movimientos ?? [])].sort(
    (a, b) => new Date(a.fechaHora) - new Date(b.fechaHora),
  )

  const rows = movimientos
    .map((item) => {
      const observacion = item.esPosibleDuplicado
        ? badgeHtml(item.observacionLabel, 'yellow')
        : item.esMovimientoIntermedio
          ? badgeHtml('Movimiento intermedio', 'neutral', {
              tooltip: INTERMEDIATE_MOVIMIENTO_TOOLTIP,
              ariaLabel: 'Movimiento intermedio',
            })
          : item.observacionLabel
            ? badgeHtml(item.observacionLabel, 'neutral')
            : '<span class="text-xs text-slate-400">—</span>'
      return `
        <li class="border-b border-slate-100 py-3 last:border-0 dark:border-slate-800">
          <p class="text-sm font-medium text-slate-900 dark:text-slate-100">${escapeHtml(describeDetalleLinea(item))}</p>
          <div class="mt-2 flex flex-wrap items-center gap-2">
            ${movementBadge(item.tipo, {
              tooltip: TIPO_INFORMADO_TOOLTIP,
              ariaLabel: TIPO_INFORMADO_TOOLTIP,
            })}
            ${badgeHtml(displayMetodoLabel(item.metodo) || '—', 'neutral')}
            ${observacion}
          </div>
        </li>
      `
    })
    .join('')

  content.innerHTML = `
    <p class="text-sm text-slate-600 dark:text-slate-300">
      ${displayValue(jornada?.empleado)} · Legajo ${displayValue(jornada?.legajo)} ·
      ${jornada?.fecha ? formatDate(new Date(`${jornada.fecha}T12:00:00`)) : '—'}
    </p>
    <p class="mt-2 text-xs text-slate-500 dark:text-slate-400">
      Consulta de solo lectura. Se muestran las marcaciones originales, incluidas posibles inconsistencias.
    </p>
    <ol class="mt-4">${rows || '<li class="text-sm text-slate-500">No hay movimientos para esta jornada.</li>'}</ol>
  `

  bindTooltipRoot(content)

  return content
}

export function openJornadaDetalle(jornada) {
  return openModal({
    title: 'Movimientos de la jornada',
    labelledBy: 'jornada-detalle-title',
    content: createJornadaDetalleContent(jornada),
    unsavedChanges: false,
  })
}
