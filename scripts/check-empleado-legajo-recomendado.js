import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  getRecommendedLegajo,
  shouldOfferRecommendedLegajo,
  suggestedLegajoLabel,
} from '../src/utils/empleado-data.js'
import { buildDashboardAlertas } from '../src/utils/dashboard-alertas.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
let passed = 0
let failed = 0

function read(relative) {
  return readFileSync(join(root, relative), 'utf8')
}

function check(name, fn) {
  try {
    fn()
    passed += 1
    console.log(`ok - ${name}`)
  } catch (error) {
    failed += 1
    console.error(`not ok - ${name}`)
    console.error(error)
  }
}

function emp(overrides) {
  return {
    activo: true,
    dni: '12345678',
    cuil: '20123456786',
    sucursal: 'Centro',
    horario: '08:00-17:00',
    departamento: 'Ops',
    tieneHuella: true,
    empresaId: 9,
    ...overrides,
  }
}

const admin = { rol: 'ADMIN', empresaId: 9 }

check('Sin numéricos sugiere 0001', () => {
  assert.equal(getRecommendedLegajo([]), '0001')
  assert.equal(getRecommendedLegajo([{ legajo: 'encargada' }]), '0001')
  assert.equal(getRecommendedLegajo([{ legajo: 'EMP-010' }]), '0001')
  assert.equal(getRecommendedLegajo([{ legajo: 'POLY-002' }]), '0001')
})

check('Si 1..8 están ocupados sugiere 0009 y no el máximo histórico', () => {
  assert.equal(
    getRecommendedLegajo([1, 2, 3, 4, 5, 6, 7, 8].map((n) => ({ legajo: String(n) }))),
    '0009',
  )
  assert.equal(
    getRecommendedLegajo([{ legajo: '1' }, { legajo: '2' }, { legajo: '10' }, { legajo: '22223' }]),
    '0003',
  )
})

check('Rellena el primer hueco con padding y no usa máximo + 1', () => {
  assert.equal(
    getRecommendedLegajo([{ legajo: '1' }, { legajo: '2' }, { legajo: '3' }, { legajo: '5' }, { legajo: '6' }]),
    '0004',
  )
  assert.equal(getRecommendedLegajo([{ legajo: '2' }, { legajo: '3' }, { legajo: '4' }]), '0001')
  assert.equal(getRecommendedLegajo([{ legajo: '015' }]), '0001')
  assert.equal(getRecommendedLegajo([{ legajo: '0001' }]), '0002')
  assert.equal(getRecommendedLegajo([{ legajo: '1' }, { legajo: '01' }, { legajo: '001' }]), '0002')
})

check('Considera activos e inactivos y no mezcla empresas', () => {
  assert.equal(
    getRecommendedLegajo([
      { legajo: '1', activo: false },
      { legajo: '3', activo: true },
    ]),
    '0002',
  )
  assert.equal(
    getRecommendedLegajo(
      [
        { empresaId: 1, legajo: '1', activo: false },
        { empresaId: 2, legajo: '2', activo: true },
      ],
      { empresaId: 1 },
    ),
    '0002',
  )
})

check('EMP-010 vacío y duplicado muestran sugerencia; numérico único no', () => {
  const catalog = [
    { id: 1, legajo: 'EMP-010' },
    { id: 2, legajo: '' },
    { id: 3, legajo: '0004' },
    { id: 4, legajo: '0004' },
    { id: 5, legajo: '0008' },
  ]
  assert.equal(shouldOfferRecommendedLegajo('EMP-010', { empleados: catalog, excludeId: 1 }), true)
  assert.equal(shouldOfferRecommendedLegajo('', { empleados: catalog, excludeId: 2 }), true)
  assert.equal(shouldOfferRecommendedLegajo('0004', { empleados: catalog, excludeId: 3 }), true)
  assert.equal(shouldOfferRecommendedLegajo('0008', { empleados: catalog, excludeId: 5 }), false)
  assert.equal(suggestedLegajoLabel('0005'), 'Legajo sugerido: 0005')
})

