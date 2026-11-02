import { buildCsv } from './csv.js'
import { fichadaDateKey, formatFichadaHora } from './format.js'
import { buildJornadas, JORNADA_ESTADO } from './jornadas.js'
import { formatMinutosInformados, parseHora } from './labor-format.js'
import { addCalendarDays } from './period.js'

export const INCIDENCIA = Object.freeze({
  todas: 'todas',
  llegadaTarde: 'llegada-tarde',
  salidaAnticipada: 'salida-anticipada',
  dentroTolerancia: 'dentro-tolerancia',
  incompleta: 'incompleta',
  sinInformacion: 'sin-informacion',
  fueraHorario: 'fuera-horario',
})

export const FILTROS_INCIDENCIA = Object.freeze([
  { id: INCIDENCIA.todas, label: 'Todas' },
  { id: INCIDENCIA.llegadaTarde, label: 'Llegadas tarde' },
  { id: INCIDENCIA.salidaAnticipada, label: 'Salidas anticipadas' },
  { id: INCIDENCIA.dentroTolerancia, label: 'Dentro de tolerancia' },
  { id: INCIDENCIA.incompleta, label: 'Jornadas incompletas' },
  { id: INCIDENCIA.sinInformacion, label: 'Sin información suficiente' },
])

const ETIQUETA = Object.freeze({
  aTiempo: 'A tiempo',
  dentro: 'Dentro de tolerancia',
  tarde: 'Llegada tarde',
  anticipada: 'Salida anticipada',
  incompleta: 'Jornada incompleta',
  sinInformacion: 'Sin información suficiente',
  sinRegistros: 'Sin registros',
})

export function rangoMes(hoy) {
  const match = String(hoy ?? '').match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return { desde: '', hasta: '' }
  const year = Number(match[1])
  const month = Number(match[2])
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return {
    desde: `${match[1]}-${match[2]}-01`,
    hasta: `${match[1]}-${match[2]}-${String(last).padStart(2, '0')}`,
  }
}

export function rangoInforme(periodo, hoy, customDesde = '', customHasta = '') {
  if (periodo === 'hoy') return { desde: hoy, hasta: hoy }
  if (periodo === '7') return { desde: addCalendarDays(hoy, -6), hasta: hoy }
  if (periodo === '30') return { desde: addCalendarDays(hoy, -29), hasta: hoy }
  if (periodo === 'personalizado' && customDesde && customHasta) return { desde: customDesde, hasta: customHasta }
  return rangoMes(hoy)
}

function diaSiguiente(fecha) {
  return addCalendarDays(fecha, 1)
}

export function minutosOperativos(fechaOperativa, fechaHora) {
  const key = fichadaDateKey(fechaHora)
  const minutos = parseHora(formatFichadaHora(fechaHora))
  if (!fechaOperativa || !key || minutos == null) return null
  if (key === fechaOperativa) return minutos
  if (key === diaSiguiente(fechaOperativa)) return minutos + 24 * 60
  return null
}

export function horarioPrevistoMinutos(horaEntrada, horaSalida) {
  const entrada = parseHora(horaEntrada)
  const salida = parseHora(horaSalida)
  if (entrada == null || salida == null) return null
  return {
    entrada,
    salida: salida <= entrada ? salida + 24 * 60 : salida,
    nocturno: salida <= entrada,
  }
}

export function clasificarLlegada(real, prevista, tolerancia) {
  const diferencia = real - prevista
  const margen = Math.max(0, Number(tolerancia) || 0)
  if (diferencia <= 0) {
    return { codigo: 'a-tiempo', etiqueta: ETIQUETA.aTiempo, diferencia, exceso: 0 }
  }
  if (diferencia <= margen) {
    return { codigo: INCIDENCIA.dentroTolerancia, etiqueta: ETIQUETA.dentro, diferencia, exceso: 0 }
  }
  return { codigo: INCIDENCIA.llegadaTarde, etiqueta: ETIQUETA.tarde, diferencia, exceso: diferencia - margen }
}

export function clasificarSalida(real, prevista, tolerancia) {
  const diferencia = prevista - real
  const margen = Math.max(0, Number(tolerancia) || 0)
  if (diferencia <= 0) {
    return { codigo: 'a-tiempo', etiqueta: ETIQUETA.aTiempo, diferencia: real - prevista, exceso: 0 }
  }
  if (diferencia <= margen) {
    return { codigo: INCIDENCIA.dentroTolerancia, etiqueta: ETIQUETA.dentro, diferencia, exceso: 0 }
  }
  return { codigo: INCIDENCIA.salidaAnticipada, etiqueta: ETIQUETA.anticipada, diferencia, exceso: diferencia - margen }
}

