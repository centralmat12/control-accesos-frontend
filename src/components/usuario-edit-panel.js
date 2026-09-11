import {
  estadoPasswordUsuario,
  USUARIO_CORREO_DUPLICADO,
  USUARIO_IDENTIDAD_CORREO_CONFIRM,
  validateUsuarioIdentidad,
} from '../api/usuarios.js'
import {
  puedeActualizarIdentidadUsuarioObjetivo,
  puedeCambiarEstadoUsuarioObjetivo,
  puedeCambiarRolUsuarioObjetivo,
  puedeDesbloquearUsuarioObjetivo,
  puedeRestablecerUsuarioObjetivo,
} from '../config/administracion.js'
import { USUARIO_ROLES_API, normalizeRole, usuarioRolLabel } from '../config/roles.js'
import { escapeHtml, formatApiDateTime } from '../utils/format.js'
import { BTN_SECONDARY_CLASS } from './button-styles.js'
import { fieldIds, formFieldMarkup, wireFormFields } from './form-field.js'
import { enhanceSelectsIn, refreshEnhancedSelect } from './dropdown.js'
import { openModal } from './modal.js'
import { bindTooltipRoot, tooltipTriggerAttributes } from './tooltip.js'

export const USUARIO_ROL_PROMOTE_MESSAGE =
  'Este cambio otorgará permisos administrativos sobre los usuarios de Recursos Humanos de la empresa. Las sesiones actuales del usuario quedarán invalidadas.'
export const USUARIO_ROL_DEMOTE_MESSAGE =
  'Este cambio retirará los permisos administrativos del usuario. Sus sesiones actuales quedarán invalidadas.'
export const USUARIO_DESACTIVAR_MESSAGE =
  'El usuario no podrá iniciar sesión y sus sesiones actuales quedarán invalidadas. La cuenta y los registros históricos se conservarán.'
export const USUARIO_REACTIVAR_MESSAGE =
  'El usuario podrá volver a iniciar sesión. Las sesiones anteriores no se recuperarán.'
export { USUARIO_CORREO_DUPLICADO, USUARIO_IDENTIDAD_CORREO_CONFIRM }

export const USUARIO_EDIT_TITLE = 'Modificación de usuario'
export const USUARIO_EDIT_FORM_TITLE = 'Datos de acceso y permisos'
export const USUARIO_EDIT_FORM_HELP = 'Modificá la identificación, el correo o el rol.'
export const USUARIO_EDIT_SAVE_LABEL = 'Guardar cambios'
export const USUARIO_EDIT_CONFIRM_TITLE = 'Confirmar modificaciones'
export const USUARIO_EDIT_CONFIRM_LABEL = 'Confirmar cambios'
export const USUARIO_EDIT_SUCCESS_MESSAGE = 'Usuario actualizado correctamente.'
export const USUARIO_EDIT_SAVE_WARNING =
  'Estos cambios invalidarán las sesiones activas del usuario. Deberá volver a iniciar sesión.'

export const USUARIO_EDIT_TOOLTIPS = Object.freeze({
  restablecer: 'Genera una clave temporal de un solo uso e invalida las sesiones actuales del usuario.',
  desactivar: 'Impide el acceso, revoca las sesiones actuales y conserva los datos y registros históricos.',
  desbloquear: 'Elimina el bloqueo temporal y restablece los intentos fallidos.',
})

const BTN_PRIMARY_CLASS =
  'inline-flex h-11 w-full shrink-0 items-center justify-center rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 active:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-600/70 disabled:text-white disabled:opacity-100 sm:w-auto'
const BTN_COMPACT_SECONDARY = `${BTN_SECONDARY_CLASS} h-8 px-2.5 py-0 text-xs`
const BTN_COMPACT_DANGER =
  'inline-flex h-8 items-center justify-center rounded-lg bg-red-600 px-2.5 text-xs font-semibold text-white hover:bg-red-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 active:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60'
const BTN_COMPACT_POSITIVE =
  'inline-flex h-8 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200 dark:hover:bg-emerald-950/70'
