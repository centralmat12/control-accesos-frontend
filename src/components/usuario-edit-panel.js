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
import { ROLES, USUARIO_ROLES_API, normalizeRole, usuarioRolLabel } from '../config/roles.js'
import { escapeHtml, formatApiDateTime } from '../utils/format.js'
import { sanitizePublicErrorMessage } from '../utils/public-error.js'
import { BTN_DELETE_CLASS, BTN_SECONDARY_CLASS } from './button-styles.js'
import { iconLockReset, iconSave, iconTrash } from './icons.js'
import { employeeStatusBadge } from './badge.js'
import { fieldIds, FORM_LABEL_CLASS, formFieldMarkup, wireFormFields } from './form-field.js'
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
export const USUARIO_EDIT_SAVE_LABEL = 'Guardar'
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
  'inline-flex h-10 w-fit shrink-0 items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3 text-sm font-semibold text-white hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 active:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-600/70 disabled:text-white disabled:opacity-100'
const BTN_FIELD_SECONDARY = `${BTN_SECONDARY_CLASS} inline-flex h-10 w-fit shrink-0 items-center justify-center rounded-lg px-3 text-sm font-semibold`
const BTN_RESET_CLASS = 'btn-action-reset gap-1.5'
const BTN_COMPACT_SECONDARY = `${BTN_SECONDARY_CLASS} h-8 px-2.5 py-0 text-xs`
const BTN_COMPACT_DANGER =
  'inline-flex h-8 items-center justify-center rounded-lg bg-red-600 px-2.5 text-xs font-semibold text-white hover:bg-red-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 active:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60'
const BTN_COMPACT_POSITIVE =
  'inline-flex h-8 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200 dark:hover:bg-emerald-950/70'
export function rolCambioConfirmMessage(rolActual, rolNuevo) {
  const from = normalizeRole(rolActual)
  const to = normalizeRole(rolNuevo)
  if (from === ROLES.Rrhh && to === ROLES.Admin) return USUARIO_ROL_PROMOTE_MESSAGE
  if (from === ROLES.Admin && to === ROLES.Rrhh) return USUARIO_ROL_DEMOTE_MESSAGE
  return 'Este cambio actualizará el rol del usuario. Las sesiones actuales quedarán invalidadas.'
}

export function usuarioEstadoConfirmMessage(activar) {
  return activar ? USUARIO_REACTIVAR_MESSAGE : USUARIO_DESACTIVAR_MESSAGE
}

