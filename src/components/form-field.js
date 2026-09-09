import { escapeHtml } from '../utils/format.js'
import { iconEye, iconEyeOff } from './icons.js'

export const FORM_INPUT_CLASS =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-60'

export const FORM_INPUT_INVALID_CLASS = 'border-red-300'
export const FORM_LABEL_CLASS = 'mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300'
export const FORM_HELP_CLASS = 'mt-1 text-xs text-slate-500 dark:text-slate-400'
export const FORM_HELP_FOCUS_CLASS = 'text-slate-700 dark:text-slate-200'
export const FORM_ERROR_CLASS = 'mt-1 text-sm text-red-600 dark:text-red-300'

export function classTokens(classNames) {
  return String(classNames ?? '')
    .split(/\s+/)
    .filter(Boolean)
}

export function toggleClassTokens(element, classNames, force) {
  if (!element) return
  classTokens(classNames).forEach((token) => {
    element.classList.toggle(token, force)
  })
}

export const USUARIO_PASSWORD_MIN = 8
export const USUARIO_PASSWORD_MAX = 20

export const USUARIO_PASSWORD_RULES = Object.freeze([
  {
    id: 'length',
    label: 'Entre 8 y 20 caracteres.',
    test: (value) => value.length >= USUARIO_PASSWORD_MIN && value.length <= USUARIO_PASSWORD_MAX,
  },
  {
    id: 'letter',
    label: 'Al menos una letra.',
    test: (value) => /\p{L}/u.test(value),
  },
  {
    id: 'number',
    label: 'Al menos un número.',
    test: (value) => /\d/.test(value),
  },
  {
    id: 'special',
    label: 'Al menos un carácter especial.',
    test: (value) => /[^\p{L}\p{N}\s]/u.test(value),
  },
  {
    id: 'spaces',
    label: 'Sin espacios.',
    test: (value) => value.length > 0 && !/\s/.test(value),
  },
])

export function fieldIds(id) {
  return {
    helpId: `${id}-help`,
    errorId: `${id}-error`,
  }
}

export function requiredMarkHtml() {
  return '<span class="ml-0.5 font-semibold text-red-600" aria-hidden="true">*</span><span class="sr-only"> (obligatorio)</span>'
}

export function fieldDescribedBy(helpId, errorId, invalid) {
  return [helpId, invalid ? errorId : null].filter(Boolean).join(' ')
}

export function shouldRevealFieldError({ error, dirty, blurred, submitted }) {
  if (!error) return false
  if (submitted) return true
  return Boolean(dirty && blurred)
}

export function digitsOnly(value) {
  return String(value ?? '').replace(/\D/g, '')
}

export function isValidCuitChecksum(value) {
  const digits = digitsOnly(value)
  if (digits.length !== 11) return false

  const multipliers = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2]
  let sum = 0
  for (let index = 0; index < 10; index += 1) {
    sum += Number(digits[index]) * multipliers[index]
  }

  let check = 11 - (sum % 11)
  if (check === 11) check = 0
  if (check === 10) check = 9
  return check === Number(digits[10])
}

export function validateCuitValue(value) {
  const trimmed = String(value ?? '').trim()
  if (!trimmed) return 'Ingresá el CUIT.'
  if (digitsOnly(trimmed).length !== 11) return 'El CUIT debe contener 11 dígitos.'
  if (!isValidCuitChecksum(trimmed)) return 'El dígito verificador del CUIT no es válido.'
  return ''
}

export function validateRequiredText(value, emptyMessage, maxLength, maxMessage) {
  const text = String(value ?? '').trim()
  if (!text) return emptyMessage
  if (maxLength && text.length > maxLength) return maxMessage
  return ''
}

export function validateNameWithLetter(value, emptyMessage, letterMessage, maxLength, maxMessage) {
  const required = validateRequiredText(value, emptyMessage, maxLength, maxMessage)
  if (required) return required
  if (!/\p{L}/u.test(String(value ?? '').trim())) return letterMessage
  return ''
}

export function passwordRuleStates(password) {
  const value = String(password ?? '')
  return USUARIO_PASSWORD_RULES.map((rule) => ({
    id: rule.id,
    label: rule.label,
    met: rule.test(value),
  }))
}

