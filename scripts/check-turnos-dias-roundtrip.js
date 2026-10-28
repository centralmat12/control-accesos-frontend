import '../scripts/browser-globals.js'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildTurnoBody, mapTurno, mapTurnoDia } from '../src/api/turnos.js'
import { textoHorasProgramadas } from '../src/utils/labor-format.js'
import { DESCANSOS_MINUTOS, etiquetaDescanso, horaTexto, minutosAlmuerzoCargado, notaDescanso, opcionesDescanso, valorCampoDescanso } from '../src/utils/turno-presentacion.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const panel = readFileSync(join(root, 'src/components/turnos-panel.js'), 'utf8')
const turnosApi = readFileSync(join(root, 'src/api/turnos.js'), 'utf8')
assert.deepEqual([...DESCANSOS_MINUTOS], [0, 15, 30, 45, 60, 75, 90, 120])
assert.doesNotMatch(turnosApi, /minutosAlmuerzo\s*\|\|/)
assert.doesNotMatch(panel, /minutosAlmuerzo\s*\|\|/)
assert.doesNotMatch(panel, /minutosAlmuerzo\s*>\s*0\s*\?/)
assert.match(turnosApi, /minutosAlmuerzo: Number\(dia\.minutosAlmuerzo \?\? 60\)/)
assert.match(panel, /valorCampoDescanso\(dia\.minutosAlmuerzo\)/)
assert.equal(minutosAlmuerzoCargado(0), 0)
assert.equal(minutosAlmuerzoCargado(30), 30)
assert.equal(minutosAlmuerzoCargado(60), 60)
assert.equal(minutosAlmuerzoCargado(null), null)
assert.equal(minutosAlmuerzoCargado(undefined), null)
assert.equal(valorCampoDescanso(0), '0')
assert.equal(valorCampoDescanso(null), '')
assert.equal(notaDescanso(0), 'Sin descanso')
assert.equal(etiquetaDescanso(minutosAlmuerzoCargado(0)), 'Sin descanso')
for (const minutos of DESCANSOS_MINUTOS) {
  const body = buildTurnoBody({
    nombre: 'Descanso',
    toleranciaMinutos: 0,
    dias: [{ diaSemana: 1, horaEntrada: '08:00', horaSalida: '18:00', minutosAlmuerzo: minutos }],
  })
  assert.equal(body.dias[0].minutosAlmuerzo, minutos)
  const mapped = mapTurno({
    id: 1,
    nombre: 'Descanso',
    toleranciaMinutos: 0,
    dias: [{ ...body.dias[0], horaEntrada: '08:00:00', horaSalida: '18:00:00' }],
  })
  assert.equal(mapped.dias[0].minutosAlmuerzo, minutos)
  assert.equal(opcionesDescanso(minutos).includes(minutos), true)
  assert.equal(etiquetaDescanso(minutos), minutos === 0 ? 'Sin descanso' : `${minutos} min`)
}
const addDay = panel.slice(panel.indexOf('function addDay'), panel.indexOf('dias.forEach(addDay)'))
const dayLabels = [...panel.match(/const DAY_LABELS = \[([^\]]+)\]/)[1].matchAll(/'([^']+)'/g)].map((match) => match[1])

assert.match(addDay, /if \(row\.isConnected\) enhanceSelectsIn\(row\)/)
assert.doesNotMatch(addDay, /list\.append\(row\)\s*enhanceSelectsIn\(row\)/)

const descansos = [0, 30, 60, 0, 30, 60]
const dias = [1, 2, 3, 4, 5, 6].map((diaSemana, index) => ({
  diaSemana,
  horaEntrada: index % 2 === 0 ? '08:00' : '08:30',
  horaSalida: index % 2 === 0 ? '17:00' : '13:00',
  minutosAlmuerzo: descansos[index],
}))

const body = buildTurnoBody({
  nombre: 'Jornada semanal',
  toleranciaMinutos: 0,
  dias,
})

assert.equal(body.toleranciaMinutos, 0)
assert.deepEqual(body.dias.map((dia) => dia.minutosAlmuerzo), descansos)
assert.deepEqual(body.dias.map((dia) => dia.diaSemana), [1, 2, 3, 4, 5, 6])

const respuesta = JSON.parse(JSON.stringify({
  id: 12,
  nombre: body.nombre,
  toleranciaMinutos: body.toleranciaMinutos,
  cantidadEmpleadosAsignados: 0,
  dias: body.dias.map((dia) => ({
    diaSemana: dia.diaSemana,
    horaEntrada: `${dia.horaEntrada}:00`,
    horaSalida: `${dia.horaSalida}:00`,
    minutosAlmuerzo: dia.minutosAlmuerzo,
  })),
}))
const pascal = {
  Id: 12,
  Nombre: body.nombre,
  ToleranciaMinutos: '0',
  Dias: body.dias.map((dia) => ({
    DiaSemana: String(dia.diaSemana),
    HoraEntrada: dia.horaEntrada,
    HoraSalida: dia.horaSalida,
    MinutosAlmuerzo: String(dia.minutosAlmuerzo),
  })),
}