check('El alta precarga el correlativo y la edición ofrece Usar sugerido', () => {
  const form = read('src/components/empleado-form.js')
  const data = read('src/utils/empleado-data.js')
  assert.match(form, /const isCreate = !initialValues/)
  assert.match(form, /value: createPrefill/)
  assert.match(form, /getRecommendedLegajo/)
  assert.match(form, /LEGAJO_USE_SUGGESTED_LABEL/)
  assert.match(data, /export const LEGAJO_USE_SUGGESTED_LABEL = 'Usar sugerido'/)
  assert.match(data, /Legajo sugerido:/)
  assert.match(form, /empleado-legajo-use-suggested/)
  assert.match(form, /shouldOfferRecommendedLegajo/)
  assert.match(form, /suggestedLegajoLabel/)
  assert.match(form, /type="button" id="empleado-legajo-use-suggested"/)
  assert.match(form, /focus-visible:ring-2/)
  assert.match(form, /input.value = recommendedLegajo/)
  assert.match(form, /fields.refresh\('legajo'\)/)
  assert.equal(form.includes('await onSubmit'), true)
  const useHandler = form.slice(form.indexOf('useSuggestedButton'))
  const clickStart = useHandler.indexOf("addEventListener('click'")
  const clickFn = useHandler.slice(clickStart, useHandler.indexOf('if (currentLegajoInspection()'))
  assert.equal(clickFn.includes('onSubmit'), false)
  assert.equal(clickFn.includes('persistUpdate'), false)
  assert.match(data, /padStart\(LEGAJO_SUGGESTION_MIN_DIGITS/)
})

check('La edición no sobrescribe el valor actual al abrir', () => {
  const form = read('src/components/empleado-form.js')
  assert.match(form, /if \(initialValues\) fillEmpleadoForm\(form, initialValues\)/)
  assert.match(form, /const createPrefill = isCreate \? recommendedLegajo/)
})

check('El Dashboard no muestra recomendaciones', () => {
  const empleados = [emp({ id: 1, nombre: 'Ana', apellido: 'Perez', legajo: 'EMP-010' })]
  const alertas = buildDashboardAlertas({ user: admin, empleados })
  const card = alertas.items.find((item) => item.type === 'empleado')
  assert.equal(card.action.label, 'Revisar empleado')
  assert.equal(card.recommendedLabel, undefined)
  const ui = read('src/components/dashboard-alerts.js')
  const logic = read('src/utils/dashboard-alertas.js')
  assert.equal(/Recomendado/i.test(ui), false)
  assert.equal(/Legajo sugerido/i.test(ui), false)
  assert.equal(/Usar sugerido/.test(ui), false)
  assert.equal(logic.includes('getRecommendedLegajo'), false)
})

check('Se revalidan formato y duplicados antes de enviar', () => {
  const form = read('src/components/empleado-form.js')
  const submitStart = form.indexOf("form.addEventListener('submit'")
  const submitFn = form.slice(submitStart)
  const hasErrorsReturn = submitFn.indexOf('if (result.hasErrors)')
  const duplicateGuard = submitFn.indexOf('inspection.blocksSave')
  const onSubmitCall = submitFn.indexOf('await onSubmit')
  assert.equal(hasErrorsReturn < onSubmitCall, true)
  assert.equal(duplicateGuard < onSubmitCall, true)
  assert.match(submitFn.slice(duplicateGuard, onSubmitCall), /return/)
})

check('No se modifica la API y no se inventa sin catálogo', () => {
  assert.equal(getRecommendedLegajo(null), null)
  const api = read('src/api/empleados.js')
  assert.equal(api.includes('/api/empleados/siguiente-legajo'), false)
  const view = read('src/views/empleados.js')
  assert.match(view, /getEmpleados\(\{ incluirInactivos: true \}\)/)
  assert.match(view, /empleados: loaded && !loadError \? empleados : null/)
})

console.log(`${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
