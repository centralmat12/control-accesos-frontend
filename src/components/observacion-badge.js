import { observacionEditAriaLabel, observacionMotivoLabel } from '../utils/fichada-observacion.js'
import { escapeHtml } from '../utils/format.js'
import { iconNote, iconPencil } from './icons.js'

export const OBSERVACION_BADGE_CLASS =
  'inline-flex max-w-[12.5rem] items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-800 ring-1 ring-inset ring-violet-600/20 transition-colors hover:bg-violet-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:bg-violet-950/70 dark:text-violet-200 dark:ring-violet-400/25 dark:hover:bg-violet-900/80'

export function observacionHumanaBadgeButton({
  item,
  canEdit = true,
  action,
  layout = 'table',
  expanded,
  controlsId,
} = {}) {
  const motivo = observacionMotivoLabel(item?.observacionHumana?.motivo)
  const aria = observacionEditAriaLabel(item, { canEdit })
  const expandedAttr = expanded == null ? '' : ` aria-expanded="${expanded ? 'true' : 'false'}"`
  const controlsAttr = controlsId ? ` aria-controls="${escapeHtml(controlsId)}"` : ''
  const icon =
    layout === 'modal'
      ? iconNote('h-3 w-3 shrink-0')
      : iconPencil('h-3 w-3 shrink-0')
  const iconFirst = layout === 'modal'

  return `<button
      type="button"
      data-action="${escapeHtml(action)}"
      data-id="${escapeHtml(String(item?.id ?? ''))}"
      class="${OBSERVACION_BADGE_CLASS}"
      data-tooltip="${escapeHtml(motivo)}"
      aria-label="${escapeHtml(aria)}"${expandedAttr}${controlsAttr}
    >${iconFirst ? `${icon}<span class="min-w-0 truncate whitespace-nowrap">${escapeHtml(motivo)}</span>` : `<span class="min-w-0 truncate whitespace-nowrap">${escapeHtml(motivo)}</span>${icon}`}</button>`
}
