import '../scripts/browser-globals.js'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  departamentosParaDistinguir,
  matchesEmpleadoQuery,
  opcionEmpleado,
} from '../src/components/empleado-combobox.js'
import { empleadosDeFiltro, mesPermitido, periodoNegocio, textoCalendarioEmpleado } from '../src/components/jornadas-calendar-panel.js'
import { parseMinutosAlmuerzo } from '../src/components/turnos-panel.js'
import { buildTurnoBody } from '../src/api/turnos.js'
import { ariaCeldaCalendario, claseCeldaCalendario, estadoCeldaCalendario, horarioNocturnoNoSoportado } from '../src/utils/labor-format.js'
import { businessNow, FICHADA_TIME_ZONE } from '../src/utils/format.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (path) => readFileSync(join(root, path), 'utf8')
const ana = { id: 1, nombre: 'María', apellido: 'Pérez', legajo: 'A-12', departamento: 'Ventas', sucursalId: 1, departamentoId: 4 }
const ana2 = { id: 2, nombre: 'Maria', apellido: 'Perez', legajo: '99', departamento: 'Depósito', sucursalId: 1, departamentoId: 5 }
const luis = { id: 3, nombre: 'Luis', apellido: 'Gómez', legajo: '0010', departamento: 'Ventas', sucursalId: 2, departamentoId: 4 }
const lista = [ana, ana2, luis]

assert.equal(matchesEmpleadoQuery(ana, 'maria'), true)
assert.equal(matchesEmpleadoQuery(ana, 'PÉREZ'), true)
assert.equal(matchesEmpleadoQuery(ana, 'a-12'), true)
assert.equal(matchesEmpleadoQuery(ana, 'ventas'), false)
assert.equal(matchesEmpleadoQuery(luis, 'gomez'), true)
assert.equal(matchesEmpleadoQuery(luis, '0010'), true)

const duplicados = departamentosParaDistinguir(lista)
const opcionAna = opcionEmpleado(ana, duplicados)
const opcionLuis = opcionEmpleado(luis, duplicados)
assert.equal(opcionAna.nombre, 'María Pérez')
assert.equal(opcionAna.legajo, 'A-12')
assert.equal(opcionAna.departamento, 'Ventas')
assert.equal(opcionLuis.departamento, '')

const porSucursal = empleadosDeFiltro(lista, { sucursalId: 1 })
assert.deepEqual(porSucursal.map((item) => item.id), [1, 2])
const porDepartamento = empleadosDeFiltro(lista, { departamentoId: 4 })
assert.deepEqual(porDepartamento.map((item) => item.id), [1, 3])
const ambos = empleadosDeFiltro(lista, { sucursalId: '2', departamentoId: '4' })
assert.deepEqual(ambos.map((item) => item.id), [3])
assert.equal(empleadosDeFiltro(ambos, { sucursalId: 1 }).length, 0)
assert.equal(textoCalendarioEmpleado(ana), 'Calendario de María Pérez · Legajo A-12')

assert.deepEqual(parseMinutosAlmuerzo('0'), { ok: true, value: 0 })
assert.deepEqual(parseMinutosAlmuerzo('60'), { ok: true, value: 60 })
assert.equal(parseMinutosAlmuerzo('60').value, 60)
assert.equal(typeof parseMinutosAlmuerzo('60').value, 'number')
for (const invalid of ['-1', '1.5', '1,5', '60min', 'min', 'abc', '', ' 60 min']) {
  assert.equal(parseMinutosAlmuerzo(invalid).ok, false, invalid)
}
const body = buildTurnoBody({
  nombre: 'Mañana',
  toleranciaMinutos: 10,
  dias: [{ diaSemana: 1, horaEntrada: '22:00', horaSalida: '06:00', minutosAlmuerzo: 60 }],
})
assert.equal(body.dias[0].minutosAlmuerzo, 60)
assert.equal(body.toleranciaMinutos, 10)
assert.equal(body.dias[0].horaEntrada, '22:00')
assert.equal(horarioNocturnoNoSoportado('22:00', '06:00'), true)
assert.equal(horarioNocturnoNoSoportado('08:00', '17:00'), false)

