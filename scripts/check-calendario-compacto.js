import '../scripts/browser-globals.js'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  detalleIncidencias,
  filasDesgloseMensual,
  marcaVisibleCelda,
  presentarSaldo,
  textoHorasTrabajadas,
  textoSaldoPeriodo,
  textoVisibleCelda,
  totalIncidencias,
} from '../src/utils/labor-format.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (path) => readFileSync(join(root, path), 'utf8')
const calendar = read('src/components/jornadas-calendar-panel.js')
const view = read('src/views/fichadas.js')
const format = read('src/utils/labor-format.js')

assert.equal(calendar.includes('calendario-empleado'), false)
assert.equal(calendar.includes('data-buscar'), false)
assert.match(calendar, /setEmpleadoId/)
assert.match(view, /calendarRoot\?\.setEmpleadoId/)

assert.match(view, /id="fichadas-periodo"/)
assert.match(view, /id="fichadas-tipo"/)
assert.match(view, /id="fichadas-metodo"/)
assert.match(view, /id="fichadas-columnas-wrap"/)
assert.match(view, /id="fichadas-periodo-wrap"/)
assert.match(view, /periodoWrap\?\.classList\.toggle\('hidden', labor\)/)
assert.match(view, /tipoWrap\?\.classList\.toggle\('hidden', calendario \|\| laborKind === 'alertas'\)/)
assert.match(view, /columnasWrap\.classList\.toggle\('hidden', activeView === 'timeline' \|\| laborKind === 'calendario' \|\| laborKind === 'alertas'\)/)
assert.equal(view.includes('fichadas-tab-timeline-info'), false)
assert.equal(view.includes('fichadas-tab-jornadas-info'), false)
assert.equal(view.includes('fichadas-tab-movimientos-info'), false)
assert.match(view, /id="fichadas-calculo"/)
assert.equal(view.includes('fichadas-vistas-info'), false)

assert.match(calendar, /data-nombre/)
assert.match(calendar, /data-legajo/)
assert.match(calendar, /data-month/)
assert.equal(calendar.includes('textoCalendarioEmpleado(elegido)'), false)
assert.equal(calendar.includes('Resumen de ${nombre}'), false)
assert.equal(calendar.includes('Información de estados'), false)

const completa = { codigo: 'completa', etiqueta: 'Completa', motivo: '' }
assert.equal(textoVisibleCelda(completa), '')
assert.equal(marcaVisibleCelda(completa), '✓')
assert.equal(textoVisibleCelda({ codigo: 'incompleta', motivo: 'Falta fichada de salida' }), 'Sin salida')
assert.equal(textoVisibleCelda({ codigo: 'completa', motivo: '' }, { minutosTarde: 12 }), 'Llegada tarde')
assert.equal(marcaVisibleCelda({ codigo: 'sinRegistros', etiqueta: 'Sin registros' }), '—')
assert.match(calendar, /ariaCeldaCalendario/)
assert.match(calendar, /marcaVisibleCelda/)
assert.match(calendar, /focus-visible:ring-2/)
assert.match(calendar, /button\.type = 'button'/)
assert.match(calendar, /renderDetail/)
assert.match(calendar, /onCompletarSalida/)

