import { displayTipoLabel, esTipoEntrada, escapeHtml } from '../utils/format.js'

const TONES = {
  success:
    'bg-emerald-50 text-emerald-700 ring-emerald-600/10 dark:bg-emerald-950/60 dark:text-emerald-300 dark:ring-emerald-400/20',
  warning:
    'bg-amber-50 text-amber-700 ring-amber-600/10 dark:bg-amber-950/60 dark:text-amber-300 dark:ring-amber-400/20',
  danger:
    'bg-red-50 text-red-700 ring-red-600/10 dark:bg-red-950/60 dark:text-red-300 dark:ring-red-400/20',
  neutral:
    'bg-slate-100 text-slate-700 ring-slate-500/10 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-400/20',
  info:
    'bg-indigo-50 text-indigo-700 ring-indigo-600/10 dark:bg-indigo-950/60 dark:text-indigo-300 dark:ring-indigo-400/20',
}

export const FEATURE_STATUS = {
  api: { label: 'Requiere integración API', tone: 'warning' },
  ui: { label: 'Interfaz pendiente', tone: 'info' },
  soon: { label: 'Próximamente', tone: 'neutral' },
}

export function badgeHtml(label, tone = 'neutral') {
  return `<span class="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${TONES[tone] ?? TONES.neutral}">${escapeHtml(label)}</span>`
}

export function featureStatusBadge(kind) {
  const status = FEATURE_STATUS[kind] ?? FEATURE_STATUS.soon
  return badgeHtml(status.label, status.tone)
}

export function employeeStatusBadge(active) {
  return badgeHtml(active ? 'Activo' : 'Inactivo', active ? 'success' : 'danger')
}

export function movementBadge(tipo) {
  return badgeHtml(displayTipoLabel(tipo), esTipoEntrada(tipo) ? 'success' : 'warning')
}

/**
 * Estado biométrico a partir del campo opcional `tieneHuella`.
 * undefined/null = dato no disponible en la API web (no se infiere).
 */
export function biometricStatusBadge(tieneHuella) {
  if (tieneHuella === true) return badgeHtml('Huella biométrica enrolada', 'success')
  if (tieneHuella === false) return badgeHtml('Huella biométrica no enrolada', 'warning')

  return `${badgeHtml('Estado no disponible', 'neutral')} ${featureStatusBadge('api')}`
}
