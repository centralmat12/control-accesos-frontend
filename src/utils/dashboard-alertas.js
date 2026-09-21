import { canAccessView } from '../config/navigation.js'
import { isAdmin, isRrhh, isSuperadmin } from '../config/roles.js'
import { formatApiDateTime } from './format.js'
import {
  ATTENTION_EMPTY_DETAIL,
  ATTENTION_EMPTY_TITLE,
  DASHBOARD_CORRECT_DATOS_LABEL,
  DASHBOARD_ENROLL_HUELLA_LABEL,
  DASHBOARD_REVIEW_EMPLEADO_LABEL,
  buildEmployeeAttentionItems,
  classifyEmployeeAttentionActions,
  empleadoAlertLabel,
  pendientesBadgeLabel,
} from './empleado-alerts.js'
import { ultimaComunicacionLabel } from './dashboard-dispositivos.js'

const RANK = { critical: 3, warning: 2, important: 2, pending: 1, info: 1 }

export function puedeVerAlertasUsuarios(user) {
  return isSuperadmin(user) || isAdmin(user)
}

export function bloqueoUsuarioDetalle(usuario) {
  const hasta = formatApiDateTime(usuario?.bloqueadoHasta)
  if (hasta) return `Bloqueado por intentos fallidos de inicio de sesión. El bloqueo vence el ${hasta}.`
  return 'Bloqueado por intentos fallidos de inicio de sesión.'
}

export function buildDashboardAlertas({
  user,
  empleados = [],
  usuarios = [],
  dispositivos = [],
  dispositivosConsultaOk = false,
  sistema = null,
  isSuperadminViewer = false,
  catalogReady = false,
  now = new Date(),
} = {}) {
  const items = []

  if (sistema?.baseDatosConectada === false) {
    items.push({
      id: 'sistema-db',
      type: 'sistema',
      severity: 'critical',
      tone: 'danger',
      title: 'Base de datos no disponible',
      detail: isSuperadminViewer
        ? sistema.detail || 'El backend no pudo confirmar el acceso a la base de datos.'
        : 'El sistema no puede confirmar la base de datos en este momento.',
      action: null,
    })
  }

  if (dispositivosConsultaOk) {
    const list = Array.isArray(dispositivos) ? dispositivos : []
    const offline = list.filter((item) => item && item.conectado === false)
    if (list.length > 0 && offline.length === list.length) {
      items.push({
        id: 'dispositivos-todos',
        type: 'dispositivos-critico',
        severity: 'critical',
        tone: 'danger',
        title: 'Todos los dispositivos están desconectados',
        detail: 'No se están recibiendo fichadas en ninguna sucursal.',
        action: dispositivoAction(user),
      })
    }

    offline.forEach((dispositivo) => {
      const sucursal = dispositivo.sucursalNombre ? ` — ${dispositivo.sucursalNombre}` : ''
      items.push({
        id: `dispositivo-${dispositivo.id}`,
        type: 'dispositivo',
        severity: 'warning',
        tone: 'warning',
        title: 'Dispositivo desconectado',
        detail: `${dispositivo.nombre}${sucursal}\n${ultimaComunicacionLabel(dispositivo.ultimaConexion, now)}`,
        action: dispositivoAction(user),
      })
    })
  }

  if (puedeVerAlertasUsuarios(user)) {
    const visibles = Array.isArray(usuarios) ? usuarios : []
    visibles
      .filter((usuario) => usuario?.bloqueado && !isSuperadmin(usuario))
      .forEach((usuario) => {
        items.push({
          id: `usuario-bloqueado-${usuario.id}`,
          type: 'usuario-bloqueado',
          severity: 'warning',
          tone: 'warning',
          title: 'Usuario bloqueado',
          detail: `${usuario.nombreUsuario || 'Usuario'}\n${bloqueoUsuarioDetalle(usuario)}`,
          action: canAccessView(user, 'administracion')
            ? { view: 'administracion', label: 'Ir a Usuarios' }
            : null,
        })
      })

    visibles
      .filter((usuario) => usuario?.requiereCambioPassword && !usuario?.bloqueado && !isSuperadmin(usuario))
      .forEach((usuario) => {
        items.push({
          id: `usuario-password-${usuario.id}`,
          type: 'usuario-password',
          severity: 'info',
          tone: 'info',
          title: 'Cambio de contraseña pendiente',
          detail: `${usuario.nombreUsuario || 'Usuario'}\nDebe cambiar la contraseña en el próximo acceso.`,
          action: canAccessView(user, 'administracion')
            ? { view: 'administracion', label: 'Ir a Usuarios' }
            : null,
        })
      })
  }

  const grouped = buildEmployeeAttentionItems(empleados)
  grouped.forEach((group) => {
    const hasConflict = group.issues.some((issue) => issue.tone === 'danger')
    const { actions, cardAction, attentionKind } = employeeAlertActions(user, group)
    items.push({
      id: `empleado-${group.id}`,
      type: 'empleado',
      empleadoId: group.id,
      issues: group.issues,
      pendingCount: group.issues.length,
      attentionKind,
      severity: 'warning',
      tone: hasConflict ? 'danger' : 'warning',
      title: empleadoAlertLabel(group.empleado),
      badge: pendientesBadgeLabel(group.issues.length),
      actions,
      cardAction,
      action: cardAction || actions[0] || null,
    })
  })

  const ordered = items.slice().sort((a, b) => RANK[b.severity] - RANK[a.severity])
  const employeeItems = ordered.filter((item) => item.type === 'empleado')
  const pendingCount = employeeItems.reduce((total, item) => total + (item.pendingCount || 0), 0)
  const empty = ordered.length === 0
  return {
    count: ordered.length,
    employeeCount: employeeItems.length,
    pendingCount,
    showEmpty: empty,
    sinPendientes: catalogReady === true && empty,
    worst: worstSeverity(ordered),
    emptyTitle: ATTENTION_EMPTY_TITLE,
    emptyDetail: ATTENTION_EMPTY_DETAIL,
    items: ordered,
  }
}

