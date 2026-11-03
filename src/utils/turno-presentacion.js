import { normalizarFiltro } from './format.js'
import { formatMinutosInformados, minutosNetosProgramados, parseHora, textoHorasProgramadas } from './labor-format.js'

export const INTERVALO_HORA_MINUTOS = 15
export const DESCANSOS_MINUTOS = Object.freeze([0, 15, 30, 45, 60, 75, 90, 120])
export const DESCANSO_AYUDA = 'Tiempo de descanso que se descuenta de la jornada programada.'

const ORDEN_SEMANA = [1, 2, 3, 4, 5, 6, 0]
const DIA_CORTO = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

export function horaTexto(value) {
  const minutes = parseHora(value)
  if (minutes == null) return ''
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
}

export function opcionesHora(actual = '') {
  const options = []
  for (let minute = 0; minute < 24 * 60; minute += INTERVALO_HORA_MINUTOS) {
    options.push(`${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`)
  }
  const extra = horaTexto(actual)
  if (extra && !options.includes(extra)) options.push(extra)
  return options.sort((a, b) => a.localeCompare(b))
}

export const MENSAJE_DESCANSO_OBLIGATORIO = 'Ingresá los minutos de descanso. Usá 0 si no corresponde.'
export const MENSAJE_DESCANSO_NEGATIVO = 'El descanso no puede ser negativo.'
export const MENSAJE_DESCANSO_ENTERO = 'Ingresá una cantidad entera de minutos.'
export const MENSAJE_DESCANSO_DURACION = 'El descanso debe ser menor que la duración de la jornada.'

export const ACCESOS_DESCANSO = Object.freeze([
  Object.freeze({ minutos: 0, etiqueta: 'Sin descanso' }),
  Object.freeze({ minutos: 30, etiqueta: '30 min' }),
  Object.freeze({ minutos: 45, etiqueta: '45 min' }),
  Object.freeze({ minutos: 60, etiqueta: '60 min' }),
])

export function etiquetaDescanso(value) {
  return Number(value) === 0 ? 'Sin descanso' : `${Number(value)} min`
}

export function minutosAlmuerzoCargado(valor) {
  if (valor == null || valor === '') return null
  const number = Number(valor)
  return Number.isInteger(number) ? number : null
}

export function valorCampoDescanso(valor) {
  const number = minutosAlmuerzoCargado(valor)
  return number == null || number < 0 ? '' : String(number)
}

export function notaDescanso(valor) {
  return String(valor ?? '').trim() === '0' ? 'Sin descanso' : ''
}

export function textoJornadaNeta(entrada, salida, descanso) {
  const resumen = textoHorasProgramadas(entrada, salida, descanso)
  return resumen.valido ? `${resumen.texto} netas` : '—'
}

export function parseMinutosAlmuerzo(value) {
  const text = String(value ?? '').trim()
  if (!text) return { ok: false, message: MENSAJE_DESCANSO_OBLIGATORIO }
  if (text.startsWith('-')) return { ok: false, message: MENSAJE_DESCANSO_NEGATIVO }
  if (!/^\d+$/.test(text)) return { ok: false, message: MENSAJE_DESCANSO_ENTERO }
  return { ok: true, value: Number(text) }
}

export function opcionesDescanso(actual) {
  const values = [...DESCANSOS_MINUTOS]
  const number = Number(actual)
  if (Number.isInteger(number) && number > 0 && !values.includes(number)) values.push(number)
  return values.sort((a, b) => a - b)
}

export function validarTramoTurno(entrada, salida, descanso) {
  const start = parseHora(entrada)
  const end = parseHora(salida)
  if (start == null || end == null) return { ok: false, message: 'Completá la entrada y la salida.' }
  if (start === end) return { ok: false, message: 'La entrada y la salida no pueden ser iguales.' }
  const minutos = parseMinutosAlmuerzo(descanso)
  if (!minutos.ok) return minutos
  const netos = minutosNetosProgramados(entrada, salida, minutos.value)
  if (netos == null) return { ok: false, message: MENSAJE_DESCANSO_DURACION }
  return { ok: true, minutos: netos, descanso: minutos.value }
}

export function minutosSemanalesProgramados(dias) {
  const list = Array.isArray(dias) ? dias : []
  if (!list.length) return null
  let total = 0
  for (const dia of list) {
    const net = minutosNetosProgramados(dia?.horaEntrada, dia?.horaSalida, dia?.minutosAlmuerzo)
    if (net == null) return null
    total += net
  }
  return total
}

export function textoHorasSemanales(dias) {
  const total = minutosSemanalesProgramados(dias)
  return total == null ? '—' : formatMinutosInformados(total)
}

