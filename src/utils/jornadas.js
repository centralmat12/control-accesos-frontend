import {
  displayMetodoLabel,
  esTipoEntrada,
  esTipoSalida,
  formatTime,
  horarioPrevistoLabel,
  toDateKey,
} from './format.js'

export function buildJornadas(fichadas, empleadoById = new Map()) {
  const groups = new Map()

  fichadas.forEach((fichada) => {
    if (!fichada.fechaHora) return

    const fecha = toDateKey(fichada.fechaHora)
    if (!fecha) return
    const empleadoKey = fichada.empleadoId ?? `${fichada.empleado}|${fichada.legajo}`
    const key = `${empleadoKey}|${fecha}`

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
      const byTime = (a, b) => new Date(a.fechaHora) - new Date(b.fechaHora)
      const entradas = group.movimientos.filter((item) => esTipoEntrada(item.tipo)).sort(byTime)
      const salidas = group.movimientos.filter((item) => esTipoSalida(item.tipo)).sort(byTime)
      const ingreso = entradas[0] ?? null
      const egreso = salidas.length ? salidas[salidas.length - 1] : null
      const empleado = empleadoById.get(Number(group.empleadoId))
      const horario = empleado?.horario ?? null

      return {
        empleadoId: group.empleadoId,
        empleado: group.empleado,
        legajo: group.legajo,
        fecha: group.fecha,
        horarioPrevisto: horarioPrevistoLabel(horario),
        ingresoHora: ingreso ? formatTime(ingreso.fechaHora) : 'Sin ingreso',
        egresoHora: egreso ? formatTime(egreso.fechaHora) : 'Pendiente',
        metodoIngreso: ingreso ? displayMetodoLabel(ingreso.metodo) : '—',
        metodoEgreso: egreso ? displayMetodoLabel(egreso.metodo) : '—',
        tieneIngreso: Boolean(ingreso),
        tieneEgreso: Boolean(egreso),
      }
    })
    .sort((a, b) => {
      if (a.fecha !== b.fecha) return a.fecha < b.fecha ? 1 : -1
      return String(a.empleado ?? '').localeCompare(String(b.empleado ?? ''), 'es')
    })
}
