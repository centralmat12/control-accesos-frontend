import { displayMetodoLabel, displayTipoLabel, displayValue, escapeHtml, formatDate } from '../utils/format.js'
import { hasObservacionHumana } from '../utils/fichada-observacion.js'
import { describeDetalleLinea, INTERMEDIATE_MOVIMIENTO_TOOLTIP, TIPO_INFORMADO_TOOLTIP } from '../utils/movimientos.js'
import { badgeHtml, movementBadge } from './badge.js'
import { observacionHumanaBadgeButton } from './observacion-badge.js'
import { openModal } from './modal.js'
import { bindTooltipRoot } from './tooltip.js'

function automaticAlertBadge(item) {
  if (item.esPosibleDuplicado) {
    return badgeHtml(item.observacionLabel, 'yellow')
  }
  if (item.esMovimientoIntermedio) {
    return badgeHtml('Movimiento intermedio', 'neutral', {
      tooltip: INTERMEDIATE_MOVIMIENTO_TOOLTIP,
      ariaLabel: 'Movimiento intermedio',
    })
  }
  if (item.observacionLabel) {
    return badgeHtml(item.observacionLabel, 'neutral')
  }
  return ''
}

function observacionPanelId(index) {
  return `jornada-observacion-detalle-${index}`
}

export function createJornadaDetalleContent(jornada, { canEditObservacion = false, onEditObservacion } = {}) {
  const content = document.createElement('div')
  const movimientos = [...(jornada?.movimientos ?? [])].sort(
    (a, b) => new Date(a.fechaHora) - new Date(b.fechaHora),
  )

  const rows = movimientos
    .map((item, index) => {
      const panelId = observacionPanelId(index)
      const auto = automaticAlertBadge(item)
      const humana = hasObservacionHumana(item)
        ? observacionHumanaBadgeButton({
            item,
            canEdit: canEditObservacion,
            action: 'toggle-observacion',
            layout: 'modal',
            expanded: false,
            controlsId: panelId,
          })
        : ''
      const detalle = hasObservacionHumana(item)
        ? `<div id="${panelId}" class="mt-2 hidden rounded-lg border border-violet-200 bg-violet-50/80 px-3 py-2 dark:border-violet-500/30 dark:bg-violet-950/40" data-observacion-panel="true" hidden>
            <p class="text-sm text-slate-700 dark:text-slate-200" data-observacion-detalle></p>
            ${
              canEditObservacion && onEditObservacion
                ? `<button
                    type="button"
                    data-action="editar-observacion"
                    data-id="${escapeHtml(String(item.id ?? ''))}"
                    class="mt-2 inline-flex items-center rounded-md bg-violet-600 px-2 py-1 text-xs font-semibold text-white hover:bg-violet-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:bg-violet-500 dark:hover:bg-violet-400"
                  >Editar</button>`
                : ''
            }
          </div>`
        : ''

      return `
        <li class="border-b border-slate-100 py-3 last:border-0 dark:border-slate-800" data-movimiento-id="${escapeHtml(String(item.id ?? ''))}">
          <p class="text-sm font-medium text-slate-900 dark:text-slate-100">${escapeHtml(describeDetalleLinea(item))}</p>
          <div class="mt-2 flex flex-wrap items-center gap-2 lg:flex-nowrap">
            ${movementBadge(item.movimientoVisual ?? item.tipo, {
              tooltip:
                displayTipoLabel(item.movimientoInformado ?? item.tipo) &&
                displayTipoLabel(item.movimientoInformado ?? item.tipo) !== displayTipoLabel(item.movimientoVisual ?? item.tipo)
                  ? `Informado originalmente: ${displayTipoLabel(item.movimientoInformado ?? item.tipo)}`
                  : TIPO_INFORMADO_TOOLTIP,
              ariaLabel: 'Clasificación de la jornada',
            })}
            ${badgeHtml(displayMetodoLabel(item.metodo) || '—', 'neutral')}
            ${auto}
            ${humana}
          </div>
          ${detalle}
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

  movimientos.forEach((item, index) => {
    if (!hasObservacionHumana(item)) return
    const panel = content.querySelector(`#${observacionPanelId(index)}`)
    const detail = panel?.querySelector('[data-observacion-detalle]')
    if (detail) detail.textContent = String(item.observacionHumana.detalle ?? '')
  })

  function collapseAll() {
    content.querySelectorAll('[data-action="toggle-observacion"]').forEach((button) => {
      button.setAttribute('aria-expanded', 'false')
    })
    content.querySelectorAll('[data-observacion-panel]').forEach((panel) => {
      panel.hidden = true
      panel.classList.add('hidden')
    })
  }

  content.addEventListener('click', (event) => {
    const edit = event.target.closest('[data-action="editar-observacion"]')
    if (edit && content.contains(edit)) {
      const id = String(edit.dataset.id ?? '')
      const fichada = movimientos.find((item) => String(item?.id) === id)
      if (fichada) onEditObservacion?.(fichada)
      return
    }

    const toggle = event.target.closest('[data-action="toggle-observacion"]')
    if (!toggle || !content.contains(toggle)) return
    const expanded = toggle.getAttribute('aria-expanded') === 'true'
    const panel = content.querySelector(`#${toggle.getAttribute('aria-controls')}`)
    collapseAll()
    if (!expanded && panel) {
      toggle.setAttribute('aria-expanded', 'true')
      panel.hidden = false
      panel.classList.remove('hidden')
    }
  })

  bindTooltipRoot(content)

  return content
}

export function openJornadaDetalle(jornada, options = {}) {
  return openModal({
    title: 'Movimientos de la jornada',
    labelledBy: 'jornada-detalle-title',
    dialogClass: 'max-w-2xl',
    content: createJornadaDetalleContent(jornada, options),
    unsavedChanges: false,
  })
}