for (const payload of [respuesta, pascal]) {
  const turno = mapTurno(payload)
  assert.equal(turno.dias.length, 6)
  turno.dias.forEach((dia, index) => {
    const origen = dias[index]
    assert.equal(dia.diaSemana, origen.diaSemana)
    assert.equal(dia.minutosAlmuerzo, origen.minutosAlmuerzo)
    const entrada = horaTexto(dia.horaEntrada)
    const salida = horaTexto(dia.horaSalida)
    assert.equal(entrada, origen.horaEntrada)
    assert.equal(salida, origen.horaSalida)
    assert.equal(dayLabels[dia.diaSemana], ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][index])
    assert.equal(opcionesDescanso(dia.minutosAlmuerzo).includes(dia.minutosAlmuerzo), true)
    assert.equal(etiquetaDescanso(dia.minutosAlmuerzo), origen.minutosAlmuerzo === 0 ? 'Sin descanso' : `${origen.minutosAlmuerzo} min`)
    const horas = textoHorasProgramadas(entrada, salida, dia.minutosAlmuerzo)
    assert.equal(horas.valido, true)
    assert.notEqual(horas.texto, '—')
  })
}

const domingo = mapTurnoDia({
  diaSemana: 0,
  horaEntrada: '09:00:00',
  horaSalida: '13:00:00',
  minutosAlmuerzo: 0,
})
assert.equal(domingo.diaSemana, 0)
assert.equal(domingo.minutosAlmuerzo, 0)
assert.equal(etiquetaDescanso(domingo.minutosAlmuerzo), 'Sin descanso')
assert.equal(textoHorasProgramadas(horaTexto(domingo.horaEntrada), horaTexto(domingo.horaSalida), 0).texto, '4 h')

assert.equal(mapTurnoDia({ diaSemana: '', horaEntrada: '08:00', horaSalida: '17:00', minutosAlmuerzo: 0 }), null)
assert.equal(mapTurnoDia({ diaSemana: false, horaEntrada: '08:00', horaSalida: '17:00', minutosAlmuerzo: false }), null)
assert.equal(mapTurnoDia({ DiaSemana: '6', HoraEntrada: '09:00', HoraSalida: '13:00' }).minutosAlmuerzo, null)
assert.equal(buildTurnoBody({
  nombre: 'Sin descanso',
  toleranciaMinutos: 10,
  dias: [{ diaSemana: '1', horaEntrada: '08:00', horaSalida: '17:00', minutosAlmuerzo: 0 }],
}).dias[0].minutosAlmuerzo, 0)

const getJson = {
  id: 9,
  nombre: 'Sin descanso',
  toleranciaMinutos: 5,
  dias: [
    { diaSemana: 1, horaEntrada: '09:00:00', horaSalida: '18:00:00', minutosAlmuerzo: 0 },
    { diaSemana: 2, horaEntrada: '09:00:00', horaSalida: '18:00:00', minutosAlmuerzo: 30 },
    { diaSemana: 3, horaEntrada: '09:00:00', horaSalida: '18:00:00', minutosAlmuerzo: 60 },
  ],
}
const editado = mapTurno(getJson)
assert.deepEqual(editado.dias.map((dia) => dia.minutosAlmuerzo), [0, 30, 60])
assert.deepEqual(editado.dias.map((dia) => etiquetaDescanso(minutosAlmuerzoCargado(dia.minutosAlmuerzo))), ['Sin descanso', '30 min', '60 min'])
assert.deepEqual(editado.dias.map((dia) => valorCampoDescanso(dia.minutosAlmuerzo)), ['0', '30', '60'])
assert.equal(notaDescanso(valorCampoDescanso(editado.dias[0].minutosAlmuerzo)), 'Sin descanso')
assert.equal(opcionesDescanso(0)[0], 0)
const reenvio = buildTurnoBody({
  nombre: editado.nombre,
  toleranciaMinutos: editado.toleranciaMinutos,
  dias: editado.dias.map((dia) => ({ ...dia, minutosAlmuerzo: minutosAlmuerzoCargado(dia.minutosAlmuerzo) })),
})
assert.deepEqual(reenvio.dias.map((dia) => dia.minutosAlmuerzo), [0, 30, 60])
