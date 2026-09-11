import { escapeHtml } from '../utils/format.js'
import { iconAgent, iconClock, iconDevice, iconStatusOff, iconStatusOk, iconStatusUnknown, iconStatusWarn } from './icons.js'
import { bindTooltipRoot, tooltipTriggerAttributes } from './tooltip.js'

const TONES = {
  success: {
    wrap: 'bg-emerald-50 text-emerald-800 ring-emerald-600/15 dark:bg-emerald-950/50 dark:text-emerald-200 dark:ring-emerald-400/20',
    icon: iconStatusOk,
  },
  warning: {
    wrap: 'bg-amber-50 text-amber-800 ring-amber-600/20 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-400/25',
    icon: iconStatusWarn,
  },
  danger: {
    wrap: 'bg-red-50 text-red-800 ring-red-600/15 dark:bg-red-950/40 dark:text-red-200 dark:ring-red-400/20',
    icon: iconStatusOff,
  },
  error: {
    wrap: 'bg-red-50 text-red-800 ring-red-600/15 dark:bg-red-950/40 dark:text-red-200 dark:ring-red-400/20',
    icon: iconStatusOff,
  },
  neutral: {
    wrap: 'bg-slate-100 text-slate-700 ring-slate-500/10 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-400/20',
    icon: iconStatusUnknown,
  },
}

function statusBadge({ tone, label, detail, id }) {
  const visual = TONES[tone] ?? TONES.neutral
  const tooltip = detail || label
  return `
    <span
      ${tooltipTriggerAttributes(tooltip, id)}
      class="inline-flex max-w-full cursor-help items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${visual.wrap}"
      aria-label="${escapeHtml(label)}"
    >
      <span class="shrink-0" aria-hidden="true">${visual.icon()}</span>
      <span class="truncate">${escapeHtml(label)}</span>
    </span>
  `
}

function rowMarkup({ icon, label, status, badgeId }) {
  return `
    <li class="flex items-center justify-between gap-3 py-1.5">
      <p class="flex min-w-0 items-center gap-2 text-sm font-medium text-slate-800 dark:text-slate-200">
        <span class="text-slate-500 dark:text-slate-400" aria-hidden="true">${icon}</span>
        ${escapeHtml(label)}
      </p>
      <div class="shrink-0">
        ${statusBadge({ ...status, id: badgeId })}
      </div>
    </li>
  `
}

export function apiConsultaStatus({ ok = false, errorMessage = '' } = {}) {
  if (ok) {
    return {
      tone: 'success',
      label: 'Operativa',
      detail: 'La consulta del panel respondió correctamente.',
    }
  }

  if (errorMessage) {
    return {
      tone: 'error',
      label: 'Error',
      detail: errorMessage,
    }
  }

  return {
    tone: 'neutral',
    label: 'Sin información',
    detail: 'Todavía no se consultó la API.',
  }
}

export function datosCargaStatus({ lastSuccessAt = null, clockLabel = '' } = {}) {
  if (!lastSuccessAt) {
    return {
      tone: 'neutral',
      label: 'Sin información',
      detail: 'Todavía no hay una carga correcta.',
    }
  }

  return {
    tone: 'success',
    label: 'Datos actualizados',
    detail: clockLabel ? `Última carga correcta: ${clockLabel}` : 'Datos actualizados.',
  }
}

export function agenteSinPermisoStatus() {
  return {
    tone: 'neutral',
    label: 'Estado no disponible para este rol',
    detail: 'El rol actual no puede consultar agentes.',
    items: [],
  }
}

export function createSystemStatusCard({
  api,
  datos,
  agente,
} = {}) {
  const card = document.createElement('section')
  card.className =
    'rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-4'
  card.setAttribute('aria-labelledby', 'dashboard-system-title')

  card.innerHTML = `
    <h2 id="dashboard-system-title" class="text-base font-semibold text-slate-900 dark:text-slate-100">Estado del sistema</h2>
    <ul class="mt-2 divide-y divide-slate-100 dark:divide-slate-800">
      ${rowMarkup({
        icon: iconDevice(),
        label: 'API',
        badgeId: 'system-status-api',
        status: api ?? { tone: 'neutral', label: 'Sin información', detail: 'Todavía no se consultó la API.' },
      })}
      ${rowMarkup({
        icon: iconClock(),
        label: 'Datos',
        badgeId: 'system-status-datos',
        status: datos ?? { tone: 'neutral', label: 'Sin información', detail: 'Todavía no hay una carga correcta.' },
      })}
      ${rowMarkup({
        icon: iconAgent(),
        label: 'Lector o agente',
        badgeId: 'system-status-agente',
        status: agente ?? { tone: 'neutral', label: 'Sin información', detail: 'No hay un último contacto disponible.' },
      })}
    </ul>
    <p class="mt-2 text-xs text-slate-500 dark:text-slate-400">Estados correspondientes a la aplicación instalada en Sede Central.</p>
  `

  bindTooltipRoot(card)
  return card
}