function resultado(codigo, etiqueta) {
  return { codigo, etiqueta }
}

function horarioTexto(dia) {
  const entrada = String(dia?.horaEntrada ?? '').slice(0, 5)
  const salida = String(dia?.horaSalida ?? '').slice(0, 5)
  return entrada && salida ? `${entrada}–${salida}` : ''
}

function descansoInformado(dia) {
  const value = dia?.minutosAlmuerzo
  if (value == null || value === '') return null
  const number = Number(value)
  return Number.isInteger(number) && number >= 0 ? number : null
}

export function evaluarJornada({
  fecha,
  hoy,
  calendario = null,
  entradaFechaHora = null,
  salidaFechaHora = null,
  estadoJornada = '',
  truncado = false,
} = {}) {
  if (!fecha || !hoy || fecha > hoy) return null
  if (calendario?.esDiaLibre && !entradaFechaHora && !salidaFechaHora) return null

  const horario = horarioPrevistoMinutos(calendario?.horaEntrada, calendario?.horaSalida)
  const tieneHorario = Boolean(calendario?.tieneHorarioConfigurado && horario)
  const tolerancia = Number(calendario?.toleranciaMinutos)
  const toleranciaOk = Number.isInteger(tolerancia) && tolerancia >= 0
  const revisar = estadoJornada === JORNADA_ESTADO.revisar
  const enCurso = estadoJornada === JORNADA_ESTADO.enCurso
  const hayMarcas = Boolean(entradaFechaHora || salidaFechaHora)
  const incompleta = estadoJornada === JORNADA_ESTADO.incompleta || (hayMarcas && !salidaFechaHora && !enCurso && !revisar)
  const laborable = Boolean(calendario?.tieneTurnoAsignado && tieneHorario && !calendario?.esDiaLibre)
  const programados = laborable && (fecha < hoy || hayMarcas) && Number.isFinite(Number(calendario?.minutosProgramados))
    ? Math.max(0, Number(calendario.minutosProgramados))
    : null

  if (!hayMarcas) {
    if (truncado || fecha >= hoy || !laborable) return null
    return base({
      fecha,
      calendario,
      minutosProgramados: programados,
      minutosTrabajados: 0,
      saldo: programados == null ? null : -programados,
      resultados: [resultado('sin-registros', ETIQUETA.sinRegistros)],
      tolerancia: toleranciaOk ? tolerancia : null,
    })
  }

  const entradaMin = entradaFechaHora ? minutosOperativos(fecha, entradaFechaHora) : null
  const salidaMin = salidaFechaHora ? minutosOperativos(fecha, salidaFechaHora) : null
  const marcasFueraDeFecha = (entradaFechaHora && entradaMin == null) || (salidaFechaHora && salidaMin == null)
  const puedeClasificar = tieneHorario && toleranciaOk && !revisar && !calendario?.esDiaLibre && !marcasFueraDeFecha
  const resultados = []
  let diferenciaEntrada = null
  let excesoEntrada = null
  let diferenciaSalida = null
  let excesoSalida = null

  if (!puedeClasificar) {
    resultados.push(resultado(INCIDENCIA.sinInformacion, ETIQUETA.sinInformacion))
  } else {
    if (entradaMin != null) {
      const llegada = clasificarLlegada(entradaMin, horario.entrada, tolerancia)
      diferenciaEntrada = llegada.diferencia
      excesoEntrada = llegada.exceso
      resultados.push(llegada)
    }
    if (salidaMin != null) {
      const salida = clasificarSalida(salidaMin, horario.salida, tolerancia)
      diferenciaSalida = salida.diferencia
      excesoSalida = salida.exceso
      if (salida.codigo !== 'a-tiempo' || !resultados.some((item) => item.codigo === 'a-tiempo')) resultados.push(salida)
    }
  }

  if (incompleta) resultados.push(resultado(INCIDENCIA.incompleta, ETIQUETA.incompleta))
  if (!resultados.length) resultados.push(resultado(INCIDENCIA.sinInformacion, ETIQUETA.sinInformacion))

  let trabajados = null
  if (entradaMin != null && salidaMin != null && salidaMin >= entradaMin && !revisar) {
    const descanso = descansoInformado(calendario)
    if (descanso != null) trabajados = Math.max(0, salidaMin - entradaMin - descanso)
  } else if (!hayMarcas) {
    trabajados = 0
  }
  const saldo = programados != null && trabajados != null ? trabajados - programados : null

  return base({
    fecha,
    calendario,
    minutosProgramados: programados,
    minutosTrabajados: trabajados,
    saldo,
    resultados: dedupe(resultados),
    tolerancia: toleranciaOk ? tolerancia : null,
    diferenciaEntrada,
    excesoEntrada,
    diferenciaSalida,
    excesoSalida,
    estadoRevision: incompleta || revisar ? 'Pendiente de revisión' : '',
  })
}

