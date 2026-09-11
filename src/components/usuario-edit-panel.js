import {
  estadoCuentaUsuario,
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
import { badgeHtml } from './badge.js'
import { BTN_SECONDARY_CLASS } from './button-styles.js'
import { fieldIds, formFieldMarkup, wireFormFields } from './form-field.js'
import { enhanceSelectsIn, refreshEnhancedSelect } from './dropdown.js'

export const USUARIO_ROL_PROMOTE_MESSAGE =
  'Este cambio otorgará permisos administrativos sobre los usuarios de Recursos Humanos de la empresa. Las sesiones actuales del usuario quedarán invalidadas.'
export const USUARIO_ROL_DEMOTE_MESSAGE =
  'Este cambio retirará los permisos administrativos del usuario. Sus sesiones actuales quedarán invalidadas.'
export const USUARIO_DESACTIVAR_MESSAGE =
  'El usuario no podrá iniciar sesión y sus sesiones actuales quedarán invalidadas. La cuenta y los registros históricos se conservarán.'
export const USUARIO_REACTIVAR_MESSAGE =
  'El usuario podrá volver a iniciar sesión. Las sesiones anteriores no se recuperarán.'
export { USUARIO_CORREO_DUPLICADO, USUARIO_IDENTIDAD_CORREO_CONFIRM }

const BTN_PRIMARY_CLASS =
  'inline-flex h-10 w-full items-center justify-center rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 active:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto'
const BTN_DANGER_CLASS =
  'inline-flex h-10 w-full items-center justify-center rounded-lg bg-red-600 px-4 text-sm font-semibold text-white hover:bg-red-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 active:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto'
const SECTION_TITLE_CLASS = 'text-sm font-semibold text-slate-900 dark:text-slate-100'
const SECTION_HELP_CLASS = 'text-sm text-slate-500 dark:text-slate-400'
const SECTION_CLASS = 'space-y-3 border-t border-slate-200 pt-5 dark:border-slate-700'

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

function identityValues(usuario) {
  return {
    nombreUsuario: String(usuario?.nombreUsuario ?? ''),
    correo: String(usuario?.correo ?? ''),
  }
}

function resumenItem(label, valueHtml) {
  return `
    <div>
      <dt class="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">${escapeHtml(label)}</dt>
      <dd class="mt-1 text-sm font-medium text-slate-900 dark:text-slate-100">${valueHtml}</dd>
    </div>
  `
}

function securityRow({ title, description, action, usuarioId, label }) {
  return `
    <div class="flex flex-col gap-3 border-b border-slate-100 py-3 last:border-b-0 last:pb-0 first:pt-0 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
      <div class="min-w-0">
        <p class="text-sm font-medium text-slate-900 dark:text-slate-100">${escapeHtml(title)}</p>
        <p class="${SECTION_HELP_CLASS}">${escapeHtml(description)}</p>
      </div>
      <button type="button" data-action="${escapeHtml(action)}" data-usuario-accion="${escapeHtml(action)}" data-usuario-id="${usuarioId}" class="${BTN_SECONDARY_CLASS} w-full sm:w-auto">
        ${escapeHtml(label)}
      </button>
    </div>
  `
}

export function usuarioEditPanelMarkup({ usuario, operador, empresaLabel = '—' } = {}) {
  const canIdentidad = puedeActualizarIdentidadUsuarioObjetivo(operador, usuario)
  const canRole = puedeCambiarRolUsuarioObjetivo(operador, usuario)
  const canEstado = puedeCambiarEstadoUsuarioObjetivo(operador, usuario)
  const canReset = puedeRestablecerUsuarioObjetivo(operador, usuario)
  const canUnlock = puedeDesbloquearUsuarioObjetivo(operador, usuario)
  const activo = Boolean(usuario?.activo)
  const selectedRol = String(usuario?.rol ?? '')
  const bloqueadoHasta = formatApiDateTime(usuario?.bloqueadoHasta)
  const usuarioId = Number(usuario?.id) > 0 ? Number(usuario.id) : ''
  const identity = identityValues(usuario)

  return `
      <div class="space-y-0">
        <section data-section="resumen" class="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/50">
          <h3 class="sr-only">Resumen de la cuenta</h3>
          <dl class="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            ${resumenItem('Empresa', `<span data-usuario-empresa-resumen>${escapeHtml(empresaLabel || '—')}</span>`)}
            ${resumenItem('Rol', badgeHtml(usuarioRolLabel(usuario?.rol), 'info'))}
            ${resumenItem('Estado', badgeHtml(estadoCuentaUsuario(usuario), activo ? 'success' : 'danger'))}
            ${resumenItem(
              'Contraseña',
              estadoPasswordUsuario(usuario) === 'Cambio requerido'
                ? badgeHtml('Cambio requerido', 'warning')
                : badgeHtml('Normal', 'neutral'),
            )}
            ${resumenItem(
              'Bloqueo',
              usuario?.bloqueado
                ? badgeHtml(bloqueadoHasta ? `Bloqueado hasta ${bloqueadoHasta}` : 'Bloqueado', 'danger')
                : badgeHtml('Sin bloqueo', 'neutral'),
            )}
          </dl>
        </section>

        <section data-section="acceso" class="space-y-3 pt-5">
          <div>
            <h3 class="${SECTION_TITLE_CLASS}">Información de acceso</h3>
            <p class="${SECTION_HELP_CLASS}">Actualizá el identificador visible y el correo de inicio de sesión.</p>
          </div>
          ${
            canIdentidad
              ? `<form id="usuario-edit-identidad" class="space-y-3" novalidate>
                  ${formFieldMarkup({
                    id: 'usuario-edit-nombreUsuario',
                    name: 'nombreUsuario',
                    label: 'Nombre de usuario',
                    required: true,
                    maxLength: 50,
                    autocomplete: 'username',
                    value: identity.nombreUsuario,
                    helpText: 'Identificador visible de la cuenta. No se utiliza para iniciar sesión.',
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
                    helpText: 'Se utiliza para iniciar sesión. Si lo modificás, el usuario deberá ingresar con el nuevo correo.',
                  })}
                  <div class="flex justify-end">
                    <button type="submit" data-action="guardar-identidad" data-usuario-accion="identidad" data-usuario-id="${usuarioId}" class="${BTN_PRIMARY_CLASS}" disabled>
                      Guardar información
                    </button>
                  </div>
                </form>`
              : `<div class="grid gap-3 sm:grid-cols-2">
                  ${resumenItem('Nombre de usuario', escapeHtml(identity.nombreUsuario || '—'))}
                  ${resumenItem('Correo electrónico', escapeHtml(identity.correo || '—'))}
                </div>`
          }
        </section>

        ${
          canRole
            ? `<section data-section="rol" class="${SECTION_CLASS}">
                <div class="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                  <div class="min-w-0 space-y-3">
                    <div>
                      <h3 class="${SECTION_TITLE_CLASS}">Rol de acceso</h3>
                      <p class="${SECTION_HELP_CLASS}">Define si administra Recursos Humanos o opera como RRHH. Guardar invalidará las sesiones actuales.</p>
                    </div>
                    ${formFieldMarkup({
                      id: 'usuario-edit-rol',
                      name: 'rol',
                      label: 'Rol',
                      tag: 'select',
                      optionsHtml: USUARIO_ROLES_API.map(
                        (rol) =>
                          `<option value="${escapeHtml(rol)}"${rol === selectedRol ? ' selected' : ''}>${escapeHtml(usuarioRolLabel(rol))}</option>`,
                      ).join(''),
                    })}
                  </div>
                  <button type="button" data-action="guardar-rol" data-usuario-accion="rol" data-usuario-id="${usuarioId}" class="${BTN_PRIMARY_CLASS}" disabled>
                    Guardar rol
                  </button>
                </div>
              </section>`
            : ''
        }

        ${
          canReset || canUnlock
            ? `<section data-section="seguridad" class="${SECTION_CLASS}">
                <h3 class="${SECTION_TITLE_CLASS}">Seguridad</h3>
                <div class="divide-y-0">
                  ${
                    canReset
                      ? securityRow({
                          title: 'Restablecer contraseña',
                          description: 'Genera una contraseña temporal de un solo uso.',
                          action: 'restablecer',
                          usuarioId,
                          label: 'Restablecer',
                        })
                      : ''
                  }
                  ${
                    canUnlock
                      ? securityRow({
                          title: 'Desbloquear cuenta',
                          description: 'Limpia el bloqueo por intentos fallidos sin cambiar la contraseña.',
                          action: 'desbloquear',
                          usuarioId,
                          label: 'Desbloquear',
                        })
                      : ''
                  }
                </div>
              </section>`
            : ''
        }

        ${
          canEstado
            ? `<section data-section="estado" class="${SECTION_CLASS}">
                <div class="flex flex-col gap-3 rounded-xl border ${
                  activo
                    ? 'border-red-200 bg-red-50/60 dark:border-red-900/60 dark:bg-red-950/20'
                    : 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/40'
                } px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
                  <div class="min-w-0">
                    <h3 class="${SECTION_TITLE_CLASS}">${activo ? 'Desactivar cuenta' : 'Reactivar cuenta'}</h3>
                    <p class="${SECTION_HELP_CLASS}">${
                      activo
                        ? 'Impide el acceso y revoca las sesiones actuales. Los datos y registros históricos se conservarán.'
                        : 'Permite que el usuario vuelva a iniciar sesión. Las sesiones anteriores no se recuperarán.'
                    }</p>
                  </div>
                  <button type="button" data-action="estado" data-usuario-accion="estado" data-usuario-id="${usuarioId}" class="${activo ? BTN_DANGER_CLASS : BTN_PRIMARY_CLASS}">
                    ${activo ? 'Desactivar usuario' : 'Reactivar usuario'}
                  </button>
                </div>
              </section>`
            : ''
        }
      </div>
    `
}