assert.match(calendar, /Horas programadas/)
assert.match(calendar, /Horas trabajadas/)
assert.match(calendar, /Saldo del período/)
assert.match(calendar, /Incidencias/)
assert.equal(calendar.includes('infoHelpButton(item.ayuda)'), false)
assert.equal(calendar.includes('Horas que debe y horas a favor salen del saldo'), false)
assert.match(calendar, /infoHelpButton\(AYUDA_RESUMEN_MENSUAL\)/)
assert.match(format, /resumen\?\.minutosTrabajados/)
assert.equal(textoHorasTrabajadas({ minutosTrabajados: 120, actividadRegistrada: 180 }), '2 h')
assert.equal(textoSaldoPeriodo({ minutosProgramados: 480, saldoMinutos: -2329 }).texto, 'Debe 38 h 49 min')
assert.equal(textoSaldoPeriodo({ minutosProgramados: 480, saldoMinutos: 120 }).texto, 'A favor 2 h')
assert.equal(textoSaldoPeriodo({ minutosProgramados: 480, saldoMinutos: 0 }).texto, 'Sin saldo pendiente')
assert.equal(presentarSaldo({ minutosProgramados: 480, saldoMinutos: 0 }).valor, 'Al día')
assert.equal(textoSaldoPeriodo({ minutosProgramados: 480, saldoMinutos: -2329 }).tono, 'deuda')
assert.equal(textoSaldoPeriodo({ minutosProgramados: 480, saldoMinutos: 120 }).tono, 'favor')
assert.equal(textoSaldoPeriodo({ minutosProgramados: 480, saldoMinutos: 0 }).tono, 'neutro')

const incidencias = {
  llegadasTarde: 8,
  salidasTempranas: 1,
  jornadasIncompletas: 3,
  diasSinRegistros: 0,
  llegadasDentroTolerancia: 9,
  salidasDentroTolerancia: 4,
}
assert.equal(totalIncidencias(incidencias), 12)
assert.equal(detalleIncidencias(incidencias), '8 tardanzas · 1 salida temprana · 3 incompletas')
assert.equal(totalIncidencias({ ...incidencias, llegadasTarde: null }), null)
assert.equal(totalIncidencias({ llegadasTarde: 1, salidasTempranas: 0, jornadasIncompletas: 0, diasSinRegistros: 1 }), 2)

const filas = filasDesgloseMensual({
  actividadRegistrada: 10571,
  minutosRepuestos: 0,
  llegadasDentroTolerancia: 2,
  llegadasTarde: 8,
  salidasDentroTolerancia: 1,
  salidasTempranas: 1,
  diasSinRegistros: 4,
  jornadasIncompletas: 3,
  minutosProgramados: 11760,
  minutosTrabajados: 10571,
})
assert.deepEqual(filas.map((fila) => fila.etiqueta), [
  'Actividad registrada',
  'Reposiciones',
  'Llegadas en tolerancia',
  'Llegadas tarde',
  'Salidas en tolerancia',
  'Salidas tempranas',
  'Días sin registros',
  'Jornadas incompletas',
])
assert.equal(calendar.includes('let desgloseAbierto = false'), true)
assert.match(calendar, /Ver desglose mensual/)
assert.match(calendar, /Ocultar desglose/)
assert.match(calendar, /desgloseAbierto \? 'Ocultar desglose' : 'Ver desglose mensual'/)

assert.match(calendar, /onVerPeriodo\(\{ empleadoId, desde, hasta, year, monthIndex \}\)/)
assert.equal(calendar.includes('Ver fichadas del período'), false)
assert.equal((calendar.match(/Ver fichadas/g) ?? []).length, 1)
assert.match(calendar, /next\.disabled = bloqueado/)
assert.match(calendar, /Seleccioná un empleado/)
assert.match(calendar, /Elegí un empleado en el buscador superior para consultar su calendario\./)
assert.match(calendar, /Sin información de jornada/)
assert.match(calendar, /createFichadasEmptyState/)
assert.match(calendar, /overflow-x-hidden/)
assert.match(calendar, /grid-cols-2/)
assert.match(calendar, /lg:grid-cols-4/)
assert.match(calendar, /sm:grid-cols-2/)
assert.match(calendar, /dark:bg-slate-900/)
assert.match(calendar, /dark:text-orange-200/)
assert.match(calendar, /dark:text-emerald-200/)
assert.match(calendar, /getResumen\(empleadoId, desde, hasta\)/)
assert.equal(calendar.includes('minutosProgramados - minutosTrabajados'), false)
assert.match(format, /export function presentarSaldo/)

console.log('ok - calendario compacto')
