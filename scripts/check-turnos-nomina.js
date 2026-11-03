import '../scripts/browser-globals.js'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  NOMINA_AUSENTE,
  NOMINA_MANTENIMIENTO,
  NOMINA_RESTRINGIDO,
  NOMINA_SIN_COINCIDENCIAS,
  NOMINA_TEMPORAL,
  NOMINA_VACIA,
  aplicarMarcadoTurno,
  aplicarSeleccionVisible,
  clasificarEstadoNomina,
  coincideAsignadoTurno,
  esEmpleadoDesasignable,
  esEmpleadoElegible,
  estadoMarcadoTurno,
  estadoSeleccionVisible,
  fechaAsignacionVisible,
  fechaCierreDesasignacion,
  fechaIsoDesdeVisible,
  mascaraFechaDia,
  textoCantidadCambiosTurno,
  textoCantidadSeleccionada,
  textoConfirmacionAsignacion,
  textoConfirmacionDesasignacion,
} from '../src/utils/turno-presentacion.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const turnos = readFileSync(join(root, 'src/components/turnos-panel.js'), 'utf8')
const api = readFileSync(join(root, 'src/api/turnos.js'), 'utf8')

assert.equal(NOMINA_VACIA, 'Todavía no hay empleados asignados a este turno.')
assert.match(api, /\/api\/Turnos\/\$\{id\}\/empleados/)
assert.match(api, /\/api\/Turnos\/\$\{turnoId\}/)
assert.equal(api.includes('No se encontró el turno.'), false)
assert.equal(turnos.includes('No se encontró el turno.'), false)
assert.match(turnos, /consultarTurnoExistente\(turnoId\)/)
assert.match(turnos, /if \(error\?\.status === 401\) return/)

assert.equal(clasificarEstadoNomina({ status: 404, turnoExiste: false }).texto, NOMINA_AUSENTE)
assert.equal(clasificarEstadoNomina({ status: 404, turnoExiste: false }).asignar, false)
assert.equal(clasificarEstadoNomina({ status: 404, turnoExiste: true }).texto, NOMINA_MANTENIMIENTO)
assert.equal(clasificarEstadoNomina({ status: 405 }).texto, NOMINA_MANTENIMIENTO)
assert.equal(clasificarEstadoNomina({ status: 405 }).asignar, true)
assert.equal(clasificarEstadoNomina({ status: 401 }).tipo, 'sesion')
assert.equal(clasificarEstadoNomina({ status: 403 }).texto, NOMINA_RESTRINGIDO)
assert.equal(clasificarEstadoNomina({ status: 403 }).asignar, false)
assert.equal(clasificarEstadoNomina({ status: 500 }).texto, NOMINA_TEMPORAL)
assert.equal(clasificarEstadoNomina({ status: 500 }).reintentar, true)
assert.equal(clasificarEstadoNomina({ status: 0 }).reintentar, true)
assert.notEqual(clasificarEstadoNomina({ status: 404, turnoExiste: true }).texto, NOMINA_VACIA)
assert.notEqual(clasificarEstadoNomina({ status: 404, turnoExiste: false }).texto, NOMINA_VACIA)

