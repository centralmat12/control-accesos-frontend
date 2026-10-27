import '../scripts/browser-globals.js'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mapResumen } from '../src/api/jornadas.js'
import { tarjetasResumenLaboral } from '../src/utils/labor-format.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const panel = readFileSync(join(root, 'src/components/jornadas-calendar-panel.js'), 'utf8')

const deuda = mapResumen({
  minutosProgramados: 480,
  actividadRegistrada: 0,
  minutosTrabajados: 0,
  minutosRepuestos: 0,
  saldoMinutos: -480,
  minutosAdeudados: 480,
  minutosAFavor: 0,
  diasSinRegistros: 1,
  llegadasTarde: 0,
})
assert.equal(deuda.minutosAdeudados, 480)
assert.equal(deuda.minutosAFavor, 0)
assert.equal(deuda.diasSinRegistros, 1)

const derivado = mapResumen({
  minutosProgramados: 480,
  minutosTrabajados: 355,
  minutosRepuestos: 0,
  saldoMinutos: -125,
})
assert.equal(derivado.minutosAdeudados, 125)
assert.equal(derivado.minutosAFavor, 0)

const favor = mapResumen({
  minutosProgramados: 480,
  minutosTrabajados: 540,
  minutosRepuestos: 0,
  saldoMinutos: 60,
  minutosAdeudados: 0,
  minutosAFavor: 60,
  llegadasDentroTolerancia: 0,
  salidasTempranas: 0,
})
assert.equal(favor.minutosAFavor, 60)
assert.equal(favor.minutosAdeudados, 0)
assert.equal(favor.llegadasDentroTolerancia, 0)

const tarjetas = tarjetasResumenLaboral(deuda)
assert.equal(tarjetas.find((item) => item.etiqueta === 'Horas que debe').texto, '8 h')
assert.equal(tarjetas.find((item) => item.etiqueta === 'Horas a favor').texto, '0 min')
assert.equal(tarjetas.find((item) => item.etiqueta === 'Días sin registros').texto, '1')
assert.equal(tarjetas.every((item) => item.ayuda.length > 20), true)
assert.equal(tarjetas.some((item) => item.texto.includes('-') || item.texto.includes('−')), false)
assert.equal(panel.includes('tarjetasResumenLaboral'), true)
assert.equal(panel.includes("['Saldo'"), false)
assert.equal(tarjetas.some((item) => item.etiqueta === 'Minutos trabajados'), true)
assert.equal(tarjetas.some((item) => item.etiqueta === 'Actividad registrada'), true)
