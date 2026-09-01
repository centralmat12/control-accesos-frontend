import { getEmpleados } from './empleados.js'
import { FICHADAS_LIMITE, getFichadas } from './fichadas.js'
import { esTipoEntrada, esTipoSalida, todayDateKey } from '../utils/format.js'
import { exclusiveHastaIso, startOfDayIso } from '../utils/period.js'

const ULTIMAS_VISIBLES = 8

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
    ultimasFichadas: fichadasHoy.slice(0, ULTIMAS_VISIBLES),
    alcanzoLimite: fichadasHoy.length >= FICHADAS_LIMITE,
  }
}
