import '../scripts/browser-globals.js'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildTurnoBody, mapTurno } from '../src/api/turnos.js'
import {
  ACCESOS_DESCANSO,
  MENSAJE_DESCANSO_DURACION,
  MENSAJE_DESCANSO_ENTERO,
  MENSAJE_DESCANSO_NEGATIVO,
  MENSAJE_DESCANSO_OBLIGATORIO,
  notaDescanso,
  parseMinutosAlmuerzo,
  textoJornadaNeta,
  validarTramoTurno,
  valorCampoDescanso,
} from '../src/utils/turno-presentacion.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const panel = readFileSync(join(root, 'src/components/turnos-panel.js'), 'utf8')
const presentacion = readFileSync(join(root, 'src/utils/turno-presentacion.js'), 'utf8')
const turnosApi = readFileSync(join(root, 'src/api/turnos.js'), 'utf8')
const addDay = panel.slice(panel.indexOf('function addDay'), panel.indexOf('dias.forEach(addDay)'))

assert.deepEqual(ACCESOS_DESCANSO.map((acceso) => acceso.etiqueta), ['Sin descanso', '30 min', '45 min', '60 min'])
assert.deepEqual(ACCESOS_DESCANSO.map((acceso) => acceso.minutos), [0, 30, 45, 60])
assert.equal(ACCESOS_DESCANSO.some((acceso) => acceso.minutos === 20), false)
assert.match(addDay, /name="minutosAlmuerzo" type="number"/)
assert.match(addDay, /aria-label="Descanso"/)
assert.match(addDay, /aria-hidden="true">min</)
assert.match(addDay, /data-descanso-rapido/)
assert.match(addDay, /Accesos rápidos de descanso/)
assert.doesNotMatch(addDay, /<select name="minutosAlmuerzo"/)
assert.doesNotMatch(panel, /minutosAlmuerzo\s*\|\|/)
assert.doesNotMatch(panel, /minutosAlmuerzo\s*>\s*0\s*\?/)
assert.doesNotMatch(presentacion, /valor\s*>\s*0\s*\?/)
assert.doesNotMatch(turnosApi, /minutosAlmuerzo\s*\|\|/)
assert.match(panel, /if \(!body\) return/)
assert.ok(panel.indexOf('const body = form.collect()') < panel.indexOf('createTurno(body)'))
assert.match(panel, /minutosAlmuerzo: 60/)

assert.equal(valorCampoDescanso(0), '0')
assert.equal(valorCampoDescanso(20), '20')
assert.equal(valorCampoDescanso(30), '30')
assert.equal(valorCampoDescanso(60), '60')
assert.equal(valorCampoDescanso(null), '')
assert.equal(valorCampoDescanso(undefined), '')
assert.equal(valorCampoDescanso(''), '')
assert.equal(notaDescanso('0'), 'Sin descanso')
assert.equal(notaDescanso(0), 'Sin descanso')
assert.equal(notaDescanso('20'), '')
assert.equal(notaDescanso(''), '')

assert.equal(textoJornadaNeta('08:00', '17:00', 60), 'Jornada neta: 8 h')
assert.equal(textoJornadaNeta('08:00', '17:00', 0), 'Jornada neta: 9 h')
assert.equal(textoJornadaNeta('08:00', '17:00', 20), 'Jornada neta: 8 h 40 min')
assert.equal(textoJornadaNeta('22:00', '06:00', 60), 'Jornada neta: 7 h')
assert.equal(textoJornadaNeta('08:00', '17:00', ''), '—')
assert.equal(textoJornadaNeta('08:00', '17:00', 35), 'Jornada neta: 8 h 25 min')

