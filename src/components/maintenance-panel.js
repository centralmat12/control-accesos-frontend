import { iconClock } from './icons.js'
import { BTN_SECONDARY_CLASS } from './button-styles.js'

export const MAINTENANCE_TITLE = 'Funcionalidad aún en mantenimiento'
export const MAINTENANCE_MESSAGE = 'Esta sección se habilitará automáticamente cuando la API esté disponible.'

export function createMaintenancePanel({ onRetry = null, compact = false } = {}) {
  const section = document.createElement('section')
  section.className = compact
    ? 'rounded-xl border border-slate-200 bg-white px-4 py-6 text-slate-900 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100'
    : 'rounded-xl border border-slate-200 bg-white px-6 py-10 text-center text-slate-900 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100'
  section.setAttribute('role', 'status')
  section.innerHTML = `
    <div class="${compact ? 'flex items-start gap-3 text-left' : ''}">
      <span class="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300 ${compact ? 'mx-0 shrink-0' : ''}" aria-hidden="true">${iconClock()}</span>
      <div class="${compact ? '' : 'mt-3'}">
        <h2 class="text-base font-semibold">${MAINTENANCE_TITLE}</h2>
        <p class="mt-2 text-sm text-slate-500 dark:text-slate-400">${MAINTENANCE_MESSAGE}</p>
        ${
          onRetry
            ? `<button type="button" data-action="retry" class="${BTN_SECONDARY_CLASS} mt-4">${compact ? 'Reintentar' : 'Reintentar'}</button>`
            : ''
        }
      </div>
    </div>
  `
  section.querySelector('[data-action="retry"]')?.addEventListener('click', () => onRetry?.())
  return section
}

export function createRestrictedPanel(message = 'No tenés permiso para usar esta sección.') {
  const section = document.createElement('section')
  section.className = 'rounded-xl border border-slate-200 bg-white px-6 py-8 text-center shadow-sm dark:border-slate-700 dark:bg-slate-900'
  section.setAttribute('role', 'status')
  section.innerHTML = `
    <h2 class="text-base font-semibold text-slate-900 dark:text-slate-100">Acceso restringido</h2>
    <p class="mt-2 text-sm text-slate-500 dark:text-slate-400">${message}</p>
  `
  return section
}

export function createRetryPanel({ title, message, onRetry }) {
  const section = document.createElement('section')
  section.className = 'rounded-xl border border-slate-200 bg-white px-6 py-8 text-center shadow-sm dark:border-slate-700 dark:bg-slate-900'
  section.setAttribute('role', 'alert')
  section.innerHTML = `
    <h2 class="text-base font-semibold text-slate-900 dark:text-slate-100"></h2>
    <p class="mt-2 text-sm text-slate-500 dark:text-slate-400"></p>
    <button type="button" class="${BTN_SECONDARY_CLASS} mt-4">Reintentar</button>
  `
  section.querySelector('h2').textContent = title
  section.querySelector('p').textContent = message
  section.querySelector('button').addEventListener('click', () => onRetry?.())
  return section
}

export function panelForCapability(result, { onRetry, restrictedMessage } = {}) {
  if (!result || result.status === 'unknown') {
    return createRetryPanel({
      title: 'No se pudo consultar el servicio',
      message: 'Volvé a intentar cuando la consulta pueda completarse.',
      onRetry,
    })
  }
  if (result.status === 'unavailable') return createMaintenancePanel({ onRetry })
  if (result.status === 'forbidden') return createRestrictedPanel(restrictedMessage)
  if (result.status === 'unauthorized') return createRestrictedPanel('La sesión no es válida. Volvé a iniciar sesión.')
  if (result.reason === 'network') {
    return createRetryPanel({
      title: 'No se pudo consultar el servicio',
      message: 'No hubo respuesta del servidor. Revisá la conexión e intentá de nuevo.',
      onRetry,
    })
  }
  return createRetryPanel({
    title: 'El servicio no está disponible en este momento',
    message: 'La consulta no pudo completarse. Podés reintentar sin perder el resto de la pantalla.',
    onRetry,
  })
}
