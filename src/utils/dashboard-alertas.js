import { canAccessView } from '../config/navigation.js'
import { isAdmin, isRrhh, isSuperadmin } from '../config/roles.js'
import { formatApiDateTime } from './format.js'
import { empleadoAlertCopy, empleadoFaltantes, empleadoSearchHint } from './empleado-alerts.js'
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

  const activos = Array.isArray(empleados) ? empleados : []
  activos.forEach((empleado, index) => {
    const missing = empleadoFaltantes(empleado)
    if (!missing.length) return
    const copy = empleadoAlertCopy(empleado, missing)
    items.push({
      id: `empleado-${empleado.id ?? index}`,
      type: 'empleado',
      severity: 'warning',
      tone: 'warning',
      title: copy.title,
      detail: copy.detail,
      action: canAccessView(user, 'empleados')
        ? { view: 'empleados', label: 'Ir a Empleados', initialQuery: empleadoSearchHint(empleado) || undefined }
        : null,
    })
  })

  const ordered = items.slice().sort((a, b) => RANK[b.severity] - RANK[a.severity])
  return {
    count: ordered.length,
    worst: worstSeverity(ordered),
    items: ordered,
  }
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

export function dashboardAlertasHeading(count) {
  if (count === 1) return '1 situación requiere atención'
  return `${count} situaciones requieren atención`
}