export function createUsuarioEditPanel({
  usuario,
  operador,
  empresaLabel = '—',
  onRequestIdentidad,
  onRequestRol,
  onRequestEstado,
  onRequestRestablecer,
  onRequestDesbloquear,
} = {}) {
  const wrapper = document.createElement('div')
  let current = usuario
  let correoServerError = ''
  let identidadBusy = false
  let fields = null

  function readIdentidad() {
    return {
      nombreUsuario: String(wrapper.querySelector('[name="nombreUsuario"]')?.value ?? ''),
      correo: String(wrapper.querySelector('[name="correo"]')?.value ?? ''),
    }
  }

  function identidadErrors() {
    const values = readIdentidad()
    const errors = validateUsuarioIdentidad(values)
    if (correoServerError) errors.correo = correoServerError
    return errors
  }

  function identidadChanged() {
    const values = readIdentidad()
    const original = identityValues(current)
    return values.nombreUsuario !== original.nombreUsuario || values.correo !== original.correo
  }

  function hasIdentidadErrors() {
    const errors = identidadErrors()
    return Boolean(errors.nombreUsuario || errors.correo)
  }

  function syncSaveButtons() {
    const saveIdentidad = wrapper.querySelector('[data-action="guardar-identidad"]')
    if (saveIdentidad) {
      saveIdentidad.disabled = identidadBusy || !identidadChanged() || hasIdentidadErrors()
      saveIdentidad.textContent = identidadBusy ? 'Guardando...' : 'Guardar información'
    }

    const rolSelect = wrapper.querySelector('[name="rol"]')
    const saveRol = wrapper.querySelector('[data-action="guardar-rol"]')
    if (rolSelect && saveRol) {
      saveRol.disabled = String(rolSelect.value) === String(current?.rol ?? '')
    }
  }

  function paint() {
    correoServerError = ''
    identidadBusy = false
    wrapper.innerHTML = usuarioEditPanelMarkup({
      usuario: current,
      operador,
      empresaLabel,
    })

    const identidadForm = wrapper.querySelector('#usuario-edit-identidad')
    if (identidadForm) {
      const nombreIds = fieldIds('usuario-edit-nombreUsuario')
      const correoIds = fieldIds('usuario-edit-correo')
      fields = wireFormFields(
        identidadForm,
        [
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
        ],
        {
          onAfterChange: (name) => {
            if (name === 'correo') correoServerError = ''
            syncSaveButtons()
          },
        },
      )

      identidadForm.addEventListener('submit', (event) => {
        event.preventDefault()
        void submitIdentidad()
      })
    } else {
      fields = null
    }

    const rolSelect = wrapper.querySelector('[name="rol"]')
    const saveRol = wrapper.querySelector('[data-action="guardar-rol"]')
    if (rolSelect && saveRol) {
      rolSelect.addEventListener('change', syncSaveButtons)
      enhanceSelectsIn(wrapper)
      refreshEnhancedSelect(rolSelect)
      saveRol.addEventListener('click', () => {
        const next = String(rolSelect.value ?? '').trim()
        if (!next || next === String(current?.rol ?? '')) return
        onRequestRol?.(next)
      })
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

    syncSaveButtons()
  }

  async function submitIdentidad() {
    if (!identidadFormAlive() || identidadBusy) return
    const values = readIdentidad()
    const validation = fields?.validateAll({ submitted: true })
    if (validation?.hasErrors || !identidadChanged()) {
      syncSaveButtons()
      validation?.firstInvalid?.focus()
      return
    }

    identidadBusy = true
    syncSaveButtons()
    try {
      const outcome = await onRequestIdentidad?.(values)
      if (!wrapper.isConnected) return
      if (outcome?.status === 'error' && outcome.error?.status === 409) {
        correoServerError = USUARIO_CORREO_DUPLICADO
        fields?.markInteracted('correo')
        fields?.refresh('correo')
      }
    } finally {
      if (!wrapper.isConnected) return
      identidadBusy = false
      syncSaveButtons()
    }
  }

  function identidadFormAlive() {
    return Boolean(wrapper.isConnected && wrapper.querySelector('#usuario-edit-identidad'))
  }

  paint()

  return {
    element: wrapper,
    isDirty() {
      const rolSelect = wrapper.querySelector('[name="rol"]')
      const rolDirty = rolSelect ? String(rolSelect.value) !== String(current?.rol ?? '') : false
      return identidadChanged() || rolDirty
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
