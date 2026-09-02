import { escapeHtml } from '../utils/format.js'
import { empleadoAlertLabel, empleadoSearchHint } from '../utils/empleado-alerts.js'

/**
 * Huella y estado de agente/lector no se muestran: la API no publica
 * `tieneHuella` ni heartbeat de agente/lector. No inferir con fichadas.
 */
export function createDashboardAlerts(alertas, { onOpenEmpleados } = {}) {
  const section = document.createElement('section')
  section.className = 'rounded-xl border border-slate-200 bg-white p-5 shadow-sm'

  const heading = document.createElement('div')
  heading.className = 'mb-4'
  heading.innerHTML = `
    <h2 class="text-base font-semibold text-slate-900">Alertas y pendientes</h2>
    <p class="mt-1 text-sm text-slate-500">Inconsistencias de datos obligatorios y datos operativos recomendados, según el listado de empleados activos.</p>
  `
  section.append(heading)

  if (!alertas.items.length) {
    const empty = document.createElement('p')
    empty.className = 'text-sm text-slate-600'
    empty.textContent = 'No hay pendientes operativos.'
    section.append(empty)
    return section
  }

  const list = document.createElement('ul')
  list.className = 'space-y-2'

  alertas.items.forEach((item) => {
    const isError = item.kind === 'inconsistency'
    const li = document.createElement('li')
    li.className = `rounded-lg border px-3 py-2 ${
      isError ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50'
    }`

    const toggle = document.createElement('button')
    toggle.type = 'button'
    toggle.className = `flex w-full items-start gap-2 text-left text-sm font-medium ${
      isError ? 'text-red-900' : 'text-amber-950'
    }`
    toggle.setAttribute('aria-expanded', 'false')
    toggle.innerHTML = `
      <span class="mt-0.5 w-4 shrink-0 text-center" aria-hidden="true">${isError ? '❗' : '⚠'}</span>
      <span>${escapeHtml(item.text)}</span>
    `

    const details = document.createElement('div')
    details.className = 'mt-2 hidden border-t border-black/10 pt-2'
    details.innerHTML = `
      <ul class="space-y-1">
        ${item.employees
          .map((empleado, index) => {
            const hint = empleadoSearchHint(empleado)
            return `
              <li>
                <button
                  type="button"
                  data-alert-index="${index}"
                  class="text-sm font-medium underline-offset-2 hover:underline ${
                    isError ? 'text-red-800' : 'text-amber-950'
                  }"
                >
                  ${escapeHtml(empleadoAlertLabel(empleado))}
                </button>
              </li>
            `
          })
          .join('')}
      </ul>
    `

    details.querySelectorAll('[data-alert-index]').forEach((button) => {
      button.addEventListener('click', (event) => {
        event.stopPropagation()
        const empleado = item.employees[Number(button.getAttribute('data-alert-index'))]
        onOpenEmpleados?.(empleadoSearchHint(empleado) || undefined)
      })
    })

    toggle.addEventListener('click', () => {
      const open = details.classList.toggle('hidden') === false
      toggle.setAttribute('aria-expanded', String(open))
    })

    li.append(toggle, details)
    list.append(li)
  })

  section.append(list)

  const go = document.createElement('button')
  go.type = 'button'
  go.className =
    'mt-4 text-sm font-medium text-blue-700 hover:text-blue-600'
  go.textContent = 'Ir a Empleados'
  go.addEventListener('click', () => onOpenEmpleados?.())
  section.append(go)

  return section
}
