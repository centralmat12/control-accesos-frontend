import {
  AGENTE_CLIENT_ID_MAX,
  AGENTE_NOMBRE_MAX,
  AGENTE_SECRET_ACK_LABEL,
  AGENTE_SECRET_COPIED,
  AGENTE_SECRET_ONCE_WARNING,
  discardAgenteSecret,
} from '../api/agentes.js'
import { escapeHtml } from '../utils/format.js'
import { bindPasswordVisibilityToggle } from './form-field.js'
import { iconEye } from './icons.js'
import { showToast } from './toast.js'

async function copyPlainText(value) {
  const text = String(value ?? '')
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }

  const input = document.createElement('textarea')
  input.value = text
  input.setAttribute('readonly', 'true')
  input.style.position = 'fixed'
  input.style.left = '-9999px'
  document.body.append(input)
  input.select()
  document.execCommand('copy')
  input.remove()
}

export function createAgenteSecretPanel({ clientId, clientSecret, onClose }) {
  const wrapper = document.createElement('div')
  const credentials = {
    clientId: String(clientId ?? '').trim(),
    clientSecret: String(clientSecret ?? ''),
  }

  wrapper.innerHTML = `
    <div class="space-y-4">
      <p class="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900" role="status">
        ${escapeHtml(AGENTE_SECRET_ONCE_WARNING)}
      </p>
      <div>
        <p class="mb-1.5 text-sm font-medium text-slate-700">Client ID</p>
        <p data-agente-client-id class="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900"></p>
      </div>
      <div>
        <p class="mb-1.5 text-sm font-medium text-slate-700" id="agente-secret-label">Client secret</p>
        <div class="relative">
          <input
            id="agente-secret-once"
            type="password"
            readonly
            autocomplete="off"
            spellcheck="false"
            aria-labelledby="agente-secret-label"
            class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 pr-11 text-sm text-slate-900 outline-none"
          />
          <button
            type="button"
            data-password-toggle
            class="absolute inset-y-0 right-0 flex items-center rounded-r-lg px-2.5 text-slate-500 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            aria-label="Mostrar secreto"
            aria-pressed="false"
          ></button>
        </div>
      </div>
      <div class="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
        <button type="button" data-action="copy" class="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
          Copiar secreto
        </button>
        <button type="button" data-action="ack" class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500">
          ${escapeHtml(AGENTE_SECRET_ACK_LABEL)}
        </button>
      </div>
    </div>
  `

  const clientIdEl = wrapper.querySelector('[data-agente-client-id]')
  const secretInput = wrapper.querySelector('#agente-secret-once')
  const toggle = wrapper.querySelector('[data-password-toggle]')
  const copyButton = wrapper.querySelector('[data-action="copy"]')
  const ackButton = wrapper.querySelector('[data-action="ack"]')

  clientIdEl.textContent = credentials.clientId
  secretInput.value = credentials.clientSecret
  toggle.innerHTML = iconEye()
  bindPasswordVisibilityToggle(secretInput, toggle)

  copyButton.addEventListener('click', async () => {
    try {
      await copyPlainText(credentials.clientSecret)
      showToast({ message: AGENTE_SECRET_COPIED, tone: 'success' })
    } catch {
      showToast({ message: 'No se pudo copiar el secreto.', tone: 'error' })
    }
  })

  function discard() {
    discardAgenteSecret(credentials)
    if (secretInput) secretInput.value = ''
  }

  ackButton.addEventListener('click', () => {
    discard()
    onClose?.()
  })

  return { element: wrapper, discard }
}
