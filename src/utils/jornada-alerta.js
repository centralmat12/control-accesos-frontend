import { fichadaDateKey, formatFichadaFecha, formatFichadaHora } from './format.js'
import { formatMinutosInformados } from './labor-format.js'
import { motivoUnicoEquivalente } from './fichada-manual-time.js'
import { interpretarFichadaUnica, MOTIVO_FALTA_SALIDA } from './movimientos.js'

export const SALIDA_COMPLETA_MESSAGE = 'La salida manual se registró correctamente y la jornada quedó completa.'

export function describeAlertaReview(alerta, { legajo } = {}) {
  const nombre = [alerta?.nombre, alerta?.apellido].filter(Boolean).join(' ') || 'Empleado'
  const legajoTexto = String(alerta?.legajo || legajo || '').trim()
  const fechaKey = fichadaDateKey(alerta?.fechaHora)
  const rows = [
    { label: 'Empleado', value: nombre },
  ]
  if (legajoTexto) rows.push({ label: 'Legajo', value: legajoTexto })
  rows.push(
    { label: 'Fecha', value: fechaKey ? (formatFichadaFecha(fechaKey) || fechaKey) : '—' },
    { label: 'Primera fichada', value: alerta?.fechaHora ? (formatFichadaHora(alerta.fechaHora) || '—') : '—' },
    {
      label: 'Última fichada',
      value: alerta?.ultimaFechaHora ? (formatFichadaHora(alerta.ultimaFechaHora) || '—') : 'Sin salida',
    },
    { label: 'Diferencia', value: formatMinutosInformados(alerta?.minutosHastaCorte) ?? '—' },
    { label: 'Motivo', value: String(alerta?.mensaje ?? '').trim() || '—' },
  )
  return { title: 'Revisar jornada incompleta', rows }
}

export function filtrosMovimientosDeAlerta(alerta) {
  const fecha = fichadaDateKey(alerta?.fechaHora)
  return {
    view: 'movimientos',
    periodo: 'personalizado',
    desde: fecha,
    hasta: fecha,
    empleadoId: String(alerta?.empleadoId ?? ''),
    tipo: 'todos',
    metodo: 'todos',
  }
}

export function puedeCompletarSalida(jornada, { permitido = false, manualDisponible = false } = {}) {
  if (!permitido || manualDisponible !== true) return false
  if (jornada?.estado !== 'Incompleta') return false
  if (String(jornada?.motivo ?? '') !== MOTIVO_FALTA_SALIDA) return false
  const ingreso = String(jornada?.ingresoHora ?? '')
  if (!ingreso || ingreso === 'Sin ingreso') return false
  if (jornada?.tieneEgreso) return false
  if (jornada?.egresoHora && jornada.egresoHora !== 'Sin salida') return false
  const lado = interpretarFichadaUnica(jornada)?.lado
  if (lado === 'egreso' || lado === 'ambigua') return false
  return true
}

export function puedeAgregarFichada(jornada, { permitido = false, manualDisponible = false } = {}) {
  if (!permitido || manualDisponible !== true) return false
  if (jornada?.estado !== 'Incompleta') return false
  return interpretarFichadaUnica(jornada)?.lado === 'ambigua'
}

export function puedeCompletarEntrada(jornada, { permitido = false, manualDisponible = false } = {}) {
  if (!permitido || manualDisponible !== true) return false
  if (jornada?.estado !== 'Incompleta') return false
  return interpretarFichadaUnica(jornada)?.lado === 'egreso'
}

export function presetCompletarSalida(jornada) {
  const entrada = (jornada?.movimientos ?? []).find((item) => !item.esPosibleDuplicado) ?? jornada?.movimientos?.[0]
  return {
    empleadoId: String(jornada?.empleadoId ?? ''),
    fecha: String(jornada?.fecha ?? ''),
    hora: '',
    tipo: 'Salida',
    motivo: '',
    detalle: '',
    bloquear: true,
    completarSalida: true,
    entradaHora: String(jornada?.ingresoHora ?? ''),
    entradaFechaHora: entrada?.fechaHora ?? '',
    empleadoNombre: String(jornada?.empleado ?? ''),
  }
}

export function presetAgregarFichada(jornada) {
  const lectura = interpretarFichadaUnica(jornada)
  const marca = (jornada?.movimientos ?? []).find((item) => item && !item.esPosibleDuplicado)
  return {
    empleadoId: String(jornada?.empleadoId ?? ''),
    fecha: String(jornada?.fecha ?? ''),
    hora: '',
    tipo: '',
    motivo: '',
    detalle: '',
    bloquear: true,
    agregarFichada: true,
    marcaHora: String(lectura?.hora ?? ''),
    marcaFechaHora: lectura?.fechaHora ?? marca?.fechaHora ?? '',
    empleadoNombre: String(jornada?.empleado ?? ''),
  }
}

export function presetCompletarEntrada(jornada) {
  const lectura = interpretarFichadaUnica(jornada)
  return {
    empleadoId: String(jornada?.empleadoId ?? ''),
    fecha: String(jornada?.fecha ?? ''),
    hora: '',
    tipo: 'Entrada',
    motivo: '',
    detalle: '',
    bloquear: true,
    completarEntrada: true,
    salidaHora: String(lectura?.hora ?? ''),
    salidaFechaHora: lectura?.fechaHora ?? '',
    empleadoNombre: String(jornada?.empleado ?? ''),
  }
}

export function presetSalidaManual(alerta) {
  const motivo = motivoUnicoEquivalente(alerta?.mensaje)
  return {
    empleadoId: String(alerta?.empleadoId ?? ''),
    fecha: fichadaDateKey(alerta?.fechaHora),
    hora: '',
    tipo: 'Salida',
    motivo,
    detalle: '',
    origenAlerta: {
      fichadaId: alerta?.fichadaId ?? null,
      empleadoId: alerta?.empleadoId ?? null,
      fechaHora: alerta?.fechaHora ?? null,
      mensaje: alerta?.mensaje ?? '',
    },
  }
}

export function estadoErrorAlertas(error) {
  if (error?.status === 401 || error?.code === 'UNAUTHORIZED') return 'sesion'
  if (error?.status === 403) return 'restringido'
  if (error?.code === 'maintenance' || error?.status === 404 || error?.status === 405) return 'mantenimiento'
  if (error?.code === 'invalid-contract') return 'contrato'
  return 'reintento'
}

export function planAccionAlerta(action, { manualAvailable = false } = {}) {
  if (action === 'cerrar') return { write: false }
  if (action === 'movimientos') return { write: false, view: 'movimientos' }
  if (action === 'salida') return { write: false, openForm: manualAvailable === true }
  return { write: false }
}

export function resultadoSalidaManual(alerta, alertas) {
  const fecha = fichadaDateKey(alerta?.fechaHora)
  const still = (Array.isArray(alertas) ? alertas : []).find((item) => {
    if (alerta?.fichadaId && item?.fichadaId && item.fichadaId === alerta.fichadaId) return true
    return Number(item?.empleadoId) === Number(alerta?.empleadoId)
      && Boolean(fecha)
      && fichadaDateKey(item?.fechaHora) === fecha
  })
  if (!still) return { completa: true, message: SALIDA_COMPLETA_MESSAGE }
  return { completa: false, message: String(still.mensaje ?? '').trim() || 'La jornada sigue incompleta.' }
}
