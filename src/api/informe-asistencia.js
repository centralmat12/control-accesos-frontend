import { getEmpleados } from './empleados.js'
import { FICHADAS_LIMITE, getFichadas } from './fichadas.js'
import { getAlertasIncompletas, getAsignaciones, getCalendario } from './jornadas.js'
import { getDepartamentos } from './departamentos.js'
import { getSucursales } from './sucursales.js'
import { businessNow, todayDateKey } from '../utils/format.js'
import { armarInforme, rangoInforme } from '../utils/informe-asistencia.js'
import { exclusiveHastaIso, startOfDayIso } from '../utils/period.js'

async function enGrupo(items, limite, tarea) {
  const salida = new Array(items.length)
  let cursor = 0
  const trabajadores = Array.from({ length: Math.min(limite, items.length) }, async () => {
    while (cursor < items.length) {
      const indice = cursor
      cursor += 1
      salida[indice] = await tarea(items[indice])
    }
  })
  await Promise.all(trabajadores)
  return salida
}

export async function obtenerContextoInforme(deps = {}) {
  const empleadosFn = deps.getEmpleados ?? getEmpleados
  const sucursalesFn = deps.getSucursales ?? getSucursales
  const departamentosFn = deps.getDepartamentos ?? getDepartamentos
  const [empleados, sucursales, departamentos] = await Promise.all([
    empleadosFn(),
    sucursalesFn().catch(() => []),
    departamentosFn().catch(() => []),
  ])
  return {
    empleados: Array.isArray(empleados) ? empleados : [],
    sucursales: Array.isArray(sucursales) ? sucursales : [],
    departamentos: Array.isArray(departamentos) ? departamentos : [],
  }
}

export async function obtenerInformeAsistencia(filtros = {}, deps = {}) {
  const hoy = filtros.hoy || businessNow()?.dateKey || todayDateKey()
  const rango = filtros.desde && filtros.hasta
    ? { desde: filtros.desde, hasta: filtros.hasta }
    : rangoInforme(filtros.periodo || 'mes', hoy, filtros.customDesde, filtros.customHasta)
  const empleados = (deps.empleados ?? (await (deps.getEmpleados ?? getEmpleados)())).filter((empleado) => empleado?.activo !== false)
  const alcance = empleados.filter((empleado) => {
    if (filtros.empleadoId && String(empleado.id) !== String(filtros.empleadoId)) return false
    if (filtros.departamentoId && String(empleado.departamentoId ?? '') !== String(filtros.departamentoId)) return false
    if (filtros.sucursalId && String(empleado.sucursalId ?? '') !== String(filtros.sucursalId)) return false
    return true
  })
  const fichadasFn = deps.getFichadas ?? getFichadas
  const calendarioFn = deps.getCalendario ?? getCalendario
  const asignacionesFn = deps.getAsignaciones ?? getAsignaciones
  const alertasFn = deps.getAlertasIncompletas ?? getAlertasIncompletas
  const consulta = {
    desde: startOfDayIso(rango.desde),
    hasta: exclusiveHastaIso(rango.hasta),
    limite: FICHADAS_LIMITE,
  }
  if (alcance.length === 1) consulta.empleadoId = alcance[0].id
  const fichadas = await fichadasFn(consulta)
  const truncado = Array.isArray(fichadas) && fichadas.length >= FICHADAS_LIMITE
  const calendarios = await enGrupo(alcance, 4, (empleado) => calendarioFn(empleado.id, rango.desde, rango.hasta).catch((error) => {
    if (error?.status === 401) throw error
    return null
  }))
  const asignaciones = await enGrupo(alcance, 4, (empleado) => asignacionesFn(empleado.id).catch(() => []))
  let alertas = []
  try {
    alertas = await alertasFn()
  } catch (error) {
    if (error?.status === 401) throw error
    alertas = []
  }
  const calendariosPorEmpleado = new Map(alcance.map((empleado, index) => [Number(empleado.id), calendarios[index]]))
  const asignacionesPorEmpleado = new Map(alcance.map((empleado, index) => [Number(empleado.id), asignaciones[index] ?? []]))
  const informe = armarInforme({
    empleados: alcance,
    fichadas,
    calendariosPorEmpleado,
    asignacionesPorEmpleado,
    alertas,
    hoy,
    truncado,
    filtros,
  })
  return { ...informe, desde: rango.desde, hasta: rango.hasta, hoy }
}
