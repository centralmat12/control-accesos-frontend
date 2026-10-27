import '../scripts/browser-globals.js'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { claimOpenDropdown, closeOpenDropdown } from '../src/components/dropdown.js'
import {
  HORAS_TURNO,
  MINUTOS_TURNO,
  moverIndice,
  partesHora,
  posicionPopoverHora,
  reducirTeclaHora,
  textoHora,
} from '../src/components/turno-hora-field.js'
import { textoHorasProgramadas } from '../src/utils/labor-format.js'
import { validarTramoTurno } from '../src/utils/turno-presentacion.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const field = readFileSync(join(root, 'src/components/turno-hora-field.js'), 'utf8')
const turnos = readFileSync(join(root, 'src/components/turnos-panel.js'), 'utf8')

assert.equal(HORAS_TURNO.length, 24)
assert.equal(HORAS_TURNO[0], '00')
assert.equal(HORAS_TURNO.at(-1), '23')
assert.equal(MINUTOS_TURNO.length, 60)
assert.equal(MINUTOS_TURNO[0], '00')
assert.equal(MINUTOS_TURNO.at(-1), '59')
assert.equal(field.includes('1440'), false)
assert.equal(field.includes('type="time"'), false)
assert.equal(turnos.includes('createTimeSelect'), false)
assert.equal(turnos.includes('type="time"'), false)

assert.equal(textoHora(0, 0), '00:00')
assert.equal(textoHora(8, 0), '08:00')
assert.equal(textoHora(17, 30), '17:30')
assert.equal(textoHora(23, 59), '23:59')
for (const hora of ['00:00', '08:00', '17:30', '23:59', '08:07']) {
  assert.equal(partesHora(hora).text, hora)
}
assert.equal(partesHora('22:00').hour, 22)
assert.equal(partesHora('06:00').minute, 0)

const base = { column: 'hour', hour: 8, minute: 0, activeHour: 8, activeMinute: 0 }
const abajo = reducirTeclaHora(base, 'ArrowDown')
assert.equal(abajo.commit, false)
assert.equal(abajo.close, false)
assert.equal(abajo.activeHour, 9)
assert.equal(abajo.hour, 8)
const elegida = reducirTeclaHora(abajo, 'Enter')
assert.equal(elegida.commit, true)
assert.equal(elegida.close, false)
assert.equal(elegida.hour, 9)
assert.equal(textoHora(elegida.hour, elegida.minute), '09:00')
const minuto = reducirTeclaHora({ ...elegida, column: 'minute', activeMinute: 0 }, 'ArrowUp')
assert.equal(minuto.activeMinute, 59)
assert.equal(minuto.commit, false)
const confirmada = reducirTeclaHora(minuto, 'Enter')
assert.equal(textoHora(confirmada.hour, confirmada.minute), '09:59')
assert.equal(reducirTeclaHora(confirmada, 'Escape').close, true)
assert.equal(moverIndice(0, -1, 24), 23)

assert.match(field, /aria-expanded/)
assert.match(field, /aria-haspopup/)
assert.match(field, /aria-controls/)
assert.match(field, /aria-selected/)
assert.match(field, /aria-activedescendant/)
assert.match(field, /Aceptar/)
assert.match(field, /Horas/)
assert.match(field, /Minutos/)
assert.match(field, /claimOpenDropdown/)
assert.match(field, /mousedown/)
assert.match(field, /Escape/)
assert.match(field, /grid-cols-2/)
assert.match(field, /overflow-x-hidden/)
assert.match(field, /overflow-y-auto/)
assert.match(field, /dark:bg-slate-900/)
assert.match(field, /dark:text-slate-100/)
assert.match(field, /bg-white/)
assert.match(field, /ring-blue-600/)
assert.match(field, /focus-visible:ring-blue-500/)
assert.match(turnos, /Seleccionar hora de entrada/)
assert.match(turnos, /Seleccionar hora de salida/)
assert.match(turnos, /name: 'horaEntrada'/)
assert.match(turnos, /name: 'horaSalida'/)
assert.match(turnos, /onChange: \(\) => paintHoras\(row\)/)
assert.match(turnos, /value: entrada/)
assert.match(turnos, /value: salida/)

let cerrado = 0
claimOpenDropdown({ close() { cerrado += 1 } })
claimOpenDropdown({ close() {} })
assert.equal(cerrado, 1)
closeOpenDropdown()

const abajoCorto = posicionPopoverHora({
  trigger: { left: 20, top: 500, bottom: 540, right: 120 },
  panelWidth: 184,
  panelHeight: 220,
  viewportWidth: 390,
  viewportHeight: 560,
})
assert.equal(abajoCorto.openUp, true)
assert.equal(abajoCorto.overflowsX, false)

const borde = posicionPopoverHora({
  trigger: { left: 360, top: 40, bottom: 80, right: 430 },
  panelWidth: 184,
  panelHeight: 220,
  viewportWidth: 400,
  viewportHeight: 700,
})
assert.equal(borde.openUp, false)
assert.equal(borde.overflowsX, false)
assert.ok(borde.left + borde.width <= 400 - 8)

assert.equal(validarTramoTurno('22:00', '06:00', '0').ok, true)
assert.equal(validarTramoTurno('08:00', '08:00', '0').ok, false)
const antes = textoHorasProgramadas('08:00', '17:00', 60)
const despues = textoHorasProgramadas('08:00', '17:30', 60)
assert.equal(antes.valido, true)
assert.equal(despues.valido, true)
assert.notEqual(antes.texto, despues.texto)
assert.equal(textoHorasProgramadas('22:00', '06:00', 0).valido, true)
