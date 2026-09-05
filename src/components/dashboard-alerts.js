import { escapeHtml } from '../utils/format.js'
import { empleadoAlertLabel, empleadoSearchHint } from '../utils/empleado-alerts.js'
import { iconAlertTriangle } from './icons.js'

/**
 * La huella solo se muestra pendiente cuando `tieneHuella` es false.
 * El estado de agente/lector no se infiere a partir de fichadas.
 */
export function createDashboardAlerts(alertas, { onOpenEmpleados } = {}) {
  if (!alertas?.items?.length) return null

  const pendingCount = alertas.count ?? alertas.items.length
  const section = document.createElement('section')
  section.className =
    'rounded-xl border border-amber-300 bg-amber-50/80 p-5 shadow-sm shadow-amber-950/5 dark:border-amber-700/70 dark:bg-amber-950/30 dark:shadow-black/20'

  const heading = document.createElement('div')
  heading.className = 'mb-4'
  heading.innerHTML = `
    <div class="flex items-start gap-3">
      <span class="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-800 ring-1 ring-inset ring-amber-600/20 dark:bg-amber-900/60 dark:text-amber-200 dark:ring-amber-400/20">
        ${iconAlertTriangle()}
      </span>
      <div class="min-w-0">
        <h2 class="text-base font-semibold text-amber-950 dark:text-amber-100">Alertas y pendientes</h2>
        <p class="mt-1 text-sm font-medium text-amber-900/80 dark:text-amber-200/80">${pendingCount} ${pendingCount === 1 ? 'empleado requiere' : 'empleados requieren'} atención</p>
      </div>
    </div>
  `
  section.append(heading)

  const list = document.createElement('ul')
  list.className = 'max-h-80 space-y-2 overflow-y-auto pr-1'

  alertas.items.forEach((item, index) => {
    const li = document.createElement('li')
    li.innerHTML = `
      <button
        type="button"
        data-alert-index="${index}"
        class="w-full rounded-lg border border-amber-200 bg-white/60 px-3 py-2.5 text-left transition-colors hover:border-amber-300 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 dark:border-amber-800/70 dark:bg-slate-950/30 dark:hover:border-amber-700 dark:hover:bg-slate-900"
      >
        <span class="block text-sm font-semibold text-amber-950 dark:text-amber-100">${escapeHtml(empleadoAlertLabel(item.empleado))}</span>
        <span class="mt-1 block text-xs leading-5 text-amber-900/80 dark:text-amber-200/80">
          Falta: ${escapeHtml(item.missing.map(({ label }) => label).join(', '))}
        </span>
      </button>
    `

    li.querySelector('[data-alert-index]')?.addEventListener('click', () => {
      onOpenEmpleados?.(empleadoSearchHint(item.empleado) || undefined)
    })
    list.append(li)
  })

  section.append(list)

  const go = document.createElement('button')
  go.type = 'button'
  go.className =
    'mt-4 text-sm font-semibold text-amber-900 underline-offset-2 hover:underline dark:text-amber-200'
  go.textContent = 'Ir a Empleados'
  go.addEventListener('click', () => onOpenEmpleados?.())
  section.append(go)

  return section
}