export function pintarTituloUsuario(heading, usuario, empresaLabel = '') {
  if (!heading) return
  heading.classList.add('flex', 'min-w-0', 'flex-wrap', 'items-center', 'gap-x-2', 'gap-y-1')
  const name = document.createElement('span')
  name.className = 'min-w-0 truncate'
  name.textContent = String(usuario?.nombreUsuario ?? '').trim() || 'Usuario'
  const nodes = [name]
  const empresa = String(empresaLabel ?? '').trim()
  if (empresa && empresa !== '—') {
    const company = document.createElement('span')
    company.className = 'min-w-0 truncate text-sm font-medium text-slate-500 dark:text-slate-400'
    company.dataset.usuarioEmpresaResumen = ''
    company.textContent = empresa
    nodes.push(company)
  }
  const host = document.createElement('span')
  host.innerHTML = employeeStatusBadge(usuario?.activo !== false, { withIcon: true })
  heading.replaceChildren(...nodes, host.firstElementChild)
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
    const reason = item.error?.message
      ? `: ${sanitizePublicErrorMessage(item.error.message, 'No se pudo completar la operación.')}`
      : ''
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
  if (!usuario?.bloqueado) return `${password}`
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

function actionButtonMarkup({ action, usuarioId, label = '', ariaLabel = '', className, tooltip, tooltipId, iconHtml = '' }) {
  const tip = tooltip ? ` ${tooltipTriggerAttributes(tooltip, tooltipId)}` : ''
  const accessible = ariaLabel || label
  const aria = accessible && accessible !== label ? ` aria-label="${escapeHtml(accessible)}"` : ''
  const content = `${iconHtml}${label ? `<span>${escapeHtml(label)}</span>` : ''}`
  return `
    <button
      type="button"
      data-action="${escapeHtml(action)}"
      data-usuario-accion="${escapeHtml(action)}"
      data-usuario-id="${usuarioId}"
      class="${className}"${aria}${tip}
    >
      ${content}
    </button>
  `
}

function usuarioEditActionGroups({ usuario, operador, matched = false } = {}) {
  const canEstado = puedeCambiarEstadoUsuarioObjetivo(operador, usuario)
  const canReset = puedeRestablecerUsuarioObjetivo(operador, usuario)
  const canUnlock = puedeDesbloquearUsuarioObjetivo(operador, usuario)
  const activo = Boolean(usuario?.activo)
  const usuarioId = Number(usuario?.id) > 0 ? Number(usuario.id) : ''
  const acceso = []

  if (canReset) {
    acceso.push(
      actionButtonMarkup({
        action: 'restablecer',
        usuarioId,
        label: matched ? 'Blanqueo de clave' : 'Restablecer clave',
        iconHtml: matched ? iconLockReset('h-3.5 w-3.5 shrink-0') : '',
        className: matched ? BTN_RESET_CLASS : BTN_COMPACT_SECONDARY,
        tooltip: USUARIO_EDIT_TOOLTIPS.restablecer,
        tooltipId: 'usuario-edit-restablecer',
      }),
    )
  }

  if (canUnlock) {
    acceso.push(
      actionButtonMarkup({
        action: 'desbloquear',
        usuarioId,
        label: 'Desbloquear',
        className: matched ? BTN_FIELD_SECONDARY : BTN_COMPACT_SECONDARY,
        tooltip: USUARIO_EDIT_TOOLTIPS.desbloquear,
        tooltipId: 'usuario-edit-desbloquear',
      }),
    )
  }

  const estado = canEstado
    ? actionButtonMarkup({
        action: 'estado',
        usuarioId,
        label: activo ? 'Desactivar cuenta' : 'Reactivar cuenta',
        iconHtml: activo && matched ? iconTrash('h-3.5 w-3.5 shrink-0') : '',
        className: activo ? (matched ? `${BTN_DELETE_CLASS} gap-1.5` : BTN_COMPACT_DANGER) : BTN_COMPACT_POSITIVE,
        tooltip: activo ? USUARIO_EDIT_TOOLTIPS.desactivar : '',
        tooltipId: activo ? 'usuario-edit-estado' : '',
      })
    : ''

  return { estado, acceso: acceso.join('') }
}

export function usuarioEditHeaderActionsMarkup({ usuario, operador } = {}) {
  const { estado, acceso } = usuarioEditActionGroups({ usuario, operador })
  const buttons = [acceso, estado].filter(Boolean)
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
              <th scope="col" class="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">DATO</th>
              <th scope="col" class="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">ANTES</th>
              <th scope="col" class="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">DESPUES</th>
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
  const selectedRol = String(usuario?.rol ?? '')
  const usuarioId = Number(usuario?.id) > 0 ? Number(usuario.id) : ''
  const identity = identityValues(usuario)

  const nombreCorreoMarkup = canIdentidad
    ? `<div class="space-y-4">
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
        })}
      </div>`
    : `<div class="space-y-4">
        ${resumenItem('Nombre de usuario', escapeHtml(identity.nombreUsuario || '—'))}
        ${resumenItem('Correo electrónico', escapeHtml(identity.correo || '—'))}
      </div>`

  const saveButton = `<button type="submit" data-action="guardar-cambios" data-usuario-accion="guardar" data-usuario-id="${usuarioId}" class="${BTN_PRIMARY_CLASS}" disabled>${iconSave('h-3.5 w-3.5 shrink-0')}<span>${USUARIO_EDIT_SAVE_LABEL}</span></button>`

  const rolMarkup = canRole
    ? formFieldMarkup({
        id: 'usuario-edit-rol',
        name: 'rol',
        label: 'Rol',
        tag: 'select',
        extraInputClass: 'h-11 py-0',
        optionsHtml: USUARIO_ROLES_API.map(
          (rol) =>
            `<option value="${escapeHtml(rol)}"${rol === selectedRol ? ' selected' : ''}>${escapeHtml(usuarioRolLabel(rol))}</option>`,
        ).join(''),
      })
    : `<div>
        <p class="${FORM_LABEL_CLASS}">Rol</p>
        <p class="flex h-11 items-center text-sm font-medium text-slate-900 dark:text-slate-100">${escapeHtml(usuarioRolLabel(usuario?.rol) || '—')}</p>
      </div>`
  const acciones = usuarioEditActionGroups({ usuario, operador, matched: true })
  const camposMarkup = `
    <section data-section="acceso" class="space-y-4">
      ${nombreCorreoMarkup}
      ${rolMarkup}
    </section>
  `
  const filaPrincipal = acciones.estado || canForm
    ? `<div class="flex items-center gap-2 ${acciones.estado && canForm ? 'justify-between' : canForm ? 'justify-end' : ''}">
        ${acciones.estado}
        ${canForm ? saveButton : ''}
      </div>`
    : ''
  const pieMarkup = `
    <div class="space-y-3 border-t border-slate-200 pt-4 dark:border-slate-700">
      ${acciones.acceso ? `<div class="flex flex-wrap gap-2">${acciones.acceso}</div>` : ''}
      ${filaPrincipal}
    </div>
  `

  return canForm
    ? `
      <form id="usuario-edit-form" class="space-y-5" novalidate>
        ${camposMarkup}
        ${pieMarkup}
      </form>
    `
    : `
      <div class="space-y-5">
        ${camposMarkup}
        ${acciones.estado ? pieMarkup : ''}
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
    const label = save.querySelector('span')
    if (label) label.textContent = USUARIO_EDIT_SAVE_LABEL
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
