import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  armarInforme,
  clasificarLlegada,
  clasificarSalida,
  csvInforme,
  filtrarDetalle,
  INCIDENCIA,
  indicadoresInforme,
  minutosOperativos,
  nombreCsvInforme,
  rangoMes,
  resumirEmpleados,
  textoVacioInforme,
} from '../src/utils/informe-asistencia.js'
import { puedeVerInformeAsistencia } from '../src/config/labor-access.js'

const root = dirname(fileURLToPath(import.meta.url))
const read = (path) => readFileSync(join(root, '..', path), 'utf8')

const hoy = '2026-11-03'
const calendario = {
  fecha: '2026-11-02',
  tieneTurnoAsignado: true,
  tieneHorarioConfigurado: true,
  esDiaLibre: false,
  toleranciaMinutos: 15,
  minutosAlmuerzo: 0,
  horaEntrada: '08:00',
  horaSalida: '17:00',
  minutosProgramados: 480,
}

function empleado(id, extra = {}) {
  return { id, nombre: 'Ana', apellido: 'López', legajo: '100', departamento: 'Planta', departamentoId: 4, sucursal: 'Centro', sucursalId: 2, horario: '08:00-17:00', activo: true, ...extra }
}

function punch(id, fechaHora, empleadoId = 7) {
  return { id, empleadoId, fechaHora, tipo: 'Entrada', metodo: 'Biometrico', empleado: 'Ana López', legajo: '100' }
}

function informeDe(fichadas, dias = [calendario], extraEmpleado = {}) {
  const persona = empleado(7, extraEmpleado)
  return armarInforme({
    empleados: [persona],
    fichadas,
    calendariosPorEmpleado: new Map([[7, dias]]),
    asignacionesPorEmpleado: new Map([[7, [{ nombreTurno: 'Mañana', fechaInicio: '2026-01-01', fechaFin: null }]]]),
    hoy,
    now: new Date('2026-11-03T15:00:00Z'),
  })
}

assert.equal(clasificarLlegada(8 * 60, 8 * 60, 15).etiqueta, 'A tiempo')
assert.equal(clasificarLlegada(8 * 60 + 15, 8 * 60, 15).etiqueta, 'Dentro de tolerancia')
assert.equal(clasificarLlegada(8 * 60 + 15, 8 * 60, 15).exceso, 0)
assert.equal(clasificarLlegada(8 * 60 + 16, 8 * 60, 15).etiqueta, 'Llegada tarde')
assert.equal(clasificarLlegada(8 * 60 + 16, 8 * 60, 15).exceso, 1)
assert.deepEqual(
  { diferencia: clasificarLlegada(8 * 60 + 22, 8 * 60, 15).diferencia, exceso: clasificarLlegada(8 * 60 + 22, 8 * 60, 15).exceso },
  { diferencia: 22, exceso: 7 },
)
assert.equal(clasificarLlegada(7 * 60 + 50, 8 * 60, 15).etiqueta, 'A tiempo')
assert.equal(clasificarSalida(16 * 60 + 45, 17 * 60, 15).etiqueta, 'Dentro de tolerancia')
assert.equal(clasificarSalida(16 * 60 + 44, 17 * 60, 15).etiqueta, 'Salida anticipada')
assert.equal(clasificarSalida(16 * 60 + 44, 17 * 60, 15).exceso, 1)

const doble = informeDe([
  punch(1, '2026-11-02T08:22:00'),
  punch(2, '2026-11-02T16:00:00'),
])
assert.equal(doble.detalle.length, 1)
assert.deepEqual(doble.detalle[0].resultados.map((item) => item.etiqueta), ['Llegada tarde', 'Salida anticipada'])
assert.equal(doble.detalle[0].minutosProgramados, 480)
assert.equal(doble.detalle[0].estadoRevision, '')
assert.equal(doble.indicadores.llegadasTarde, 1)
assert.equal(doble.indicadores.salidasAnticipadas, 1)
assert.equal(resumirEmpleados(doble.detalle)[0].jornadasEvaluadas, 1)
assert.equal(resumirEmpleados(doble.detalle)[0].minutosProgramados, 480)

const incompleta = informeDe([punch(1, '2026-11-02T08:22:00')])
assert.ok(incompleta.detalle[0].resultados.some((item) => item.etiqueta === 'Jornada incompleta'))
assert.equal(incompleta.detalle[0].estadoRevision, 'Pendiente de revisión')
assert.equal(incompleta.detalle[0].minutosTrabajados, null)

const sinTurno = informeDe(
  [punch(1, '2026-11-02T08:00:00')],
  [{ fecha: '2026-11-02', tieneTurnoAsignado: false, tieneHorarioConfigurado: false, esDiaLibre: false, minutosProgramados: 0 }],
)
assert.deepEqual(sinTurno.detalle[0].resultados.map((item) => item.etiqueta), ['Sin información suficiente', 'Jornada incompleta'])
assert.equal(sinTurno.detalle[0].minutosProgramados, null)

