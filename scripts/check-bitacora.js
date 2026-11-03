import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { consultarBitacora } from '../src/api/auditoria.js'
import {
  filtrarBitacora,
  filasExportacion,
  formatoFechaBitacora,
  normalizarEventoBitacora,
  textoAccion,
} from '../src/utils/bitacora.js'

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

const turno = normalizarEventoBitacora({
  id: 'evt-1',
  fechaHora: '2026-11-02T04:32:00.000Z',
  usuario: { id: '7', nombre: 'Martín' },
  modulo: 'turnos',
  accion: 'editar',
  entidad: { tipo: 'turno', id: '4', nombre: 'Jornada semanal' },
  detalle: 'Cambió la tolerancia del turno.',
  resultado: 'ok',
  empresa: 'Norte',
  sucursal: 'Centro',
  origen: 'web',
  cambios: [
    { campo: 'tolerancia', antes: '10 min', despues: '15 min' },
    { campo: 'entradaLunes', antes: '08:30', despues: '08:00' },
    { campo: 'nombre', antes: 'Jornada semanal', despues: 'Jornada semanal' },
  ],
  metadataSegura: { password: 'no', codigo: 'OK' },
})

assert.equal(textoAccion(turno), 'Editó el turno Jornada semanal')
assert.equal(turno.modulo, 'Administración')
assert.equal(turno.resultado, 'Exitoso')
assert.equal(turno.origen, 'Web')
assert.equal(turno.cambios.length, 2)
assert.equal(turno.cambios[0].campo, 'Tolerancia')
assert.equal(turno.cambios[1].antes, '08:30')
assert.equal(turno.metadataSegura.password, undefined)
assert.equal(turno.metadataSegura.codigo, 'OK')
assert.equal(formatoFechaBitacora('2026-11-02T04:32:00.000Z').includes('·'), true)

const salida = normalizarEventoBitacora({
  fechaHora: '2026-11-02T10:00:00',
  usuario: { nombre: 'Ana' },
  modulo: 'Fichadas',
  accion: 'corregir',
  entidad: { tipo: 'salida', nombre: 'Agustín Gauna' },
  resultado: 'Advertencia',
})
assert.equal(textoAccion(salida), 'Corrigió la salida de Agustín Gauna')

const rechazado = normalizarEventoBitacora({
  fechaHora: '2026-11-01T12:00:00',
  accion: 'login-fallido',
  modulo: 'auth',
  resultado: 'rechazado',
  detalle: 'jwt eyJhbGciOi secret',
})
assert.equal(textoAccion(rechazado), 'No pudo iniciar sesión')
assert.equal(rechazado.detalle, '')
assert.equal(rechazado.modulo, 'Seguridad')
assert.equal(rechazado.resultado, 'Rechazado')

const hoy = '2026-11-02'
const visibles = filtrarBitacora([turno, salida, rechazado], { periodo: 'hoy', q: 'jornada' }, hoy)
assert.equal(visibles.length, 1)
assert.equal(visibles[0].id, 'evt-1')
assert.deepEqual(filasExportacion([turno])[0].slice(1, 4), ['Martín', 'Administración', 'Editó el turno Jornada semanal'])

const consulta = await consultarBitacora()
assert.equal(consulta.disponible, false)
assert.deepEqual(consulta.eventos, [])

const api = read('src/api/auditoria.js')
assert.equal(/apiFetch\s*\(/.test(api), false)
assert.equal(/sessionStorage\.(get|set)Item/.test(api), false)
assert.equal(/localStorage\.(get|set)Item/.test(api), false)

const view = read('src/views/registros.js')
assert.equal(view.includes('getActivityLogs'), false)
assert.equal(view.includes('sessionStorage'), false)
assert.match(view, /No hay actividad para mostrar/)
assert.match(view, /No encontramos registros para los filtros seleccionados\./)
assert.match(view, /finally/)
assert.match(view, /Reintentar/)
assert.match(view, /createExportMenu/)
assert.match(view, /Fecha y hora/)
assert.equal(view.includes('>Registros</h2>'), false)

console.log('ok - bitácora')
