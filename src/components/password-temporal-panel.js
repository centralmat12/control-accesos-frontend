import { discardPasswordTemporal } from '../api/usuarios.js'
import { escapeHtml, formatApiDateTime } from '../utils/format.js'
import { bindPasswordVisibilityToggle } from './form-field.js'
import { iconEye } from './icons.js'
import { showToast } from './toast.js'
import { BTN_SECONDARY_CLASS } from './button-styles.js'

const ONCE_WARNING =
  'Esta contraseña temporal se muestra una sola vez. Copiala ahora y entregala a la persona. No queda guardada en el panel. Si cerrás sin copiarla, no podrá volver a visualizarse.'

export const PASSWORD_TEMPORAL_COPIED = 'Contraseña temporal copiada.'
export const PASSWORD_TEMPORAL_ACK_LABEL = 'Ya guardé la contraseña'
export const PASSWORD_TEMPORAL_MODAL = Object.freeze({
  closeOnBackdrop: false,
  closeOnEscape: true,
  hideCloseButton: false,
  unsavedChanges: true,
})
export const PASSWORD_TEMPORAL_DISCARD_PROMPT = Object.freeze({
  title: '¿Cerrar sin guardar la contraseña?',
  message:
    'Esta contraseña temporal no podrá volver a visualizarse. Si no la copiaste, deberás restablecerla de nuevo.',
  continueLabel: 'Seguir viendo',
  discardLabel: 'Cerrar de todos modos',
})

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

export function createPasswordTemporalPanel({
  nombreUsuario,
  passwordTemporal,
  venceEn,
  onClose,
} = {}) {
  const wrapper = document.createElement('div')
  const secret = {
    passwordTemporal: String(passwordTemporal ?? ''),
  }
  const vencimiento = formatApiDateTime(venceEn)

  wrapper.innerHTML = `
    <div class="space-y-4">
      <p class="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-100" role="status">
        ${escapeHtml(ONCE_WARNING)}
      </p>
      <div>
        <p class="mb-1.5 text-sm font-medium text-slate-700 dark:text-slate-200">Usuario</p>
        <p data-password-temporal-user class="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"></p>
      </div>
      <div>
        <p class="mb-1.5 text-sm font-medium text-slate-700 dark:text-slate-200" id="password-temporal-label">Contraseña temporal</p>
        <div class="relative">
          <input
            id="password-temporal-once"
            type="password"
            readonly
            autocomplete="off"
            spellcheck="false"
            aria-labelledby="password-temporal-label"
            class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 pr-11 text-sm text-slate-900 outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
          />
          <button
            type="button"
            data-password-toggle
            class="absolute inset-y-0 right-0 flex items-center rounded-r-lg px-2.5 text-slate-500 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:hover:text-slate-200"
            aria-label="Mostrar contraseña temporal"
            aria-pressed="false"
          ></button>
        </div>
      </div>
      ${
        vencimiento
          ? `<p class="text-sm text-slate-600 dark:text-slate-300">Vence el <span data-password-temporal-vence></span>.</p>`
          : ''
      }
      <div class="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 dark:border-slate-800 sm:flex-row sm:justify-end">
        <button type="button" data-action="copy" class="${BTN_SECONDARY_CLASS}">
          Copiar contraseña temporal
        </button>
        <button type="button" data-action="ack" class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500">
          ${escapeHtml(PASSWORD_TEMPORAL_ACK_LABEL)}
        </button>
      </div>
    </div>
  `

  const userEl = wrapper.querySelector('[data-password-temporal-user]')
  const secretInput = wrapper.querySelector('#password-temporal-once')
  const venceEl = wrapper.querySelector('[data-password-temporal-vence]')
  const toggle = wrapper.querySelector('[data-password-toggle]')
  const copyButton = wrapper.querySelector('[data-action="copy"]')
  const ackButton = wrapper.querySelector('[data-action="ack"]')

  userEl.textContent = String(nombreUsuario ?? '').trim() || 'Usuario'
  secretInput.value = secret.passwordTemporal
  if (venceEl) venceEl.textContent = vencimiento
  toggle.innerHTML = iconEye()
  bindPasswordVisibilityToggle(secretInput, toggle)

  copyButton.addEventListener('click', async () => {
    try {
      await copyPlainText(secret.passwordTemporal)
      showToast({ message: PASSWORD_TEMPORAL_COPIED, tone: 'success' })
    } catch {
      showToast({ message: 'No se pudo copiar la contraseña temporal.', tone: 'error' })
    }
  })

  function discard() {
    discardPasswordTemporal(secret)
    if (secretInput) secretInput.value = ''
  }

  function hasVisibleSecret() {
    return Boolean(secret.passwordTemporal)
  }

  ackButton.addEventListener('click', () => {
    discard()
    onClose?.()
  })

  return { element: wrapper, discard, hasVisibleSecret }
}
