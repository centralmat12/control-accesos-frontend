import { escapeHtml } from '../utils/format.js'

export function createFeedbackState({ title, message, tone = 'neutral', actionLabel, onAction }) {
  const tones = {
    neutral: 'border-slate-200 bg-white text-slate-900',
    error: 'border-red-200 bg-red-50 text-red-900',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  }

  const wrapper = document.createElement('div')
  wrapper.className = `rounded-xl border px-6 py-10 text-center shadow-sm ${tones[tone] ?? tones.neutral}`

  wrapper.innerHTML = `
    <h2 class="text-base font-semibold">${escapeHtml(title)}</h2>
    <p class="mt-2 text-sm ${tone === 'error' ? 'text-red-700' : tone === 'success' ? 'text-emerald-800' : 'text-slate-500'}">${escapeHtml(message)}</p>
    ${
      actionLabel
        ? `<button type="button" class="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500">
            ${escapeHtml(actionLabel)}
          </button>`
        : ''
    }
  `

  if (actionLabel && onAction) {
    wrapper.querySelector('button')?.addEventListener('click', onAction)
  }

  return wrapper
}

export function createLoadingState(message = 'Cargando empleados...') {
  const wrapper = document.createElement('div')
  wrapper.className =
    'flex items-center justify-center rounded-xl border border-slate-200 bg-white px-6 py-16 text-sm text-slate-500 shadow-sm'
  wrapper.textContent = message
  return wrapper
}
