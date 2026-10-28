import '../scripts/browser-globals.js'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildAsignacionBody } from '../src/api/jornadas.js'
import { buildTurnoBody, mapTurno } from '../src/api/turnos.js'
import { parseMinutosAlmuerzo, presentarFilaTurno } from '../src/components/turnos-panel.js'
import { puedeAdministrarTurnos, puedeConsultarTurnos } from '../src/config/labor-access.js'
import { minutosNetosProgramados, textoHorasProgramadas } from '../src/utils/labor-format.js'
import {
  coincideEmpleadoTurno,
  etiquetaDescanso,
  minutosSemanalesProgramados,
  opcionesDescanso,
  opcionesHora,
  textoEmpleadosAsignados,
  textoHorarioHabitual,
  textoHorasSemanales,
  textoResultadoAsignacion,
  validarTramoTurno,
} from '../src/utils/turno-presentacion.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const turnos = readFileSync(join(root, 'src/components/turnos-panel.js'), 'utf8')
const table = turnos.slice(turnos.indexOf('function renderTable'), turnos.indexOf('function openEliminarTurnoConfirm'))

const semana = [1, 2, 3, 4, 5].map((diaSemana) => ({
  diaSemana,
  horaEntrada: '08:00',
  horaSalida: '17:00',
  minutosAlmuerzo: 60,
})).concat([{ diaSemana: 6, horaEntrada: '09:00', horaSalida: '13:00', minutosAlmuerzo: 0 }])

const fila = presentarFilaTurno({ nombre: 'Jornada semanal', dias: semana, cantidadEmpleadosAsignados: 11 })
assert.equal(fila.texto, '6 días')
assert.equal(fila.horario, 'Lun–Vie · 08:00–17:00 · Sáb · 09:00–13:00')
assert.equal(fila.horas, '44 h')
assert.equal(fila.empleados, '11 asignados')
assert.equal(table.includes(`${fila.horario}`), false)
assert.equal(table.includes('w-max'), false)
assert.match(table, /md:hidden/)
assert.match(turnos, /overflow-x-hidden/)

assert.equal(textoHorarioHabitual([
  { diaSemana: 1, horaEntrada: '08:00', horaSalida: '17:00' },
  { diaSemana: 2, horaEntrada: '09:00', horaSalida: '18:00' },
  { diaSemana: 3, horaEntrada: '10:00', horaSalida: '19:00' },
]), 'Horarios variables')

const horas = opcionesHora()
assert.equal(horas[0], '00:00')
assert.equal(horas.at(-1), '23:45')
assert.equal(horas.length, 96)
assert.ok(horas.every((hora) => Number(hora.slice(3)) % 15 === 0))
assert.equal(opcionesHora('08:00').includes('08:07'), false)
const historico = opcionesHora('08:07')
assert.ok(historico.includes('08:07'))
assert.ok(historico.includes('08:00'))
assert.equal(turnos.includes('type="time"'), false)
assert.match(turnos, /name: 'horaEntrada'/)
assert.match(turnos, /createTurnoHoraField/)

assert.equal(etiquetaDescanso(0), 'Sin descanso')
for (const minutos of [0, 15, 30, 45, 60, 75, 90, 120]) {
  assert.ok(opcionesDescanso(60).includes(minutos))
}
assert.equal(parseMinutosAlmuerzo('0').value, 0)
assert.equal(parseMinutosAlmuerzo('-1').ok, false)
assert.equal(validarTramoTurno('08:00', '17:00', -1).ok, false)
assert.equal(validarTramoTurno('08:00', '17:00', 540).ok, false)
assert.equal(validarTramoTurno('08:00', '17:00', 540).message, 'El descanso debe ser menor que la duración de la jornada.')
assert.equal(textoHorasProgramadas('08:00', '17:00', 60).texto, '8 h')
assert.equal(textoHorasProgramadas('08:00', '17:00', 30).texto, '8 h 30 min')
assert.equal(textoHorasProgramadas('08:00', '17:00', 0).texto, '9 h')
assert.equal(textoHorasProgramadas('22:00', '06:00', 60).texto, '7 h')
assert.equal(minutosNetosProgramados('22:00', '06:00', 60), 420)
assert.equal(validarTramoTurno('22:00', '22:00', 0).message, 'La entrada y la salida no pueden ser iguales.')
assert.equal(minutosSemanalesProgramados(semana), 44 * 60)
assert.equal(textoHorasSemanales(semana), fila.horas)

assert.equal(textoEmpleadosAsignados(11), '11 asignados')
assert.equal(textoEmpleadosAsignados(0), '0 asignados')
assert.equal(textoEmpleadosAsignados(null), '—')
assert.equal(textoEmpleadosAsignados(undefined), '—')
assert.equal(mapTurno({ id: 4, nombre: 'Sin conteo', dias: [] }).cantidadEmpleadosAsignados, null)
assert.equal(presentarFilaTurno({ dias: semana }).empleados, '—')

const persona = { nombre: 'Ana', apellido: 'Gómez', legajo: 'A-12', dni: '30111222' }
assert.equal(coincideEmpleadoTurno(persona, 'ana'), true)
assert.equal(coincideEmpleadoTurno(persona, 'gomez'), true)
assert.equal(coincideEmpleadoTurno(persona, 'A-12'), true)
assert.equal(coincideEmpleadoTurno(persona, '30111222'), true)
assert.equal(coincideEmpleadoTurno(persona, 'nadie'), false)

const cerrada = buildAsignacionBody({ turnoId: 3, fechaInicio: '2026-10-27', fechaFin: '2026-12-31' })
assert.equal(cerrada.fechaFin, '2026-12-31')
assert.equal(cerrada.turnoId, 3)
const abierta = buildAsignacionBody({ turnoId: 3, fechaInicio: '2026-10-27', fechaFin: '' })
assert.equal(Object.hasOwn(abierta, 'fechaFin'), false)
assert.equal(Object.hasOwn(abierta, 'empresaId'), false)
assert.match(textoResultadoAsignacion([{ ok: false, message: 'La asignación se cruza con otra asignación futura.' }]).mensaje, /se cruza/)
const parcial = textoResultadoAsignacion([
  { ok: true },
  { ok: false, message: 'La vigencia se superpone con otra asignación.' },
])
assert.equal(parcial.parcial, true)
assert.match(parcial.mensaje, /superpone/)
assert.match(turnos, /if \(saving\) return/)
assert.match(turnos, /if \(asignando\) return/)

assert.equal(puedeAdministrarTurnos({ rol: 'RRHH' }), false)
assert.equal(puedeConsultarTurnos({ rol: 'RRHH' }), true)
assert.equal(puedeAdministrarTurnos({ rol: 'ADMIN' }), true)
assert.equal(puedeAdministrarTurnos({ rol: 'SuperAdmin' }), true)
assert.match(turnos, /puedeAdministrarTurnos\(getCurrentUser\(\)\)/)
assert.equal(Object.hasOwn(buildTurnoBody({
  nombre: 'Mañana',
  toleranciaMinutos: 0,
  dias: [{ diaSemana: 1, horaEntrada: '08:00', horaSalida: '17:00', minutosAlmuerzo: 0 }],
}), 'empresaId'), false)
assert.equal(buildTurnoBody({
  nombre: 'Mañana',
  toleranciaMinutos: 0,
  dias: [{ diaSemana: 1, horaEntrada: '08:00', horaSalida: '17:00', minutosAlmuerzo: 0 }],
}).dias[0].minutosAlmuerzo, 0)
