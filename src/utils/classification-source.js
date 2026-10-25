import { SERVER_CLASSIFICATION_ID } from '../api/capabilities.js'
import { fichadaDateKey, formatFichadaHora } from './format.js'
import { buildJornadas, empleadoPorId } from './jornadas.js'
import { formatMinutosInformados } from './labor-format.js'
import { annotateMovimientos } from './movimientos.js'

export const CLASSIFICATION_SOURCE = Object.freeze({
  frontend: 'frontend',
  api: 'api',
})

const API_VISUAL = new Set(['Entrada', 'Salida', 'Movimiento intermedio'])
const API_ESTADO = new Set(['Completa', 'En curso', 'Incompleta', 'Revisar'])

let activeSource = CLASSIFICATION_SOURCE.frontend

function devLog(message) {
  try {
    if (import.meta.env?.DEV) console.info(message)
  } catch {
    /* pruebas */
  }
}

export function classificationSource() {
  return activeSource
}

export function resetClassificationSource() {
  activeSource = CLASSIFICATION_SOURCE.frontend
}

export function fichadasTraenClasificacionDiaria(fichadas) {
  const list = Array.isArray(fichadas) ? fichadas : []
  if (list.length === 0) return false
  return list.every((item) => API_VISUAL.has(item?.movimientoVisual) && API_ESTADO.has(item?.jornadaEstado))
}

export function applyClassificationDeclaration(declaration, fichadas) {
  if (declaration === SERVER_CLASSIFICATION_ID && fichadasTraenClasificacionDiaria(fichadas)) {
    activeSource = CLASSIFICATION_SOURCE.api
    devLog('Clasificación activa: api (daily-first-last-v1)')
    return activeSource
  }
  activeSource = CLASSIFICATION_SOURCE.frontend
  devLog('Clasificación activa: frontend')
  return activeSource
}

export function clasificarSegunFuente(fichadas, options = {}) {
  if (activeSource === CLASSIFICATION_SOURCE.api && fichadasTraenClasificacionDiaria(fichadas)) {
    return fichadas.map((item) => ({ ...item }))
  }
  if (activeSource === CLASSIFICATION_SOURCE.api) {
    activeSource = CLASSIFICATION_SOURCE.frontend
    devLog('Clasificación api inválida; se vuelve a frontend')
  }
  return annotateMovimientos(fichadas, options)
}

function actividadRegistradaDesdeApi(movimientos) {
  for (const item of movimientos) {
    if (!item || !Object.prototype.hasOwnProperty.call(item, 'actividadRegistrada')) continue
    const value = item.actividadRegistrada
    if (value == null || value === '') continue
    if (typeof value === 'string') return value
    return formatMinutosInformados(value) ?? '—'
  }
  return '—'
}

function jornadasDesdeApi(fichadas, empleadoById = new Map()) {
  const groups = new Map()
  fichadas.forEach((fichada) => {
    const fecha = fichada.jornadaFecha || fichadaDateKey(fichada.fechaHora)
    if (!fecha) return
    const key = `${fichada.empleadoId ?? ''}|${fecha}`
    if (!groups.has(key)) {
      groups.set(key, {
        empleadoId: fichada.empleadoId,
        empleado: fichada.empleado,
        legajo: fichada.legajo,
        fecha,
        estado: fichada.jornadaEstado,
        motivo: fichada.jornadaMotivo || '',
        movimientos: [],
      })
    }
    groups.get(key).movimientos.push(fichada)
  })

  return [...groups.values()].map((group) => {
    const movimientos = [...group.movimientos]
    const ingreso = movimientos.find((item) => item.movimientoVisual === 'Entrada') ?? null
    const egreso = [...movimientos].reverse().find((item) => item.movimientoVisual === 'Salida') ?? null
    const empleado = empleadoPorId(empleadoById, group.empleadoId)
    return {
      ...group,
      horarioPrevisto: empleado?.horario ?? 'No asignado',
      ingresoHora: ingreso ? formatFichadaHora(ingreso.fechaHora) : 'Sin ingreso',
      egresoHora: egreso ? formatFichadaHora(egreso.fechaHora) : 'Sin salida',
      egresoDefinitivo: group.estado === 'Completa',
      fichadasIntermedias: movimientos.filter((item) => item.movimientoVisual === 'Movimiento intermedio').length,
      actividadRegistrada: actividadRegistradaDesdeApi(movimientos),
      posiblesDuplicados: 0,
      movimientos,
      fuente: CLASSIFICATION_SOURCE.api,
    }
  })
}

export function construirJornadasSegunFuente(fichadas, empleadoById, options = {}) {
  if (activeSource === CLASSIFICATION_SOURCE.api && fichadasTraenClasificacionDiaria(fichadas)) {
    return jornadasDesdeApi(fichadas, empleadoById)
  }
  if (activeSource === CLASSIFICATION_SOURCE.api) {
    activeSource = CLASSIFICATION_SOURCE.frontend
    devLog('Clasificación api inválida; se vuelve a frontend')
  }
  return buildJornadas(fichadas, empleadoById, options)
}