export function validateUsuarioPasswordPolicy(password) {
  const value = String(password ?? '')
  if (!value) return 'Ingresá la contraseña inicial.'
  if (/\s/.test(value)) return 'La contraseña no puede contener espacios, tabulaciones ni saltos de línea.'
  if (value.length < USUARIO_PASSWORD_MIN || value.length > USUARIO_PASSWORD_MAX) {
    return `La contraseña debe tener entre ${USUARIO_PASSWORD_MIN} y ${USUARIO_PASSWORD_MAX} caracteres.`
  }
  if (!/\p{L}/u.test(value)) return 'La contraseña debe incluir al menos una letra.'
  if (!/\d/.test(value)) return 'La contraseña debe incluir al menos un número.'
  if (!/[^\p{L}\p{N}\s]/u.test(value)) return 'La contraseña debe incluir al menos un carácter especial.'
  return ''
}

export function pendingPasswordRules(password) {
  return passwordRuleStates(password).filter((rule) => !rule.met)
}

export function passwordMeetsAllRequirements(password) {
  return pendingPasswordRules(password).length === 0
}

export function passwordConfirmStatus(password, confirm) {
  const confirmValue = String(confirm ?? '')
  const passwordValue = String(password ?? '')
  if (!confirmValue) return 'help'
  if (confirmValue !== passwordValue) return 'mismatch'
  if (!passwordMeetsAllRequirements(passwordValue)) return 'pending'
  return 'match'
}

export function validatePasswordConfirm(password, confirm) {
  const value = String(confirm ?? '')
  if (!value) return 'Volvé a ingresar la contraseña.'
  if (value !== String(password ?? '')) return 'Las contraseñas no coinciden.'
  return ''
}

export function validateEmailValue(value, { emptyMessage = 'Ingresá el correo electrónico.', required = true } = {}) {
  const email = String(value ?? '').trim()
  if (!email) return required ? emptyMessage : ''
  if (email.length > 100) return 'El correo no puede superar 100 caracteres.'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Ingresá un correo electrónico válido.'
  return ''
}

export function formFieldMarkup({
  id,
  name,
  label,
  required = false,
  helpText = '',
  type = 'text',
  tag = 'input',
  maxLength,
  autocomplete,
  inputMode,
  extraInputClass = '',
  optionsHtml = '',
  disabled = false,
}) {
  const { helpId, errorId } = fieldIds(id)
  const describedBy = fieldDescribedBy(helpId, errorId, false)
  const requiredAttr = required ? 'required' : ''
  const disabledAttr = disabled ? 'disabled' : ''
  const maxAttr = maxLength ? `maxlength="${Number(maxLength)}"` : ''
  const autoAttr = autocomplete ? `autocomplete="${escapeHtml(autocomplete)}"` : ''
  const modeAttr = inputMode ? `inputmode="${escapeHtml(inputMode)}"` : ''
  const inputClass = `${FORM_INPUT_CLASS} ${extraInputClass}`.trim()

  const control =
    tag === 'select'
      ? `<select id="${escapeHtml(id)}" name="${escapeHtml(name)}" ${requiredAttr} ${disabledAttr} aria-describedby="${describedBy}" class="${inputClass}">${optionsHtml}</select>`
      : `<input id="${escapeHtml(id)}" name="${escapeHtml(name)}" type="${escapeHtml(type)}" ${maxAttr} ${autoAttr} ${modeAttr} ${requiredAttr} ${disabledAttr} aria-describedby="${describedBy}" class="${inputClass}" />`

  return `
    <div data-form-field="${escapeHtml(name)}">
      <label for="${escapeHtml(id)}" class="${FORM_LABEL_CLASS}">
        ${escapeHtml(label)}${required ? requiredMarkHtml() : ''}
      </label>
      ${control}
      ${helpText ? `<p id="${helpId}" class="${FORM_HELP_CLASS}">${escapeHtml(helpText)}</p>` : ''}
      <p id="${errorId}" class="${FORM_ERROR_CLASS} hidden" aria-live="polite"></p>
    </div>
  `
}

