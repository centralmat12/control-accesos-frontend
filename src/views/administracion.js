import {
  AGENTE_DESACTIVAR_CONFIRM,
  AGENTE_DESACTIVAR_MESSAGE,
  AGENTE_DESACTIVAR_TITLE,
  AGENTE_ROTAR_CONFIRM,
  AGENTE_ROTAR_MESSAGE,
  AGENTE_ROTAR_TITLE,
  AGENTE_SECRET_MODAL,
  createAgente,
  desactivarAgente,
  discardAgenteSecret,
  getAgentes,
  getLoadedAgenteClientIds,
  rotarSecretAgente,
} from '../api/agentes.js'
import { getCurrentUser, isPasswordChangeRequiredError, isSessionExpiredError } from '../api/auth.js'
import { getEmpresaContexto } from '../api/empresa-context.js'
import {
  createEmpresa,
  empresaDisplayName,
  getCachedEmpresaNombre,
  getEmpresas,
} from '../api/empresas.js'
import { createSucursal, getSucursales, updateSucursal } from '../api/sucursales.js'
import {
  actualizarIdentidadUsuario,
  cambiarEstadoUsuario,
  cambiarRolUsuario,
  completeUsuarioResetReveal,
  desbloquearUsuario,
  estadoCuentaUsuario,
  eliminarUsuario,
  cancelarInvitacionUsuario,
  estadoMfaUsuario,
  estadoPasswordUsuario,
  exigirMfaUsuario,
  filterUsuariosByOperador,
  getUsuarios,
  restablecerPasswordUsuario,
  createUsuario,
  invitarUsuario,
  reenviarInvitacionUsuario,
} from '../api/usuarios.js'
import {
  ADMIN_FIELD_CONTROL_CLASS,
  ADMIN_FILTER_GRID_CLASS,
  ADMIN_PAGE_CLASS,
  ADMIN_PRIMARY_BUTTON_CLASS,
  ADMIN_TABLE_FRAME_CLASS,
  ADMIN_TH_CLASS,
  adminSectionHeaderMarkup,
  createAdminEmptyState,
} from '../components/admin-panel-layout.js'
import { createDepartamentosAdmin } from '../components/departamentos-admin.js'
import { createTurnosPanel } from '../components/turnos-panel.js'
import { createCorreoSalientePanel } from '../components/correo-saliente-panel.js'
import { puedeAdministrarTurnos } from '../config/labor-access.js'
import { iconBuilding, iconChevronRight, iconMail, iconPlus, iconUserPlus } from '../components/icons.js'
import { actionButtonMarkup, BTN_SECONDARY_CLASS } from '../components/button-styles.js'
import { pageHeadingMarkup } from '../components/page-heading.js'
import {
  API_ENABLEMENT_HINT,
  USUARIO_ACCION_FUERA_DE_ALCANCE,
  USUARIOS_TABLE_CENTERED_COLUMNS,
  USUARIOS_TABLE_COLUMNS,
  empresaIdDeTenant,
  puedeAbrirNuevoUsuario,
  puedeAdministrarAgentes,
  puedeMostrarAltaDepartamento,
  puedeVerSeccionEmpresas,
  puedeCrearAgentes,
  puedeCrearEmpresas,
  puedeCrearSucursales,
  puedeDesactivarAgente,
  puedeEditarSucursales,
  puedeEditarUsuarioObjetivo,
  puedeListarUsuarios,
  puedeRotarSecretAgente,
} from '../config/administracion.js'
import { createAgenteForm } from '../components/agente-form.js'
import { createAgenteSecretPanel } from '../components/agente-secret-panel.js'
import { badgeHtml, employeeStatusBadge, featureStatusBadge } from '../components/badge.js'
import { createEmpresaForm } from '../components/empresa-form.js'
import { createFeedbackState } from '../components/feedback-state.js'
import { openConfirmModal, openFormModal, openModal } from '../components/modal.js'
import { createSucursalForm } from '../components/sucursal-form.js'
import { createTableSkeleton } from '../components/skeleton.js'
import { showToast } from '../components/toast.js'
import {
  PASSWORD_TEMPORAL_DISCARD_PROMPT,
  PASSWORD_TEMPORAL_MODAL,
  createPasswordTemporalPanel,
} from '../components/password-temporal-panel.js'
import {
  applyUsuarioEditSaves,
  createUsuarioEditPanel,
  openUsuarioEliminarConfirm,
  openUsuarioCancelarInvitacionConfirm,
  openUsuarioModificacionesConfirm,
  pintarTituloUsuario,
  USUARIO_EDIT_SUCCESS_MESSAGE,
  USUARIO_EDIT_TITLE,
  USUARIO_ELIMINAR_SUCCESS,
  USUARIO_CANCELAR_INVITACION_SUCCESS,
  USUARIO_REENVIAR_INVITACION_SUCCESS,
  USUARIO_REENVIAR_INVITACION_TITLE,
  usuarioEditIdentidadPayload,
  usuarioEditRolPayload,
  mfaIndicadorHtml,
  usuarioEstadoConfirmMessage,
  usuarioReenviarInvitacionMessage,
} from '../components/usuario-edit-panel.js'
import { createInvitacionForm, createUsuarioForm } from '../components/usuario-form.js'
import { isAdmin, isSuperadmin, puedeAdministrarCorreoSaliente, rolesAsignablesParaAlta, usuarioRolLabel } from '../config/roles.js'
import { displayValue, escapeHtml, formatApiDateTime } from '../utils/format.js'
import { createKeyedLock, createViewLifecycle, runLockedConfirmAction } from '../utils/view-guard.js'

const USUARIOS_COL_WIDTH = {
  Estado: 'w-44 min-w-44',
  MFA: 'w-48 min-w-48',
  'Cambio de clave': 'w-36 min-w-36',
  Bloqueo: 'w-36 min-w-36',
  Acciones: 'w-32 min-w-32',
}

export function usuariosColumnAlignClass(label) {
  return USUARIOS_TABLE_CENTERED_COLUMNS.includes(label) ? 'text-center' : 'text-left'
}

export function usuariosTableHeadMarkup(columns = USUARIOS_TABLE_COLUMNS) {
  return columns
    .map((label) => {
      const align = usuariosColumnAlignClass(label)
      const width = USUARIOS_COL_WIDTH[label] ?? ''
      return `<th scope="col" class="${ADMIN_TH_CLASS} ${align} ${width}">${escapeHtml(label)}</th>`
    })
    .join('')
}

export function usuarioFilaAccionesMarkup(operador, usuario) {
  if (!puedeEditarUsuarioObjetivo(operador, usuario)) {
    return '<div class="flex justify-center text-slate-400">—</div>'
  }

  return `<div class="flex flex-col items-center justify-center gap-1.5">
      ${actionButtonMarkup({
        label: 'Editar',
        ariaLabel: 'Editar usuario',
        attrs: `data-usuario-accion="editar" data-usuario-id="${usuario.id}"`,
        compact: true,
      })}
    </div>`
}

const CONTROL_CLASS =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'

const TAB_BASE =
  'inline-flex h-8 shrink-0 items-center whitespace-nowrap rounded-lg px-2.5 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500'
const TAB_ACTIVE = 'bg-blue-600 text-white'
const TAB_IDLE = 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'

const SECTIONS = {
  usuarios: 'usuarios',
  empresas: 'empresas',
  departamentos: 'departamentos',
  turnos: 'turnos',
  correo: 'correo',
}

function readAdminTab() {
  const hash = String(globalThis.location?.hash ?? '')
  const query = hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : ''
  return new URLSearchParams(query).get('tab') || ''
}

function writeAdminTab(section) {
  const hash = section && section !== SECTIONS.usuarios ? `#/administracion?tab=${section}` : '#/administracion'
  if ((globalThis.location?.hash || '') === hash) return
  globalThis.history?.replaceState?.({ view: 'administracion', tab: section }, '', hash)
}

function matchesQuery(empresa, query) {
  if (!query) return true
  const haystack = [empresaDisplayName(empresa), empresa.razonSocial, empresa.cuit, empresa.id]
    .join(' ')
    .toLowerCase()
  return haystack.includes(query)
}

function altaOpcionClass() {
  return [
    'flex w-full transform-none cursor-pointer items-center gap-3 rounded-xl border border-[#e2e8f0] bg-[#ffffff] p-3 text-left hover:transform-none',
    'transition-[background-color,border-color,box-shadow] duration-150',
    'hover:border-blue-300 hover:bg-[#f4f8ff] hover:shadow-[0_4px_10px_-6px_rgba(37,99,235,0.55)]',
    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500',
    'dark:border-slate-600 dark:bg-slate-800',
    'dark:hover:border-blue-400 dark:hover:bg-slate-700',
    'dark:hover:shadow-[0_4px_10px_-6px_rgba(96,165,250,0.55)]',
    'dark:focus-visible:outline-blue-400',
  ].join(' ')
}

function altaIconoClass() {
  return 'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'
}

function createActionControl({ id, label, enabled, disabledMessage = '' }) {
  if (enabled) {
    return `
      <button
        type="button"
        id="${id}"
        class="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 sm:w-auto"
      >
        ${iconPlus('h-4 w-4')}<span>${escapeHtml(label)}</span>
      </button>
    `
  }

  return `
    <div class="flex flex-col items-stretch gap-1.5 sm:items-end">
      <button
        type="button"
        id="${id}"
        disabled
        aria-disabled="true"
        title="${escapeHtml(disabledMessage || API_ENABLEMENT_HINT)}"
        class="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
      >
        ${iconPlus('h-4 w-4')}<span>${escapeHtml(label)}</span>
      </button>
      ${
        disabledMessage
          ? `<p class="text-xs text-slate-500">${escapeHtml(disabledMessage)}</p>`
          : featureStatusBadge('apiEnable')
      }
    </div>
  `
}