function dedupe(resultados) {
  const seen = new Set()
  return resultados.filter((item) => {
    const key = `${item.codigo}:${item.etiqueta}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function base({ calendario, ...fields }) {
  return {
    minutosProgramados: null,
    minutosTrabajados: null,
    saldo: null,
    diferenciaEntrada: null,
    excesoEntrada: null,
    diferenciaSalida: null,
    excesoSalida: null,
    tolerancia: null,
    estadoRevision: '',
    horarioPrevisto: horarioTexto(calendario),
    ...fields,
  }
}

export function turnoVigente(asignaciones, fecha) {
  const vigentes = (asignaciones ?? []).filter((item) => item?.fechaInicio && item.fechaInicio <= fecha && (!item.fechaFin || item.fechaFin >= fecha))
  vigentes.sort((a, b) => String(b.fechaInicio).localeCompare(String(a.fechaInicio)))
  return vigentes[0] ?? null
}

function sumar(valores) {
  if (valores.some((value) => value == null || !Number.isFinite(Number(value)))) return null
  return valores.reduce((total, value) => total + Number(value), 0)
}

export function indicadoresInforme(filas) {
  return (filas ?? []).reduce((total, fila) => {
    const codigos = new Set((fila.resultados ?? []).map((item) => item.codigo))
    if (codigos.has(INCIDENCIA.llegadaTarde)) total.llegadasTarde += 1
    if (codigos.has(INCIDENCIA.salidaAnticipada)) total.salidasAnticipadas += 1
    if (codigos.has(INCIDENCIA.incompleta)) total.incompletas += 1
    total.minutosFuera += Number(fila.excesoEntrada ?? 0) + Number(fila.excesoSalida ?? 0)
    return total
  }, { llegadasTarde: 0, salidasAnticipadas: 0, incompletas: 0, minutosFuera: 0 })
}

export function filaCoincideIncidencia(fila, incidencia) {
  if (!incidencia || incidencia === INCIDENCIA.todas) return true
  if (incidencia === INCIDENCIA.fueraHorario) return Number(fila.excesoEntrada ?? 0) > 0 || Number(fila.excesoSalida ?? 0) > 0
  return (fila.resultados ?? []).some((item) => item.codigo === incidencia)
}

export function resumirEmpleados(filas) {
  const grupos = new Map()
  for (const fila of filas ?? []) {
    const key = String(fila.empleadoId ?? fila.empleado ?? '')
    if (!grupos.has(key)) grupos.set(key, [])
    grupos.get(key).push(fila)
  }
  return [...grupos.values()].map((items) => {
    const primero = items[0]
    const codigos = (codigo) => items.filter((fila) => fila.resultados.some((item) => item.codigo === codigo)).length
    return {
      empleadoId: primero.empleadoId ?? null,
      legajo: primero.legajo ?? '',
      empleado: primero.empleado ?? '',
      departamento: primero.departamento ?? '',
      sucursal: primero.sucursal ?? '',
      jornadasEvaluadas: items.length,
      llegadasTarde: codigos(INCIDENCIA.llegadaTarde),
      minutosTardanza: items.reduce((total, fila) => total + Number(fila.excesoEntrada ?? 0), 0),
      salidasAnticipadas: codigos(INCIDENCIA.salidaAnticipada),
      minutosSalidaAnticipada: items.reduce((total, fila) => total + Number(fila.excesoSalida ?? 0), 0),
      jornadasIncompletas: codigos(INCIDENCIA.incompleta),
      minutosProgramados: sumar(items.map((fila) => fila.minutosProgramados)),
      minutosTrabajados: sumar(items.map((fila) => fila.minutosTrabajados)),
      saldo: sumar(items.map((fila) => fila.saldo)),
    }
  })
}

function alertaKey(alerta) {
  const fecha = fichadaDateKey(alerta?.fechaHora)
  if (!fecha || !alerta?.empleadoId) return ''
  return `${alerta.empleadoId}|${fecha}`
}

export function armarInforme({
  empleados = [],
  fichadas = [],
  calendariosPorEmpleado = new Map(),
  asignacionesPorEmpleado = new Map(),
  alertas = [],
  hoy,
  now = new Date(),
  truncado = false,
  filtros = {},
} = {}) {
  const alcance = (empleados ?? []).filter((empleado) => {
    if (filtros.empleadoId && String(empleado.id) !== String(filtros.empleadoId)) return false
    if (filtros.departamentoId && String(empleado.departamentoId ?? '') !== String(filtros.departamentoId)) return false
    if (filtros.sucursalId && String(empleado.sucursalId ?? '') !== String(filtros.sucursalId)) return false
    return empleado.activo !== false
  })
  const porId = new Map(alcance.map((empleado) => [Number(empleado.id), empleado]))
  const jornadas = buildJornadas(fichadas, porId, { todayKey: hoy, now })
  const porFecha = new Map()
  for (const jornada of jornadas) {
    const id = Number(jornada.empleadoId)
    if (!porId.has(id)) continue
    porFecha.set(`${id}|${jornada.fecha}`, jornada)
  }
  const pendientes = new Set((alertas ?? []).map(alertaKey).filter(Boolean))
  const detalle = []

  for (const empleado of alcance) {
    const id = Number(empleado.id)
    const dias = calendariosPorEmpleado.get(id)
    const asignaciones = asignacionesPorEmpleado.get(id) ?? []
    const fechas = new Set(Array.isArray(dias) ? dias.map((dia) => dia.fecha) : [])
    for (const [key, jornada] of porFecha) {
      if (Number(jornada.empleadoId) === id) fechas.add(jornada.fecha || key.split('|')[1])
    }
    for (const fecha of [...fechas].filter(Boolean).sort()) {
      const jornada = porFecha.get(`${id}|${fecha}`) ?? null
      const calendario = Array.isArray(dias) ? dias.find((dia) => dia.fecha === fecha) ?? null : null
      const marcaEntrada = jornada?.movimientos?.find((item) => !item.esPosibleDuplicado) ?? null
      const efectivos = (jornada?.movimientos ?? []).filter((item) => !item.esPosibleDuplicado)
      const marcaSalida = jornada?.egresoDefinitivo || jornada?.estado === JORNADA_ESTADO.completa || jornada?.estado === JORNADA_ESTADO.revisar
        ? efectivos.at(-1) ?? null
        : null
      const evaluada = evaluarJornada({
        fecha,
        hoy,
        calendario,
        entradaFechaHora: marcaEntrada?.fechaHora ?? null,
        salidaFechaHora: marcaSalida && marcaSalida !== marcaEntrada ? marcaSalida.fechaHora : null,
        estadoJornada: jornada?.estado ?? '',
        truncado,
      })
      if (!evaluada) continue
      const turno = turnoVigente(asignaciones, fecha)
      const revisionAlerta = pendientes.has(`${id}|${fecha}`)
      detalle.push({
        ...evaluada,
        empleadoId: id,
        legajo: empleado.legajo ?? jornada?.legajo ?? '',
        empleado: [empleado.nombre, empleado.apellido].filter(Boolean).join(' ') || jornada?.empleado || '',
        departamento: empleado.departamento ?? '',
        sucursal: empleado.sucursal ?? '',
        turno: turno?.nombreTurno ?? '',
        entrada: marcaEntrada ? formatFichadaHora(marcaEntrada.fechaHora) : '',
        salida: marcaSalida && marcaSalida !== marcaEntrada ? formatFichadaHora(marcaSalida.fechaHora) : '',
        estadoRevision: evaluada.estadoRevision || (revisionAlerta ? 'Pendiente de revisión' : ''),
      })
    }
  }

  detalle.sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)) || String(a.empleado).localeCompare(String(b.empleado), 'es'))
  return {
    detalle,
    resumenEmpleados: resumirEmpleados(detalle),
    indicadores: indicadoresInforme(detalle),
    truncado: Boolean(truncado),
  }
}

export function filtrarDetalle(detalle, incidencia) {
  return (detalle ?? []).filter((fila) => filaCoincideIncidencia(fila, incidencia))
}

export function textoVacioInforme({ requiereEmpleado = false, empleadoId = '', cantidad = 0 } = {}) {
  if (requiereEmpleado && !empleadoId) {
    return {
      titulo: 'Seleccioná un empleado',
      detalle: 'Elegí un empleado para consultar su asistencia.',
    }
  }
  if (!cantidad) {
    return {
      titulo: 'No hay incidencias para mostrar',
      detalle: 'No encontramos registros con los filtros seleccionados.',
    }
  }
  return null
}

function celda(valor) {
  if (valor == null || valor === '') return ''
  return String(valor)
}

function minutosCsv(valor) {
  return valor == null || !Number.isFinite(Number(valor)) ? '' : String(Math.round(Number(valor)))
}

export const DETALLE_CSV_HEADERS = Object.freeze([
  'Fecha',
  'Legajo',
  'Empleado',
  'Departamento',
  'Sucursal',
  'Turno',
  'Horario previsto',
  'Entrada registrada',
  'Salida registrada',
  'Tolerancia aplicada',
  'Resultado',
  'Diferencia total',
  'Exceso sobre tolerancia',
  'Minutos programados',
  'Minutos trabajados',
  'Saldo',
  'Estado de revisión',
])

export const RESUMEN_CSV_HEADERS = Object.freeze([
  'Legajo',
  'Empleado',
  'Departamento',
  'Sucursal',
  'Jornadas evaluadas',
  'Llegadas tarde',
  'Minutos de tardanza',
  'Salidas anticipadas',
  'Minutos de salida anticipada',
  'Jornadas incompletas',
  'Minutos programados',
  'Minutos trabajados',
  'Saldo',
])

function diferenciasCsv(fila) {
  const partes = []
  if (fila.diferenciaEntrada != null) partes.push(`Entrada ${fila.diferenciaEntrada}`)
  if (fila.diferenciaSalida != null) partes.push(`Salida ${fila.diferenciaSalida}`)
  return partes.join(' | ')
}

function excesosCsv(fila) {
  const partes = []
  if (Number(fila.excesoEntrada) > 0) partes.push(`Entrada ${fila.excesoEntrada}`)
  if (Number(fila.excesoSalida) > 0) partes.push(`Salida ${fila.excesoSalida}`)
  return partes.join(' | ')
}

export function filasCsvDetalle(filas) {
  return (filas ?? []).map((fila) => [
    celda(fila.fecha),
    celda(fila.legajo),
    celda(fila.empleado),
    celda(fila.departamento),
    celda(fila.sucursal),
    celda(fila.turno),
    celda(fila.horarioPrevisto),
    celda(fila.entrada),
    celda(fila.salida),
    fila.tolerancia == null ? '' : String(fila.tolerancia),
    (fila.resultados ?? []).map((item) => item.etiqueta).join(' | '),
    diferenciasCsv(fila),
    excesosCsv(fila),
    minutosCsv(fila.minutosProgramados),
    minutosCsv(fila.minutosTrabajados),
    minutosCsv(fila.saldo),
    celda(fila.estadoRevision),
  ])
}

export function filasCsvResumen(filas) {
  return resumirEmpleados(filas).map((fila) => [
    celda(fila.legajo),
    celda(fila.empleado),
    celda(fila.departamento),
    celda(fila.sucursal),
    String(fila.jornadasEvaluadas),
    String(fila.llegadasTarde),
    String(fila.minutosTardanza),
    String(fila.salidasAnticipadas),
    String(fila.minutosSalidaAnticipada),
    String(fila.jornadasIncompletas),
    minutosCsv(fila.minutosProgramados),
    minutosCsv(fila.minutosTrabajados),
    minutosCsv(fila.saldo),
  ])
}

export function csvInforme(tipo, filas) {
  const headers = tipo === 'resumen' ? RESUMEN_CSV_HEADERS : DETALLE_CSV_HEADERS
  const rows = tipo === 'resumen' ? filasCsvResumen(filas) : filasCsvDetalle(filas)
  rows.push(['Informe operativo'])
  return buildCsv(headers, rows)
}

export function nombreExportInforme(tipo, fecha, extension) {
  const stamp = /^\d{4}-\d{2}-\d{2}/.test(String(fecha ?? '')) ? String(fecha).slice(0, 10) : 'periodo'
  const clase = tipo === 'resumen' ? 'resumen' : 'detalle'
  return `informe-asistencia-${clase}-${stamp}.${extension}`
}

export function nombreCsvInforme(tipo, desde) {
  return nombreExportInforme(tipo, desde, 'csv')
}

export function textoDiferencia(fila) {
  const partes = []
  if (fila.diferenciaEntrada != null) partes.push(`Entrada ${formatMinutosInformados(fila.diferenciaEntrada)}`)
  if (fila.diferenciaSalida != null) partes.push(`Salida ${formatMinutosInformados(fila.diferenciaSalida)}`)
  return partes.join(' · ')
}

export function textoExceso(fila) {
  const partes = []
  if (Number(fila.excesoEntrada) > 0) partes.push(`Entrada ${formatMinutosInformados(fila.excesoEntrada)}`)
  if (Number(fila.excesoSalida) > 0) partes.push(`Salida ${formatMinutosInformados(fila.excesoSalida)}`)
  return partes.join(' · ')
}
