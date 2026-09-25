import {
  displayMetodoLabel,
  fichadaDateKey,
  fichadaSortKey,
  formatFichadaHora,
  horarioPrevistoLabel,
  todayDateKey,
} from './format.js'
import {
  annotateMovimientos,
  describeFichadasIntermedias,
  empleadoMovimientoKey,
} from './movimientos.js'

export const JORNADA_ESTADO = {
  completa: 'Completa',
  enCurso: 'En curso',
  incompleta: 'Incompleta',
  revisar: 'Revisar',
}

function minutesOf(value) {
  const match = String(fichadaSortKey(value) ?? '').match(/T(\d{2}):(\d{2})/)
  if (!match) return null
  return Number(match[1]) * 60 + Number(match[2])
}

export function formatActividadRegistrada(minutes) {
  const safe = Math.max(0, Math.round(minutes))
  const hours = Math.floor(safe / 60)
  const rest = safe % 60
  if (hours === 0) return `${rest} min`
  if (rest === 0) return `${hours} h`
  return `${hours} h ${String(rest).padStart(2, '0')} min`
}

export function actividadRegistradaLabel({ ingreso, egreso, estado, now = new Date() }) {
  if (estado === JORNADA_ESTADO.incompleta) return '—'
  const start = ingreso ? minutesOf(ingreso.fechaHora) : null
  if (start == null) return '—'
  if (!egreso) {
    if (estado === JORNADA_ESTADO.enCurso) {
      const current = minutesOf(now)
      const startDate = String(ingreso.fechaHora).slice(0, 10)
      const nowDate = String(fichadaSortKey(now)).slice(0, 10)
      if (current == null || (nowDate === startDate && current < start)) return '—'
      const span = nowDate === startDate ? current - start : current + 24 * 60 - start
      return `${formatActividadRegistrada(span)} (provisional)`
    }
    return '—'
  }
  const end = minutesOf(egreso.fechaHora)
  if (end == null || end < start) return '—'
  const label = formatActividadRegistrada(end - start)
  return estado === JORNADA_ESTADO.revisar ? `${label} (a revisar)` : label
}

export function summarizeJornadasVista(jornadas) {
  return {
    total: jornadas.length,
    completas: jornadas.filter((item) => item.estado === JORNADA_ESTADO.completa).length,
    enCurso: jornadas.filter((item) => item.estado === JORNADA_ESTADO.enCurso).length,
    incompletas: jornadas.filter((item) => item.estado === JORNADA_ESTADO.incompleta).length,
    revisar: jornadas.filter((item) => item.estado === JORNADA_ESTADO.revisar).length,
  }
}

export function buildJornadas(fichadas, empleadoById = new Map(), { todayKey = todayDateKey(), now } = {}) {
  const horarioByEmpleado = new Map()
  empleadoById.forEach((empleado, id) => horarioByEmpleado.set(Number(id), empleado?.horario ?? ''))
  const referenceNow = now ?? new Date()
  const annotated = annotateMovimientos(fichadas, { now: referenceNow, horarioByEmpleado })
  const groups = new Map()

  annotated.forEach((fichada) => {
    if (!fichada.fechaHora) return
    const fecha = fichada.jornadaFecha || fichadaDateKey(fichada.fechaHora)
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
        (a, b) => new Date(a.fechaHora) - new Date(b.fechaHora) || Number(a.id) - Number(b.id),
      )
      const validos = movimientos
      const efectivos = movimientos.filter((item) => !item.esPosibleDuplicado)
      const ingreso = efectivos[0] ?? movimientos[0] ?? null
      const egreso = efectivos.length >= 2 ? efectivos.at(-1) : null
      const intermedias = efectivos.filter((item) => item.esMovimientoIntermedio)
      const estado = ingreso?.jornadaEstado || JORNADA_ESTADO.incompleta
      const motivo = ingreso?.jornadaMotivo || ''
      const actividadRegistrada = actividadRegistradaLabel({
        ingreso: efectivos[0] ?? null,
        egreso: estado === JORNADA_ESTADO.completa || estado === JORNADA_ESTADO.revisar ? egreso : null,
        estado,
        now: referenceNow,
      })
      const empleado = empleadoById.get(Number(group.empleadoId))
      const horario = empleado?.horario ?? null
      const posiblesDuplicados = movimientos.filter((item) => item.esPosibleDuplicado).length

      let egresoHora = 'Sin salida'
      let egresoDefinitivo = false
      if (estado === JORNADA_ESTADO.enCurso) {
        egresoHora = 'En curso'
      } else if (egreso && estado !== JORNADA_ESTADO.incompleta) {
        egresoHora = formatFichadaHora(egreso.fechaHora)
        egresoDefinitivo = estado === JORNADA_ESTADO.completa
      }

      return {
        empleadoId: group.empleadoId,
        empleado: group.empleado,
        legajo: group.legajo,
        fecha: group.fecha,
        horarioPrevisto: horarioPrevistoLabel(horario),
        ingresoHora: ingreso ? formatFichadaHora(ingreso.fechaHora) : 'Sin ingreso',
        egresoHora,
        egresoDefinitivo,
        metodoIngreso: ingreso ? displayMetodoLabel(ingreso.metodo) : '—',
        metodoEgreso: egreso ? displayMetodoLabel(egreso.metodo) : '—',
        tieneIngreso: Boolean(ingreso),
        tieneEgreso: Boolean(egreso),
        fichadasIntermedias: intermedias.length,
        fichadasIntermediasLabel: intermedias.length ? String(intermedias.length) : '—',
        actividadRegistrada,
        motivo,
        posiblesDuplicados,
        advertencia: posiblesDuplicados
          ? `${posiblesDuplicados} posible${posiblesDuplicados === 1 ? '' : 's'} duplicado${posiblesDuplicados === 1 ? '' : 's'}`
          : '',
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