export async function renderAdministracion(container) {
  const user = getCurrentUser()
  const canCreateUsuarios = puedeAbrirNuevoUsuario(user)
  const canCreateEmpresas = puedeCrearEmpresas(user)
  const canViewEmpresasSection = puedeVerSeccionEmpresas(user)
  const canViewDepartamentosSection = puedeMostrarAltaDepartamento(user)
  const canListUsuarios = puedeListarUsuarios(user)
  const tenantEmpresaId = empresaIdDeTenant(user)
  const usuarioDisabledMessage =
    isAdmin(user) && !tenantEmpresaId
      ? 'La sesión ADMIN no incluye una empresa válida.'
      : API_ENABLEMENT_HINT
  const view = document.createElement('div')
  view.className = ADMIN_PAGE_CLASS

  view.innerHTML = `
    ${pageHeadingMarkup({
      title: 'Administración de la organización',
      description: 'Gestioná los accesos y la estructura de la empresa.',
    })}
    <div class="inline-flex w-fit max-w-full flex-wrap gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-slate-700 dark:bg-slate-800/60" role="tablist" aria-label="Secciones de administración">
      <button type="button" data-section="${SECTIONS.usuarios}" role="tab" class="${TAB_BASE}">
        Usuarios
      </button>
      ${
        canViewEmpresasSection
          ? `<button type="button" data-section="${SECTIONS.empresas}" role="tab" class="${TAB_BASE}">
        Empresas
      </button>`
          : ''
      }
      ${
        canViewDepartamentosSection
          ? `<button type="button" data-section="${SECTIONS.departamentos}" role="tab" class="${TAB_BASE}">
        Departamentos
      </button>`
          : ''
      }
      ${
        puedeAdministrarTurnos(user)
          ? `<button type="button" data-section="${SECTIONS.turnos}" role="tab" class="${TAB_BASE}">
        Turnos de trabajo
      </button>`
          : ''
      }
      ${
        puedeAdministrarCorreoSaliente(user)
          ? `<button type="button" data-section="${SECTIONS.correo}" role="tab" class="${TAB_BASE}">
        Correo
      </button>`
          : ''
      }
    </div>
    <div id="admin-panel"></div>
  `

  const panel = view.querySelector('#admin-panel')
  const tabButtons = [...view.querySelectorAll('[data-section]')]
  let section = SECTIONS.usuarios
  let selectedEmpresa = null
  let selectedSucursal = null
  let empresas = []
  let sucursales = []
  let agentes = []
  let usuarios = []
  let usuariosLoaded = false
  let usuariosError = false
  let usuariosErrorMessage = 'Ocurrió un error al consultar la API.'
  let empresasLoaded = false
  let empresasError = false
  let empresasErrorMessage = 'Ocurrió un error al consultar la API.'
  let sucursalesLoaded = false
  let sucursalesError = false
  let sucursalesErrorMessage = 'Ocurrió un error al consultar la API.'
  let agentesLoaded = false
  let agentesError = false
  let agentesErrorMessage = 'Ocurrió un error al consultar la API.'
  let empresaQuery = ''
  let usuarioQuery = ''
  let usuarioRol = ''
  let usuarioEstado = ''
  let usuarioMfa = ''
  let activeModalClose = null
  let secretHolder = null
  let passwordTemporalOpen = false
  let usuarioEditPanel = null
  let usuarioEditPaintTitle = null
  let usuariosRequestId = 0
  const life = createViewLifecycle()
  const usuarioAccionLock = createKeyedLock()
  const listenerAbort = new AbortController()

  function isViewAlive() {
    return life.isAlive()
  }

  function viewToast(options) {
    if (!isViewAlive()) return
    showToast(options)
  }

  function closeActiveModal(options) {
    activeModalClose?.(options)
  }

  function clearSecretHolder() {
    if (secretHolder) {
      secretHolder.discard?.()
      discardAgenteSecret(secretHolder)
      secretHolder = null
    }
    passwordTemporalOpen = false
  }

  function resolveSection(next) {
    if (next === SECTIONS.empresas && !canViewEmpresasSection) return SECTIONS.usuarios
    if (next === SECTIONS.departamentos && !canViewDepartamentosSection) return SECTIONS.usuarios
    if (next === SECTIONS.turnos && !puedeAdministrarTurnos(user)) return SECTIONS.usuarios
    if (next === SECTIONS.correo && !puedeAdministrarCorreoSaliente(user)) return SECTIONS.usuarios
    if (next === SECTIONS.empresas || next === SECTIONS.departamentos || next === SECTIONS.turnos || next === SECTIONS.correo) return next
    return SECTIONS.usuarios
  }

  function setSection(next) {
    if (!isViewAlive()) return
    section = resolveSection(next)
    writeAdminTab(section)
    disposeDepartamentos()
    disposeTurnos()
    disposeCorreo()
    if (section !== SECTIONS.empresas) {
      selectedEmpresa = null
      selectedSucursal = null
    }
    tabButtons.forEach((button) => {
      const active = button.dataset.section === section
      button.className = `${TAB_BASE} ${active ? TAB_ACTIVE : TAB_IDLE}`
      button.setAttribute('aria-selected', String(active))
    })
    renderPanel()
    if (section === SECTIONS.usuarios && canListUsuarios) {
      if (!usuariosLoaded) void loadUsuarios()
      // Nombres de empresa para el listado global de SuperAdmin.
      if (isSuperadmin(user) && !empresasLoaded) void loadEmpresas({ silent: true })
    }
    if (section === SECTIONS.empresas && canViewEmpresasSection && !selectedEmpresa && !empresasLoaded) {
      void loadEmpresas()
    }
  }

  let departamentosAdmin = null

  function disposeDepartamentos() {
    departamentosAdmin?.dispose()
    departamentosAdmin = null
  }

  let turnosPanel = null

  function disposeTurnos() {
    turnosPanel = null
  }

  function renderTurnos() {
    panel.replaceChildren()
    turnosPanel = createTurnosPanel()
    panel.append(turnosPanel)
  }

  let correoPanel = null

  function disposeCorreo() {
    correoPanel?.dispose?.()
    correoPanel = null
  }

  function renderCorreo() {
    panel.replaceChildren()
    correoPanel = createCorreoSalientePanel()
    panel.append(correoPanel)
  }

  function renderPanel() {
    if (section === SECTIONS.correo && puedeAdministrarCorreoSaliente(user)) {
      renderCorreo()
      return
    }
    if (section === SECTIONS.turnos && puedeAdministrarTurnos(user)) {
      renderTurnos()
      return
    }
    if (section === SECTIONS.departamentos && canViewDepartamentosSection) {
      renderDepartamentos()
      return
    }
    if (section !== SECTIONS.empresas || !canViewEmpresasSection) {
      renderUsuarios()
      return
    }
    if (selectedSucursal) {
      renderAgentesAdmin()
      return
    }
    if (selectedEmpresa) {
      renderEmpresaDetail()
      return
    }
    renderEmpresasList()
  }

  function empresaSeleccionadaId() {
    if (isSuperadmin(user)) return getEmpresaContexto()?.id ?? null
    return tenantEmpresaId
  }

  function empresaLabel(empresaId) {
    const id = Number(empresaId)
    if (!Number.isFinite(id) || id <= 0) return '—'

    const conocida = empresas.find((empresa) => Number(empresa.id) === id)
    const nombreConocido = conocida ? empresaDisplayName(conocida) : ''
    if (nombreConocido) return nombreConocido

    const contexto = getEmpresaContexto()
    if (contexto && Number(contexto.id) === id && contexto.nombre) return contexto.nombre

    if (!isSuperadmin(user) && id === tenantEmpresaId) {
      const cache = getCachedEmpresaNombre(user)
      if (cache) return cache
    }

    return `ID ${id}`
  }

  function usuariosFiltrados(visibles) {
    const query = usuarioQuery.trim().toLowerCase()
    return visibles.filter((usuario) => {
      if (usuarioRol && String(usuario.rol) !== usuarioRol) return false
      if (usuarioEstado && estadoCuentaUsuario(usuario) !== usuarioEstado) return false
      if (usuarioMfa && estadoMfaUsuario(usuario) !== usuarioMfa) return false
      if (!query) return true
      const texto = `${usuario.nombreUsuario ?? ''} ${usuario.correo ?? ''}`.toLowerCase()
      return texto.includes(query)
    })
  }

  function usuariosFiltroActivo() {
    return Boolean(usuarioQuery.trim() || usuarioRol || usuarioEstado || usuarioMfa)
  }

  function renderUsuarios() {
    const roles = [...new Set(filterUsuariosByOperador(usuarios, user).map((usuario) => usuario.rol).filter(Boolean))]
    panel.innerHTML = `
      <div class="space-y-4">
        ${adminSectionHeaderMarkup({
          titleId: 'admin-usuarios-title',
          title: 'Usuarios',
          description: 'Administrá los accesos, roles y estados.',
          actionHtml: createActionControl({
            id: 'admin-usuario-new',
            label: 'Nuevo usuario',
            enabled: canCreateUsuarios,
            disabledMessage: usuarioDisabledMessage,
          }),
        })}
        <div class="grid items-end gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(12rem,1.4fr)_repeat(3,minmax(8.5rem,0.8fr))_auto]">
          <div class="min-w-0">
            <label for="admin-usuarios-search" class="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Buscar</label>
            <input id="admin-usuarios-search" type="search" placeholder="Usuario o correo" class="${CONTROL_CLASS} ${ADMIN_FIELD_CONTROL_CLASS}" />
          </div>
          <div class="min-w-0" data-usuarios-rol>
            <label for="admin-usuarios-rol" class="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Rol</label>
            <select id="admin-usuarios-rol" class="${CONTROL_CLASS} ${ADMIN_FIELD_CONTROL_CLASS}">
              <option value="">Todos</option>
              ${roles.map((rol) => `<option value="${escapeHtml(rol)}">${escapeHtml(usuarioRolLabel(rol))}</option>`).join('')}
            </select>
          </div>
          <div class="min-w-0">
            <label for="admin-usuarios-estado" class="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Estado</label>
            <select id="admin-usuarios-estado" class="${CONTROL_CLASS} ${ADMIN_FIELD_CONTROL_CLASS}">
              <option value="">Todos</option>
              <option value="Activo">Activo</option>
              <option value="Inactivo">Inactivo</option>
              <option value="Invitación pendiente">Invitación pendiente</option>
              <option value="Bloqueado">Bloqueado</option>
            </select>
          </div>
          <div class="min-w-0">
            <label for="admin-usuarios-mfa" class="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">MFA</label>
            <select id="admin-usuarios-mfa" class="${CONTROL_CLASS} ${ADMIN_FIELD_CONTROL_CLASS}">
              <option value="">Todos</option>
              <option value="Con MFA">Con MFA</option>
              <option value="Sin MFA">Sin MFA</option>
              <option value="Configuración pendiente">Configuración pendiente</option>
              <option value="No disponible">No disponible</option>
            </select>
          </div>
          <button type="button" id="admin-usuarios-clear" class="${BTN_SECONDARY_CLASS} h-10 self-end">Limpiar</button>
        </div>
        <div id="admin-usuarios-state"></div>
      </div>
    `
    const search = panel.querySelector('#admin-usuarios-search')
    const rol = panel.querySelector('#admin-usuarios-rol')
    const estado = panel.querySelector('#admin-usuarios-estado')
    const mfa = panel.querySelector('#admin-usuarios-mfa')
    const clear = panel.querySelector('#admin-usuarios-clear')
    search.value = usuarioQuery
    rol.value = usuarioRol
    estado.value = usuarioEstado
    mfa.value = usuarioMfa
    const syncClear = () => {
      clear.disabled = !usuariosFiltroActivo()
    }
    search.addEventListener('input', () => {
      usuarioQuery = search.value
      syncClear()
      paintUsuariosResults()
    }, { signal: listenerAbort.signal })
    rol.addEventListener('change', () => {
      usuarioRol = rol.value
      syncClear()
      paintUsuariosResults()
    }, { signal: listenerAbort.signal })
    estado.addEventListener('change', () => {
      usuarioEstado = estado.value
      syncClear()
      paintUsuariosResults()
    }, { signal: listenerAbort.signal })
    mfa.addEventListener('change', () => {
      usuarioMfa = mfa.value
      syncClear()
      paintUsuariosResults()
    }, { signal: listenerAbort.signal })
    clear.addEventListener('click', () => {
      usuarioQuery = ''
      usuarioRol = ''
      usuarioEstado = ''
      usuarioMfa = ''
      search.value = ''
      for (const control of [rol, estado, mfa]) {
        control.value = ''
        control._caSelect?.refresh()
      }
      syncClear()
      paintUsuariosResults()
    }, { signal: listenerAbort.signal })
    syncClear()
    if (canCreateUsuarios) {
      panel.querySelector('#admin-usuario-new')?.addEventListener('click', openUsuarioCreate, {
        signal: listenerAbort.signal,
      })
    }
    panel.querySelector('#admin-usuarios-state')?.addEventListener('click', onUsuarioAccionClick, {
      signal: listenerAbort.signal,
    })
    paintUsuariosResults()
  }

  function cuentaEstadoMarkup(usuario) {
    const estado = estadoCuentaUsuario(usuario)
    const badge =
      estado === 'Bloqueado'
        ? badgeHtml('Bloqueado', 'danger')
        : estado === 'Invitación pendiente'
          ? badgeHtml('Invitación pendiente', 'warning')
        : estado === 'Inactivo'
          ? badgeHtml('Inactivo', 'danger')
          : badgeHtml('Activo', 'success')

    return `<div class="flex justify-center">${badge}</div>`
  }

  function bloqueoEstadoMarkup(usuario) {
    const estado = estadoCuentaUsuario(usuario)
    if (estado !== 'Bloqueado') {
      return '<div class="flex justify-center text-slate-400">—</div>'
    }
    const hasta = formatApiDateTime(usuario.bloqueadoHasta)
    return `
      <div class="flex flex-col items-center justify-center gap-1 text-center">
        <p class="text-xs font-medium text-slate-700 dark:text-slate-300">${hasta ? `Hasta ${escapeHtml(hasta)}` : 'Bloqueado'}</p>
      </div>
    `
  }

  function passwordEstadoMarkup(usuario) {
  return estadoPasswordUsuario(usuario) === 'Cambio requerido'
    ? badgeHtml('Cambio requerido', 'warning')
    : badgeHtml('No requerido', 'neutral')
}

  function usuarioAccionesMarkup(usuario) {
    return usuarioFilaAccionesMarkup(user, usuario)
  }

  function ignoreClosedSession(error) {
    return isSessionExpiredError(error) || isPasswordChangeRequiredError(error)
  }

  function paintUsuariosResults() {
    if (!isViewAlive() || passwordTemporalOpen) return
    const results = panel.querySelector('#admin-usuarios-state')
    if (!results) return

    if (!canListUsuarios) {
      results.replaceChildren(
        createFeedbackState({
          title: 'Sin permisos para ver usuarios',
          message: 'Tu sesión no tiene permisos para consultar los usuarios del panel.',
        }),
      )
      return
    }

    if (!usuariosLoaded) {
      results.replaceChildren(
        createTableSkeleton({
          rows: 5,
          columns: USUARIOS_TABLE_COLUMNS.length,
          label: 'Cargando usuarios',
        }),
      )
      return
    }

    if (usuariosError) {
      results.replaceChildren(
        createFeedbackState({
          title: 'No se pudieron cargar los usuarios',
          message: usuariosErrorMessage,
          tone: 'error',
          actionLabel: 'Reintentar',
          onAction: () => loadUsuarios(),
        }),
      )
      return
    }

    const visibles = filterUsuariosByOperador(usuarios, user)
    const filtrados = usuariosFiltrados(visibles)
    const rolField = panel.querySelector('[data-usuarios-rol]')
    const rolSelect = panel.querySelector('#admin-usuarios-rol')
    const roles = [...new Set(visibles.map((usuario) => usuario.rol).filter(Boolean))]
    if (rolField && rolSelect) {
      rolField.hidden = roles.length === 0
      const selected = usuarioRol
      rolSelect.innerHTML = `<option value="">Todos</option>${roles
        .map((rol) => `<option value="${escapeHtml(rol)}">${escapeHtml(usuarioRolLabel(rol))}</option>`)
        .join('')}`
      rolSelect.value = roles.includes(selected) ? selected : ''
      if (rolSelect.value !== selected) usuarioRol = rolSelect.value
    }

    if (visibles.length === 0) {
      results.replaceChildren(
        createAdminEmptyState({
          title: 'No hay usuarios',
          detail: 'Todavía no hay registros disponibles.',
          actionLabel: canCreateUsuarios ? '+ Nuevo usuario' : '',
          onAction: canCreateUsuarios ? openUsuarioCreate : undefined,
        }),
      )
      return
    }

    if (filtrados.length === 0) {
      results.replaceChildren(
        createAdminEmptyState({
          title: 'No encontramos resultados',
          detail: 'Probá cambiar o limpiar los filtros aplicados.',
          actionLabel: 'Limpiar filtros',
          onAction: () => panel.querySelector('#admin-usuarios-clear')?.click(),
        }),
      )
      return
    }

    const sectionEl = document.createElement('section')
    sectionEl.className = ADMIN_TABLE_FRAME_CLASS
    sectionEl.innerHTML = `
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
          <thead class="bg-slate-50 dark:bg-slate-800">
            <tr>
              ${usuariosTableHeadMarkup()}
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
            ${filtrados
              .map(
                (usuario) => `
                  <tr class="h-12 hover:bg-slate-50 dark:hover:bg-slate-800/60">
                    <td class="whitespace-nowrap px-3 py-2 text-left text-sm font-medium text-slate-900 dark:text-slate-100">${displayValue(usuario.nombreUsuario)}</td>
                    <td class="whitespace-nowrap px-3 py-2 text-left text-sm text-slate-600 dark:text-slate-300">${displayValue(usuario.correo)}</td>
                    <td class="whitespace-nowrap px-3 py-2 text-left text-sm text-slate-600 dark:text-slate-300">${escapeHtml(usuarioRolLabel(usuario.rol))}</td>
                    <td class="whitespace-nowrap px-3 py-2 text-left text-sm text-slate-600 dark:text-slate-300">${displayValue(empresaLabel(usuario.empresaId))}</td>
                    <td class="w-44 min-w-44 whitespace-nowrap px-3 py-2 text-center text-sm">${cuentaEstadoMarkup(usuario)}</td>
                    <td class="w-48 min-w-48 whitespace-nowrap px-3 py-2 text-center text-sm"><div class="flex justify-center">${mfaIndicadorHtml(usuario)}</div></td>
                    <td class="w-36 min-w-36 whitespace-nowrap px-3 py-2 text-center text-sm"><div class="flex justify-center">${passwordEstadoMarkup(usuario)}</div></td>
                    <td class="w-36 min-w-36 whitespace-nowrap px-3 py-2 text-center text-sm">${bloqueoEstadoMarkup(usuario)}</td>
                    <td class="w-32 min-w-32 px-3 py-2 text-center text-sm">${usuarioAccionesMarkup(usuario)}</td>
                  </tr>
                `,
              )
              .join('')}
          </tbody>
        </table>
      </div>
    `
    results.replaceChildren(sectionEl)
    applyUsuarioAccionBusy()
  }

  async function loadUsuarios() {
    if (!canListUsuarios || !isViewAlive() || passwordTemporalOpen) return
    const requestId = ++usuariosRequestId
    usuariosLoaded = false
    usuariosError = false
    paintUsuariosResults()
    try {
      const resultado = await getUsuarios({ empresaId: empresaSeleccionadaId() })
      if (!isViewAlive() || requestId !== usuariosRequestId || passwordTemporalOpen) return
      usuarios = resultado
      usuariosLoaded = true
      usuariosError = false
    } catch (error) {
      if (!isViewAlive() || requestId !== usuariosRequestId) return
      if (ignoreClosedSession(error)) return
      usuarios = []
      usuariosLoaded = true
      usuariosError = true
      usuariosErrorMessage =
        error.status === 403
          ? 'No tenés permisos para consultar usuarios.'
          : error.message || 'No se pudieron cargar los usuarios.'
      viewToast({ message: usuariosErrorMessage, tone: 'error' })
    }
    if (!isViewAlive() || passwordTemporalOpen) return
    paintUsuariosResults()
    syncUsuarioEditPanel()
  }

  function applyUsuarioAccionBusy() {
    if (!isViewAlive()) return
    const roots = [panel.querySelector('#admin-usuarios-state'), usuarioEditPanel?.element].filter(Boolean)
    roots.forEach((root) => {
      root.querySelectorAll('[data-usuario-accion][data-usuario-id]').forEach((button) => {
        const key = usuarioAccionLock.key(button.dataset.usuarioAccion, button.dataset.usuarioId)
        button.disabled = usuarioAccionLock.has(key)
      })
    })
    usuarioEditPanel?.syncSaveButtons?.()
    roots.forEach((root) => {
      root.querySelectorAll('[data-usuario-accion][data-usuario-id]').forEach((button) => {
        const key = usuarioAccionLock.key(button.dataset.usuarioAccion, button.dataset.usuarioId)
        if (usuarioAccionLock.has(key)) button.disabled = true
      })
    })
  }

  function syncUsuarioEditPanel() {
    if (!isViewAlive() || !usuarioEditPanel) return
    const actual = usuarioEditPanel.getUsuario()
    const next = usuarios.find((item) => Number(item.id) === Number(actual?.id))
    if (!next) {
      closeActiveModal({ force: true })
      return
    }
    usuarioEditPanel.update(next)
    usuarioEditPaintTitle?.(next)
    applyUsuarioAccionBusy()
  }

  function showPasswordTemporalPanel({ nombreUsuario, passwordTemporal, venceEn }) {
    return new Promise((resolve) => {
      if (!isViewAlive()) {
        resolve()
        return
      }

      clearSecretHolder()
      const panelSecret = createPasswordTemporalPanel({
        nombreUsuario,
        passwordTemporal,
        venceEn,
        onClose: () => closeActiveModal({ force: true }),
      })
      secretHolder = panelSecret
      passwordTemporalOpen = true
      const modal = openModal({
        title: 'Contraseña temporal',
        content: panelSecret.element,
        labelledBy: 'usuario-password-temporal-title',
        ...PASSWORD_TEMPORAL_MODAL,
        isDirty: () => panelSecret.hasVisibleSecret(),
        discardPrompt: PASSWORD_TEMPORAL_DISCARD_PROMPT,
        onClose: () => {
          panelSecret.discard()
          if (secretHolder === panelSecret) secretHolder = null
          passwordTemporalOpen = false
          activeModalClose = null
          resolve()
        },
      })
      activeModalClose = modal.close
    })
  }

  async function confirmarRestablecer(usuario) {
    const key = usuarioAccionLock.key('restablecer', usuario.id)
    const outcome = await runLockedConfirmAction({
      lock: usuarioAccionLock,
      key,
      isAlive: isViewAlive,
      onLockChange: () => applyUsuarioAccionBusy(),
      confirm: () =>
        openConfirmModal({
          title: 'Restablecer contraseña',
          message: `Se generará una contraseña temporal para ${usuario.nombreUsuario}. Las sesiones anteriores quedarán invalidadas y deberá cambiar la contraseña en el próximo ingreso.`,
          confirmLabel: 'Restablecer',
        }),
      execute: () =>
        restablecerPasswordUsuario(usuario.id, {
          empresaId: empresaSeleccionadaId(),
        }),
    })

    if (outcome.status === 'busy' || outcome.status === 'cancelled' || outcome.status === 'confirm-error') {
      return
    }

    if (outcome.status === 'error') {
      if (!isViewAlive()) return
      if (ignoreClosedSession(outcome.error)) return
      viewToast({
        message:
          outcome.error?.status === 404 || outcome.error?.status === 403
            ? USUARIO_ACCION_FUERA_DE_ALCANCE
            : outcome.error?.message || 'No se pudo restablecer la contraseña.',
        tone: 'error',
      })
      return
    }

    await completeUsuarioResetReveal({
      result: outcome.result,
      isAlive: isViewAlive,
      reveal: async (taken) => {
        if (usuarioEditPanel) closeActiveModal({ force: true })
        if (!isViewAlive()) return
        await showPasswordTemporalPanel({
          nombreUsuario: usuario.nombreUsuario,
          passwordTemporal: taken.passwordTemporal,
          venceEn: taken.venceEn,
        })
      },
      refresh: loadUsuarios,
    })
  }

  async function confirmarDesbloquear(usuario) {
    const key = usuarioAccionLock.key('desbloquear', usuario.id)
    const outcome = await runLockedConfirmAction({
      lock: usuarioAccionLock,
      key,
      isAlive: isViewAlive,
      onLockChange: () => applyUsuarioAccionBusy(),
      confirm: () =>
        openConfirmModal({
          title: 'Desbloquear cuenta',
          message: `Se desbloqueará a ${usuario.nombreUsuario}. Esta acción no cambia la contraseña.`,
          confirmLabel: 'Desbloquear',
        }),
      execute: () => desbloquearUsuario(usuario.id, { empresaId: empresaSeleccionadaId() }),
    })

    if (outcome.status === 'busy' || outcome.status === 'cancelled' || outcome.status === 'confirm-error') {
      return
    }

    if (outcome.status === 'error') {
      if (!isViewAlive()) return
      if (ignoreClosedSession(outcome.error)) return
      viewToast({
        message:
          outcome.error?.status === 404 || outcome.error?.status === 403
            ? USUARIO_ACCION_FUERA_DE_ALCANCE
            : outcome.error?.message || 'No se pudo desbloquear la cuenta.',
        tone: 'error',
      })
      return
    }

    if (outcome.status !== 'ok' || !isViewAlive()) return
    viewToast({ message: 'Cuenta desbloqueada.', tone: 'success' })
    await loadUsuarios()
  }

  function handleUsuarioAccionError(error, fallback) {
    if (!isViewAlive()) return
    if (ignoreClosedSession(error)) return
    viewToast({
      message:
        error?.status === 404 || error?.status === 403
          ? USUARIO_ACCION_FUERA_DE_ALCANCE
          : error?.message || fallback,
      tone: 'error',
    })
  }

  async function confirmarEliminar(usuario, panelEdit) {
    const key = usuarioAccionLock.key('eliminar', usuario.id)
    if (!usuarioAccionLock.acquire(key)) return { status: 'busy' }
    applyUsuarioAccionBusy()
    try {
      if (!isViewAlive()) return { status: 'disposed' }
      const outcome = await openUsuarioEliminarConfirm({
        nombre: usuario.nombreUsuario,
        execute: () => eliminarUsuario(usuario.id, { empresaId: empresaSeleccionadaId() }),
      })
      if (outcome.status === 'cancelled' || !isViewAlive()) return outcome
      if (outcome.status !== 'ok') {
        panelEdit.showEliminarError?.(outcome.error?.message || 'No se pudo eliminar la cuenta.')
        return outcome
      }
      viewToast({ message: USUARIO_ELIMINAR_SUCCESS, tone: 'success' })
      await loadUsuarios()
      return outcome
    } catch (error) {
      panelEdit.showEliminarError?.(error?.message || 'No se pudo eliminar la cuenta.')
      handleUsuarioAccionError(error, 'No se pudo eliminar la cuenta.')
    } finally {
      usuarioAccionLock.release(key)
      applyUsuarioAccionBusy()
    }
  }

  async function confirmarCancelarInvitacion(usuario, panelEdit) {
    const key = usuarioAccionLock.key('cancelar-invitacion', usuario.id)
    if (!usuarioAccionLock.acquire(key)) return { status: 'busy' }
    applyUsuarioAccionBusy()
    try {
      if (!isViewAlive()) return { status: 'disposed' }
      const outcome = await openUsuarioCancelarInvitacionConfirm({
        nombre: usuario.nombreUsuario,
        execute: () => cancelarInvitacionUsuario(usuario.id, { empresaId: empresaSeleccionadaId() }),
      })
      if (outcome.status === 'cancelled' || !isViewAlive()) return outcome
      if (outcome.status !== 'ok') {
        panelEdit.showEliminarError?.(outcome.error?.message || 'No se pudo cancelar la invitación.')
        return outcome
      }
      closeActiveModal({ force: true })
      viewToast({ message: USUARIO_CANCELAR_INVITACION_SUCCESS, tone: 'success' })
      await loadUsuarios()
      return outcome
    } catch (error) {
      panelEdit.showEliminarError?.(error?.message || 'No se pudo cancelar la invitación.')
      handleUsuarioAccionError(error, 'No se pudo cancelar la invitación.')
    } finally {
      usuarioAccionLock.release(key)
      applyUsuarioAccionBusy()
    }
  }

  async function confirmarReenviarInvitacion(usuario) {
    const key = usuarioAccionLock.key('reenviar-invitacion', usuario.id)
    const outcome = await runLockedConfirmAction({
      lock: usuarioAccionLock,
      key,
      isAlive: isViewAlive,
      onLockChange: () => applyUsuarioAccionBusy(),
      confirm: () =>
        openModalConfirmacionAzul({
          title: USUARIO_REENVIAR_INVITACION_TITLE,
          message: usuarioReenviarInvitacionMessage(usuario.nombreUsuario),
          confirmLabel: USUARIO_REENVIAR_INVITACION_TITLE,
        }),
      execute: () => reenviarInvitacionUsuario(usuario.id, { empresaId: empresaSeleccionadaId() }),
    })

    if (outcome.status === 'busy' || outcome.status === 'cancelled' || outcome.status === 'confirm-error') {
      return
    }

    if (outcome.status === 'error') {
      handleUsuarioAccionError(outcome.error, 'No se pudo reenviar la invitación.')
      return
    }

    if (outcome.status !== 'ok' || !isViewAlive()) return
    viewToast({ message: outcome.result?.mensaje || USUARIO_REENVIAR_INVITACION_SUCCESS, tone: 'success' })
    await loadUsuarios()
  }

  function openModalConfirmacionAzul({ title, message, confirmLabel }) {
    return new Promise((resolve) => {
      let settled = false
      const content = document.createElement('div')
      const text = document.createElement('p')
      text.className = 'text-sm text-slate-600 dark:text-slate-300'
      text.textContent = message
      const actions = document.createElement('div')
      actions.className = 'mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end'
      const cancel = document.createElement('button')
      cancel.type = 'button'
      cancel.dataset.autofocus = 'true'
      cancel.className = BTN_SECONDARY_CLASS
      cancel.textContent = 'Cancelar'
      const confirm = document.createElement('button')
      confirm.type = 'button'
      confirm.className = 'rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500'
      confirm.textContent = confirmLabel
      actions.append(cancel, confirm)
      content.append(text, actions)
      const finish = (value) => {
        if (settled) return
        settled = true
        modal.close({ force: true })
        resolve(value)
      }
      const modal = openModal({
        title,
        content,
        labelledBy: 'usuario-reenviar-title',
        stacked: true,
        closeOnBackdrop: false,
        unsavedChanges: false,
        onClose: () => {
          if (!settled) resolve(false)
        },
      })
      cancel.addEventListener('click', () => finish(false))
      confirm.addEventListener('click', () => finish(true))
    })
  }

  async function confirmarCambioEstado(usuario, activo) {
    const key = usuarioAccionLock.key('estado', usuario.id)
    const outcome = await runLockedConfirmAction({
      lock: usuarioAccionLock,
      key,
      isAlive: isViewAlive,
      onLockChange: () => applyUsuarioAccionBusy(),
      confirm: () =>
        openConfirmModal({
          title: activo ? 'Reactivar usuario' : 'Desactivar usuario',
          message: usuarioEstadoConfirmMessage(activo),
          confirmLabel: activo ? 'Reactivar usuario' : 'Desactivar usuario',
        }),
      execute: () => cambiarEstadoUsuario(usuario.id, activo, { empresaId: empresaSeleccionadaId() }),
    })

    if (outcome.status === 'busy' || outcome.status === 'cancelled' || outcome.status === 'confirm-error') {
      return
    }

    if (outcome.status === 'error') {
      handleUsuarioAccionError(outcome.error, 'No se pudo actualizar el estado del usuario.')
      return
    }

    if (outcome.status !== 'ok' || !isViewAlive()) return
    viewToast({ message: outcome.result?.mensaje || 'Usuario actualizado correctamente.', tone: 'success' })
    await loadUsuarios()
  }

  async function confirmarModificaciones(usuario, changes) {
    if (!Array.isArray(changes) || changes.length === 0) return { status: 'cancelled' }

    const key = usuarioAccionLock.key('guardar', usuario.id)
    if (!usuarioAccionLock.acquire(key)) return { status: 'busy' }
    applyUsuarioAccionBusy()

    try {
      if (!isViewAlive()) return { status: 'disposed' }

      const outcome = await openUsuarioModificacionesConfirm({
        changes,
        execute: () =>
          applyUsuarioEditSaves({
            changes,
            saveIdentidad: () =>
              actualizarIdentidadUsuario(
                usuario.id,
                usuarioEditIdentidadPayload(usuario, changes),
                { empresaId: empresaSeleccionadaId() },
              ),
            saveRol: () =>
              cambiarRolUsuario(usuario.id, usuarioEditRolPayload(changes), {
                empresaId: empresaSeleccionadaId(),
              }),
            saveEstado: () =>
              cambiarEstadoUsuario(usuario.id, false, { empresaId: empresaSeleccionadaId() }),
            saveMfa: () => exigirMfaUsuario(usuario.id, { empresaId: empresaSeleccionadaId() }),
          }),
        onAfterAttempt: async (summary) => {
          if (!isViewAlive()) return
          if (summary?.status === 'ok') {
            viewToast({ message: USUARIO_EDIT_SUCCESS_MESSAGE, tone: 'success' })
          }
          await loadUsuarios()
        },
      })

      if (outcome.status !== 'ok' || !isViewAlive()) return outcome
      return outcome
    } finally {
      usuarioAccionLock.release(key)
      applyUsuarioAccionBusy()
    }
  }

  function openUsuarioEdit(usuario) {
    if (!isViewAlive() || passwordTemporalOpen) return
    if (!puedeEditarUsuarioObjetivo(user, usuario)) return

    closeActiveModal({ force: true })
    let modal
    const panelEdit = createUsuarioEditPanel({
      usuario,
      operador: user,
      empresaLabel: empresaLabel(usuario.empresaId),
      onRequestClose: () => modal?.close(),
      onRequestSave: (changes) => {
        const actual = panelEdit.getUsuario()
        return confirmarModificaciones(actual, changes)
      },
      onRequestEstado: (activo) => {
        const actual = panelEdit.getUsuario()
        void confirmarCambioEstado(actual, activo)
      },
      onRequestRestablecer: () => {
        const actual = panelEdit.getUsuario()
        void confirmarRestablecer(actual)
      },
      onRequestDesbloquear: () => {
        const actual = panelEdit.getUsuario()
        void confirmarDesbloquear(actual)
      },
      onRequestEliminar: () => {
        const actual = panelEdit.getUsuario()
        return confirmarEliminar(actual, panelEdit)
      },
      onRequestCancelarInvitacion: () => {
        const actual = panelEdit.getUsuario()
        return confirmarCancelarInvitacion(actual, panelEdit)
      },
      onRequestReenviarInvitacion: () => {
        const actual = panelEdit.getUsuario()
        void confirmarReenviarInvitacion(actual)
      },
    })
    usuarioEditPanel = panelEdit
    modal = openModal({
      title: USUARIO_EDIT_TITLE,
      subtitle: '',
      dialogClass: 'max-w-md',
      content: panelEdit.element,
      labelledBy: 'usuario-edit-title',
      unsavedChanges: true,
      closeOnBackdrop: false,
      isDirty: () => panelEdit.isDirty(),
      onClose: () => {
        if (usuarioEditPanel === panelEdit) usuarioEditPanel = null
        usuarioEditPaintTitle = null
        if (activeModalClose === modal.close) activeModalClose = null
      },
    })
    usuarioEditPaintTitle = (actual) => {
      pintarTituloUsuario(modal.dialog.querySelector('#usuario-edit-title'), actual, empresaLabel(actual?.empresaId))
    }
    usuarioEditPaintTitle(usuario)
    activeModalClose = modal.close
    applyUsuarioAccionBusy()
  }

  function onUsuarioAccionClick(event) {
    if (!isViewAlive()) return
    const button = event.target.closest('[data-usuario-accion]')
    if (!button || button.disabled) return
    const usuario = usuarios.find((item) => Number(item.id) === Number(button.dataset.usuarioId))
    if (!usuario) return
    if (button.dataset.usuarioAccion === 'editar') {
      openUsuarioEdit(usuario)
    }
  }

  function openUsuarioCreate() {
    if (!canCreateUsuarios || !isViewAlive()) return
    const contenido = document.createElement('div')
    const opciones = document.createElement('div')
    opciones.className = 'flex w-full flex-col gap-2 px-1 py-1'
    opciones.innerHTML = `
      <button type="button" id="alta-invitar" data-autofocus class="${altaOpcionClass()}">
        <span class="${altaIconoClass()}">${iconMail('h-5 w-5')}</span>
        <span class="min-w-0 flex-1">
          <span class="flex flex-wrap items-center gap-2">
            <span class="text-sm font-semibold text-slate-900 dark:text-slate-100">Invitar por correo</span>
            ${badgeHtml('Recomendada', 'blue')}
          </span>
          <span class="mt-1 block text-sm leading-5 text-slate-500 dark:text-slate-400">La persona recibe un enlace para confirmar su correo y crear su contraseña.</span>
        </span>
        <span class="shrink-0 text-slate-400">${iconChevronRight('h-4 w-4')}</span>
      </button>
      <button type="button" id="alta-directa" class="${altaOpcionClass()}">
        <span class="${altaIconoClass()}">${iconUserPlus('h-5 w-5')}</span>
        <span class="min-w-0 flex-1">
          <span class="block text-sm font-semibold text-slate-900 dark:text-slate-100">Crear cuenta directamente</span>
          <span class="mt-1 block text-sm leading-5 text-slate-500 dark:text-slate-400">Vos definís una contraseña inicial para la cuenta.</span>
        </span>
        <span class="shrink-0 text-slate-400">${iconChevronRight('h-4 w-4')}</span>
      </button>
    `
    const paso = document.createElement('div')
    paso.className = 'hidden space-y-3'
    contenido.append(opciones, paso)

    function volver(origen) {
      paso.replaceChildren()
      paso.classList.add('hidden')
      opciones.classList.remove('hidden')
      origen?.focus()
    }

    function mostrar(form, origen) {
      const volverBoton = document.createElement('button')
      volverBoton.type = 'button'
      volverBoton.className = `${BTN_SECONDARY_CLASS} h-10`
      volverBoton.textContent = 'Volver'
      volverBoton.addEventListener('click', () => volver(origen))
      paso.replaceChildren(volverBoton, form)
      paso.classList.remove('hidden')
      opciones.classList.add('hidden')
      volverBoton.focus()
    }

    const alta = {
      empresaIdPermitida: tenantEmpresaId,
      permitirElegirEmpresa: isSuperadmin(user),
      rolesPermitidos: rolesAsignablesParaAlta(user),
      onCancel: () => closeActiveModal(),
    }
    const tarjetaInvitar = opciones.querySelector('#alta-invitar')
    const tarjetaDirecta = opciones.querySelector('#alta-directa')
    tarjetaInvitar.addEventListener('click', () => {
      mostrar(createInvitacionForm({
        ...alta,
        onSubmit: async (dto) => {
          await invitarUsuario(dto)
          closeActiveModal({ force: true })
          viewToast({ message: 'Invitación enviada.', tone: 'success' })
        },
      }), tarjetaInvitar)
    })
    tarjetaDirecta.addEventListener('click', () => {
      mostrar(createUsuarioForm({
        ...alta,
        onSubmit: async (dto) => {
          await createUsuario(dto)
          closeActiveModal({ force: true })
          viewToast({ message: 'Usuario creado correctamente.', tone: 'success' })
        },
      }), tarjetaDirecta)
    })

    const modal = openFormModal({
      title: 'Nuevo usuario',
      content: contenido,
      labelledBy: 'usuario-create-title',
      onClose: () => {
        activeModalClose = null
      },
    })
    activeModalClose = modal.close
  }

  function renderEmpresasList() {
    if (!canViewEmpresasSection) {
      setSection(SECTIONS.usuarios)
      return
    }
    panel.innerHTML = `
      <div class="space-y-4">
        ${adminSectionHeaderMarkup({
          titleId: 'admin-empresas-title',
          title: 'Empresas',
          description: 'Administrá las empresas disponibles en el sistema.',
          actionHtml: canCreateEmpresas
            ? `<button type="button" id="admin-empresa-new" class="${ADMIN_PRIMARY_BUTTON_CLASS}">${iconPlus('h-4 w-4')}<span>Nueva empresa</span></button>`
            : '',
        })}
        <div class="${ADMIN_FILTER_GRID_CLASS}">
          <div class="min-w-0">
            <label for="admin-empresas-search" class="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Buscar</label>
            <input id="admin-empresas-search" type="search" placeholder="Nombre, razón social, CUIT o ID" class="${CONTROL_CLASS} ${ADMIN_FIELD_CONTROL_CLASS}" />
          </div>
          <button type="button" id="admin-empresas-clear" class="${BTN_SECONDARY_CLASS} h-10">Limpiar</button>
        </div>
        <div id="admin-empresas-results"></div>
      </div>
    `
    const search = panel.querySelector('#admin-empresas-search')
    const clear = panel.querySelector('#admin-empresas-clear')
    search.value = empresaQuery
    const syncClear = () => {
      clear.disabled = !empresaQuery.trim()
    }
    search.addEventListener('input', () => {
      empresaQuery = search.value
      syncClear()
      paintEmpresasResults()
    })
    clear.addEventListener('click', () => {
      empresaQuery = ''
      search.value = ''
      syncClear()
      paintEmpresasResults()
    })
    syncClear()
    if (canCreateEmpresas) {
      panel.querySelector('#admin-empresa-new')?.addEventListener('click', openEmpresaCreate)
    }
    paintEmpresasResults()
  }

  function paintEmpresasResults() {
    const results = panel.querySelector('#admin-empresas-results')
    if (!results) return

    if (!empresasLoaded) {
      results.replaceChildren(createTableSkeleton({ rows: 6, columns: 4, label: 'Cargando empresas' }))
      return
    }

    if (empresasError) {
      results.replaceChildren(
        createFeedbackState({
          title: 'No se pudieron cargar las empresas',
          message: empresasErrorMessage,
          tone: 'error',
          actionLabel: 'Reintentar',
          onAction: () => loadEmpresas(),
        }),
      )
      return
    }

    const filtered = empresas.filter((empresa) => matchesQuery(empresa, empresaQuery.trim().toLowerCase()))

    if (empresas.length === 0) {
      results.replaceChildren(
        createAdminEmptyState({
          title: 'No hay empresas',
          detail: 'Todavía no hay registros disponibles.',
          actionLabel: canCreateEmpresas ? '+ Nueva empresa' : '',
          onAction: canCreateEmpresas ? openEmpresaCreate : undefined,
        }),
      )
      return
    }

    if (filtered.length === 0) {
      results.replaceChildren(
        createAdminEmptyState({
          title: 'No encontramos resultados',
          detail: 'Probá cambiar o limpiar los filtros aplicados.',
          actionLabel: 'Limpiar filtros',
          onAction: () => panel.querySelector('#admin-empresas-clear')?.click(),
        }),
      )
      return
    }

    const sectionEl = document.createElement('section')
    sectionEl.className = ADMIN_TABLE_FRAME_CLASS
    sectionEl.innerHTML = `
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-slate-200 text-left dark:divide-slate-700">
          <thead class="bg-slate-50 dark:bg-slate-800">
            <tr>
              <th scope="col" class="${ADMIN_TH_CLASS} text-left">Nombre</th>
              <th scope="col" class="${ADMIN_TH_CLASS} text-left">Razón social</th>
              <th scope="col" class="${ADMIN_TH_CLASS} text-left">CUIT</th>
              <th scope="col" class="${ADMIN_TH_CLASS} text-left">ID</th>
              <th scope="col" class="${ADMIN_TH_CLASS} text-right">Acciones</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
            ${filtered
              .map(
                (empresa) => `
                  <tr class="h-12 hover:bg-slate-50 dark:hover:bg-slate-800/60" data-empresa-id="${Number(empresa.id)}">
                    <td class="max-w-48 truncate px-3 py-2 text-sm font-medium text-slate-900 dark:text-slate-100">${displayValue(empresaDisplayName(empresa))}</td>
                    <td class="max-w-64 truncate px-3 py-2 text-sm text-slate-600 dark:text-slate-300">${displayValue(empresa.razonSocial)}</td>
                    <td class="whitespace-nowrap px-3 py-2 text-sm text-slate-600 dark:text-slate-300">${displayValue(empresa.cuit)}</td>
                    <td class="whitespace-nowrap px-3 py-2 text-sm text-slate-600 dark:text-slate-300">${displayValue(empresa.id)}</td>
                    <td class="px-3 py-2 text-right">
                      <button type="button" data-action="view" data-id="${Number(empresa.id)}" class="${BTN_SECONDARY_CLASS} inline-flex h-8 items-center gap-1.5 whitespace-nowrap px-2.5 text-sm">
                        ${iconBuilding('h-4 w-4')}<span>Ver sucursales</span>
                      </button>
                    </td>
                  </tr>
                `,
              )
              .join('')}
          </tbody>
        </table>
      </div>
    `
    sectionEl.querySelectorAll('[data-action="view"]').forEach((button) => {
      button.addEventListener('click', () => {
        const id = Number(button.dataset.id)
        selectedEmpresa = empresas.find((empresa) => Number(empresa.id) === id) ?? null
        sucursalesLoaded = false
        sucursalesError = false
        sucursales = []
        renderPanel()
        if (selectedEmpresa) void loadSucursales()
      })
    })
    results.replaceChildren(sectionEl)
  }

  function openEmpresaCreate() {
    if (!canCreateEmpresas) return
    const form = createEmpresaForm({
      onCancel: () => closeActiveModal(),
      onSubmit: async (dto) => {
        await createEmpresa(dto)
        closeActiveModal({ force: true })
        viewToast({ message: 'Empresa creada correctamente.', tone: 'success' })
        await loadEmpresas()
      },
    })
    const modal = openFormModal({
      title: 'Nueva empresa',
      content: form,
      labelledBy: 'empresa-create-title',
      onClose: () => {
        activeModalClose = null
      },
    })
    activeModalClose = modal.close
  }

  function renderEmpresaDetail() {
    const nombre = empresaDisplayName(selectedEmpresa)
    const canCreateHere = puedeCrearSucursales(user, selectedEmpresa?.id)
    panel.innerHTML = `
      <div class="space-y-4">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <button type="button" id="admin-empresa-back" class="text-sm font-medium text-blue-700 hover:text-blue-600">
              ← Volver a empresas
            </button>
            <h3 class="mt-2 text-lg font-semibold text-slate-900">${escapeHtml(nombre)}</h3>
            <p class="mt-1 text-sm text-slate-500">
              ID ${escapeHtml(String(selectedEmpresa.id))}
              ${selectedEmpresa.cuit ? ` · CUIT ${escapeHtml(selectedEmpresa.cuit)}` : ''}
            </p>
          </div>
          ${
            canCreateHere
              ? createActionControl({ id: 'admin-sucursal-new', label: 'Agregar sucursal', enabled: true })
              : ''
          }
        </div>
        <div id="admin-sucursales-results"></div>
      </div>
    `
    panel.querySelector('#admin-empresa-back')?.addEventListener('click', () => {
      selectedEmpresa = null
      selectedSucursal = null
      renderPanel()
    })
    if (canCreateHere) {
      panel.querySelector('#admin-sucursal-new')?.addEventListener('click', openSucursalCreate)
    }
    paintSucursalesResults()
  }

  function paintSucursalesResults() {
    const results = panel.querySelector('#admin-sucursales-results')
    if (!results) return
    const canEditHere = puedeEditarSucursales(user, selectedEmpresa?.id)
    const canManageAgentesHere = puedeAdministrarAgentes(user, selectedEmpresa?.id)
    const showActions = canEditHere || canManageAgentesHere

    if (!sucursalesLoaded) {
      results.replaceChildren(
        createTableSkeleton({ rows: 5, columns: showActions ? 4 : 3, label: 'Cargando sucursales' }),
      )
      return
    }

    if (sucursalesError) {
      results.replaceChildren(
        createFeedbackState({
          title: 'No se pudieron cargar las sucursales',
          message: sucursalesErrorMessage,
          tone: 'error',
          actionLabel: 'Reintentar',
          onAction: () => loadSucursales(),
        }),
      )
      return
    }

    if (sucursales.length === 0) {
      results.replaceChildren(
        createFeedbackState({
          title: 'No hay sucursales',
          message: puedeCrearSucursales(user, selectedEmpresa?.id)
            ? 'Esta empresa todavía no tiene sucursales. Agregá la primera.'
            : 'Esta empresa todavía no tiene sucursales.',
        }),
      )
      return
    }

    const sectionEl = document.createElement('section')
    sectionEl.className = 'overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm'
    sectionEl.innerHTML = `
      <div class="max-h-[65vh] overflow-auto">
        <table class="min-w-full divide-y divide-slate-200">
          <thead class="sticky top-0 z-10 bg-slate-50">
            <tr>
              <th scope="col" class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Nombre</th>
              <th scope="col" class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Serial del lector</th>
              <th scope="col" class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">ID</th>
              ${
                showActions
                  ? '<th scope="col" class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Acciones</th>'
                  : ''
              }
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            ${sucursales
              .map((sucursal) => {
                const sameEmpresa = Number(sucursal.empresaId) === Number(selectedEmpresa?.id)
                const canEditSucursal =
                  sameEmpresa && puedeEditarSucursales(user, sucursal.empresaId)
                const canManageSucursalAgentes =
                  sameEmpresa && puedeAdministrarAgentes(user, sucursal.empresaId)
                const actions = []
                if (canEditSucursal) {
                  actions.push(actionButtonMarkup({
                    label: 'Editar',
                    ariaLabel: 'Editar sucursal',
                    attrs: `data-action="edit-sucursal" data-id="${Number(sucursal.id)}"`,
                    compact: true,
                  }))
                }
                if (canManageSucursalAgentes) {
                  actions.push(`<button
                    type="button"
                    data-action="manage-agentes"
                    data-id="${Number(sucursal.id)}"
                    class="rounded-lg px-2.5 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  >
                    Administrar agentes
                  </button>`)
                }
                return `
                  <tr class="hover:bg-slate-50">
                    <td class="whitespace-nowrap px-4 py-3 text-sm font-medium text-slate-900">${displayValue(sucursal.nombre)}</td>
                    <td class="whitespace-nowrap px-4 py-3 text-sm text-slate-600">${displayValue(sucursal.serialLector)}</td>
                    <td class="whitespace-nowrap px-4 py-3 text-sm text-slate-600">${displayValue(sucursal.id)}</td>
                    ${
                      showActions
                        ? `<td class="whitespace-nowrap px-4 py-3 text-right">
                            <div class="flex flex-wrap justify-end gap-1">${actions.join('')}</div>
                          </td>`
                        : ''
                    }
                  </tr>
                `
              })
              .join('')}
          </tbody>
        </table>
      </div>
    `
    sectionEl.querySelectorAll('[data-action="edit-sucursal"]').forEach((button) => {
      button.addEventListener('click', () => {
        const id = Number(button.dataset.id)
        const sucursal = sucursales.find((item) => Number(item.id) === id)
        if (sucursal) openSucursalEdit(sucursal)
      })
    })
    sectionEl.querySelectorAll('[data-action="manage-agentes"]').forEach((button) => {
      button.addEventListener('click', () => {
        const id = Number(button.dataset.id)
        const sucursal = sucursales.find((item) => Number(item.id) === id)
        if (sucursal) openAgentesAdmin(sucursal)
      })
    })
    results.replaceChildren(sectionEl)
  }

  function openSucursalCreate() {
    if (!selectedEmpresa?.id) {
      viewToast({ message: 'No se puede crear una sucursal sin empresa.', tone: 'error' })
      return
    }

    if (!puedeCrearSucursales(user, selectedEmpresa.id)) return

    const form = createSucursalForm({
      empresaNombre: empresaDisplayName(selectedEmpresa),
      onCancel: () => closeActiveModal(),
      onSubmit: async (dto) => {
        await createSucursal({
          ...dto,
          empresaId: Number(selectedEmpresa.id),
        })
        closeActiveModal({ force: true })
        viewToast({ message: 'Sucursal creada correctamente.', tone: 'success' })
        await loadSucursales()
      },
    })
    const modal = openFormModal({
      title: 'Agregar sucursal',
      content: form,
      labelledBy: 'sucursal-create-title',
      onClose: () => {
        activeModalClose = null
      },
    })
    activeModalClose = modal.close
  }

  function openSucursalEdit(sucursal) {
    const sucursalId = Number(sucursal?.id)
    const empresaId = Number(sucursal?.empresaId)
    const selectedEmpresaId = Number(selectedEmpresa?.id)

    if (
      !Number.isFinite(sucursalId) ||
      sucursalId <= 0 ||
      !Number.isFinite(empresaId) ||
      empresaId <= 0 ||
      empresaId !== selectedEmpresaId ||
      !puedeEditarSucursales(user, empresaId)
    ) {
      viewToast({ message: 'No tenés permiso para editar esta sucursal.', tone: 'error' })
      return
    }

    const form = createSucursalForm({
      mode: 'edit',
      sucursal,
      empresaNombre: empresaDisplayName(selectedEmpresa),
      onCancel: () => closeActiveModal(),
      onSubmit: async (dto) => {
        await updateSucursal({
          id: sucursalId,
          nombre: dto.nombre,
          empresaId,
          serialLector: dto.serialLector,
        })
        closeActiveModal({ force: true })
        viewToast({ message: 'Sucursal actualizada correctamente', tone: 'success' })
        await loadSucursales()
      },
    })
    const modal = openFormModal({
      title: 'Editar sucursal',
      content: form,
      labelledBy: 'sucursal-edit-title',
      onClose: () => {
        activeModalClose = null
      },
    })
    activeModalClose = modal.close
  }

  function formatUltimoAcceso(value) {
    // ultimoAcceso is API UtcNow; formatApiDateTime applies the temporary UTC patch.
    const label = formatApiDateTime(value)
    return label ? escapeHtml(label) : '—'
  }

  function openAgentesAdmin(sucursal) {
    const sucursalId = Number(sucursal?.id)
    const empresaId = Number(sucursal?.empresaId ?? selectedEmpresa?.id)

    if (
      !Number.isFinite(sucursalId) ||
      sucursalId <= 0 ||
      empresaId !== Number(selectedEmpresa?.id) ||
      !puedeAdministrarAgentes(user, empresaId)
    ) {
      viewToast({ message: 'No tenés permiso para administrar agentes de esta sucursal.', tone: 'error' })
      return
    }

    selectedSucursal = sucursal
    agentes = []
    agentesLoaded = false
    agentesError = false
    renderPanel()
    void loadAgentes()
  }

  function renderAgentesAdmin() {
    const empresaNombre = empresaDisplayName(selectedEmpresa)
    const sucursalNombre = String(selectedSucursal?.nombre ?? '').trim()
    const canCreate = puedeCrearAgentes(user, selectedEmpresa?.id)

    panel.innerHTML = `
      <div class="space-y-4">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <button type="button" id="admin-agentes-back" class="text-sm font-medium text-blue-700 hover:text-blue-600">
              ← Volver a sucursales
            </button>
            <h3 class="mt-2 text-lg font-semibold text-slate-900">Agentes de la sucursal</h3>
            <p class="mt-1 text-sm text-slate-500">
              Empresa ${escapeHtml(empresaNombre)} · Sucursal ${escapeHtml(sucursalNombre)}
            </p>
            <p class="mt-1 text-xs text-slate-500">
              Credenciales del programa instalado. El serial del lector se edita en “Editar sucursal”.
            </p>
          </div>
          ${
            canCreate
              ? createActionControl({ id: 'admin-agente-new', label: 'Agregar agente', enabled: true })
              : ''
          }
        </div>
        <div id="admin-agentes-results"></div>
      </div>
    `
    panel.querySelector('#admin-agentes-back')?.addEventListener('click', () => {
      closeActiveModal({ force: true })
      selectedSucursal = null
      agentes = []
      clearSecretHolder()
      renderPanel()
    })
    if (canCreate) {
      panel.querySelector('#admin-agente-new')?.addEventListener('click', openAgenteCreate)
    }
    paintAgentesResults()
  }

  function paintAgentesResults() {
    const results = panel.querySelector('#admin-agentes-results')
    if (!results) return

    const canCreate = puedeCrearAgentes(user, selectedEmpresa?.id)
    const canRotate = puedeRotarSecretAgente(user, selectedEmpresa?.id)
    const canDeactivate = puedeDesactivarAgente(user, selectedEmpresa?.id)

    if (!agentesLoaded) {
      results.replaceChildren(createTableSkeleton({ rows: 4, columns: 5, label: 'Cargando agentes' }))
      return
    }

    if (agentesError) {
      results.replaceChildren(
        createFeedbackState({
          title: 'No se pudieron cargar los agentes',
          message: agentesErrorMessage,
          tone: 'error',
          actionLabel: 'Reintentar',
          onAction: () => loadAgentes(),
        }),
      )
      return
    }

    if (agentes.length === 0) {
      results.replaceChildren(
        createFeedbackState({
          title: 'No hay agentes en esta sucursal',
          message: canCreate
            ? 'Esta sucursal todavía no tiene un agente instalado. Agregá el primero.'
            : 'Esta sucursal todavía no tiene agentes.',
        }),
      )
      return
    }

    const sectionEl = document.createElement('section')
    sectionEl.className = 'overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm'
    sectionEl.innerHTML = `
      <div class="max-h-[65vh] overflow-auto">
        <table class="min-w-full divide-y divide-slate-200">
          <thead class="sticky top-0 z-10 bg-slate-50">
            <tr>
              <th scope="col" class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Nombre</th>
              <th scope="col" class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Client ID</th>
              <th scope="col" class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Estado</th>
              <th scope="col" class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Último acceso</th>
              ${
                canRotate || canDeactivate
                  ? '<th scope="col" class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Acciones</th>'
                  : ''
              }
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            ${agentes
              .map((agente) => {
                const actions = []
                if (canRotate) {
                  actions.push(`<button
                    type="button"
                    data-action="rotar-secret"
                    data-id="${Number(agente.id)}"
                    class="rounded-lg px-2.5 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  >
                    Rotar secreto
                  </button>`)
                }
                if (canDeactivate && agente.activo) {
                  actions.push(`<button
                    type="button"
                    data-action="desactivar"
                    data-id="${Number(agente.id)}"
                    class="rounded-lg px-2.5 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                  >
                    Desactivar
                  </button>`)
                }
                return `
                  <tr class="hover:bg-slate-50">
                    <td class="whitespace-nowrap px-4 py-3 text-sm font-medium text-slate-900">${displayValue(agente.nombre)}</td>
                    <td class="whitespace-nowrap px-4 py-3 text-sm text-slate-600">${displayValue(agente.clientId)}</td>
                    <td class="whitespace-nowrap px-4 py-3 text-sm">${employeeStatusBadge(agente.activo)}</td>
                    <td class="whitespace-nowrap px-4 py-3 text-sm text-slate-600">${formatUltimoAcceso(agente.ultimoAcceso)}</td>
                    ${
                      canRotate || canDeactivate
                        ? `<td class="whitespace-nowrap px-4 py-3 text-right">
                            <div class="flex flex-wrap justify-end gap-1">${actions.join('')}</div>
                          </td>`
                        : ''
                    }
                  </tr>
                `
              })
              .join('')}
          </tbody>
        </table>
      </div>
    `
    sectionEl.querySelectorAll('[data-action="rotar-secret"]').forEach((button) => {
      button.addEventListener('click', () => {
        const id = Number(button.dataset.id)
        const agente = agentes.find((item) => Number(item.id) === id)
        if (agente) void confirmRotarSecret(agente)
      })
    })
    sectionEl.querySelectorAll('[data-action="desactivar"]').forEach((button) => {
      button.addEventListener('click', () => {
        const id = Number(button.dataset.id)
        const agente = agentes.find((item) => Number(item.id) === id)
        if (agente) void confirmDesactivarAgente(agente)
      })
    })
    results.replaceChildren(sectionEl)
  }

  function openAgenteCreate() {
    if (!selectedSucursal?.id || !selectedEmpresa?.id) return
    if (!puedeCrearAgentes(user, selectedEmpresa.id)) return

    const sucursalId = Number(selectedSucursal.id)
    const empresaId = Number(selectedEmpresa.id)
    const existingClientIds = getLoadedAgenteClientIds()

    const form = createAgenteForm({
      empresaNombre: empresaDisplayName(selectedEmpresa),
      sucursalNombre: selectedSucursal.nombre,
      sucursalId,
      existingClientIds,
      onCancel: () => closeActiveModal(),
      onSubmit: async (dto) => {
        const created = await createAgente({
          sucursalId,
          empresaId,
          nombre: dto.nombre,
          clientId: dto.clientId,
        })
        closeActiveModal({ force: true })
        viewToast({ message: 'Agente creado. Guardá el secreto ahora.', tone: 'success' })
        await loadAgentes()
        openAgenteSecretModal(created)
      },
    })
    const modal = openFormModal({
      title: 'Agregar agente',
      content: form,
      labelledBy: 'agente-create-title',
      onClose: () => {
        activeModalClose = null
      },
    })
    activeModalClose = modal.close
  }

  function openAgenteSecretModal(created) {
    clearSecretHolder()
    const panelSecret = createAgenteSecretPanel({
      clientId: created?.clientId,
      clientSecret: created?.clientSecret,
      onClose: () => closeActiveModal({ force: true }),
    })
    secretHolder = created
    const modal = openFormModal({
      title: 'Secreto del agente',
      content: panelSecret.element,
      labelledBy: 'agente-secret-title',
      ...AGENTE_SECRET_MODAL,
      onClose: () => {
        panelSecret.discard()
        discardAgenteSecret(created)
        clearSecretHolder()
        activeModalClose = null
      },
    })
    activeModalClose = modal.close
  }

  async function confirmRotarSecret(agente) {
    const confirmed = await openConfirmModal({
      title: AGENTE_ROTAR_TITLE,
      message: AGENTE_ROTAR_MESSAGE,
      confirmLabel: AGENTE_ROTAR_CONFIRM,
      cancelLabel: 'Cancelar',
      danger: true,
    })
    if (!confirmed) return

    try {
      const created = await rotarSecretAgente({
        id: agente.id,
        empresaId: Number(selectedEmpresa.id),
      })
      viewToast({ message: 'Secreto regenerado. Guardalo ahora.', tone: 'success' })
      openAgenteSecretModal(created)
    } catch (error) {
      if (ignoreClosedSession(error)) return
      viewToast({ message: error.message || 'No se pudo regenerar el secreto.', tone: 'error' })
    }
  }

  async function confirmDesactivarAgente(agente) {
    const confirmed = await openConfirmModal({
      title: AGENTE_DESACTIVAR_TITLE,
      message: AGENTE_DESACTIVAR_MESSAGE,
      confirmLabel: AGENTE_DESACTIVAR_CONFIRM,
      cancelLabel: 'Cancelar',
      danger: true,
    })
    if (!confirmed) return

    try {
      await desactivarAgente({
        id: agente.id,
        empresaId: Number(selectedEmpresa.id),
      })
      viewToast({ message: 'Agente desactivado.', tone: 'success' })
      await loadAgentes()
    } catch (error) {
      if (ignoreClosedSession(error)) return
      viewToast({ message: error.message || 'No se pudo desactivar el agente.', tone: 'error' })
    }
  }

  async function loadAgentes() {
    if (!selectedSucursal?.id || !selectedEmpresa?.id) return
    agentesLoaded = false
    agentesError = false
    paintAgentesResults()
    try {
      agentes = await getAgentes({
        sucursalId: selectedSucursal.id,
        empresaId: selectedEmpresa.id,
      })
      agentesLoaded = true
      agentesError = false
    } catch (error) {
      if (!isViewAlive() || ignoreClosedSession(error)) return
      agentes = []
      agentesLoaded = true
      agentesError = true
      agentesErrorMessage = error.message || 'No se pudieron cargar los agentes.'
      viewToast({
        message: error.message || 'No se pudieron cargar los agentes.',
        tone: 'error',
      })
    }
    if (!isViewAlive()) return
    paintAgentesResults()
  }

  async function loadEmpresas({ silent = false } = {}) {
    if (!isSuperadmin(user)) return
    empresasLoaded = false
    empresasError = false
    paintEmpresasResults()
    try {
      empresas = await getEmpresas()
      empresasLoaded = true
      empresasError = false
    } catch (error) {
      if (!isViewAlive() || ignoreClosedSession(error)) return
      empresas = []
      empresasLoaded = true
      empresasError = true
      empresasErrorMessage = error.message || 'No se pudieron cargar las empresas.'
      if (!silent) {
        viewToast({
          message: error.message || 'No se pudieron cargar las empresas.',
          tone: 'error',
        })
      }
    }
    if (!isViewAlive()) return
    paintEmpresasResults()
    // El listado de usuarios resuelve nombres de empresa con este catálogo.
    paintUsuariosResults()
  }

  async function loadSucursales() {
    if (!selectedEmpresa?.id) return
    sucursalesLoaded = false
    sucursalesError = false
    paintSucursalesResults()
    try {
      sucursales = await getSucursales({ empresaId: selectedEmpresa.id })
      sucursalesLoaded = true
      sucursalesError = false
    } catch (error) {
      if (!isViewAlive() || ignoreClosedSession(error)) return
      sucursales = []
      sucursalesLoaded = true
      sucursalesError = true
      sucursalesErrorMessage = error.message || 'No se pudieron cargar las sucursales.'
      viewToast({
        message: error.message || 'No se pudieron cargar las sucursales.',
        tone: 'error',
      })
    }
    if (!isViewAlive()) return
    paintSucursalesResults()
  }

  tabButtons.forEach((button, index) => {
    button.addEventListener('click', () => setSection(button.dataset.section), {
      signal: listenerAbort.signal,
    })
    button.addEventListener('keydown', (event) => {
      if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return
      event.preventDefault()
      const next = event.key === 'ArrowRight' ? index + 1 : index - 1
      const target = tabButtons[(next + tabButtons.length) % tabButtons.length]
      target?.focus()
      if (target) setSection(target.dataset.section)
    }, { signal: listenerAbort.signal })
  })

  async function renderDepartamentos() {
    const empresaId = empresaSeleccionadaId()
    panel.innerHTML = `
      <div class="space-y-4">
        ${adminSectionHeaderMarkup({
          titleId: 'admin-departamentos-title',
          title: 'Departamentos',
          description: 'Organizá los departamentos disponibles en cada sucursal.',
        })}
        <div data-admin-departamentos></div>
      </div>
    `
    const host = panel.querySelector('[data-admin-departamentos]')
    if (!empresaId) {
      host.replaceChildren(
        createAdminEmptyState({
          title: 'Seleccioná una empresa',
          detail: 'Elegí una empresa en el encabezado para ver sus departamentos.',
        }),
      )
      return
    }
    host.innerHTML = `<p class="text-sm text-slate-500" role="status">Cargando departamentos…</p>`
    let sucursalesDepartamento = []
    try {
      sucursalesDepartamento = await getSucursales({ empresaId })
    } catch (error) {
      if (!isViewAlive() || ignoreClosedSession(error)) return
      host.replaceChildren(
        createFeedbackState({
          title: 'No se pudieron cargar los departamentos',
          message: 'Intentá nuevamente.',
          tone: 'error',
          actionLabel: 'Reintentar',
          onAction: () => renderDepartamentos(),
        }),
      )
      return
    }
    if (!isViewAlive() || section !== SECTIONS.departamentos) return
    host.replaceChildren()
    departamentosAdmin = createDepartamentosAdmin({
      sucursales: sucursalesDepartamento,
      empresaId,
      addLabel: 'Nuevo departamento',
      embed: true,
    })
    panel.querySelector('[data-admin-action]')?.append(departamentosAdmin.addButton)
    host.append(departamentosAdmin.element)
  }

  container.replaceChildren(view)
  setSection(resolveSection(readAdminTab() || SECTIONS.usuarios))

  return () => {
    life.dispose(() => {
      listenerAbort.abort()
      disposeDepartamentos()
      clearSecretHolder()
      closeActiveModal({ force: true })
    })
  }
}