export function formStaticFieldMarkup({ id, label, valueHtml, helpText = '', required = false }) {
  const { helpId, errorId } = fieldIds(id)
  return `
    <div data-form-field="${escapeHtml(id)}">
      <p class="${FORM_LABEL_CLASS}" id="${escapeHtml(id)}-label">
        ${escapeHtml(label)}${required ? requiredMarkHtml() : ''}
      </p>
      <div class="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5" aria-labelledby="${escapeHtml(id)}-label" aria-describedby="${helpId}">
        <p id="${escapeHtml(id)}-value" class="text-sm font-medium text-slate-900">${valueHtml}</p>
      </div>
      <p id="${helpId}" class="${FORM_HELP_CLASS}">${escapeHtml(helpText)}</p>
      <p id="${errorId}" class="${FORM_ERROR_CLASS} hidden" aria-live="polite"></p>
    </div>
  `
}

export function formPasswordFieldMarkup({
  id,
  name,
  label,
  required = true,
  maxLength,
  autocomplete = 'new-password',
  helpText = '',
  describedBy = '',
}) {
  const { helpId, errorId } = fieldIds(id)
  const described = [describedBy, helpText ? helpId : '', errorId].filter(Boolean).join(' ')
  const maxAttr = maxLength ? `maxlength="${Number(maxLength)}"` : ''
  const inputClass = `${FORM_INPUT_CLASS} pr-11`

  return `
    <div data-form-field="${escapeHtml(name)}">
      <label for="${escapeHtml(id)}" class="${FORM_LABEL_CLASS}">
        ${escapeHtml(label)}${required ? requiredMarkHtml() : ''}
      </label>
      <div class="relative">
        <input
          id="${escapeHtml(id)}"
          name="${escapeHtml(name)}"
          type="password"
          ${maxAttr}
          autocomplete="${escapeHtml(autocomplete)}"
          ${required ? 'required' : ''}
          aria-describedby="${described}"
          class="${inputClass}"
        />
        <button
          type="button"
          data-password-toggle
          class="absolute inset-y-0 right-0 flex items-center rounded-r-lg px-2.5 text-slate-500 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          aria-label="Mostrar contraseña"
          aria-pressed="false"
        ></button>
      </div>
      ${helpText ? `<p id="${helpId}" class="${FORM_HELP_CLASS}">${escapeHtml(helpText)}</p>` : ''}
      <p id="${id}-success" class="mt-1 hidden text-sm font-medium text-emerald-700" role="status"></p>
      <p id="${errorId}" class="${FORM_ERROR_CLASS} hidden" aria-live="polite"></p>
    </div>
  `
}

export function passwordRequirementsMarkup(id) {
  const items = USUARIO_PASSWORD_RULES.map(
    (rule) => `
      <li data-rule="${escapeHtml(rule.id)}" class="mb-1 max-h-6 overflow-hidden text-xs text-slate-600 opacity-100 transition-[max-height,opacity,margin] duration-200 ease-out">
        <span class="flex items-start gap-2">
          <span aria-hidden="true">•</span>
          <span>${escapeHtml(rule.label)}</span>
        </span>
      </li>
    `,
  ).join('')

  return `
    <div id="${escapeHtml(id)}" class="mt-2">
      <ul data-password-rules class="m-0 list-none p-0" aria-live="off">
        ${items}
      </ul>
      <p data-password-complete class="hidden text-sm font-medium text-emerald-700" role="status">
        <span aria-hidden="true">✓ </span>La contraseña cumple todos los requisitos.
      </p>
    </div>
  `
}

export function syncPasswordRequirements(container, password) {
  if (!container) return
  const list = container.matches('ul') ? container : container.querySelector('[data-password-rules]')
  const success = container.querySelector?.('[data-password-complete]') ?? null
  const states = passwordRuleStates(password)
  const allMet = passwordMeetsAllRequirements(password)

  states.forEach((rule) => {
    const item = (list ?? container).querySelector(`[data-rule="${rule.id}"]`)
    if (!item) return
    item.classList.toggle('max-h-0', rule.met)
    item.classList.toggle('opacity-0', rule.met)
    item.classList.toggle('mb-0', rule.met)
    item.classList.toggle('max-h-6', !rule.met)
    item.classList.toggle('opacity-100', !rule.met)
    item.classList.toggle('mb-1', !rule.met)
    item.setAttribute('aria-hidden', String(rule.met))
  })

  if (list) list.classList.toggle('hidden', allMet)
  if (success) success.classList.toggle('hidden', !allMet)
}

