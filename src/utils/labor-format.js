/** Convierte minutos informados por la API. No aplica reglas laborales. */
export function formatMinutosInformados(value) {
  if (value == null || value === '') return null
  const number = Number(value)
  if (!Number.isFinite(number)) return null
  const sign = number < 0 ? '−' : ''
  const abs = Math.abs(Math.round(number))
  const hours = Math.floor(abs / 60)
  const minutes = abs % 60
  if (hours === 0) return `${sign}${minutes} min`
  if (minutes === 0) return `${sign}${hours} h`
  return `${sign}${hours} h ${String(minutes).padStart(2, '0')} min`
}

export function parseHora(value) {
  const match = String(value ?? '').trim().match(/^(\d{1,2}):(\d{2})/)
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours > 23 || minutes > 59) return null
  return hours * 60 + minutes
}

/** Diferencia de reloj entre dos horas del mismo día. No resta almuerzo. */
export function duracionReloj(entrada, salida) {
  const start = parseHora(entrada)
  const end = parseHora(salida)
  if (start == null || end == null || end <= start) return null
  return formatMinutosInformados(end - start)
}

export function horarioNocturnoNoSoportado(entrada, salida) {
  const start = parseHora(entrada)
  const end = parseHora(salida)
  return start != null && end != null && end <= start
}

/** Minutos netos: duración entre entrada y salida, con el descanso restado una sola vez. */
export function minutosNetosProgramados(entrada, salida, descanso) {
  const start = parseHora(entrada)
  const end = parseHora(salida)
  const restText = String(descanso ?? '').trim()
  if (start == null || end == null || start === end || !/^\d+$/.test(restText)) return null
  const rest = Number(restText)
  const span = end > start ? end - start : end + 24 * 60 - start
  if (rest >= span) return null
  return span - rest
}

/** Valor visible de un día. No forma parte del DTO. */
export function textoHorasProgramadas(entrada, salida, descanso) {
  const minutes = minutosNetosProgramados(entrada, salida, descanso)
  if (minutes == null) return { valido: false, texto: '—' }
  return { valido: true, texto: formatMinutosInformados(minutes) }
}

/** Mismo cálculo para la tabla: un valor, un rango, o sin días configurados. */
export function textoHorasProgramadasDias(dias) {
  const minutes = (Array.isArray(dias) ? dias : [])
    .map((dia) => minutosNetosProgramados(dia?.horaEntrada, dia?.horaSalida, dia?.minutosAlmuerzo))
    .filter((value) => value != null)
  if (!minutes.length) return 'Sin configurar'
  const min = Math.min(...minutes)
  const max = Math.max(...minutes)
  if (min === max) return formatMinutosInformados(min)
  if (min % 60 === 0 && max % 60 === 0) return `${min / 60}–${max / 60} h`
  return `${formatMinutosInformados(min)}–${formatMinutosInformados(max)}`
}

export const NOCTURNO_PENDIENTE =
  'El horario nocturno se habilitará cuando el servicio acepte una salida del día siguiente. Hoy el servicio solo admite horarios que terminan el mismo día.'

export function monthBounds(year, monthIndex) {
  const month = String(monthIndex + 1).padStart(2, '0')
  const last = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate()
  return {
    desde: `${year}-${month}-01`,
    hasta: `${year}-${month}-${String(last).padStart(2, '0')}`,
  }
}

export function shiftMonth(year, monthIndex, delta) {
  const date = new Date(Date.UTC(year, monthIndex + delta, 1))
  return { year: date.getUTCFullYear(), monthIndex: date.getUTCMonth() }
}

export const CALENDARIO_HEADERS = Object.freeze(['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'])

export function grillaMensual(year, monthIndex) {
  const bounds = monthBounds(year, monthIndex)
  const last = Number(bounds.hasta.slice(-2))
  const leading = (new Date(Date.UTC(year, monthIndex, 1)).getUTCDay() + 6) % 7
  const cells = Array.from({ length: leading }, () => null)
  for (let day = 1; day <= last; day += 1) {
    cells.push(`${bounds.desde.slice(0, 8)}${String(day).padStart(2, '0')}`)
  }
  while (cells.length % 7) cells.push(null)
  return { ...bounds, headers: CALENDARIO_HEADERS, cells }
}

