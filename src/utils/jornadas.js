import {
  displayMetodoLabel,
  formatTime,
  horarioPrevistoLabel,
  toDateKey,
  todayDateKey,
} from './format.js'
import {
  annotateMovimientos,
  describeFichadasIntermedias,
  empleadoMovimientoKey,
  validMovimientosForResumen,
} from './movimientos.js'

export const JORNADA_ESTADO = {
  completa: 'Completa',
  enCurso: 'En curso',
  pendiente: 'Pendiente',
}

export function summarizeJornadasVista(jornadas) {
  return {
    total: jornadas.length,
    completas: jornadas.filter((item) => item.estado === JORNADA_ESTADO.completa).length,
    enCurso: jornadas.filter((item) => item.estado === JORNADA_ESTADO.enCurso).length,
    pendientes: jornadas.filter((item) => item.estado === JORNADA_ESTADO.pendiente).length,
  }
}

function resolveEstado({ validCount, isToday }) {
  if (isToday) return JORNADA_ESTADO.enCurso
  if (validCount >= 2) return JORNADA_ESTADO.completa
  return JORNADA_ESTADO.pendiente
}

export function buildJornadas(fichadas, empleadoById = new Map(), { todayKey = todayDateKey() } = {}) {
  const annotated = annotateMovimientos(fichadas)
  const groups = new Map()

  annotated.forEach((fichada) => {
    if (!fichada.fechaHora) return
    const fecha = toDateKey(fichada.fechaHora)
    if (!fecha) return
    const key = `${empleadoMovimientoKey(fichada)}|${fecha}`

    if (!groups.has(key)) {
      groups.set(key, {
        empleadoId: fichada.empleadoId,
        empleado: fichada.empleado,
        legajo: fichada.legajo,
        fecha,
        movimientos: [],
      })
    }

    groups.get(key).movimientos.push(fichada)
  })

  return [...groups.values()]
    .map((group) => {
      const movimientos = [...group.movimientos].sort(
        (a, b) => new Date(a.fechaHora) - new Date(b.fechaHora),
      )
      const validos = validMovimientosForResumen(movimientos)
      const ingreso = validos[0] ?? null
      const egreso = validos.length >= 2 ? validos.at(-1) : null
      const intermedias = validos.length >= 3 ? validos.slice(1, -1) : []
      const isToday = group.fecha === todayKey
      const estado = resolveEstado({ validCount: validos.length, isToday })
      const empleado = empleadoById.get(Number(group.empleadoId))
      const horario = empleado?.horario ?? null
      const posiblesDuplicados = movimientos.filter((item) => item.esPosibleDuplicado).length

      let egresoHora = 'Pendiente'
      let egresoDefinitivo = false
      if (egreso) {
        egresoHora = isToday
          ? `${formatTime(egreso.fechaHora)} · última disponible`
          : formatTime(egreso.fechaHora)
        egresoDefinitivo = !isToday
      }

      return {
        empleadoId: group.empleadoId,
        empleado: group.empleado,
        legajo: group.legajo,
        fecha: group.fecha,
        horarioPrevisto: horarioPrevistoLabel(horario),
        ingresoHora: ingreso ? formatTime(ingreso.fechaHora) : 'Sin ingreso',
        egresoHora,
        egresoDefinitivo,
        metodoIngreso: ingreso ? displayMetodoLabel(ingreso.metodo) : '—',
        metodoEgreso: egreso ? displayMetodoLabel(egreso.metodo) : '—',
        tieneIngreso: Boolean(ingreso),
        tieneEgreso: Boolean(egreso),
        fichadasIntermedias: intermedias.length,
        fichadasIntermediasLabel: describeFichadasIntermedias(intermedias.length),
        posiblesDuplicados,
        estado,
        movimientos,
        validos,
      }
    })
    .sort((a, b) => {
      if (a.fecha !== b.fecha) return a.fecha < b.fecha ? 1 : -1
      return String(a.empleado ?? '').localeCompare(String(b.empleado ?? ''), 'es')
    })
}

export function buildJornadasCsvRows(jornadas) {
  return jornadas.map((item) => [
    item.empleado ?? '',
    item.legajo ?? '',
    item.fecha ?? '',
    item.horarioPrevisto ?? '',
    item.ingresoHora ?? '',
    item.egresoHora ?? '',
    String(item.fichadasIntermedias ?? 0),
    String(item.posiblesDuplicados ?? 0),
    item.estado ?? '',
  ])
}