export function applyPasswordConfirmPresentation({
  input,
  helpEl,
  errorEl,
  successEl,
  helpId,
  errorId,
  successId,
  status,
  submitted = false,
}) {
  const mismatch = status === 'mismatch' || (submitted && status === 'help')
  const showHelp = status === 'help' && !submitted
  const showSuccess = status === 'match'
  const described = [
    showHelp ? helpId : null,
    mismatch ? errorId : null,
    showSuccess ? successId : null,
  ]
    .filter(Boolean)
    .join(' ')

  if (input) {
    input.setAttribute('aria-describedby', described)
    if (mismatch) input.setAttribute('aria-invalid', 'true')
    else input.removeAttribute('aria-invalid')
    input.classList.toggle(FORM_INPUT_INVALID_CLASS, mismatch)
  }

  if (helpEl) helpEl.classList.toggle('hidden', !showHelp)
  if (errorEl) {
    const message = status === 'mismatch' ? 'Las contraseñas no coinciden.' : submitted && status === 'help' ? 'Volvé a ingresar la contraseña.' : ''
    if (errorEl.textContent !== message) errorEl.textContent = message
    errorEl.classList.toggle('hidden', !mismatch)
  }
  if (successEl) {
    successEl.innerHTML = showSuccess
      ? '<span aria-hidden="true">✓ </span>Las contraseñas coinciden.'
      : ''
    successEl.classList.toggle('hidden', !showSuccess)
  }
}

export function bindPasswordVisibilityToggle(input, button) {
  if (!input || !button) return

  function restoreCaret(start, end) {
    input.focus()
    try {
      if (typeof start === 'number' && typeof end === 'number') {
        input.setSelectionRange(start, end)
      }
    } catch {
      /* type=password puede ignorar la selección en algunos navegadores */
    }
  }

  function paint(visible, restoreFocus = true) {
    const start = input.selectionStart
    const end = input.selectionEnd
    input.type = visible ? 'text' : 'password'
    button.setAttribute('aria-pressed', String(visible))
    button.setAttribute('aria-label', visible ? 'Ocultar contraseña' : 'Mostrar contraseña')
    button.innerHTML = visible ? iconEyeOff() : iconEye()
    if (restoreFocus) restoreCaret(start, end)
  }

  button.addEventListener('mousedown', (event) => {
    event.preventDefault()
  })

  button.addEventListener('click', (event) => {
    event.preventDefault()
    paint(input.type === 'password')
  })

  paint(false, false)
}

function setControlInvalid(control, invalid) {
  if (!control || control.type === 'hidden') return
  control.classList.toggle(FORM_INPUT_INVALID_CLASS, invalid)
  if (invalid) control.setAttribute('aria-invalid', 'true')
  else control.removeAttribute('aria-invalid')
}

export function applyFieldPresentation({
  controls,
  helpEl,
  errorEl,
  helpId,
  errorId,
  extraDescribedBy = '',
  error,
  reveal,
  focused = false,
  silent = false,
}) {
  const invalid = Boolean(reveal && error)
  const describedBy = [extraDescribedBy, fieldDescribedBy(helpId, errorId, invalid && !silent)]
    .filter(Boolean)
    .join(' ')

  controls.forEach((control) => {
    if (!control) return
    setControlInvalid(control, invalid)
    if (control.type !== 'hidden' && describedBy) control.setAttribute('aria-describedby', describedBy)
  })

  if (helpEl) {
    helpEl.classList.toggle('hidden', invalid || !helpEl.textContent)
    toggleClassTokens(helpEl, FORM_HELP_FOCUS_CLASS, Boolean(focused) && !invalid)
  }

  if (errorEl) {
    const next = invalid && !silent ? error : ''
    if (errorEl.textContent !== next) errorEl.textContent = next
    errorEl.classList.toggle('hidden', !(invalid && !silent))
  }

  return invalid
}

