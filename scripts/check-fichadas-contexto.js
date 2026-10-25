import '../scripts/browser-globals.js'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createFichadasTimeline } from '../src/components/fichadas-timeline.js'
import { closeObservacionesJornada, openObservacionesJornada } from '../src/components/jornada-observaciones.js'
import { businessNow } from '../src/utils/format.js'
import {
  ariaCeldaCalendario,
  claseCeldaCalendario,
  esExcepcionHoraria,
  estadoCeldaCalendario,
  etiquetaSaldo,
  grillaMensual,
  mesSinAtencion,
  presentarSaldo,
  turnoHabitual,
} from '../src/utils/labor-format.js'
import {
  commitManualFichada,
  ENTRADA_DUPLICADA_MESSAGE,
  ENTRADA_POSTERIOR_MESSAGE,
  SALIDA_ANTERIOR_MESSAGE,
  SALIDA_DUPLICADA_MESSAGE,
  SALIDA_LARGA_MESSAGE,
  TIPO_FICHADA_MESSAGE,
  validateEntradaContraSalida,
  validateFichadaContraMarca,
  validateSalidaContraEntrada,
} from '../src/utils/fichada-manual-time.js'
import {
  estadoErrorAlertas,
  presetAgregarFichada,
  presetCompletarEntrada,
  presetCompletarSalida,
  puedeAgregarFichada,
  puedeCompletarEntrada,
  puedeCompletarSalida,
} from '../src/utils/jornada-alerta.js'
import { buildJornadas } from '../src/utils/jornadas.js'
import { aplicarHorarioDelDia, interpretarFichadaUnica, MOTIVO_FALTA_SALIDA, SINGLE_PUNCH_PROXIMITY_MINUTES } from '../src/utils/movimientos.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (path) => readFileSync(join(root, path), 'utf8')
const queue = []

function check(name, fn) {
  queue.push([name, fn])
}

function node() {
  const element = {
    children: [],
    listeners: [],
    attributes: {},
    className: '',
    style: {},
    textContent: '',
    tabIndex: 0,
    isConnected: true,
    dataset: {},
    parentElement: null,
    append(...items) {
      items.forEach((item) => {
        item.parentElement = element
        element.children.push(item)
      })
    },
    remove() {
      element.isConnected = false
      element.parentElement = null
    },
    setAttribute(name, value) {
      element.attributes[name] = String(value)
    },
    getAttribute(name) {
      return element.attributes[name] ?? null
    },
    removeAttribute(name) {
      delete element.attributes[name]
    },
    contains(target) {
      return target === element || element.children.some((child) => child === target || child.contains?.(target))
    },
    addEventListener(type, fn, capture) {
      element.listeners.push({ type, fn, capture: Boolean(capture) })
    },
    removeEventListener(type, fn) {
      element.listeners = element.listeners.filter((entry) => entry.type !== type || entry.fn !== fn)
    },
    focus() {
      element.focused = true
    },
    querySelector() {
      return null
    },
    querySelectorAll() {
      return []
    },
    getBoundingClientRect() {
      return { left: 20, bottom: 40, top: 20, right: 40, width: 20, height: 20 }
    },
    get offsetWidth() {
      return 120
    },
    get offsetHeight() {
      return 80
    },
  }
  return element
}

function installDocument() {
  const body = node()
  const documentListeners = []
  const windowListeners = []
  const documentRef = {
    body,
    createElement() {
      return node()
    },
    addEventListener(type, fn) {
      documentListeners.push({ type, fn })
    },
    removeEventListener(type, fn) {
      const index = documentListeners.findIndex((entry) => entry.type === type && entry.fn === fn)
      if (index >= 0) documentListeners.splice(index, 1)
    },
    dispatch(type, event) {
      documentListeners.filter((entry) => entry.type === type).forEach((entry) => entry.fn(event))
    },
  }
  const windowRef = {
    innerWidth: 800,
    innerHeight: 600,
    addEventListener(type, fn, capture) {
      windowListeners.push({ type, fn, capture })
    },
    removeEventListener(type, fn) {
      const index = windowListeners.findIndex((entry) => entry.type === type && entry.fn === fn)
      if (index >= 0) windowListeners.splice(index, 1)
    },
    dispatch(type, event) {
      windowListeners.filter((entry) => entry.type === type).forEach((entry) => entry.fn(event))
    },
  }
  globalThis.document = documentRef
  globalThis.window = windowRef
  return { documentRef, windowRef, documentListeners, windowListeners }
}

const jornadaObs = {
  empleado: 'Ana <Ríos>',
  fecha: '2026-10-20',
  movimientos: [{ hora: '08:00', movimiento: 'Entrada', motivo: 'Olvido', detalle: 'Nota', observacionHumana: { motivo: 'OlvidoDeFichaje', detalle: 'Nota' } }],
}