const SECTION_TITLE_CLASS = 'text-sm font-semibold text-slate-900 dark:text-slate-100'
const SECTION_HELP_CLASS = 'text-sm text-slate-500 dark:text-slate-400'

export function rolCambioConfirmMessage(rolActual, rolNuevo) {
  const from = normalizeRole(rolActual)
  const to = normalizeRole(rolNuevo)
  if (from === 'RRHH' && to === 'ADMIN') return USUARIO_ROL_PROMOTE_MESSAGE
  if (from === 'ADMIN' && to === 'RRHH') return USUARIO_ROL_DEMOTE_MESSAGE
  return 'Este cambio actualizará el rol del usuario. Las sesiones actuales quedarán invalidadas.'
}

export function usuarioEstadoConfirmMessage(activar) {
  return activar ? USUARIO_REACTIVAR_MESSAGE : USUARIO_DESACTIVAR_MESSAGE
}

export function usuarioEditSubtitle(usuario) {
  const nombre = String(usuario?.nombreUsuario ?? '').trim()
  const correo = String(usuario?.correo ?? '').trim()
  if (nombre && correo) return `${nombre} · ${correo}`
  return nombre || correo || ''
}

function identityValues(usuario) {
  return {
    nombreUsuario: String(usuario?.nombreUsuario ?? ''),
    correo: String(usuario?.correo ?? ''),
  }
}

export function usuarioEditFormValues(usuario, overrides = {}) {
  return {
    nombreUsuario: String(overrides.nombreUsuario ?? usuario?.nombreUsuario ?? ''),
    correo: String(overrides.correo ?? usuario?.correo ?? ''),
    rol: String(overrides.rol ?? usuario?.rol ?? ''),
  }
}

function displayChangeValue(key, value) {
  if (key === 'rol') return usuarioRolLabel(value) || String(value ?? '') || '—'
  const text = String(value ?? '').trim()
  return text || '—'
}

export function usuarioEditDiff(original, values) {
  const current = usuarioEditFormValues(original)
  const next = usuarioEditFormValues(original, values)
  const fields = [
    { key: 'nombreUsuario', kind: 'identidad', label: 'Nombre de usuario' },
    { key: 'correo', kind: 'identidad', label: 'Correo electrónico' },
    { key: 'rol', kind: 'rol', label: 'Rol' },
  ]

  return fields
    .filter((field) => current[field.key] !== next[field.key])
    .map((field) => ({
      ...field,
      currentValue: current[field.key],
      newValue: next[field.key],
      currentLabel: displayChangeValue(field.key, current[field.key]),
      newLabel: displayChangeValue(field.key, next[field.key]),
    }))
}

export function usuarioEditSavePlan(changes = []) {
  return {
    identity: changes.some((change) => change.kind === 'identidad'),
    role: changes.some((change) => change.kind === 'rol'),
  }
}

export function usuarioEditIdentidadPayload(original, changes = []) {
  const payload = identityValues(original)
  changes.forEach((change) => {
    if (change.key === 'nombreUsuario') payload.nombreUsuario = String(change.newValue ?? '')
    if (change.key === 'correo') payload.correo = String(change.newValue ?? '')
  })
  return payload
}

export function usuarioEditRolPayload(changes = []) {
  const change = changes.find((item) => item.key === 'rol')
  return change ? String(change.newValue ?? '') : ''
}

export function summarizeUsuarioEditSave(results) {
  const attempted = []
  const succeeded = []
  const failed = []

  if (results?.identity?.status && results.identity.status !== 'skipped') {
    attempted.push('identidad')
    if (results.identity.status === 'ok') succeeded.push('identidad')
    else failed.push({ kind: 'identidad', error: results.identity.error })
  }
  if (results?.role?.status && results.role.status !== 'skipped') {
    attempted.push('rol')
    if (results.role.status === 'ok') succeeded.push('rol')
    else failed.push({ kind: 'rol', error: results.role.error })
  }

  const status = failed.length === 0 ? 'ok' : succeeded.length ? 'partial' : 'error'
  return { status, results, attempted, succeeded, failed }
}