function fieldEl(form, id) {
  return id ? form.querySelector(`#${id}`) : null
}

export function wireFormFields(form, fieldConfigs, { onAfterChange } = {}) {
  const states = new Map()

  function controlsOf(config) {
    if (config.controls) return config.controls.filter(Boolean)
    return [...form.querySelectorAll(`[name="${config.name}"]`)]
  }

  function readRaw(config) {
    if (config.readValue) return config.readValue()
    const [control] = controlsOf(config)
    return control?.value ?? ''
  }

  function apply(config) {
    const state = states.get(config.name)
    const error = config.getError() || ''
    const currentValue = readRaw(config)
    const reveal = shouldRevealFieldError({
      error,
      dirty: state.dirty,
      blurred: config.live ? state.dirty && String(currentValue).length > 0 : state.blurred,
      submitted: state.submitted,
    })
    const focused = controlsOf(config).some((item) => item === document.activeElement)
    if (config.customPresentation) {
      config.onPresent?.({ error, reveal, submitted: state.submitted, dirty: state.dirty })
    } else {
      applyFieldPresentation({
        controls: controlsOf(config),
        helpEl: fieldEl(form, config.helpId),
        errorEl: fieldEl(form, config.errorId),
        helpId: config.helpId,
        errorId: config.errorId,
        extraDescribedBy: config.extraDescribedBy ?? '',
        error,
        reveal,
        focused,
        silent: config.silent === true,
      })
    }
    return { name: config.name, error, reveal, control: controlsOf(config).find((item) => item.type !== 'hidden') ?? controlsOf(config)[0] }
  }

  fieldConfigs.forEach((config) => {
    const controls = controlsOf(config)
    const initial = readRaw(config)
    states.set(config.name, { initial, dirty: false, blurred: false, submitted: false })

    controls.forEach((control) => {
      control.addEventListener('focus', () => {
        apply(config)
      })

      control.addEventListener('input', () => {
        const state = states.get(config.name)
        const current = readRaw(config)
        state.dirty = current !== state.initial
        if (config.live || state.blurred || state.submitted) apply(config)
        else applyFieldPresentation({
          controls,
          helpEl: fieldEl(form, config.helpId),
          errorEl: fieldEl(form, config.errorId),
          helpId: config.helpId,
          errorId: config.errorId,
          extraDescribedBy: config.extraDescribedBy ?? '',
          error: '',
          reveal: false,
          focused: true,
        })
        onAfterChange?.(config.name)
      })

      control.addEventListener('change', () => {
        const state = states.get(config.name)
        state.dirty = readRaw(config) !== state.initial
        if (control.tagName === 'SELECT') state.blurred = true
        apply(config)
        onAfterChange?.(config.name)
      })

      control.addEventListener('focusout', () => {
        const state = states.get(config.name)
        if (config.normalizeOnBlur && control.type !== 'password') {
          control.value = config.normalizeOnBlur(control.value)
        }
        state.dirty = readRaw(config) !== state.initial
        state.blurred = state.dirty || state.blurred
        apply(config)
        onAfterChange?.(config.name)
      })
    })
  })

  function validateAll({ submitted = true } = {}) {
    const results = fieldConfigs.map((config) => {
      const state = states.get(config.name)
      if (submitted) state.submitted = true
      return apply(config)
    })
    const invalid = results.filter((item) => item.reveal && item.error)
    return {
      errors: Object.fromEntries(results.map((item) => [item.name, item.error])),
      firstInvalid: invalid[0]?.control ?? null,
      hasErrors: invalid.length > 0,
    }
  }

  function refresh(name) {
    const config = fieldConfigs.find((item) => item.name === name)
    if (config) apply(config)
  }

  function markInteracted(name) {
    const state = states.get(name)
    if (!state) return
    state.dirty = true
    state.blurred = true
    refresh(name)
  }

  return { validateAll, refresh, markInteracted }
}
