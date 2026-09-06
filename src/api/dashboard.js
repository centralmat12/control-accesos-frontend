import { getEmpleados } from './empleados.js'
import { FICHADAS_LIMITE, getFichadas } from './fichadas.js'
import { esTipoEntrada, esTipoSalida, todayDateKey } from '../utils/format.js'
import { exclusiveHastaIso, startOfDayIso } from '../utils/period.js'
import { buildEmpleadoAlertas } from '../utils/empleado-alerts.js'

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

export async function getDashboardData() {
  const today = todayDateKey()
  const [empleados, fichadasHoy] = await Promise.all([
    getEmpleados(),
    getFichadas({
      desde: startOfDayIso(today),
      hasta: exclusiveHastaIso(today),
    }),
  ])

  return {
    empleadosActivos: empleados.length,
    fichadasHoy: fichadasHoy.length,
    entradas: fichadasHoy.filter((item) => esTipoEntrada(item.tipo)).length,
    salidas: fichadasHoy.filter((item) => esTipoSalida(item.tipo)).length,
    ultimasFichadas: sortFichadasByNewest(fichadasHoy),
    alcanzoLimite: fichadasHoy.length >= FICHADAS_LIMITE,
    alertas: buildEmpleadoAlertas(empleados),
  }
}