function modificationPhrase(kind) {
  return kind === 'rol' ? 'del rol' : 'de los datos de acceso'
}

export function usuarioEditSaveFeedback(summary) {
  if (!summary || summary.status === 'ok') {
    return { tone: 'success', message: USUARIO_EDIT_SUCCESS_MESSAGE }
  }

  const parts = []
  if (summary.succeeded.length) {
    parts.push(`Se aplicó la modificación ${summary.succeeded.map(modificationPhrase).join(' y ')}.`)
  }
  summary.failed.forEach((item) => {
    const reason = item.error?.message ? `: ${item.error.message}` : ''
    parts.push(`No se pudo aplicar la modificación ${modificationPhrase(item.kind)}${reason}.`)
  })
  return {
    tone: summary.status === 'partial' ? 'warning' : 'error',
    message: parts.join(' '),
  }
}

export async function applyUsuarioEditSaves({ changes = [], saveIdentidad, saveRol, onProgress } = {}) {
  const plan = usuarioEditSavePlan(changes)
  const results = {
    identity: plan.identity ? { status: 'pending' } : { status: 'skipped' },
    role: plan.role ? { status: 'pending' } : { status: 'skipped' },
  }

  if (plan.identity) {
    onProgress?.({ step: 'identidad', results })
    try {
      results.identity = { status: 'ok', value: await saveIdentidad() }
    } catch (error) {
      results.identity = { status: 'error', error }
    }
  }

  if (plan.role) {
    onProgress?.({ step: 'rol', results })
    try {
      results.role = { status: 'ok', value: await saveRol() }
    } catch (error) {
      results.role = { status: 'error', error }
    }
  }

  return summarizeUsuarioEditSave(results)
}

export function usuarioEditEstadoResumen(usuario) {
  return Boolean(usuario?.activo) ? 'Cuenta activa' : 'Cuenta inactiva'
}

export function usuarioEditAccesoResumen(usuario) {
  const password = estadoPasswordUsuario(usuario)
  if (!usuario?.bloqueado) return `${password} · Sin bloqueo`
  const hasta = formatApiDateTime(usuario.bloqueadoHasta)
  return `${password} · ${hasta ? `Bloqueado hasta ${hasta}` : 'Bloqueado'}`
}

function resumenItem(label, valueHtml, { valueClass = '' } = {}) {
  return `
    <div class="flex min-h-[2.75rem] min-w-0 flex-col justify-center">
      <dt class="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">${escapeHtml(label)}</dt>
      <dd class="mt-1 text-sm font-medium text-slate-900 dark:text-slate-100 ${valueClass}">${valueHtml}</dd>
    </div>
  `
}

function estadoDotMarkup(activo) {
  const tone = activo ? 'bg-emerald-500' : 'bg-red-500'
  return `<span class="inline-flex min-w-0 items-center gap-2">
      <span class="h-2 w-2 shrink-0 rounded-full ${tone}" aria-hidden="true"></span>
      <span>${escapeHtml(usuarioEditEstadoResumen({ activo }))}</span>
    </span>`
}

function actionButtonMarkup({ action, usuarioId, label, className, tooltip, tooltipId }) {
  const tip = tooltip ? ` ${tooltipTriggerAttributes(tooltip, tooltipId)}` : ''
  return `
    <button
      type="button"
      data-action="${escapeHtml(action)}"
      data-usuario-accion="${escapeHtml(action)}"
      data-usuario-id="${usuarioId}"
      class="${className}"${tip}
    >
      ${escapeHtml(label)}
    </button>
  `
}