const manual = read('src/components/fichada-manual-panel.js')
const combo = read('src/components/empleado-combobox.js')
const calendar = read('src/components/jornadas-calendar-panel.js')
const turnos = read('src/components/turnos-panel.js')
const fichadas = read('src/api/fichadas-manuales.js')
assert.match(manual, /No puede ser posterior a hoy\./)
assert.match(manual, /No puede ser posterior a la hora actual\./)
assert.match(manual, /Indicá si corresponde a una entrada o una salida\./)
assert.match(manual, /Seleccioná el motivo del registro manual\./)
assert.match(manual, /Agregá el detalle que justifica la fichada\./)
assert.match(manual, /mode: 'select'/)
assert.match(manual, /locked: empleadoFijo/)
assert.match(manual, /empleadoCombo\.destroy\(\)/)
assert.match(manual, /tryBeginSubmit/)
assert.match(manual, /validateManualFichadaTime/)
assert.match(manual, /createFichadaManual/)
assert.match(manual, /sm:grid-cols-2/)
assert.equal(manual.includes('title='), false)
assert.match(fichadas, /\/api\/FichadasManuales/)
assert.match(combo, /Buscar por nombre o legajo/)
assert.match(combo, /ArrowDown/)
assert.match(combo, /ArrowUp/)
assert.match(combo, /Enter/)
assert.match(combo, /Escape/)
assert.match(combo, /Tab/)
assert.match(combo, /role="combobox"/)
assert.match(combo, /choose\(TODOS_VALUE/)
assert.match(combo, /abort\.abort\(\)/)
assert.equal(calendar.includes('calendario-sucursal'), false)
assert.equal(calendar.includes('calendario-departamento'), false)
assert.match(calendar, /Seleccioná a quién querés consultar\./)
assert.match(calendar, /presentation: 'calendario'/)
assert.match(calendar, /No se encontraron empleados\./)
assert.match(calendar, /textoCalendarioEmpleado/)
assert.match(calendar, /if \(!empleadoId\)/)
assert.match(calendar, /root\.destroy/)
assert.match(turnos, /Nombre del turno/)
assert.match(turnos, /Usá un nombre fácil de identificar\./)
assert.match(turnos, /Minutos permitidos después del horario de entrada\./)
assert.match(turnos, /aria-label="Descanso"/)
assert.match(turnos, /Tiempo de descanso que se descuenta de la jornada programada\./)
assert.match(turnos, /inputmode="numeric"/)
assert.match(turnos, /aria-hidden="true">min</)
assert.match(turnos, /minutosAlmuerzo: minutos\.value/)
assert.equal(turnos.includes('horarioNocturnoNoSoportado'), false)
assert.equal(turnos.includes('NOCTURNO_PENDIENTE'), false)
assert.match(turnos, /createTurnoHoraField/)
assert.match(read('src/views/fichadas.js'), /calendarRoot\?\.destroy\?\.\(\)/)

const ahora = new Date('2026-10-25T02:30:00.000Z')
assert.equal(FICHADA_TIME_ZONE, 'America/Argentina/Buenos_Aires')
assert.equal(businessNow(ahora).dateKey, '2026-10-24')
assert.equal(periodoNegocio(ahora).dateKey, '2026-10-24')
assert.equal(mesPermitido(2026, 8, ahora), true)
assert.equal(mesPermitido(2026, 9, ahora), true)
assert.equal(mesPermitido(2026, 10, ahora), false)
assert.equal(mesPermitido(2027, 0, ahora), false)
const hoy = periodoNegocio(ahora).dateKey
const turno = { tieneTurnoAsignado: true, horaEntrada: '08:00', horaSalida: '17:00' }
const futura = estadoCeldaCalendario({
  dia: turno,
  jornada: { estado: 'Incompleta', motivo: 'Falta fichada de salida', movimientos: [{}] },
  fecha: '2026-10-27',
  hoy,
})
assert.equal(futura.codigo, 'futuro')
assert.equal(futura.etiqueta, '')
assert.equal(ariaCeldaCalendario('2026-10-27', futura), '27 de octubre de 2026, fecha futura')
assert.match(claseCeldaCalendario('futuro'), /slate/)
assert.doesNotMatch(claseCeldaCalendario('futuro'), /emerald|orange|amber/)
assert.equal(estadoCeldaCalendario({ dia: turno, fecha: '2026-10-20', hoy }).etiqueta, 'Sin registros')
assert.equal(estadoCeldaCalendario({ dia: { tieneTurnoAsignado: false }, fecha: '2026-10-26', hoy }).codigo, 'futuro')
assert.equal(estadoCeldaCalendario({ dia: turno, jornada: { estado: 'Completa', movimientos: [{}, {}] }, fecha: '2026-10-23', hoy }).etiqueta, 'Completa')
assert.match(calendar, /labelClass: FORM_LABEL_CLASS/)
assert.match(calendar, /max-w-\[32\.5rem\]/)
assert.match(calendar, /data-identidad/)
assert.match(calendar, /sm:ml-auto/)
assert.match(calendar, /aria-label="Ver mes anterior"/)
assert.match(calendar, /aria-label="Ver mes siguiente"/)
assert.match(calendar, /w-44 shrink-0/)
assert.match(calendar, /No hay períodos futuros disponibles\./)
assert.match(calendar, /next\.disabled = bloqueado/)
assert.match(calendar, /aria-disabled/)
assert.match(calendar, /event\.preventDefault\(\)/)
assert.match(calendar, /addEventListener\('keydown', bloquearFuturo\)/)
assert.ok(calendar.indexOf('if (!mesPermitido(year, monthIndex)) return') < calendar.indexOf('getCalendario('))
assert.match(calendar, /codigo === 'futuro'/)
assert.match(calendar, /futuro: 'Fecha futura'/)
const futuraInicio = calendar.indexOf("const futura = document.createElement('div')")
const futuraMarkup = calendar.slice(futuraInicio, calendar.indexOf("const button = document.createElement('button')", futuraInicio))
assert.match(futuraMarkup, /createElement\('div'\)/)
assert.equal(futuraMarkup.includes('Sin registros'), false)
assert.equal(futuraMarkup.includes('addEventListener'), false)
assert.match(calendar, /flex-col gap-2 sm:flex-row/)
assert.match(calendar, /min-w-0/)

console.log('ok formularios de empleados, calendario y turnos')