const vacio = turnos.slice(turnos.indexOf("modo === 'vacio'"), turnos.indexOf("modo === 'mantenimiento'"))
const lista = turnos.slice(turnos.indexOf("modo === 'lista'"), turnos.indexOf("modo === 'vacio'"))
assert.equal(vacio.includes('data-buscar'), false)
assert.equal(vacio.includes('Asignar empleados'), false)
assert.match(vacio, /NOMINA_VACIA/)
assert.equal(vacio.includes('text-red-600'), false)
assert.match(lista, /data-buscar/)
assert.match(lista, /Buscar entre asignados/)
assert.match(lista, /Nombre, apellido o legajo/)
assert.match(lista, /h-10 w-full/)
assert.equal(lista.includes('Asignar empleados'), false)
assert.match(turnos, /overflow-x-hidden/)
assert.equal(lista.includes('w-max'), false)
assert.match(turnos, /data-asignar-turno/)
assert.match(turnos, /sm:justify-self-end/)
assert.equal(turnos.includes('turno-asignados-titulo'), false)
assert.equal(turnos.includes('La consulta de empleados asignados todavía no está disponible'), false)
assert.match(turnos, /fase === 'mantenimiento'/)
assert.match(turnos, /NOMINA_SIN_COINCIDENCIAS/)
assert.match(turnos, /host\.limpiar = \(\) => \{/)
assert.match(turnos, /filtro = ''/)

const ana = { nombreCompleto: 'Ana Gómez', legajo: 'A-12' }
assert.equal(coincideAsignadoTurno(ana, 'ana'), true)
assert.equal(coincideAsignadoTurno(ana, 'gomez'), true)
assert.equal(coincideAsignadoTurno(ana, 'a-12'), true)
assert.equal(coincideAsignadoTurno(ana, 'nadie'), false)

const candidatos = [
  { id: 1, nombre: 'Ana', apellido: 'Gómez', activo: true },
  { id: 2, nombre: 'Luis', apellido: 'Pérez', activo: true },
  { id: 3, nombre: 'Ya', apellido: 'Asignado', activo: true, yaAsignado: true },
  { id: 4, nombre: 'Inactivo', apellido: 'Pérez', activo: false },
]
assert.equal(esEmpleadoElegible(candidatos[2]), false)
assert.equal(esEmpleadoElegible(candidatos[3]), false)
let seleccion = aplicarSeleccionVisible(candidatos, new Set(), true)
assert.deepEqual([...seleccion].sort(), [1, 2])
const filtrados = [candidatos[1], candidatos[3]]
seleccion = aplicarSeleccionVisible(filtrados, new Set([1]), true)
assert.equal(seleccion.has(1), true)
assert.equal(seleccion.has(2), true)
assert.equal(seleccion.has(4), false)
const parcial = estadoSeleccionVisible(candidatos, new Set([1]))
assert.equal(parcial.indeterminado, true)
assert.equal(parcial.marcado, false)
const completo = estadoSeleccionVisible(candidatos, new Set([1, 2]))
assert.equal(completo.marcado, true)
assert.equal(completo.indeterminado, false)
const quitados = aplicarSeleccionVisible([candidatos[1]], new Set([1, 2]), false)
assert.equal(quitados.has(1), true)
assert.equal(quitados.has(2), false)
assert.equal(quitados.has(3), false)
const sinElegibles = estadoSeleccionVisible([candidatos[2], candidatos[3]], new Set())
assert.equal(sinElegibles.deshabilitado, true)
assert.equal(textoCantidadSeleccionada(0), '0 seleccionados')
assert.equal(textoCantidadSeleccionada(1), '1 seleccionado')
assert.equal(textoCantidadSeleccionada(8), '8 seleccionados')
assert.equal(esEmpleadoDesasignable(candidatos[2]), true)
assert.equal(esEmpleadoDesasignable(candidatos[0]), false)
assert.equal(fechaAsignacionVisible('2026-11-02'), '02/11/2026')
assert.equal(fechaIsoDesdeVisible('02/11/2026'), '2026-11-02')
assert.equal(fechaIsoDesdeVisible('11/02/2026'), '2026-02-11')
assert.equal(fechaIsoDesdeVisible('31/02/2026'), '')
assert.equal(mascaraFechaDia('02112026'), '02/11/2026')
assert.equal(fechaCierreDesasignacion('2026-10-06', '2026-11-02'), '2026-11-01')
assert.equal(fechaCierreDesasignacion('2026-11-02', '2026-11-02'), '2026-11-02')
assert.equal(textoCantidadCambiosTurno({ asignar: 0, quitar: 1 }), '1 para quitar')
assert.equal(textoCantidadCambiosTurno({ asignar: 2, quitar: 1 }), '2 para asignar · 1 para quitar')
const marcados = aplicarMarcadoTurno(candidatos, new Set(), new Set(), false)
assert.equal(marcados.quitar.has(3), true)
assert.equal(marcados.seleccion.size, 0)
const soloAsignados = estadoMarcadoTurno([candidatos[2]], new Set(), new Set())
assert.equal(soloAsignados.marcado, true)
assert.equal(soloAsignados.deshabilitado, false)
const desmarcados = estadoMarcadoTurno([candidatos[2]], new Set(), new Set([3]))
assert.equal(desmarcados.marcado, false)
assert.match(textoConfirmacionDesasignacion({
  nombre: 'Jornada semanal',
  bajas: [{ nombre: 'Genova Hernandez', fechaInicio: '2026-10-06', fechaFin: '2026-11-01' }],
}), /desde hoy no forman parte de este turno/)

assert.match(turnos, /const seleccion = new Set\(\)/)
assert.match(turnos, /const quitar = new Set\(\)/)
assert.match(turnos, /if \(!elegidos\.length && !aQuitar\.length\)/)
assert.match(turnos, /if \(asignando\) return/)
assert.match(turnos, /Seleccionar todos los resultados/)
assert.match(turnos, /aria-checked/)
assert.match(turnos, /indeterminate/)
assert.match(turnos, /aria-live="polite"/)
assert.match(turnos, /Ya asignado/)
assert.match(turnos, /\[data-asignar-turno\]/)
assert.equal(textoConfirmacionAsignacion({
  nombre: 'Jornada semanal',
  cantidad: 8,
  fechaInicio: '2026-10-27',
  fechaFin: '',
  nombres: ['Ana Gómez', 'Luis Pérez'],
}), 'Se asignará “Jornada semanal” a 8 empleados desde el 27/10/2026, sin fecha de finalización. Empleados: Ana Gómez, Luis Pérez.')
assert.match(textoConfirmacionAsignacion({
  nombre: 'Jornada semanal',
  cantidad: 6,
  fechaInicio: '2026-10-27',
  fechaFin: '2026-12-01',
  nombres: ['Uno', 'Dos', 'Tres', 'Cuatro', 'Cinco', 'Seis'],
}), /hasta el 01\/12\/2026/)
assert.match(textoConfirmacionAsignacion({
  nombre: 'Jornada semanal',
  cantidad: 6,
  fechaInicio: '2026-10-27',
  fechaFin: '2026-12-01',
  nombres: ['Uno', 'Dos', 'Tres', 'Cuatro', 'Cinco', 'Seis'],
}), /y 2 más/)

const asignar = turnos.slice(turnos.indexOf('function openAsignar'), turnos.indexOf('function confirmarAsignacion'))
assert.equal(asignar.includes('getTurnoEmpleados'), false)
assert.equal(asignar.includes('getEmpleados()'), true)
assert.match(asignar, /for \(const empleado of elegidos\)/)
assert.equal(asignar.split('getEmpleados()').length - 1, 1)
const nomina = turnos.slice(turnos.indexOf('async function cargar()'), turnos.indexOf('host.limpiar'))
assert.match(nomina, /getTurnoEmpleados\(turnoId\)/)
assert.equal(nomina.includes('getEmpleados'), false)
assert.equal(nomina.split('getTurnoEmpleados').length - 1, 1)