export function textoDiasConfigurados(dias) {
  const count = (Array.isArray(dias) ? dias : []).filter((dia) => {
    const value = Number(dia?.diaSemana)
    return Number.isInteger(value) && value >= 0 && value <= 6
  }).length
  if (count === 0) return 'Sin días configurados'
  if (count === 1) return '1 día'
  return `${count} días`
}

export function textoHorarioHabitual(dias) {
  const ordered = (Array.isArray(dias) ? dias : [])
    .map((dia) => {
      const entrada = horaTexto(dia?.horaEntrada)
      const salida = horaTexto(dia?.horaSalida)
      const diaSemana = Number(dia?.diaSemana)
      if (!entrada || !salida || !Number.isInteger(diaSemana)) return null
      return { diaSemana, entrada, salida, key: `${entrada}|${salida}` }
    })
    .filter(Boolean)
    .sort((a, b) => ORDEN_SEMANA.indexOf(a.diaSemana) - ORDEN_SEMANA.indexOf(b.diaSemana))

  if (!ordered.length) return '—'

  const groups = []
  for (const dia of ordered) {
    const last = groups.at(-1)
    const consecutive = last
      && ORDEN_SEMANA.indexOf(dia.diaSemana) === ORDEN_SEMANA.indexOf(last.days.at(-1)) + 1
    if (last && last.key === dia.key && consecutive) last.days.push(dia.diaSemana)
    else groups.push({ key: dia.key, entrada: dia.entrada, salida: dia.salida, days: [dia.diaSemana] })
  }

  if (groups.length > 2) return 'Horarios variables'

  return groups.map((group) => {
    const inicio = DIA_CORTO[group.days[0]]
    const fin = DIA_CORTO[group.days.at(-1)]
    const etiqueta = group.days.length > 1 ? `${inicio}–${fin}` : inicio
    return `${etiqueta} · ${group.entrada}–${group.salida}`
  }).join(' · ')
}

export function textoEmpleadosAsignados(cantidad) {
  if (cantidad == null || cantidad === '') return '—'
  const value = Number(cantidad)
  if (!Number.isInteger(value) || value < 0) return '—'
  if (value === 1) return '1 asignado'
  return `${value} asignados`
}

export function textoResumenAsignadosTurno(cantidad) {
  if (cantidad == null || cantidad === '') return '—'
  const value = Number(cantidad)
  if (!Number.isInteger(value) || value < 0) return '—'
  if (value === 0) return 'Sin empleados asignados'
  if (value === 1) return '1 empleado asignado'
  return `${value} empleados asignados`
}

export function coincideEmpleadoTurno(empleado, query) {
  const needle = normalizarFiltro(query)
  if (!needle) return true
  const campos = [
    empleado?.nombre,
    empleado?.apellido,
    [empleado?.nombre, empleado?.apellido].filter(Boolean).join(' '),
    [empleado?.apellido, empleado?.nombre].filter(Boolean).join(' '),
    empleado?.legajo,
    empleado?.dni,
  ]
  return campos.some((value) => normalizarFiltro(value).includes(needle))
}

export function coincideAsignadoTurno(asignado, query) {
  const needle = normalizarFiltro(query)
  if (!needle) return true
  return [asignado?.nombreCompleto, asignado?.legajo]
    .some((value) => normalizarFiltro(value).includes(needle))
}

export const NOMINA_VACIA = 'Todavía no hay empleados asignados a este turno.'
export const NOMINA_AUSENTE = 'El turno ya no existe o no está disponible para esta empresa.'
export const NOMINA_MANTENIMIENTO = 'La consulta de empleados asignados todavía no está disponible en esta versión de la API.'
export const NOMINA_RESTRINGIDO = 'Acceso restringido.'
export const NOMINA_TEMPORAL = 'No se pudo consultar la nómina. Podés reintentar.'
export const NOMINA_SIN_COINCIDENCIAS = 'No hay empleados asignados que coincidan con la búsqueda.'

export function clasificarEstadoNomina({ status = 0, turnoExiste = null } = {}) {
  if (status === 401) return { tipo: 'sesion', texto: '', reintentar: false, asignar: false }
  if (status === 403) return { tipo: 'restringido', texto: NOMINA_RESTRINGIDO, reintentar: false, asignar: false }
  if (status === 405) return { tipo: 'mantenimiento', texto: NOMINA_MANTENIMIENTO, reintentar: false, asignar: true }
  if (status === 404) {
    if (turnoExiste === true) return { tipo: 'mantenimiento', texto: NOMINA_MANTENIMIENTO, reintentar: false, asignar: true }
    if (turnoExiste === false) return { tipo: 'ausente', texto: NOMINA_AUSENTE, reintentar: false, asignar: false }
    return { tipo: 'temporal', texto: NOMINA_TEMPORAL, reintentar: true, asignar: true }
  }
  return { tipo: 'temporal', texto: NOMINA_TEMPORAL, reintentar: true, asignar: true }
}