check('el popover abre, cierra y no duplica listeners', () => {
  const { documentRef, windowRef, documentListeners, windowListeners } = installDocument()
  const anchor = node()
  openObservacionesJornada(anchor, {
    empleado: 'Ana',
    fecha: '2026-10-20',
    movimientos: [{
      fechaHora: '2026-10-20T08:00:00',
      movimientoVisual: 'Entrada',
      observacionHumana: { motivo: 'OlvidoDeFichaje', detalle: 'Nota' },
    }],
  })
  assert.equal(anchor.getAttribute('aria-expanded'), 'true')
  assert.equal(documentListeners.length, 2)
  assert.equal(windowListeners.length, 1)
  assert.equal(documentRef.body.children.length, 1)
  openObservacionesJornada(anchor, jornadaObs)
  assert.equal(documentListeners.length, 0)
  assert.equal(windowListeners.length, 0)
  assert.equal(anchor.getAttribute('aria-expanded'), 'false')
  const again = node()
  openObservacionesJornada(again, {
    empleado: 'Ana',
    fecha: '2026-10-20',
    movimientos: [{
      fechaHora: '2026-10-20T08:00:00',
      movimientoVisual: 'Entrada',
      observacionHumana: { motivo: 'OlvidoDeFichaje', detalle: '<script>' },
    }],
  })
  documentRef.dispatch('pointerdown', { target: node() })
  assert.equal(documentRef.body.children.filter((item) => item.isConnected !== false).length, 0)
  openObservacionesJornada(again, {
    empleado: 'Ana',
    fecha: '2026-10-20',
    movimientos: [{
      fechaHora: '2026-10-20T08:00:00',
      movimientoVisual: 'Entrada',
      observacionHumana: { motivo: 'OlvidoDeFichaje', detalle: 'Nota' },
    }],
  })
  documentRef.dispatch('keydown', { key: 'Escape' })
  assert.equal(windowListeners.length, 0)
  openObservacionesJornada(again, {
    empleado: 'Ana',
    fecha: '2026-10-20',
    movimientos: [{
      fechaHora: '2026-10-20T08:00:00',
      movimientoVisual: 'Entrada',
      observacionHumana: { motivo: 'OlvidoDeFichaje', detalle: 'Nota' },
    }],
  })
  windowRef.dispatch('scroll', { target: documentRef.body })
  assert.equal(windowListeners.length, 0)
  closeObservacionesJornada()
  assert.equal(windowListeners.length, 0)
})

check('la vista cierra el popover al cambiar de contexto', () => {
  const view = read('src/views/fichadas.js')
  assert.match(view, /closeObservacionesJornada\(\)/)
  assert.match(view, /function setView/)
  assert.match(view, /onServerFilterChange/)
})