const ceros = indicadoresInforme([])
assert.deepEqual(ceros, { llegadasTarde: 0, salidasAnticipadas: 0, incompletas: 0, minutosFuera: 0 })

const filtrado = filtrarDetalle(doble.detalle, INCIDENCIA.llegadaTarde)
assert.equal(filtrado.length, 1)
assert.equal(filtrarDetalle(doble.detalle, INCIDENCIA.dentroTolerancia).length, 0)
const soloAna = armarInforme({
  empleados: [empleado(7), empleado(8, { nombre: 'Luis', apellido: 'Paz', legajo: '200' })],
  fichadas: [punch(1, '2026-11-02T08:22:00', 7), punch(3, '2026-11-02T09:00:00', 8)],
  calendariosPorEmpleado: new Map([
    [7, [calendario]],
    [8, [{ ...calendario }]],
  ]),
  asignacionesPorEmpleado: new Map(),
  hoy,
  now: new Date('2026-11-03T15:00:00Z'),
  filtros: { empleadoId: 7, sucursalId: 2 },
})
assert.equal(soloAna.detalle.length, 1)
assert.equal(soloAna.detalle[0].empleadoId, 7)

const noche = informeDe(
  [punch(1, '2026-11-02T22:10:00'), punch(2, '2026-11-03T05:00:00')],
  [{
    ...calendario,
    horaEntrada: '22:00',
    horaSalida: '06:00',
    minutosProgramados: 420,
  }],
  { horario: '22:00-06:00' },
)
assert.equal(noche.detalle.length, 1)
assert.equal(minutosOperativos('2026-11-02', '2026-11-03T05:00:00'), 5 * 60 + 24 * 60)
assert.ok(noche.detalle[0].resultados.some((item) => item.etiqueta === 'Dentro de tolerancia'))

const csv = csvInforme('detalle', [{ ...doble.detalle[0], empleado: '=cmd', legajo: '100' }])
assert.ok(csv.charCodeAt(0) === 0xfeff)
assert.ok(csv.includes(';'))
assert.ok(csv.includes("'=cmd"))
assert.ok(csv.includes('Informe operativo'))
const resumenCsv = csvInforme('resumen', doble.detalle)
assert.ok(resumenCsv.includes('Minutos de tardanza'))
assert.ok(resumenCsv.includes('Informe operativo'))
assert.equal(nombreCsvInforme('detalle', '2026-11-02'), 'informe-asistencia-detalle-2026-11-02.csv')
assert.equal(nombreCsvInforme('resumen', '2026-11-02'), 'informe-asistencia-resumen-2026-11-02.csv')
assert.deepEqual(rangoMes('2026-11-15'), { desde: '2026-11-01', hasta: '2026-11-30' })

assert.equal(textoVacioInforme({ cantidad: 0 }).titulo, 'No hay incidencias para mostrar')
assert.equal(textoVacioInforme({ cantidad: 0 }).detalle, 'No encontramos registros con los filtros seleccionados.')
assert.equal(textoVacioInforme({ requiereEmpleado: true, empleadoId: '' }).titulo, 'Seleccioná un empleado')
assert.equal(textoVacioInforme({ requiereEmpleado: true, empleadoId: '' }).detalle, 'Elegí un empleado para consultar su asistencia.')

assert.equal(puedeVerInformeAsistencia({ rol: 'RRHH' }), true)
assert.equal(puedeVerInformeAsistencia({ rol: 'ADMIN' }), true)
assert.equal(puedeVerInformeAsistencia({ rol: 'EMPLEADO' }), false)

const view = read('src/views/fichadas.js')
const panel = read('src/components/informe-asistencia-panel.js')
const capa = read('src/api/informe-asistencia.js')
assert.match(view, /Consulta de fichadas/)
assert.match(view, /Informes de asistencia/)
assert.match(view, /seccion=informe/)
assert.match(view, /ca:fichadas-seccion/)
assert.equal(view.includes('fichadas-tab-informe'), false)
assert.equal(panel.includes('Volver a fichadas'), false)
assert.match(panel, /exportarCsv/)
assert.match(panel, /exportarPdf/)
assert.match(panel, /printReport/)
assert.match(panel, /Detalle de jornadas/)
assert.match(panel, /Resumen por empleado/)
assert.match(panel, /Este mes/)
assert.match(panel, /Buscar por nombre, apellido o legajo/)
assert.match(panel, /Limpiar filtros/)
assert.match(panel, /xl:grid-cols-5/)
assert.match(panel, /lg:grid-cols-4/)
assert.match(panel, /overflow-auto/)
assert.match(panel, /fichadas-scroll/)
assert.match(panel, /ArrowRight/)
assert.match(panel, /ArrowLeft/)
assert.match(read('src/components/export-menu.js'), /Escape/)
assert.equal(panel.includes('bg-amber-50'), false)
assert.match(panel, /obtenerInformeAsistencia/)
assert.equal(panel.includes('clasificarLlegada'), false)
assert.match(capa, /export async function obtenerInformeAsistencia/)
assert.equal(capa.includes('empresaId'), false)

console.log('ok - informe de asistencia')