export function esEmpleadoElegible(empleado) {
  return Boolean(empleado) && empleado.activo !== false && empleado.yaAsignado !== true && Number(empleado.id) > 0
}

export function esEmpleadoDesasignable(empleado) {
  return Boolean(empleado) && empleado.activo !== false && empleado.yaAsignado === true && Number(empleado.id) > 0
}

export function restarDiaIso(iso) {
  const match = String(iso ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!match) return ''
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
  date.setUTCDate(date.getUTCDate() - 1)
  const mes = String(date.getUTCMonth() + 1).padStart(2, '0')
  const dia = String(date.getUTCDate()).padStart(2, '0')
  return `${date.getUTCFullYear()}-${mes}-${dia}`
}

export function fechaCierreDesasignacion(fechaInicio, hoy) {
  const inicio = String(fechaInicio ?? '').slice(0, 10)
  const actual = String(hoy ?? '').slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(inicio) || !/^\d{4}-\d{2}-\d{2}$/.test(actual)) return ''
  const ayer = restarDiaIso(actual)
  return inicio <= ayer ? ayer : inicio
}

export function aplicarMarcadoTurno(visibles, seleccion, quitar, marcar) {
  const nextSeleccion = new Set(seleccion)
  const nextQuitar = new Set(quitar)
  for (const empleado of visibles ?? []) {
    if (esEmpleadoElegible(empleado)) {
      if (marcar) nextSeleccion.add(empleado.id)
      else nextSeleccion.delete(empleado.id)
    } else if (esEmpleadoDesasignable(empleado)) {
      if (marcar) nextQuitar.delete(empleado.id)
      else nextQuitar.add(empleado.id)
    }
  }
  return { seleccion: nextSeleccion, quitar: nextQuitar }
}

export function marcadoEnTurno(empleado, seleccion, quitar) {
  if (esEmpleadoDesasignable(empleado)) return !quitar?.has?.(empleado.id)
  return esEmpleadoElegible(empleado) && Boolean(seleccion?.has?.(empleado.id))
}

export function estadoMarcadoTurno(visibles, seleccion, quitar) {
  const marcables = (visibles ?? []).filter((empleado) => esEmpleadoElegible(empleado) || esEmpleadoDesasignable(empleado))
  const marcados = marcables.filter((empleado) => marcadoEnTurno(empleado, seleccion, quitar)).length
  if (!marcables.length) return { marcado: false, indeterminado: false, deshabilitado: true, marcados }
  if (marcados === 0) return { marcado: false, indeterminado: false, deshabilitado: false, marcados }
  if (marcados === marcables.length) return { marcado: true, indeterminado: false, deshabilitado: false, marcados }
  return { marcado: false, indeterminado: true, deshabilitado: false, marcados }
}

export function textoCantidadCambiosTurno({ asignar = 0, quitar = 0 } = {}) {
  const altas = Number(asignar) || 0
  const bajas = Number(quitar) || 0
  const partes = []
  if (altas) partes.push(altas === 1 ? '1 para asignar' : `${altas} para asignar`)
  if (bajas) partes.push(bajas === 1 ? '1 para quitar' : `${bajas} para quitar`)
  return partes.length ? partes.join(' · ') : '0 seleccionados'
}

export function aplicarSeleccionVisible(visibles, seleccion, marcar) {
  const next = new Set(seleccion)
  for (const empleado of visibles ?? []) {
    if (!esEmpleadoElegible(empleado)) continue
    if (marcar) next.add(empleado.id)
    else next.delete(empleado.id)
  }
  return next
}

export function estadoSeleccionVisible(visibles, seleccion) {
  const elegibles = (visibles ?? []).filter(esEmpleadoElegible)
  const marcados = elegibles.filter((empleado) => seleccion?.has?.(empleado.id)).length
  if (!elegibles.length) return { marcado: false, indeterminado: false, deshabilitado: true, marcados }
  if (marcados === 0) return { marcado: false, indeterminado: false, deshabilitado: false, marcados }
  if (marcados === elegibles.length) return { marcado: true, indeterminado: false, deshabilitado: false, marcados }
  return { marcado: false, indeterminado: true, deshabilitado: false, marcados }
}

export function textoCantidadSeleccionada(cantidad) {
  const total = Number(cantidad) || 0
  return total === 1 ? '1 seleccionado' : `${total} seleccionados`
}

export function fechaAsignacionVisible(value) {
  const match = String(value ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!match) return ''
  return `${match[3]}/${match[2]}/${match[1]}`
}

export function fechaIsoDesdeVisible(value) {
  const match = String(value ?? '').trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!match) return ''
  const day = Number(match[1])
  const month = Number(match[2])
  const year = Number(match[3])
  const date = new Date(year, month - 1, day)
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return ''
  return `${match[3]}-${match[2]}-${match[1]}`
}

