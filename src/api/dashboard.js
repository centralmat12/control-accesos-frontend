import { FICHADAS_LIMITE } from './fichadas.js'
import { puedeListarUsuarios } from '../config/administracion.js'
import { todayDateKey } from '../utils/format.js'
import { JORNADA_CLASIFICACION, MOVIMIENTO_VISUAL, clasificarFichadas } from '../utils/movimientos.js'
import { exclusiveHastaIso, startOfDayIso } from '../utils/period.js'
import { buildEmpleadoAlertas } from '../utils/empleado-alerts.js'
import { isSuperadmin } from '../config/roles.js'
import { getCurrentUser } from './auth.js'
import { getOperativeEmpresaId } from './empresa-context.js'
import { getUsuarios } from './usuarios.js'

function sortFichadasByNewest(items) {
  return [...items].sort((a, b) => {
    const aTime = new Date(a.fechaHora).getTime()
    const bTime = new Date(b.fechaHora).getTime()

    if (Number.isNaN(aTime) && Number.isNaN(bTime)) return 0
    if (Number.isNaN(aTime)) return 1
    if (Number.isNaN(bTime)) return -1
    return bTime - aTime
  })
}

export function buildDashboardData(empleados = [], fichadasHoy = [], { now = new Date() } = {}) {
  const listaEmpleados = Array.isArray(empleados) ? empleados : []
  const listaFichadas = Array.isArray(fichadasHoy) ? fichadasHoy : []
  const horarioByEmpleado = new Map(listaEmpleados.map((empleado) => [Number(empleado.id), empleado.horario ?? '']))
  const clasificadas = clasificarFichadas(listaFichadas, { now, horarioByEmpleado })

  return {
    empleados: listaEmpleados,
    empleadosActivos: listaEmpleados.length,
    fichadasHoy: listaFichadas.length,
    entradas: clasificadas.filter((item) => item.movimientoVisual === MOVIMIENTO_VISUAL.entrada && !item.esPosibleDuplicado).length,
    salidas: clasificadas.filter(
      (item) =>
        item.movimientoVisual === MOVIMIENTO_VISUAL.salida &&
        item.jornadaEstado === JORNADA_CLASIFICACION.completa &&
        !item.esPosibleDuplicado,
    ).length,
    ultimasFichadas: sortFichadasByNewest(listaFichadas),
    alcanzoLimite: listaFichadas.length >= FICHADAS_LIMITE,
    alertas: buildEmpleadoAlertas(listaEmpleados),
  }
}

export function dashboardFichadasFilters() {
  const today = todayDateKey()
  return {
    desde: startOfDayIso(today),
    hasta: exclusiveHastaIso(today),
  }
}

export async function getDashboardUsuariosGestion() {
  const user = getCurrentUser()
  if (!puedeListarUsuarios(user)) return { attempted: false, usuarios: [] }

  const empresaId = getOperativeEmpresaId(user)
  // SuperAdmin sin empresa: GET /api/usuarios lista todas las empresas. No mezclar tenants.
  if (isSuperadmin(user) && !empresaId) return { attempted: false, usuarios: [] }

  return {
    attempted: true,
    usuarios: await getUsuarios(empresaId ? { empresaId } : {}),
  }
}