function horaCorta(value) {
  const match = String(value ?? '').match(/(\d{1,2}):(\d{2})/)
  if (!match) return ''
  return `${String(match[1]).padStart(2, '0')}:${match[2]}`
}

export function turnoHabitual(dias) {
  const base = (Array.isArray(dias) ? dias : []).filter(
    (dia) => dia?.tieneTurnoAsignado && !dia.esDiaLibre && !dia.esExcepcionManual && horaCorta(dia.horaEntrada) && horaCorta(dia.horaSalida),
  )
  if (!base.length) return null
  const firma = (dia) => `${horaCorta(dia.horaEntrada)}|${horaCorta(dia.horaSalida)}|${Number(dia.minutosAlmuerzo) || 0}`
  const primera = firma(base[0])
  if (!base.every((dia) => firma(dia) === primera)) return null
  const entrada = horaCorta(base[0].horaEntrada)
  const salida = horaCorta(base[0].horaSalida)
  const almuerzo = Number(base[0].minutosAlmuerzo) || 0
  return {
    entrada,
    salida,
    almuerzo,
    texto: `Turno habitual: ${entrada}–${salida} · Almuerzo: ${almuerzo} min`,
  }
}

export function esExcepcionHoraria(dia, habitual) {
  if (!dia || dia.esDiaLibre) return false
  if (dia.esExcepcionManual) return true
  if (!habitual || !dia.tieneTurnoAsignado) return false
  const entrada = horaCorta(dia.horaEntrada)
  const salida = horaCorta(dia.horaSalida)
  if (!entrada || !salida) return false
  const almuerzo = Number(dia.minutosAlmuerzo)
  return entrada !== habitual.entrada
    || salida !== habitual.salida
    || (Number.isFinite(almuerzo) ? almuerzo : 0) !== habitual.almuerzo
}

const ETIQUETA_CELDA = Object.freeze({
  completa: 'Completa',
  incompleta: 'Incompleta',
  revisar: 'Revisar',
  enCurso: 'En curso',
  vacaciones: 'Vacaciones',
  sinRegistros: 'Sin registros',
  futuro: '',
  sinPrevista: 'Sin jornada prevista',
})

export function claseCeldaCalendario(codigo) {
  if (codigo === 'completa') return 'border-emerald-600/30 bg-emerald-50 text-emerald-950 dark:border-emerald-400/30 dark:bg-emerald-950/50 dark:text-emerald-100'
  if (codigo === 'incompleta') return 'border-orange-500/40 bg-orange-50 text-orange-950 dark:border-orange-400/40 dark:bg-orange-950/40 dark:text-orange-100'
  if (codigo === 'revisar') return 'border-amber-500/40 bg-amber-50 text-amber-950 dark:border-amber-400/40 dark:bg-amber-950/40 dark:text-amber-100'
  if (codigo === 'enCurso') return 'border-emerald-500/40 bg-emerald-50 text-emerald-950 dark:bg-emerald-950/40 dark:text-emerald-100 bg-[repeating-linear-gradient(135deg,transparent,transparent_4px,rgba(16,185,129,0.18)_4px,rgba(16,185,129,0.18)_8px)]'
  if (codigo === 'vacaciones') return 'border-violet-500/40 bg-violet-50 text-violet-950 dark:border-violet-400/30 dark:bg-violet-950/40 dark:text-violet-100'
  if (codigo === 'sinRegistros') return 'border-slate-300 bg-slate-100 text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300'
  if (codigo === 'sinPrevista' || codigo === 'futuro') return 'border-slate-200 bg-slate-50 text-slate-400 dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-500'
  return 'border-slate-200 bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100'
}

