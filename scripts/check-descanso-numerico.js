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
const popover = panel.slice(panel.indexOf('function montarPopoverDescanso'), panel.indexOf('function turnoForm'))
const scroll = panel.slice(panel.indexOf('data-scroll'), panel.indexOf('data-error'))
assert.match(addDay, /name="minutosAlmuerzo" type="number"/)
assert.match(addDay, /aria-label="Descanso"/)
assert.match(addDay, /aria-hidden="true">min</)
assert.match(addDay, /Accesos rápidos de descanso/)
assert.match(addDay, /montarPopoverDescanso\(/)
assert.doesNotMatch(addDay, /data-descanso-rapido/)
assert.doesNotMatch(addDay, /flex flex-wrap gap-1/)
assert.doesNotMatch(addDay, /data-descanso-nota/)
assert.match(popover, /data-descanso-rapido/)
assert.match(popover, /Accesos rápidos de descanso/)
assert.match(popover, /panel\.hidden = true/)
assert.match(popover, /panel\.style\.position = 'fixed'/)
assert.match(popover, /document\.body\.append\(panel\)/)
assert.match(popover, /stopImmediatePropagation/)
assert.match(popover, /positionDropdownPanel/)
assert.match(panel, /const DIA_COLUMNS = 'xl:grid-cols-\[minmax\(130px,1\.35fr\)_minmax\(92px,1fr\)_minmax\(92px,1fr\)_minmax\(115px,1fr\)_minmax\(90px,auto\)_40px\]'/)
assert.match(panel, /xl:grid \$\{DIA_COLUMNS\}/)
assert.match(panel, /data-dias-grid/)
assert.match(addDay, /xl:contents/)
assert.doesNotMatch(addDay, /xl:grid-cols-/)
assert.match(panel, /const DIA_COLUMNS_MEDIO = 'md:grid-cols-\[minmax\(0,1\.35fr\)_minmax\(0,1fr\)_minmax\(0,1fr\)\]'/)
assert.match(scroll, /overflow-y-auto overflow-x-hidden/)
assert.equal(scroll.includes('data-cancel'), false)
assert.equal(scroll.includes('data-delete-slot'), false)
assert.doesNotMatch(panel, /max-h-\[min\(58vh/)
assert.match(panel, /flex min-h-0 flex-1 flex-col/)
assert.match(addDay, /data-tooltip="Quitar día"/)
assert.match(addDay, /iconTrash/)
assert.match(addDay, /Quitar \$\{escapeHtml\(nombreDia/)
assert.match(addDay, /Horas programadas después del descanso/)
assert.doesNotMatch(addDay, />Quitar</)
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

assert.equal(textoJornadaNeta('08:00', '17:00', 60), '8 h netas')
assert.equal(textoJornadaNeta('08:00', '17:00', 0), '9 h netas')
assert.equal(textoJornadaNeta('08:00', '17:00', 20), '8 h 40 min netas')
assert.equal(textoJornadaNeta('22:00', '06:00', 60), '7 h netas')
assert.equal(textoJornadaNeta('08:00', '17:00', ''), '—')
assert.equal(textoJornadaNeta('08:00', '17:00', 35), '8 h 25 min netas')

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