export function usuarioEditHeaderActionsMarkup({ usuario, operador } = {}) {
  const canEstado = puedeCambiarEstadoUsuarioObjetivo(operador, usuario)
  const canReset = puedeRestablecerUsuarioObjetivo(operador, usuario)
  const canUnlock = puedeDesbloquearUsuarioObjetivo(operador, usuario)
  const activo = Boolean(usuario?.activo)
  const usuarioId = Number(usuario?.id) > 0 ? Number(usuario.id) : ''
  const buttons = []

  if (canReset) {
    buttons.push(
      actionButtonMarkup({
        action: 'restablecer',
        usuarioId,
        label: 'Restablecer clave',
        className: BTN_COMPACT_SECONDARY,
        tooltip: USUARIO_EDIT_TOOLTIPS.restablecer,
        tooltipId: 'usuario-edit-restablecer',
      }),
    )
  }

  if (canEstado) {
    buttons.push(
      actionButtonMarkup({
        action: 'estado',
        usuarioId,
        label: activo ? 'Desactivar cuenta' : 'Reactivar cuenta',
        className: activo ? BTN_COMPACT_DANGER : BTN_COMPACT_POSITIVE,
        tooltip: activo ? USUARIO_EDIT_TOOLTIPS.desactivar : '',
        tooltipId: activo ? 'usuario-edit-estado' : '',
      }),
    )
  }

  if (canUnlock) {
    buttons.push(
      actionButtonMarkup({
        action: 'desbloquear',
        usuarioId,
        label: 'Desbloquear',
        className: BTN_COMPACT_SECONDARY,
        tooltip: USUARIO_EDIT_TOOLTIPS.desbloquear,
        tooltipId: 'usuario-edit-desbloquear',
      }),
    )
  }

  if (!buttons.length) return ''

  return `
    <section data-section="acciones" class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
      <div class="flex flex-wrap justify-end gap-2">
        ${buttons.join('')}
      </div>
    </section>
  `
}

export function usuarioModificacionesConfirmMarkup({ changes = [], busy = false, resultMessage = '', resultTone = '' } = {}) {
  const rows = changes
    .map(
      (change) => `
        <tr class="border-t border-slate-200 dark:border-slate-700">
          <th scope="row" class="px-3 py-2 text-left text-sm font-medium text-slate-700 dark:text-slate-200">${escapeHtml(change.label)}</th>
          <td class="px-3 py-2 text-sm text-slate-600 dark:text-slate-300">${escapeHtml(change.currentLabel ?? displayChangeValue(change.key, change.currentValue))}</td>
          <td class="px-3 py-2 text-sm font-medium text-slate-900 dark:text-slate-100">${escapeHtml(change.newLabel ?? displayChangeValue(change.key, change.newValue))}</td>
        </tr>
      `,
    )
    .join('')

  const resultClass =
    resultTone === 'warning'
      ? 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100'
      : resultTone === 'error'
        ? 'border-red-200 bg-red-50 text-red-900 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-100'
        : 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'

  return `
    <div class="space-y-4">
      <div class="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
        <table class="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
          <thead class="bg-slate-50 dark:bg-slate-800">
            <tr>
              <th scope="col" class="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Campo</th>
              <th scope="col" class="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Valor actual</th>
              <th scope="col" class="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Nuevo valor</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <p class="text-sm text-slate-600 dark:text-slate-300">${escapeHtml(USUARIO_EDIT_SAVE_WARNING)}</p>
      <div data-save-progress class="${busy ? '' : 'hidden'} flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300" role="status" aria-live="polite">
        <span class="h-3.5 w-3.5 animate-pulse rounded-full bg-blue-600" aria-hidden="true"></span>
        <span>Guardando cambios...</span>
      </div>
      <p data-save-result class="${resultMessage ? '' : 'hidden'} rounded-lg border px-3 py-2 text-sm ${resultClass}" role="status" aria-live="polite">${escapeHtml(resultMessage)}</p>
      <div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" data-action="cancel" data-autofocus class="${BTN_SECONDARY_CLASS}" ${busy ? 'disabled' : ''}>Cancelar</button>
        <button type="button" data-action="confirm" class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60" ${busy ? 'disabled' : ''}>${USUARIO_EDIT_CONFIRM_LABEL}</button>
      </div>
    </div>
  `
}