export function estadoCeldaCalendario({ dia = null, jornada = null, fecha = '', hoy = '', habitual = null, fichadasConocidas = true } = {}) {
  const prevista = Boolean(dia?.tieneTurnoAsignado)
  const movimientos = Array.isArray(jornada?.movimientos) ? jornada.movimientos.length : 0
  const estado = String(jornada?.estado ?? '')
  let codigo = ''
  if (fecha && hoy && fecha > hoy) codigo = 'futuro'
  else if (dia?.esDiaLibre) codigo = 'vacaciones'
  else if (estado === 'Revisar') codigo = 'revisar'
  else if (estado === 'Incompleta') codigo = 'incompleta'
  else if (estado === 'En curso') codigo = 'enCurso'
  else if (estado === 'Completa') codigo = 'completa'
  else if (prevista && fichadasConocidas && fecha && hoy && fecha < hoy && movimientos === 0) codigo = 'sinRegistros'
  else if (prevista && fecha && hoy && fecha > hoy) codigo = 'futuro'
  else if (!prevista) codigo = 'sinPrevista'
  const motivo = String(jornada?.motivo ?? '')
  return {
    codigo,
    etiqueta: ETIQUETA_CELDA[codigo] ?? '',
    sub: codigo === 'incompleta' && motivo === 'Falta fichada de salida' ? 'Sin salida' : '',
    excepcion: esExcepcionHoraria(dia, habitual),
    fichadasEnLibre: codigo === 'vacaciones' && movimientos > 0,
    motivo,
    prevista,
    fecha,
  }
}

export function ariaCeldaCalendario(fecha, estado) {
  const larga = new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(`${fecha}T00:00:00Z`))
    .replace(/\s+/g, ' ')
  const extra = []
  const frase = (texto) => (texto && !/[.]$/.test(texto) ? `${texto}.` : texto)
  if (estado?.codigo === 'completa') extra.push('Jornada completa.')
  else if (estado?.codigo === 'incompleta') extra.push('Jornada incompleta.', frase(estado.motivo || 'Incompleta'))
  else if (estado?.codigo === 'revisar') extra.push('Jornada a revisar.', frase(estado.motivo || 'Revisar'))
  else if (estado?.codigo === 'enCurso') extra.push('Jornada en curso.')
  else if (estado?.codigo === 'vacaciones') extra.push('Vacaciones / día libre.')
  else if (estado?.codigo === 'sinRegistros') extra.push('Sin registros.')
  else if (estado?.codigo === 'sinPrevista') extra.push('Sin jornada prevista.')
  if (estado?.fichadasEnLibre) extra.push('Hay movimientos registrados.')
  if (estado?.excepcion) extra.push('Excepción horaria.')
  if (estado?.codigo === 'futuro') return `${larga.replace(/\.+$/, '')}, fecha futura`
  const fechaTexto = /[.]$/.test(larga) ? larga : `${larga}.`
  return [fechaTexto, ...extra].join(' ').replace(/\s+/g, ' ').trim()
}

export function mesSinAtencion(items, hoy) {
  const lista = Array.isArray(items) ? items : []
  const bloquea = lista.some((item) => item?.excepcion || ['incompleta', 'revisar', 'vacaciones', 'sinRegistros'].includes(item?.codigo))
  const pasadas = lista.filter((item) => item?.prevista && item.fecha < hoy && item.codigo !== 'vacaciones')
  return !bloquea && pasadas.length > 0 && pasadas.every((item) => item.codigo === 'completa')
}

export function etiquetaSaldo(minutos) {
  const value = Number(minutos)
  if (!Number.isFinite(value)) return null
  const rounded = Math.round(value)
  const abs = Math.abs(rounded)
  const hours = Math.floor(abs / 60)
  const minutes = String(abs % 60).padStart(2, '0')
  if (rounded === 0) return 'Al día'
  if (rounded < 0) return `Debe ${hours} h ${minutes} min`
  return `A favor ${hours} h ${minutes} min`
}

function programadosInformados(value) {
  return typeof value === 'number' && Number.isFinite(value)
}

function minutosPositivos(value) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

export function presentarSaldo(resumen) {
  const programados = resumen?.minutosProgramados
  if (!programadosInformados(programados) || programados < 0) {
    return { valor: 'No disponible', detalle: 'El resumen no informó las horas programadas.' }
  }
  if (programados > 0) return { valor: etiquetaSaldo(resumen?.saldoMinutos) ?? '—', detalle: '' }
  const hayActividad = minutosPositivos(resumen?.actividadRegistrada)
    || minutosPositivos(resumen?.minutosTrabajados)
    || minutosPositivos(resumen?.minutosRepuestos)
  if (hayActividad) {
    return { valor: 'No calculable', detalle: 'No hay horas programadas informadas para este período.' }
  }
  return { valor: 'Sin jornada programada', detalle: '' }
}