check('hay un solo empleado compartido y el calendario no elige el primero', () => {
  const view = read('src/views/fichadas.js')
  const calendar = read('src/components/jornadas-calendar-panel.js')
  assert.match(view, /empleadoId: empleadoCombobox.getEmpleadoId\(\)/)
  assert.match(view, /onEmpleadoChange/)
  assert.match(view, /laborKind === 'calendario'/)
  assert.match(calendar, /Seleccioná un empleado para consultar su calendario\./)
  assert.equal(calendar.includes('filteredEmpleados()[0]'), false)
  assert.match(read('src/components/empleado-combobox.js'), /choose\(TODOS_VALUE/)
})

check('la grilla mensual usa el día real y Buenos Aires', () => {
  const octubre = grillaMensual(2026, 9)
  assert.deepEqual(octubre.headers, ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'])
  assert.equal(octubre.cells[0], null)
  assert.equal(octubre.cells[3], '2026-10-01')
  assert.equal(octubre.cells.at(-1), null)
  assert.equal(octubre.desde, '2026-10-01')
  assert.equal(octubre.hasta, '2026-10-31')
  const hoy = businessNow(new Date('2026-10-25T02:30:00.000Z'))
  assert.equal(hoy.dateKey, '2026-10-24')
  const habitual = turnoHabitual([
    { tieneTurnoAsignado: true, horaEntrada: '08:00', horaSalida: '17:00', minutosAlmuerzo: 60 },
    { tieneTurnoAsignado: true, horaEntrada: '08:00:00', horaSalida: '17:00:00', minutosAlmuerzo: 60 },
  ])
  assert.match(habitual.texto, /Turno habitual: 08:00–17:00 · Almuerzo: 60 min/)
  assert.equal(turnoHabitual([
    { tieneTurnoAsignado: true, horaEntrada: '08:00', horaSalida: '17:00', minutosAlmuerzo: 60 },
    { tieneTurnoAsignado: true, horaEntrada: '09:00', horaSalida: '18:00', minutosAlmuerzo: 60 },
  ]), null)
  const uniforme = estadoCeldaCalendario({
    dia: { tieneTurnoAsignado: true, horaEntrada: '08:00', horaSalida: '17:00', minutosAlmuerzo: 60 },
    fecha: '2026-11-02',
    hoy: '2026-10-25',
    habitual,
  })
  assert.equal(uniforme.etiqueta, '')
  assert.equal(uniforme.excepcion, false)
  assert.equal(estadoCeldaCalendario({
    dia: { esDiaLibre: true, tieneTurnoAsignado: true },
    fecha: '2026-10-12',
    hoy: '2026-10-25',
    habitual,
  }).codigo, 'vacaciones')
  assert.equal(estadoCeldaCalendario({
    dia: { tieneTurnoAsignado: false },
    fecha: '2026-10-20',
    hoy: '2026-10-25',
  }).etiqueta, 'Sin jornada prevista')
  const calendar = read('src/components/jornadas-calendar-panel.js')
  assert.equal(calendar.includes('>Turno asignado<'), false)
  assert.match(calendar, /Ver fichadas del período/)
  assert.equal(calendar.includes('Revisar en fichadas'), false)
  assert.equal(calendar.includes('Funcionalidad aún en mantenimiento'), false)
})

check('el saldo se traduce solo si hay horas programadas', () => {
  assert.equal(etiquetaSaldo(-125), 'Debe 2 h 05 min')
  assert.equal(presentarSaldo({ minutosProgramados: 480, saldoMinutos: -125 }).valor, 'Debe 2 h 05 min')
  assert.equal(presentarSaldo({ minutosProgramados: 480, saldoMinutos: 90 }).valor, 'A favor 1 h 30 min')
  assert.equal(presentarSaldo({ minutosProgramados: 480, saldoMinutos: 0 }).valor, 'Al día')
  const activo = presentarSaldo({ minutosProgramados: 0, actividadRegistrada: 8270, minutosTrabajados: 8270, minutosRepuestos: 0, saldoMinutos: 8270 })
  assert.equal(activo.valor, 'No calculable')
  assert.equal(activo.detalle, 'No hay horas programadas informadas para este período.')
  assert.equal(presentarSaldo({ minutosProgramados: 0, actividadRegistrada: 0, minutosTrabajados: 0, minutosRepuestos: 0, saldoMinutos: 0 }).valor, 'Sin jornada programada')
  assert.equal(presentarSaldo({ minutosProgramados: null, saldoMinutos: 100, actividadRegistrada: 100 }).valor, 'No disponible')
  assert.equal(presentarSaldo({ minutosProgramados: undefined }).valor, 'No disponible')
  assert.equal(presentarSaldo({ minutosProgramados: '' }).valor, 'No disponible')
  assert.equal(presentarSaldo({ minutosProgramados: Number.NaN }).valor, 'No disponible')
  assert.equal(presentarSaldo({ minutosProgramados: '0', actividadRegistrada: 10 }).valor, 'No disponible')
  assert.equal(presentarSaldo({}).detalle, 'El resumen no informó las horas programadas.')
  assert.equal(Number(null) === 0, true)
  assert.notEqual(presentarSaldo({ minutosProgramados: null, saldoMinutos: 0 }).valor, 'Sin jornada programada')
})

check('las celdas muestran el estado de la jornada y no el horario', () => {
  const hoy = '2026-10-25'
  const habitual = turnoHabitual([
    { tieneTurnoAsignado: true, horaEntrada: '08:00', horaSalida: '17:00', minutosAlmuerzo: 60 },
    { tieneTurnoAsignado: true, horaEntrada: '08:00:00', horaSalida: '17:00:00', minutosAlmuerzo: '60' },
  ])
  const base = { tieneTurnoAsignado: true, horaEntrada: '08:00', horaSalida: '17:00', minutosAlmuerzo: 60 }
  const completa = estadoCeldaCalendario({ dia: base, jornada: { estado: 'Completa', movimientos: [{}, {}], TipoRegistro: 'Salida' }, fecha: '2026-10-24', hoy, habitual })
  assert.equal(completa.etiqueta, 'Completa')
  assert.match(claseCeldaCalendario(completa.codigo), /emerald/)
  const incompleta = estadoCeldaCalendario({ dia: base, jornada: { estado: 'Incompleta', motivo: 'Falta fichada de salida', movimientos: [{}] }, fecha: '2026-10-23', hoy, habitual })
  assert.equal(incompleta.etiqueta, 'Incompleta')
  assert.equal(incompleta.sub, 'Sin salida')
  assert.match(claseCeldaCalendario(incompleta.codigo), /orange/)
  assert.match(claseCeldaCalendario('revisar'), /amber/)
  assert.match(claseCeldaCalendario('enCurso'), /repeating-linear-gradient/)
  const libre = estadoCeldaCalendario({ dia: { ...base, esDiaLibre: true }, jornada: { estado: 'Completa', movimientos: [{}] }, fecha: '2026-10-12', hoy, habitual })
  assert.equal(libre.codigo, 'vacaciones')
  assert.equal(libre.fichadasEnLibre, true)
  assert.match(claseCeldaCalendario(libre.codigo), /violet/)
  assert.equal(estadoCeldaCalendario({ dia: base, fecha: '2026-10-20', hoy, habitual }).etiqueta, 'Sin registros')
  assert.equal(estadoCeldaCalendario({ dia: base, fecha: '2026-10-26', hoy, habitual }).codigo, 'futuro')
  assert.equal(estadoCeldaCalendario({ dia: base, fecha: '2026-10-25', hoy, habitual }).etiqueta, '')
  assert.equal(estadoCeldaCalendario({ dia: { tieneTurnoAsignado: false }, fecha: '2026-10-20', hoy }).codigo, 'sinPrevista')
  assert.equal(estadoCeldaCalendario({ dia: base, jornada: { tipo: 'Salida', TipoRegistro: 'Entrada' }, fecha: '2026-10-20', hoy, habitual }).codigo, 'sinRegistros')
  assert.equal(esExcepcionHoraria({ ...base, horaEntrada: '08:00:00' }, habitual), false)
  assert.equal(esExcepcionHoraria({ ...base, horaEntrada: '10:00', horaSalida: '15:00' }, habitual), true)
  assert.equal(esExcepcionHoraria({ ...base, esExcepcionManual: true }, habitual), true)
  assert.equal(esExcepcionHoraria({ tieneTurnoAsignado: true, horaEntrada: '09:00', horaSalida: '18:00', minutosAlmuerzo: 30 }, null), false)
  const distinta = estadoCeldaCalendario({ dia: { ...base, horaEntrada: '10:00', horaSalida: '15:00' }, jornada: { estado: 'Completa', movimientos: [{}, {}] }, fecha: '2026-10-13', hoy, habitual })
  assert.equal(distinta.etiqueta, 'Completa')
  assert.equal(distinta.excepcion, true)
  assert.match(ariaCeldaCalendario('2026-10-25', incompleta), /25 de octubre de 2026\. Jornada incompleta\. Falta fichada de salida\./)
  assert.equal(mesSinAtencion([
    { fecha: '2026-10-01', prevista: true, codigo: 'completa', excepcion: false },
  ], hoy), true)
  assert.equal(mesSinAtencion([
    { fecha: '2026-10-01', prevista: true, codigo: 'completa', excepcion: false },
    { fecha: '2026-10-02', prevista: true, codigo: 'sinRegistros', excepcion: false },
  ], hoy), false)
  const calendar = read('src/components/jornadas-calendar-panel.js')
  assert.match(calendar, /construirJornadasSegunFuente/)
  assert.equal(calendar.includes('annotateMovimientos'), false)
  assert.equal(calendar.includes('TipoRegistro'), false)
  assert.equal(calendar.includes('Horario distinto'), false)
  assert.match(calendar, /getFichadas\(\{ empleadoId, desde, hasta \}\)/)
  assert.match(calendar, /getResumen\(empleadoId, desde, hasta\)/)
  assert.match(calendar, /onCompletarSalida/)
  assert.equal(estadoCeldaCalendario.toString().includes('TipoRegistro'), false)
})

check('Ver fichadas del período aplica empleado y el mes visible', () => {
  const view = read('src/views/fichadas.js')
  assert.match(view, /function verFichadasDelPeriodo/)
  assert.match(view, /periodoSelect.value = 'personalizado'/)
  assert.match(view, /setView\('jornadas'\)/)
  assert.match(view, /calendarCursor = \{ year, monthIndex \}/)
})

check('Revisar abre el modal sin esperar la escritura y distingue errores', () => {
  const panel = read('src/components/jornadas-alertas-panel.js')
  const start = panel.indexOf('function openReview')
  const end = panel.indexOf('function paint')
  const body = panel.slice(start, end)
  assert.ok(body.indexOf('openModal') < body.indexOf('resolveCapability'))
  assert.equal(estadoErrorAlertas({ status: 401 }), 'sesion')
  assert.equal(estadoErrorAlertas({ status: 403 }), 'restringido')
  assert.equal(estadoErrorAlertas({ status: 404 }), 'mantenimiento')
  assert.equal(estadoErrorAlertas({ status: 405 }), 'mantenimiento')
  assert.equal(estadoErrorAlertas({ status: 500 }), 'reintento')
  assert.equal(estadoErrorAlertas({ code: 'invalid-contract', status: 200 }), 'contrato')
  assert.equal(estadoErrorAlertas(new TypeError('red')), 'reintento')
  assert.match(read('src/api/jornadas.js'), /invalid-contract/)
  assert.match(panel, /load\(true\)/)
})

check('la línea de tiempo separa filas y solo dibuja el horario previsto si existe', () => {
  installDocument()
  const sinHorario = createFichadasTimeline([{
    empleado: 'Ana',
    fecha: '2026-10-20',
    estado: 'Completa',
    horarioPrevisto: 'No asignado',
    movimientos: [
      { fechaHora: '2026-10-20T08:00:00', id: 1 },
      { fechaHora: '2026-10-20T17:00:00', id: 2 },
    ],
  }], { now: new Date('2026-10-20T18:00:00Z') })
  assert.equal(sinHorario.innerHTML?.includes?.('Horario previsto:') ?? sinHorario.children.some((child) => JSON.stringify(child).includes('Horario previsto:')), false)
  const source = read('src/components/fichadas-timeline.js')
  assert.match(source, /Horario previsto:/)
  assert.match(source, /border-slate-400\/80/)
  assert.match(source, /last:border-b-0/)
  assert.match(source, /focus-within:bg-slate-50/)
  assert.match(source, /Completar salida/)
  assert.equal(source.includes('Incompleta · Sin salida'), false)
  const faltante = {
    empleado: 'Ana Rios',
    fecha: '2026-10-24',
    estado: 'Incompleta',
    motivo: 'Falta fichada de salida',
    horarioPrevisto: '08:00–17:00',
    ingresoHora: '08:58',
    egresoHora: 'Sin salida',
    tieneEgreso: false,
    movimientos: [{ fechaHora: '2026-10-24T08:58:00', id: 1 }],
  }
  const conPermiso = createFichadasTimeline([faltante], {
    now: new Date('2026-10-25T18:00:00Z'),
    puedeCompletar: () => true,
  })
  const html = String(conPermiso.innerHTML ?? '')
  assert.match(html, /Salida faltante/)
  assert.match(html, /Solo ingreso ·/)
  assert.match(html, /aria-label="Completar salida de Ana Rios del /)
  assert.match(html, /Salida faltante<\/span><button[^>]*data-action="completar-salida"/)
  assert.equal(html.includes('Incompleta · Sin salida'), false)
  const sinPermiso = String(createFichadasTimeline([faltante], {
    now: new Date('2026-10-25T18:00:00Z'),
    puedeCompletar: () => false,
  }).innerHTML ?? '')
  assert.match(sinPermiso, /Salida faltante/)
  assert.equal(sinPermiso.includes('data-action="completar-salida"'), false)
  const egreso = {
    ...faltante,
    horarioPrevisto: '08:00–17:00',
    movimientos: [{ fechaHora: '2026-10-24T16:59:00', id: 9, tipo: 'Entrada' }],
  }
  const htmlEgreso = String(createFichadasTimeline([egreso], {
    now: new Date('2026-10-25T18:00:00Z'),
    puedeCompletar: () => false,
    puedeCompletarEntrada: () => true,
  }).innerHTML ?? '')
  assert.match(htmlEgreso, /Solo egreso · 16:59/)
  assert.match(htmlEgreso, /Entrada faltante/)
  assert.match(htmlEgreso, /Completar entrada/)
  assert.match(htmlEgreso, /Entrada faltante<\/span><button[^>]*data-action="completar-entrada"/)
  assert.equal(htmlEgreso.includes('Salida faltante'), false)
  assert.equal(htmlEgreso.includes('Solo ingreso'), false)
  assert.equal(htmlEgreso.includes('Incompleta · Sin salida'), false)
  assert.equal(egreso.movimientos[0].tipo, 'Entrada')
  const ambigua = {
    ...faltante,
    fecha: '2026-10-19',
    horarioPrevisto: 'No asignado',
    movimientos: [{ fechaHora: '2026-10-19T12:30:00', id: 3, tipo: 'Entrada' }],
  }
  const htmlAmbigua = String(createFichadasTimeline([ambigua], {
    now: new Date('2026-10-25T18:00:00Z'),
    puedeCompletar: () => true,
    puedeCompletarEntrada: () => true,
    puedeAgregar: () => true,
  }).innerHTML ?? '')
  assert.equal(ambigua.estado, 'Incompleta')
  assert.match(htmlAmbigua, /Fichada única · 12:30/)
  assert.match(htmlAmbigua, /19\/10\/2026 · <span class="text-amber-700 dark:text-amber-300">Incompleta<\/span><button[^>]*data-action="agregar-fichada"/)
  assert.match(htmlAmbigua, /Agregar fichada/)
  assert.equal(htmlAmbigua.includes('>Revisar<'), false)
  assert.equal(htmlAmbigua.includes('data-action="completar-salida"'), false)
  assert.equal(htmlAmbigua.includes('data-action="completar-entrada"'), false)
  assert.equal(htmlAmbigua.includes('Solo ingreso'), false)
  assert.equal(htmlAmbigua.includes('Solo egreso'), false)
  assert.equal(htmlAmbigua.includes('Incompleta · Sin salida'), false)
  const sinAccion = String(createFichadasTimeline([ambigua], {
    now: new Date('2026-10-25T18:00:00Z'),
    puedeAgregar: () => false,
  }).innerHTML ?? '')
  assert.match(sinAccion, /Incompleta/)
  assert.equal(sinAccion.includes('data-action="agregar-fichada"'), false)
  const duplicada = {
    ...ambigua,
    estado: 'Revisar',
    motivo: 'Hay fichadas posiblemente duplicadas',
    movimientos: [{ fechaHora: '2026-10-19T12:30:00', esPosibleDuplicado: true }],
  }
  const htmlDuplicada = String(createFichadasTimeline([duplicada], {
    now: new Date('2026-10-25T18:00:00Z'),
    puedeAgregar: () => true,
  }).innerHTML ?? '')
  assert.match(htmlDuplicada, /Revisar/)
  assert.equal(htmlDuplicada.includes('data-action="agregar-fichada"'), false)
  assert.equal(htmlDuplicada.includes('Fichada única'), false)
})

check('Completar salida respeta estado, rol, entrada y la ventana de 60 segundos', () => {
  const base = {
    estado: 'Incompleta',
    motivo: MOTIVO_FALTA_SALIDA,
    ingresoHora: '08:00',
    egresoHora: 'Sin salida',
    tieneEgreso: false,
    fecha: '2026-10-20',
    empleadoId: 7,
    empleado: 'Ana',
    horarioPrevisto: '08:00–17:00',
    movimientos: [{ fechaHora: '2026-10-20T08:00:00', esPosibleDuplicado: false }],
  }
  assert.equal(puedeCompletarSalida(base, { permitido: true, manualDisponible: true }), true)
  assert.equal(puedeCompletarSalida(base, { permitido: false, manualDisponible: true }), false)
  assert.equal(puedeCompletarSalida({ ...base, estado: 'Completa' }, { permitido: true, manualDisponible: true }), false)
  assert.equal(puedeCompletarSalida({ ...base, motivo: 'Otro' }, { permitido: true, manualDisponible: true }), false)
  assert.equal(puedeCompletarSalida(base, { permitido: true, manualDisponible: false }), false)
  assert.equal(SINGLE_PUNCH_PROXIMITY_MINUTES, 120)
  const cerca = {
    ...base,
    horarioPrevisto: '08:00–17:00',
    movimientos: [{ fechaHora: '2026-10-20T16:59:00', tipo: 'Entrada', esPosibleDuplicado: false }],
  }
  assert.equal(interpretarFichadaUnica(cerca).lado, 'egreso')
  assert.equal(interpretarFichadaUnica(cerca).hora, '16:59')
  assert.equal(interpretarFichadaUnica({ ...cerca, movimientos: [{ fechaHora: '2026-10-20T08:05:00' }] }).lado, 'ingreso')
  assert.equal(interpretarFichadaUnica({ ...cerca, movimientos: [{ fechaHora: '2026-10-20T15:00:00' }] }).lado, 'egreso')
  assert.equal(interpretarFichadaUnica({ ...cerca, movimientos: [{ fechaHora: '2026-10-20T08:58:00' }] }).lado, 'ingreso')
  const fuera = interpretarFichadaUnica({ ...cerca, movimientos: [{ fechaHora: '2026-10-20T14:59:00' }] })
  assert.equal(fuera.lado, 'ambigua')
  assert.equal(fuera.hora, '14:59')
  const empate = interpretarFichadaUnica({ ...cerca, horarioPrevisto: '08:00–12:00', movimientos: [{ fechaHora: '2026-10-20T10:00:00' }] })
  assert.equal(empate.lado, 'ambigua')
  assert.equal(empate.hora, '10:00')
  assert.equal(interpretarFichadaUnica({ ...cerca, estado: 'Completa' }), null)
  const sinHorario = interpretarFichadaUnica({ ...cerca, horarioPrevisto: 'No asignado' })
  assert.equal(sinHorario.lado, 'ambigua')
  assert.equal(sinHorario.hora, '16:59')
  assert.equal(interpretarFichadaUnica({ ...cerca, horarioPrevisto: 'turno mañana' }).lado, 'ambigua')
  assert.equal(interpretarFichadaUnica({ ...cerca, horarioPrevisto: '' }).lado, 'ambigua')
  assert.equal(interpretarFichadaUnica({ ...cerca, movimientos: [{ fechaHora: '2026-10-20T16:59:00', esPosibleDuplicado: true }] }), null)
  assert.equal(puedeCompletarSalida({ ...base, horarioPrevisto: '' }, { permitido: true, manualDisponible: true }), false)
  assert.equal(puedeCompletarEntrada({ ...cerca, horarioPrevisto: '' }, { permitido: true, manualDisponible: true }), false)
  const marca1702 = { estado: 'Incompleta', horarioPrevisto: '08:00 a 17:00', movimientos: [{ fechaHora: '2026-10-23T17:02:00', tipo: 'Entrada' }] }
  for (const horario of ['08:00–17:00', '08:00-17:00', '08:00 a 17:00', '08:00:00-17:00:00']) {
    const lectura = interpretarFichadaUnica({ ...marca1702, horarioPrevisto: horario })
    assert.equal(lectura.lado, 'egreso', horario)
    assert.equal(lectura.hora, '17:02', horario)
  }
  const enBuenosAires = interpretarFichadaUnica({
    ...marca1702,
    movimientos: [{ fechaHora: '2026-10-23T20:02:00Z', tipo: 'Entrada' }],
  })
  assert.equal(enBuenosAires.hora, '17:02')
  assert.equal(enBuenosAires.lado, 'egreso')
  const sinHorario1702 = interpretarFichadaUnica({ ...marca1702, horarioPrevisto: 'No asignado' })
  assert.equal(sinHorario1702.lado, 'ambigua')
  assert.equal(sinHorario1702.hora, '17:02')
  assert.equal(marca1702.estado, 'Incompleta')
  const porAsignacion = aplicarHorarioDelDia(
    { ...marca1702, horarioPrevisto: 'No asignado' },
    { horaEntrada: '08:00:00', horaSalida: '17:00:00', tieneTurnoAsignado: true },
  )
  assert.equal(interpretarFichadaUnica(porAsignacion).lado, 'egreso')
  const porExcepcion = aplicarHorarioDelDia(
    { ...marca1702, horarioPrevisto: '08:00 a 17:00' },
    { horaEntrada: '09:00', horaSalida: '18:00', esExcepcionManual: true, tieneTurnoAsignado: true },
  )
  assert.equal(interpretarFichadaUnica(porExcepcion).lado, 'egreso')
  const sinTurno = aplicarHorarioDelDia(
    { ...marca1702, horarioPrevisto: '08:00 a 17:00' },
    { tieneTurnoAsignado: false, tieneHorarioConfigurado: false, esExcepcionManual: false },
  )
  assert.equal(interpretarFichadaUnica(sinTurno).lado, 'ambigua')
  const construida = buildJornadas(
    [{ id: 1, empleadoId: '7', empleado: 'Ana', fechaHora: '2026-10-23T17:02:00', tipo: 'Entrada' }],
    new Map([['7', { id: '7', horario: '08:00-17:00' }]]),
    { todayKey: '2026-10-25', now: new Date('2026-10-25T18:00:00Z') },
  )
  assert.equal(construida[0].estado, 'Incompleta')
  assert.equal(construida[0].horarioPrevisto, '08:00 a 17:00')
  assert.equal(interpretarFichadaUnica(construida[0]).lado, 'egreso')
  assert.equal(construida[0].movimientos[0].tipo, 'Entrada')
  const ambigua1702 = { ...marca1702, horarioPrevisto: '', fecha: '2026-10-23', empleadoId: 7, empleado: 'Ana' }
  assert.equal(puedeAgregarFichada(ambigua1702, { permitido: true, manualDisponible: true }), true)
  assert.equal(puedeAgregarFichada(ambigua1702, { permitido: false, manualDisponible: true }), false)
  assert.equal(puedeAgregarFichada(marca1702, { permitido: true, manualDisponible: true }), false)
  const agregar = presetAgregarFichada(ambigua1702)
  assert.equal(agregar.tipo, '')
  assert.equal(agregar.hora, '')
  assert.equal(agregar.motivo, '')
  assert.equal(agregar.detalle, '')
  assert.equal(agregar.fecha, '2026-10-23')
  assert.equal(agregar.bloquear, true)
  assert.equal(agregar.agregarFichada, true)
  assert.equal(validateFichadaContraMarca({ fecha: '2026-10-23', hora: '16:00', tipo: '' }, '2026-10-23T17:02:00').message, TIPO_FICHADA_MESSAGE)
  assert.equal(validateFichadaContraMarca({ fecha: '2026-10-23', hora: '17:30', tipo: 'Entrada' }, '2026-10-23T17:02:00').message, ENTRADA_POSTERIOR_MESSAGE)
  assert.equal(validateFichadaContraMarca({ fecha: '2026-10-23', hora: '16:00', tipo: 'Salida' }, '2026-10-23T17:02:00').message, SALIDA_ANTERIOR_MESSAGE)
  assert.equal(validateFichadaContraMarca({ fecha: '2026-10-23', hora: '17:01:30', tipo: 'Entrada' }, '2026-10-23T17:02:00').message, ENTRADA_DUPLICADA_MESSAGE)
  assert.equal(validateFichadaContraMarca({ fecha: '2026-10-23', hora: '17:03', tipo: 'Salida' }, '2026-10-23T17:02:00').message, SALIDA_DUPLICADA_MESSAGE)
  assert.equal(validateFichadaContraMarca({ fecha: '2026-10-23', hora: '16:00', tipo: 'Entrada' }, '2026-10-23T17:02:00').ok, true)
  assert.equal(validateFichadaContraMarca({ fecha: '2026-10-23', hora: '18:00', tipo: 'Salida' }, '2026-10-23T17:02:00').ok, true)
  const panel = read('src/components/fichada-manual-panel.js')
  assert.match(panel, /agregarFichada \? '<option value="">Seleccioná<\/option>'/)
  assert.match(panel, /if \(!preset\.agregarFichada\) form\.tipo\.disabled = true/)
  assert.equal(puedeCompletarSalida({ ...cerca, movimientos: [{ fechaHora: '2026-10-20T14:59:00' }] }, { permitido: true, manualDisponible: true }), false)
  assert.equal(puedeCompletarSalida(cerca, { permitido: true, manualDisponible: true }), false)
  assert.equal(puedeCompletarEntrada(cerca, { permitido: true, manualDisponible: true }), true)
  assert.equal(puedeCompletarEntrada(cerca, { permitido: false, manualDisponible: true }), false)
  const entrada = presetCompletarEntrada(cerca)
  assert.equal(entrada.tipo, 'Entrada')
  assert.equal(entrada.hora, '')
  assert.equal(entrada.fecha, '2026-10-20')
  assert.equal(entrada.bloquear, true)
  assert.equal(validateEntradaContraSalida({ fecha: '2026-10-20', hora: '17:30' }, '2026-10-20T16:59:00').message, ENTRADA_POSTERIOR_MESSAGE)
  assert.equal(validateEntradaContraSalida({ fecha: '2026-10-20', hora: '16:58:30' }, '2026-10-20T16:59:00').message, ENTRADA_DUPLICADA_MESSAGE)
  assert.equal(validateEntradaContraSalida({ fecha: '2026-10-20', hora: '16:00' }, '2026-10-20T16:59:00').ok, true)
  const preset = presetCompletarSalida(base)
  assert.equal(preset.hora, '')
  assert.equal(preset.motivo, '')
  assert.equal(preset.detalle, '')
  assert.equal(preset.tipo, 'Salida')
  assert.equal(preset.bloquear, true)
  assert.equal(preset.fecha, '2026-10-20')
  const anterior = validateSalidaContraEntrada({ fecha: '2026-10-20', hora: '07:00' }, '2026-10-20T08:00:00')
  assert.equal(anterior.ok, false)
  assert.equal(anterior.message, SALIDA_ANTERIOR_MESSAGE)
  const duplicada = validateSalidaContraEntrada({ fecha: '2026-10-20', hora: '08:01:00' }, '2026-10-20T08:00:00')
  assert.equal(duplicada.message, SALIDA_DUPLICADA_MESSAGE)
  const valida = validateSalidaContraEntrada({ fecha: '2026-10-20', hora: '08:01:01' }, '2026-10-20T08:00:00')
  assert.equal(valida.ok, true)
  assert.equal(valida.warning, '')
  const larga = validateSalidaContraEntrada({ fecha: '2026-10-20', hora: '20:00:01' }, '2026-10-20T08:00:00')
  assert.equal(larga.ok, true)
  assert.equal(larga.warning, SALIDA_LARGA_MESSAGE)
})

check('una salida inválida no dispara el POST y el doble envío sigue bloqueado', async () => {
  let posts = 0
  await assert.rejects(
    () => commitManualFichada(
      { empleadoId: 7, fecha: '2026-10-20', hora: '08:00:30', tipo: 'Salida', motivo: 'Otro', detalle: 'Nota' },
      {
        now: new Date('2026-10-25T15:00:00Z'),
        create: async () => {
          posts += 1
        },
        extraCheck: () => validateSalidaContraEntrada({ fecha: '2026-10-20', hora: '08:00:30' }, '2026-10-20T08:00:00'),
      },
    ),
    (error) => error.message === SALIDA_DUPLICADA_MESSAGE,
  )
  assert.equal(posts, 0)
  await assert.rejects(
    () => commitManualFichada(
      { empleadoId: 7, fecha: '2026-10-23', hora: '16:00', tipo: '', motivo: 'Otro', detalle: 'Nota' },
      {
        now: new Date('2026-10-25T15:00:00Z'),
        create: async () => {
          posts += 1
        },
        extraCheck: (value) => validateFichadaContraMarca(value, '2026-10-23T17:02:00'),
      },
    ),
    (error) => error.message === TIPO_FICHADA_MESSAGE,
  )
  assert.equal(posts, 0)
})

let passed = 0
for (const [name, fn] of queue) {
  await fn()
  passed += 1
  console.log(`ok ${name}`)
}
console.log(`${passed} checks ok`)