export function openUsuarioModificacionesConfirm({ changes, execute, onAfterAttempt } = {}) {
  return new Promise((resolve) => {
    let settled = false
    let busy = false
    let finished = false
    let lastOutcome = { status: 'cancelled' }

    const content = document.createElement('div')
    content.innerHTML = usuarioModificacionesConfirmMarkup({ changes })

    const cancelBtn = content.querySelector('[data-action="cancel"]')
    const confirmBtn = content.querySelector('[data-action="confirm"]')
    const progress = content.querySelector('[data-save-progress]')
    const resultNode = content.querySelector('[data-save-result]')

    const finish = (outcome) => {
      if (settled) return
      settled = true
      modal.close({ force: true })
      resolve(outcome)
    }

    const modal = openModal({
      title: USUARIO_EDIT_CONFIRM_TITLE,
      content,
      labelledBy: 'usuario-modificaciones-title',
      stacked: true,
      closeOnBackdrop: false,
      closeOnEscape: () => !busy,
      canClose: () => !busy,
      unsavedChanges: false,
      onClose: () => {
        if (!settled) resolve(lastOutcome)
      },
    })

    const closeButton = modal.dialog.querySelector('[aria-label="Cerrar"]')

    function setBusy(nextBusy) {
      busy = nextBusy
      cancelBtn.disabled = nextBusy || finished
      confirmBtn.disabled = nextBusy || finished
      if (closeButton) closeButton.disabled = nextBusy
      progress.classList.toggle('hidden', !nextBusy)
      modal.dialog.setAttribute('aria-busy', nextBusy ? 'true' : 'false')
    }

    cancelBtn?.addEventListener('click', () => {
      if (busy) return
      finish(lastOutcome)
    })

    confirmBtn?.addEventListener('click', async () => {
      if (busy || finished) return
      setBusy(true)
      try {
        const summary = await execute()
        const outcome = { status: summary?.status || 'error', summary }
        lastOutcome = outcome
        finished = true
        await onAfterAttempt?.(summary)
        if (outcome.status === 'ok') {
          finish(outcome)
          return
        }
        const feedback = usuarioEditSaveFeedback(summary)
        resultNode.textContent = feedback.message
        resultNode.classList.remove('hidden')
        cancelBtn.textContent = 'Cerrar'
        cancelBtn.disabled = false
        confirmBtn.disabled = true
      } catch (error) {
        finished = true
        lastOutcome = { status: 'error', summary: summarizeUsuarioEditSave({ identity: { status: 'error', error }, role: { status: 'skipped' } }) }
        const feedback = usuarioEditSaveFeedback(lastOutcome.summary)
        resultNode.textContent = feedback.message || error.message || 'No se pudieron aplicar las modificaciones.'
        resultNode.classList.remove('hidden')
        cancelBtn.textContent = 'Cerrar'
        cancelBtn.disabled = false
        confirmBtn.disabled = true
      } finally {
        busy = false
        progress.classList.add('hidden')
        if (closeButton) closeButton.disabled = false
        modal.dialog.setAttribute('aria-busy', 'false')
      }
    })
  })
}