assert.equal(parseMinutosAlmuerzo('').message, MENSAJE_DESCANSO_OBLIGATORIO)
assert.equal(parseMinutosAlmuerzo('   ').message, MENSAJE_DESCANSO_OBLIGATORIO)
assert.equal(parseMinutosAlmuerzo('-1').message, MENSAJE_DESCANSO_NEGATIVO)
assert.equal(parseMinutosAlmuerzo('20.5').message, MENSAJE_DESCANSO_ENTERO)
assert.equal(parseMinutosAlmuerzo('20 min').message, MENSAJE_DESCANSO_ENTERO)
assert.equal(parseMinutosAlmuerzo('20').value, 20)
assert.equal(parseMinutosAlmuerzo('0').value, 0)
assert.equal(validarTramoTurno('08:00', '17:00', 540).message, MENSAJE_DESCANSO_DURACION)
assert.equal(validarTramoTurno('08:00', '17:00', 541).message, MENSAJE_DESCANSO_DURACION)
assert.equal(validarTramoTurno('22:00', '06:00', 480).message, MENSAJE_DESCANSO_DURACION)
assert.equal(validarTramoTurno('22:00', '06:00', 60).ok, true)
assert.equal(validarTramoTurno('08:00', '17:00', 0).ok, true)
assert.equal(validarTramoTurno('08:00', '17:00', '').ok, false)

for (const minutos of [0, 20, 30, 60]) {
  const manual = buildTurnoBody({
    nombre: 'Jornada',
    toleranciaMinutos: 5,
    dias: [{ diaSemana: 1, horaEntrada: '08:00', horaSalida: '17:00', minutosAlmuerzo: minutos }],
  })
  assert.equal(manual.dias[0].minutosAlmuerzo, minutos)
  const editado = mapTurno({
    id: 4,
    nombre: 'Jornada',
    toleranciaMinutos: 5,
    dias: [{ diaSemana: 1, horaEntrada: '08:00:00', horaSalida: '17:00:00', minutosAlmuerzo: minutos }],
  })
  assert.equal(valorCampoDescanso(editado.dias[0].minutosAlmuerzo), String(minutos))
  assert.equal(notaDescanso(editado.dias[0].minutosAlmuerzo), minutos === 0 ? 'Sin descanso' : '')
  const reenvio = buildTurnoBody({
    nombre: editado.nombre,
    toleranciaMinutos: editado.toleranciaMinutos,
    dias: editado.dias,
  })
  assert.equal(reenvio.dias[0].minutosAlmuerzo, minutos)
}

const rapidoCero = buildTurnoBody({
  nombre: 'Jornada',
  toleranciaMinutos: 5,
  dias: [{ diaSemana: 1, horaEntrada: '08:00', horaSalida: '17:00', minutosAlmuerzo: ACCESOS_DESCANSO[0].minutos }],
})
const rapidoSesenta = buildTurnoBody({
  nombre: 'Jornada',
  toleranciaMinutos: 5,
  dias: [{ diaSemana: 1, horaEntrada: '08:00', horaSalida: '17:00', minutosAlmuerzo: ACCESOS_DESCANSO[3].minutos }],
})
assert.equal(rapidoCero.dias[0].minutosAlmuerzo, 0)
assert.equal(rapidoSesenta.dias[0].minutosAlmuerzo, 60)
assert.equal(JSON.stringify(rapidoCero), '{"nombre":"Jornada","toleranciaMinutos":5,"dias":[{"diaSemana":1,"horaEntrada":"08:00","horaSalida":"17:00","minutosAlmuerzo":0}]}')
assert.equal(buildTurnoBody({
  nombre: 'Jornada',
  toleranciaMinutos: 5,
  dias: [{ diaSemana: 1, horaEntrada: '08:00', horaSalida: '17:00', minutosAlmuerzo: 20 }],
}).dias[0].minutosAlmuerzo, 20)

const soloLunes = buildTurnoBody({
  nombre: 'Jornada',
  toleranciaMinutos: 0,
  dias: [{ diaSemana: 1, horaEntrada: '08:00', horaSalida: '17:00', minutosAlmuerzo: 20 }],
})
assert.deepEqual(soloLunes.dias.map((dia) => dia.diaSemana), [1])