export function mascaraFechaDia(value) {
  const digits = String(value ?? '').replace(/\D/g, '').slice(0, 8)
  return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter(Boolean).join('/')
}

export function resumirNombres(nombres, maximo = 4) {
  const lista = (nombres ?? []).map((nombre) => String(nombre ?? '').trim()).filter(Boolean)
  if (lista.length <= maximo) return lista.join(', ')
  return `${lista.slice(0, maximo).join(', ')} y ${lista.length - maximo} más`
}

export function textoConfirmacionDesasignacion({ nombre, bajas } = {}) {
  const turno = String(nombre || 'el turno')
  const lista = Array.isArray(bajas) ? bajas : []
  const total = lista.length
  const personas = total === 1 ? '1 empleado' : `${total} empleados`
  const resumen = resumirNombres(lista.map((item) => item?.nombre))
  const limitadas = lista.filter((item) => item?.fechaFin && item.fechaFin === item.fechaInicio)
  const cerradas = lista.filter((item) => item?.fechaFin && item.fechaFin !== item.fechaInicio)
  const partes = [`Se quitará a ${personas} de “${turno}”.`]
  if (cerradas.length) {
    partes.push('La vigencia abierta se cierra ayer: desde hoy no forman parte de este turno.')
  }
  if (limitadas.length) {
    partes.push('La asignación que empieza hoy o más adelante no se puede borrar: queda limitada a su día de inicio.')
  }
  const base = partes.join(' ')
  return resumen ? `${base} Empleados: ${resumen}.` : base
}

export function textoConfirmacionCambiosTurno({ nombre, altas = null, bajas = [] } = {}) {
  const partes = []
  if (altas?.cantidad) partes.push(textoConfirmacionAsignacion({ nombre, ...altas }))
  if (bajas?.length) partes.push(textoConfirmacionDesasignacion({ nombre, bajas }))
  return partes.join(' ')
}

export function textoResultadoCambiosTurno(resultados) {
  const lista = Array.isArray(resultados) ? resultados : []
  const okAsignar = lista.filter((item) => item?.ok && item.accion !== 'quitar').length
  const okQuitar = lista.filter((item) => item?.ok && item.accion === 'quitar').length
  const fail = lista.filter((item) => item && !item.ok)
  const detalle = fail.map((item) => String(item.message || 'No se pudo completar el cambio.').trim()).filter(Boolean).join(' ')
  const hechos = [
    okAsignar ? (okAsignar === 1 ? 'se asignó a 1 empleado' : `se asignó a ${okAsignar} empleados`) : '',
    okQuitar ? (okQuitar === 1 ? 'se quitó a 1 empleado' : `se quitó a ${okQuitar} empleados`) : '',
  ].filter(Boolean)
  if (!fail.length) {
    const mensaje = hechos.length ? `${hechos.join(' y ').replace(/^./, (letra) => letra.toUpperCase())}.` : 'No hubo cambios.'
    return { parcial: false, mensaje }
  }
  if (!hechos.length) return { parcial: false, mensaje: detalle || 'No se pudo completar el cambio.' }
  return { parcial: true, mensaje: `${hechos.join(' y ').replace(/^./, (letra) => letra.toUpperCase())}. ${fail.length} no se pudieron cambiar. ${detalle}`.trim() }
}

export function textoConfirmacionAsignacion({ nombre, cantidad, fechaInicio, fechaFin, nombres } = {}) {
  const turno = String(nombre || 'el turno')
  const total = Number(cantidad) || 0
  const personas = total === 1 ? '1 empleado' : `${total} empleados`
  const inicio = fechaAsignacionVisible(fechaInicio)
  const cierre = fechaFin ? `hasta el ${fechaAsignacionVisible(fechaFin)}` : 'sin fecha de finalización'
  const resumen = resumirNombres(nombres)
  const base = `Se asignará “${turno}” a ${personas} desde el ${inicio}, ${cierre}.`
  return resumen ? `${base} Empleados: ${resumen}.` : base
}

export function textoResultadoAsignacion(resultados) {
  const lista = Array.isArray(resultados) ? resultados : []
  const ok = lista.filter((item) => item?.ok)
  const fail = lista.filter((item) => item && !item.ok)
  const detalle = fail.map((item) => String(item.message || 'No se pudo asignar.').trim()).filter(Boolean).join(' ')
  if (!fail.length) {
    const cantidad = ok.length
    return {
      parcial: false,
      mensaje: cantidad === 1 ? 'Se asignó el turno a 1 empleado.' : `Se asignó el turno a ${cantidad} empleados.`,
    }
  }
  if (!ok.length) return { parcial: false, mensaje: detalle || 'No se pudo asignar el turno.' }
  return {
    parcial: true,
    mensaje: `Se asignó a ${ok.length} y ${fail.length} no se pudieron asignar. ${detalle}`.trim(),
  }
}
