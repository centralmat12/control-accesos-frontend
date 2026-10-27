import '../scripts/browser-globals.js'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { presentarConteoJornadasIncompletas } from '../src/components/jornadas-alertas-panel.js'
import { decidirEliminacionTurno, presentarFilaTurno, textoConfirmacionEliminarTurno } from '../src/components/turnos-panel.js'
import { textoHorasProgramadas } from '../src/utils/labor-format.js'
import { buildTurnoBody } from '../src/api/turnos.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (path) => readFileSync(join(root, path), 'utf8')
const turnos = read('src/components/turnos-panel.js')
const api = read('src/api/turnos.js')
const dashboard = read('src/views/dashboard.js')
const fichadas = read('src/views/fichadas.js')
const status = read('src/components/system-status.js')
const alerts = read('src/components/jornadas-alertas-panel.js')
const table = turnos.slice(turnos.indexOf('function renderTable'), turnos.indexOf('function openEliminarTurnoConfirm'))

assert.equal(table.includes('Estado'), false)
assert.match(table, /Empleados asignados/)
assert.equal(table.includes('Duración prevista'), false)
assert.equal(table.includes('La API no informa'), false)
assert.equal(table.includes('data-tooltip'), false)
assert.match(table, /Horas semanales/)
assert.match(table, /Horario habitual/)
assert.match(table, /Sin días configurados/)
assert.equal(table.includes('colspan='), false)
assert.match(turnos, /minmax\(0,1\.2fr\)_minmax\(0,0\.7fr\)_minmax\(0,1\.5fr\)_minmax\(0,0\.9fr\)_minmax\(0,1fr\)_auto/)
assert.match(table, /TURNOS_COLUMNS/)
assert.match(table, /md:hidden/)
assert.match(turnos, /overflow-x-hidden/)
assert.equal(table.includes('table-fixed'), false)
assert.equal(table.includes('w-[21%]'), false)
assert.equal(table.includes('colgroup'), false)
assert.equal(table.includes('<th'), false)
assert.equal(table.includes('<td'), false)
assert.match(turnos, /max-w-\[min\(100%,65rem\)\]/)
assert.match(turnos, /text-center/)
assert.match(table, /label: 'Editar'/)
assert.match(api, /cantidadEmpleadosAsignados/)
assert.equal(api.includes('duracionReloj'), false)
const domingo = presentarFilaTurno({
  nombre: 'domingos',
  dias: [{ diaSemana: 0, horaEntrada: '09:00', horaSalida: '18:00', minutosAlmuerzo: 60 }],
})
assert.equal(domingo.horario, 'Dom · 09:00–18:00')
assert.equal(domingo.horas, '8 h')
assert.equal(domingo.texto, '1 día')
const noche = presentarFilaTurno({
  dias: [{ diaSemana: 1, horaEntrada: '22:00', horaSalida: '06:00', minutosAlmuerzo: 60 }],
})
assert.equal(noche.horas, '7 h')
assert.equal(presentarFilaTurno({
  dias: [{ diaSemana: 1, horaEntrada: '09:00', horaSalida: '18:00', minutosAlmuerzo: 120 }],
}).horas, '7 h')
const sinDias = presentarFilaTurno({ nombre: '09:00-18:00', dias: [] })
assert.equal(sinDias.vacio, true)
assert.equal(sinDias.texto, 'Sin días configurados')
assert.equal(sinDias.horas, '—')
assert.equal(sinDias.horario, '—')
const nombreHorario = presentarFilaTurno({ nombre: '08:00-17:00', dias: [] })
assert.equal(nombreHorario.horas, '—')
assert.equal(presentarFilaTurno({
  dias: [
    { diaSemana: 1, horaEntrada: '09:00', horaSalida: '18:00', minutosAlmuerzo: 60 },
    { diaSemana: 2, horaEntrada: '08:30', horaSalida: '18:30', minutosAlmuerzo: 60 },
  ],
}).horas, '17 h')
assert.equal(presentarFilaTurno({
  dias: [{ diaSemana: 1, horaEntrada: '08:30', horaSalida: '18:30', minutosAlmuerzo: 60 }],
}).horas, '9 h')
assert.equal(table.includes('data-delete'), false)
assert.equal(table.includes('Eliminar'), false)
assert.match(table, /label: 'Editar'/)
assert.match(turnos, /if \(initial\?\.id\)/)
assert.match(turnos, /data-delete-turno/)
assert.match(turnos, /Eliminar turno/)
assert.equal(turnos.includes('openConfirmModal'), false)
assert.match(turnos, /minmax\(240px,320px\)_100px/)
assert.match(turnos, /sm:w-\[320px\]/)
assert.match(turnos, /justify-start/)
assert.match(turnos, /minmax\(0,1\.15fr\)_minmax\(0,0\.85fr\)_minmax\(0,0\.85fr\)_minmax\(0,0\.95fr\)_minmax\(0,0\.8fr\)_auto/)
assert.match(turnos, /Horas netas/)
assert.match(turnos, /dialogClass: 'max-w-\[45rem\]'/)
assert.match(turnos, /aplicarTurnoGuardado/)
assert.match(turnos, /silent: true/)
assert.equal(/(^|[^:\w])grid-cols-4/.test(turnos), false)
assert.match(turnos, />Día</)
assert.match(turnos, />Entrada</)
assert.match(turnos, />Salida</)
assert.match(turnos, />Descanso</)
assert.match(turnos, /Días y horarios/)
assert.match(turnos, /data-add-day/)
assert.ok(turnos.indexOf('Días y horarios') < turnos.indexOf('data-add-day'))
assert.ok(turnos.indexOf('data-add-day') < turnos.indexOf('data-dias'))
assert.match(turnos, /data-horas/)
assert.match(turnos, /Ej\. Turno administrativo/)
assert.match(turnos, /Crear turno/)
assert.match(turnos, /initial\?\.id \? 'Guardar' : 'Crear turno'/)
assert.equal(turnos.includes('value="Turno administrativo"'), false)
assert.match(turnos, /grid-cols-1/)
assert.match(turnos, /sm:w-auto/)
assert.equal(textoHorasProgramadas('09:00', '18:00', 60).texto, '8 h')
assert.equal(textoHorasProgramadas('08:30', '18:30', 60).texto, '9 h')
assert.equal(textoHorasProgramadas('22:00', '06:00', 60).texto, '7 h')
assert.equal(textoHorasProgramadas('09:00', '18:00', 120).texto, '7 h')
assert.equal(textoHorasProgramadas('09:00', '18:00', '').texto, '—')
assert.equal(textoHorasProgramadas('', '18:00', 60).valido, false)
assert.equal(textoHorasProgramadas('09:00', '18:00', 540).valido, false)
const bodyTurno = buildTurnoBody({
  nombre: 'Turno administrativo',
  toleranciaMinutos: 15,
  dias: [{ diaSemana: 1, horaEntrada: '09:00', horaSalida: '18:00', minutosAlmuerzo: 60 }],
})
assert.deepEqual(Object.keys(bodyTurno).sort(), ['dias', 'nombre', 'toleranciaMinutos'])
assert.deepEqual(Object.keys(bodyTurno.dias[0]).sort(), ['diaSemana', 'horaEntrada', 'horaSalida', 'minutosAlmuerzo'])
assert.equal(JSON.stringify(bodyTurno).includes('programadas'), false)
assert.match(turnos, /space-y-2/)
assert.match(turnos, /data-delete-slot/)
assert.match(turnos, /ml-auto flex flex-wrap items-center justify-end gap-2/)
assert.match(turnos, /createActionButton\(\{\s*variant: 'delete'/s)
assert.match(turnos, /actionButtonMarkup/)
assert.match(turnos, /aria-busy/)
assert.match(turnos, /Eliminando…/)
assert.match(turnos, /let busy = false/)
assert.match(turnos, /if \(busy \|\| settled\) return/)
assert.match(turnos, /\(\) => deleteTurno\(turno\.id\)/)
assert.equal(turnos.includes('turnos.filter'), false)
assert.match(api, /method: 'DELETE'/)
assert.match(api, /\/api\/Turnos\/\$\{id\}/)

const copy = textoConfirmacionEliminarTurno('Mañana')
assert.equal(copy.title, 'Eliminar turno')
assert.equal(copy.question, '¿Querés eliminar el turno “Mañana”?')
assert.equal(copy.detail, 'Esta acción solo puede realizarse si el turno no tiene asignaciones de empleados.')
assert.deepEqual(decidirEliminacionTurno(null), {
  closeEditor: true,
  reload: true,
  toast: 'Turno eliminado.',
  tone: 'success',
})
assert.equal(decidirEliminacionTurno({ status: 401 }).session, true)
assert.equal(decidirEliminacionTurno({ status: 403 }).message, 'Acceso restringido.')
assert.equal(decidirEliminacionTurno({ status: 403 }).closeEditor, undefined)
assert.equal(decidirEliminacionTurno({ status: 404 }).toast, 'El turno ya no existe.')
assert.equal(decidirEliminacionTurno({ status: 404 }).reload, true)
assert.equal(decidirEliminacionTurno({ status: 409, message: 'El turno tiene empleados asignados.' }).message, 'El turno tiene empleados asignados.')
assert.equal(decidirEliminacionTurno({ status: 409, message: 'El turno tiene empleados asignados.' }).closeEditor, undefined)
assert.equal(decidirEliminacionTurno({ status: 500 }).message, 'No se pudo eliminar el turno. Podés reintentar.')
assert.equal(decidirEliminacionTurno(new Error('network')).closeEditor, undefined)

assert.equal(presentarConteoJornadasIncompletas({ phase: 'cargando' }).value, '—')
assert.equal(presentarConteoJornadasIncompletas({ phase: 'error' }).value, '—')
assert.match(presentarConteoJornadasIncompletas({ phase: 'error' }).detail, /No se pudo consultar/)
assert.equal(presentarConteoJornadasIncompletas({ phase: 'prohibido' }).value, '—')
assert.equal(presentarConteoJornadasIncompletas({ phase: 'prohibido' }).action, false)
assert.equal(presentarConteoJornadasIncompletas({ phase: 'ok', count: 0 }).tone, 'neutral')
assert.equal(presentarConteoJornadasIncompletas({ phase: 'ok', count: 2 }).tone, 'amber')
assert.equal(presentarConteoJornadasIncompletas({ phase: 'ok', count: 2 }).value, '2')
assert.equal(presentarConteoJornadasIncompletas({ phase: 'ok', count: 2 }).detail, 'Falta revisar o completar una fichada.')

assert.equal(alerts.includes('createJornadasPendientesIndicator'), false)
assert.equal(dashboard.includes('createJornadasPendientesIndicator'), false)
assert.match(read('src/utils/dashboard-alertas.js'), /Jornada incompleta/)
assert.match(read('src/utils/dashboard-alertas.js'), /Falta revisar o completar una fichada\./)
assert.match(dashboard, /fichadasLabor/)
assert.match(dashboard, /ca:jornadas-incompletas/)
assert.match(fichadas, /fichadasLabor === 'alertas'/)
assert.match(fichadas, /openLabor\('alertas'\)/)
assert.match(fichadas, /ca:jornadas-incompletas/)
assert.match(status, /Alertas del sistema/)
assert.equal(status.includes('Alertas y pendientes'), false)
assert.equal(dashboard.includes('pendingCount +'), false)