export function usuarioEditPanelMarkup({ usuario, operador, empresaLabel = '—' } = {}) {
  const canIdentidad = puedeActualizarIdentidadUsuarioObjetivo(operador, usuario)
  const canRole = puedeCambiarRolUsuarioObjetivo(operador, usuario)
  const canForm = canIdentidad || canRole
  const activo = Boolean(usuario?.activo)
  const selectedRol = String(usuario?.rol ?? '')
  const usuarioId = Number(usuario?.id) > 0 ? Number(usuario.id) : ''
  const identity = identityValues(usuario)

  const nombreCorreoMarkup = canIdentidad
    ? `<div class="grid gap-3 sm:grid-cols-2">
        ${formFieldMarkup({
          id: 'usuario-edit-nombreUsuario',
          name: 'nombreUsuario',
          label: 'Nombre de usuario',
          required: true,
          maxLength: 50,
          autocomplete: 'username',
          value: identity.nombreUsuario,
        })}
        ${formFieldMarkup({
          id: 'usuario-edit-correo',
          name: 'correo',
          label: 'Correo electrónico',
          required: true,
          type: 'email',
          maxLength: 100,
          autocomplete: 'email',
          value: identity.correo,
          helpText: 'Se utiliza para iniciar sesión.',
        })}
      </div>`
    : `<div class="grid gap-3 sm:grid-cols-2">
        ${resumenItem('Nombre de usuario', escapeHtml(identity.nombreUsuario || '—'))}
        ${resumenItem('Correo electrónico', escapeHtml(identity.correo || '—'))}
      </div>`

  const saveButton = `<button type="submit" data-action="guardar-cambios" data-usuario-accion="guardar" data-usuario-id="${usuarioId}" class="${BTN_PRIMARY_CLASS}" disabled>
                      ${USUARIO_EDIT_SAVE_LABEL}
                    </button>`

  const rolYGuardarMarkup = canRole
    ? `<div class="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div class="min-w-0 flex-1">
          ${formFieldMarkup({
            id: 'usuario-edit-rol',
            name: 'rol',
            label: 'Rol',
            tag: 'select',
            extraInputClass: 'h-11 py-0',
            optionsHtml: USUARIO_ROLES_API.map(
              (rol) =>
                `<option value="${escapeHtml(rol)}"${rol === selectedRol ? ' selected' : ''}>${escapeHtml(usuarioRolLabel(rol))}</option>`,
            ).join(''),
          })}
        </div>
        ${saveButton}
      </div>`
    : `<div class="flex justify-end">${saveButton}</div>`

  return `
      <div class="space-y-4">
        ${usuarioEditHeaderActionsMarkup({ usuario, operador })}

        <section data-section="resumen" class="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/50">
          <h3 class="sr-only">Resumen de la cuenta</h3>
          <dl class="grid grid-cols-1 items-stretch gap-3 min-[28rem]:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_minmax(0,1.2fr)_minmax(0,1.6fr)] lg:items-center">
            ${resumenItem('Empresa', `<span data-usuario-empresa-resumen>${escapeHtml(empresaLabel || '—')}</span>`)}
            ${resumenItem('Rol', escapeHtml(usuarioRolLabel(usuario?.rol) || '—'), { valueClass: 'lg:whitespace-nowrap' })}
            ${resumenItem('Estado', estadoDotMarkup(activo))}
            ${resumenItem('Acceso', escapeHtml(usuarioEditAccesoResumen(usuario)))}
          </dl>
        </section>

        ${
          canForm
            ? `<section data-section="acceso">
                <form id="usuario-edit-form" class="space-y-4" novalidate>
                  <div>
                    <h3 class="${SECTION_TITLE_CLASS}">${USUARIO_EDIT_FORM_TITLE}</h3>
                    <p class="${SECTION_HELP_CLASS}">${USUARIO_EDIT_FORM_HELP}</p>
                  </div>
                  ${nombreCorreoMarkup}
                  ${rolYGuardarMarkup}
                </form>
              </section>`
            : `<section data-section="acceso">
                ${nombreCorreoMarkup}
              </section>`
        }
      </div>
    `
}