function employeeEditAction(group, label) {
  return {
    kind: 'edit-empleado',
    view: 'empleados',
    label,
    empleadoId: group.id,
    openEdit: true,
  }
}

function employeeEnrollAction(group) {
  return {
    kind: 'enroll-help',
    label: DASHBOARD_ENROLL_HUELLA_LABEL,
    empleadoId: group.id,
    empleadoNombre: empleadoAlertLabel(group.empleado),
    empresaId: group.empleado?.empresaId ?? null,
  }
}

export function employeeAlertActions(user, group) {
  const attentionKind = classifyEmployeeAttentionActions(group?.issues)
  const canEdit = canAccessView(user, 'empleados')
  const editLabel = attentionKind === 'mixed' ? DASHBOARD_CORRECT_DATOS_LABEL : DASHBOARD_REVIEW_EMPLEADO_LABEL
  const editAction = canEdit ? employeeEditAction(group, editLabel) : null
  const enrollAction = employeeEnrollAction(group)

  if (attentionKind === 'frontend') {
    const actions = editAction ? [editAction] : []
    return { attentionKind, actions, cardAction: editAction }
  }
  if (attentionKind === 'agent') {
    return { attentionKind, actions: [enrollAction], cardAction: enrollAction }
  }
  if (attentionKind === 'mixed') {
    const actions = [...(editAction ? [editAction] : []), enrollAction]
    return { attentionKind, actions, cardAction: actions.length === 1 ? actions[0] : null }
  }
  return { attentionKind, actions: [], cardAction: null }
}

function dispositivoAction(user) {
  if (isRrhh(user) || !canAccessView(user, 'administracion')) return null
  if (isSuperadmin(user)) return { view: 'administracion', label: 'Revisar configuración' }
  return null
}

function worstSeverity(items) {
  if (items.some((item) => item.severity === 'critical')) return 'critical'
  if (items.some((item) => item.severity === 'warning' || item.severity === 'important')) return 'warning'
  if (items.length) return 'info'
  return null
}

export function dashboardAlertasHeading(employeeCount, pendingCount = 0) {
  const empleadosLabel =
    employeeCount === 1 ? '1 empleado requiere atención' : `${employeeCount} empleados requieren atención`
  const pendientesLabel = pendingCount === 1 ? '1 pendiente' : `${pendingCount} pendientes`
  return `${empleadosLabel} · ${pendientesLabel}`
}

export function alertasPendientesStatus({
  catalogReady = false,
  empleadosConsultaOk = false,
  hasAlertas = false,
  pendingCount = 0,
  loading = false,
  failed = false,
  worst = null,
} = {}) {
  if (catalogReady === true && empleadosConsultaOk === true) {
    const count = Number(pendingCount) || 0
    if (hasAlertas || count > 0) {
      const label = count === 1 ? '1 pendiente' : `${Math.max(count, 1)} pendientes`
      return {
        tone: worst === 'critical' || worst === 'danger' ? 'danger' : 'warning',
        label,
        detail: 'Hay alertas y pendientes que requieren atención.',
        interactive: true,
        pendingCount: count || 1,
        actionLabel: `Ver ${label}`,
      }
    }
    return {
      tone: 'success',
      label: 'Sin pendientes',
      detail: 'No hay alertas ni pendientes en este momento.',
      interactive: false,
    }
  }

  if (failed === true && catalogReady !== true) {
    return {
      tone: 'error',
      label: 'No se pudo verificar',
      detail: 'No se pudieron consultar los pendientes de empleados.',
      interactive: false,
    }
  }

  return {
    tone: 'neutral',
    label: 'Verificando…',
    detail: 'Se están consultando las alertas y los pendientes.',
    interactive: false,
  }
}
