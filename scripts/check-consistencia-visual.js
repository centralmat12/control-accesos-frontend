import '../scripts/browser-globals.js'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { textoOpcionCalendario, matchesEmpleadoQuery } from '../src/components/empleado-combobox.js'
import { itemJornadasIncompletas, textoResumenAlertas } from '../src/utils/dashboard-alertas.js'
import { normalizeHora } from '../src/components/time-field.js'
import { horarioNocturnoNoSoportado } from '../src/utils/labor-format.js'
import { buildTurnoBody } from '../src/api/turnos.js'
import { actionButtonMarkup } from '../src/components/button-styles.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (path) => readFileSync(join(root, path), 'utf8')
const calendar = read('src/components/jornadas-calendar-panel.js')
const combo = read('src/components/empleado-combobox.js')
const tooltip = read('src/components/tooltip.js')
const turnos = read('src/components/turnos-panel.js')
const dashboard = read('src/views/dashboard.js')
const fichadas = read('src/views/fichadas.js')
const css = read('src/style.css')

assert.equal(calendar.includes('calendario-sucursal'), false)
assert.equal(calendar.includes('calendario-departamento'), false)
assert.match(calendar, /max-w-\[32\.5rem\]/)
assert.match(calendar, /w-full max-w-\[32\.5rem\]/)
assert.match(calendar, /if \(!empleadoId\)/)
assert.match(combo, /presentation === 'calendario'/)
assert.match(combo, /Buscar por nombre o legajo/)

const persona = { id: 5, nombre: 'Emanuel', apellido: 'Guardo', legajo: '0005', sucursalNombre: 'Centro', departamento: 'Ventas' }
assert.equal(matchesEmpleadoQuery(persona, 'emanuel'), true)
assert.equal(matchesEmpleadoQuery(persona, 'guardo'), true)
assert.equal(matchesEmpleadoQuery(persona, '0005'), true)
assert.equal(textoOpcionCalendario(persona).principal, 'Emanuel Guardo · Legajo 0005')
assert.equal(textoOpcionCalendario(persona).secundaria, 'Centro · Ventas')

assert.equal(itemJornadasIncompletas(0), null)
assert.equal(itemJornadasIncompletas(null), null)
const una = itemJornadasIncompletas(1)
assert.equal(una.title, 'Jornada incompleta')
assert.equal(una.detail, 'Falta revisar o completar una fichada.')
assert.equal(una.action.label, 'Revisar jornada')
assert.equal(una.action.openAlertaDetalle, true)
assert.equal(una.action.fichadasLabor, 'alertas')
const varias = itemJornadasIncompletas(3)
assert.equal(varias.title, '3 jornadas incompletas')
assert.equal(varias.action.label, 'Ver jornadas')
assert.equal(varias.action.openAlertaDetalle, undefined)
assert.equal(textoResumenAlertas({ items: [una] }), 'Jornada incompleta')
assert.match(textoResumenAlertas({
  items: [
    { type: 'empleado', pendingCount: 2, title: 'Ana' },
    una,
  ],
}), /1 empleado requiere atención · 2 pendientes · Jornada incompleta/)
assert.equal(dashboard.includes('createJornadasPendientesIndicator'), false)
assert.match(fichadas, /openAlertaDetalle/)
assert.match(fichadas, /openFirst/)

assert.match(tooltip, /data-tooltip-compact/)
assert.match(tooltip, /clearActiveTooltip/)
assert.match(tooltip, /keydown/)
assert.match(tooltip, /Escape/)
assert.match(tooltip, /aria-describedby/)
assert.match(tooltip, /infoHelpButton/)
assert.match(turnos, /Usá un nombre fácil de identificar\./)
assert.match(turnos, /Minutos permitidos después del horario de entrada\./)
assert.match(turnos, /Tiempo de descanso que se descuenta de la jornada programada\./)
assert.match(turnos, /data-error/)
assert.match(turnos, /createTurnoHoraField/)
assert.equal(turnos.includes('createTimeSelect'), false)
assert.equal(/type="time"/.test(turnos), false)

assert.equal(normalizeHora('7:05'), '07:05')
assert.equal(normalizeHora('23:59'), '23:59')
assert.equal(normalizeHora('24:00'), null)
assert.equal(normalizeHora('10:60'), null)
assert.equal(normalizeHora('10 AM'), null)
assert.equal(horarioNocturnoNoSoportado('22:00', '06:00'), true)
const body = buildTurnoBody({
  nombre: 'Noche',
  toleranciaMinutos: 10,
  dias: [{ diaSemana: 1, horaEntrada: '22:00', horaSalida: '06:00', minutosAlmuerzo: 30 }],
})
assert.equal(body.dias[0].horaEntrada, '22:00')
assert.equal(body.dias[0].horaSalida, '06:00')

const edit = actionButtonMarkup({ compact: true, label: 'Editar', ariaLabel: 'Editar turno' })
const remove = actionButtonMarkup({ compact: true, variant: 'delete', label: 'Eliminar', ariaLabel: 'Eliminar departamento' })
assert.match(edit, /btn-action-edit btn-action-compact/)
assert.match(remove, /btn-action-delete btn-action-compact/)
assert.match(edit, /<svg/)
assert.match(css, /\.btn-action-compact/)
assert.match(css, /height: 2rem/)
for (const file of [
  'src/components/empleados-table.js',
  'src/components/departamentos-admin.js',
  'src/components/turnos-panel.js',
  'src/views/administracion.js',
]) {
  assert.match(read(file), /compact: true/)
}
assert.match(turnos, /grid-cols-1/)