export function createUsuarioEditPanel({
  usuario,
  operador,
  empresaLabel = '—',
  onRequestSave,
  onRequestEstado,
  onRequestRestablecer,
  onRequestDesbloquear,
} = {}) {
  const wrapper = document.createElement('div')
  let current = usuario
  let correoServerError = ''
  let saveBusy = false
  let fields = null
  let tooltipsBound = false

  function readFormValues() {
    const nombreInput = wrapper.querySelector('[name="nombreUsuario"]')
    const correoInput = wrapper.querySelector('[name="correo"]')
    const rolSelect = wrapper.querySelector('[name="rol"]')
    return usuarioEditFormValues(current, {
      nombreUsuario: nombreInput ? nombreInput.value : current?.nombreUsuario,
      correo: correoInput ? correoInput.value : current?.correo,
      rol: rolSelect ? rolSelect.value : current?.rol,
    })
  }

  function identidadErrors() {
    if (!wrapper.querySelector('[name="nombreUsuario"]')) return {}
    const values = readFormValues()
    const errors = validateUsuarioIdentidad(values)
    if (correoServerError) errors.correo = correoServerError
    return errors
  }

  function hasFormChanges() {
    return usuarioEditDiff(current, readFormValues()).length > 0
  }

  function hasIdentidadErrors() {
    const errors = identidadErrors()
    return Boolean(errors.nombreUsuario || errors.correo)
  }

  function syncSaveButtons() {
    const save = wrapper.querySelector('[data-action="guardar-cambios"]')
    if (!save) return
    save.disabled = saveBusy || !hasFormChanges() || hasIdentidadErrors()
    save.textContent = USUARIO_EDIT_SAVE_LABEL
  }

  function paint() {
    correoServerError = ''
    saveBusy = false
    wrapper.innerHTML = usuarioEditPanelMarkup({
      usuario: current,
      operador,
      empresaLabel,
    })

    const form = wrapper.querySelector('#usuario-edit-form')
    if (form) {
      const specs = []
      if (wrapper.querySelector('[name="nombreUsuario"]')) {
        const nombreIds = fieldIds('usuario-edit-nombreUsuario')
        const correoIds = fieldIds('usuario-edit-correo')
        specs.push(
          {
            name: 'nombreUsuario',
            helpId: nombreIds.helpId,
            errorId: nombreIds.errorId,
            live: true,
            keepHelpVisible: true,
            getError: () => identidadErrors().nombreUsuario,
          },
          {
            name: 'correo',
            helpId: correoIds.helpId,
            errorId: correoIds.errorId,
            live: true,
            keepHelpVisible: true,
            getError: () => identidadErrors().correo,
          },
        )
      }

      fields = specs.length
        ? wireFormFields(form, specs, {
            onAfterChange: (name) => {
              if (name === 'correo') correoServerError = ''
              syncSaveButtons()
            },
          })
        : null

      const rolSelect = wrapper.querySelector('[name="rol"]')
      if (rolSelect) {
        rolSelect.addEventListener('change', syncSaveButtons)
        enhanceSelectsIn(wrapper)
        refreshEnhancedSelect(rolSelect)
      }

      form.addEventListener('submit', (event) => {
        event.preventDefault()
        void submitForm()
      })
    } else {
      fields = null
    }

    wrapper.querySelector('[data-action="estado"]')?.addEventListener('click', () => {
      onRequestEstado?.(!Boolean(current?.activo))
    })
    wrapper.querySelector('[data-action="restablecer"]')?.addEventListener('click', () => {
      onRequestRestablecer?.()
    })
    wrapper.querySelector('[data-action="desbloquear"]')?.addEventListener('click', () => {
      onRequestDesbloquear?.()
    })

    if (!tooltipsBound) {
      bindTooltipRoot(wrapper)
      tooltipsBound = true
    }

    syncSaveButtons()
  }

  async function submitForm() {
    if (!formAlive() || saveBusy) return
    const values = readFormValues()
    const validation = fields?.validateAll({ submitted: true })
    if (validation?.hasErrors || !hasFormChanges()) {
      syncSaveButtons()
      validation?.firstInvalid?.focus()
      return
    }

    const changes = usuarioEditDiff(current, values)
    saveBusy = true
    syncSaveButtons()
    try {
      const outcome = await onRequestSave?.(changes)
      if (!wrapper.isConnected) return
      const identityError =
        outcome?.summary?.failed?.find((item) => item.kind === 'identidad')?.error ||
        outcome?.summary?.results?.identity?.error
      if (identityError?.status === 409) {
        correoServerError = USUARIO_CORREO_DUPLICADO
        fields?.markInteracted('correo')
        fields?.refresh('correo')
      }
    } finally {
      if (!wrapper.isConnected) return
      saveBusy = false
      syncSaveButtons()
    }
  }

  function formAlive() {
    return Boolean(wrapper.isConnected && wrapper.querySelector('#usuario-edit-form'))
  }

  paint()

  return {
    element: wrapper,
    isDirty() {
      return hasFormChanges()
    },
    syncSaveButtons,
    update(nextUsuario) {
      current = nextUsuario
      paint()
    },
    getUsuario() {
      return current
    },
  }
}
