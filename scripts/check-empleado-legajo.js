import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  LEGAJO_API_CONFLICT,
  LEGAJO_CREATE_DUPLICATE,
  LEGAJO_DIGITS_RE,
  LEGAJO_EDIT_ALERT,
  LEGAJO_EDIT_DUPLICATE_ALERT,
  LEGAJO_INVALID_MESSAGE,
  LEGAJO_LIST_WARNING,
  findDuplicateEmpleados,
  inspectLegajo,
  isBlankLegajo,
  isInvalidHistoricalLegajo,
  isValidNumericLegajo,
  listLegajoWarnings,
  validateEmpleadoValues,
  validateLegajo,
} from '../src/utils/empleado-data.js'
import { displayValue } from '../src/utils/format.js'
import { legajoCellHtml } from '../src/components/empleados-table.js'

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

const complete = {
  nombre: 'Ana',
  apellido: 'Perez',
  dni: '12345678',
  cuil: '20123456786',
}

check('encargada se detecta como inválido', () => {
  assert.equal(LEGAJO_DIGITS_RE.source, '^\\d+$')
  assert.equal(isValidNumericLegajo('encargada'), false)
  assert.equal(isInvalidHistoricalLegajo('encargada'), true)
  assert.equal(validateLegajo('encargada'), LEGAJO_INVALID_MESSAGE)
})

check('EMP-003 se detecta como inválido', () => {
  assert.equal(isInvalidHistoricalLegajo('EMP-003'), true)
  assert.equal(validateLegajo('EMP-003'), LEGAJO_INVALID_MESSAGE)
  assert.equal(validateLegajo('12 3'), LEGAJO_INVALID_MESSAGE)
})

check('123 es válido', () => {
  assert.equal(isValidNumericLegajo('123'), true)
  assert.equal(isInvalidHistoricalLegajo('123'), false)
  assert.equal(validateLegajo('123'), '')
  assert.equal(validateLegajo(' 123 '), '')
})

check('000123 es válido y se conserva como string', () => {
  assert.equal(isValidNumericLegajo('000123'), true)
  assert.equal(validateLegajo('000123'), '')
  assert.equal(String(Number('000123')), '123')
  assert.notEqual('000123', String(Number('000123')))
})

check('null y string vacío se tratan como sin legajo, no como legado inválido', () => {
  assert.equal(isBlankLegajo(null), true)
  assert.equal(isBlankLegajo(''), true)
  assert.equal(isBlankLegajo('   '), true)
  assert.equal(isInvalidHistoricalLegajo(null), false)
  assert.equal(isInvalidHistoricalLegajo(''), false)
  assert.equal(isInvalidHistoricalLegajo('   '), false)
  assert.equal(validateLegajo(null), '')
  assert.equal(validateLegajo(''), '')
  assert.equal(displayValue(null), '—')
  assert.equal(displayValue(''), '—')
  const emptyEdit = validateEmpleadoValues(
    { ...complete, legajo: null },
    { initialValues: { ...complete, legajo: null } },
  )
  assert.equal(emptyEdit.legajo, undefined)
})

check('El valor histórico incorrecto se muestra sin modificación', () => {
  const markup = legajoCellHtml({ legajo: 'encargada' })
  assert.match(markup, /encargada/)
  assert.equal(markup.includes('encargada'), true)
  assert.doesNotMatch(markup, /encargad(?!a)/)
  assert.match(markup, new RegExp(LEGAJO_LIST_WARNING.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  const mixed = legajoCellHtml({ legajo: 'EMP-003' })
  assert.match(mixed, /EMP-003/)
  assert.equal(displayValue('EMP-003'), 'EMP-003')
  assert.equal(legajoCellHtml({ legajo: '123' }).includes(LEGAJO_LIST_WARNING), false)
  assert.equal(legajoCellHtml({ legajo: null }), '—')
})

check('La edición queda bloqueada hasta ingresar únicamente números', () => {
  const initial = { ...complete, legajo: 'encargada' }
  const blocked = validateEmpleadoValues(initial, { initialValues: initial })
  assert.equal(blocked.legajo, LEGAJO_INVALID_MESSAGE)
  const stillMixed = validateEmpleadoValues(
    { ...complete, legajo: 'EMP-003' },
    { initialValues: initial },
  )
  assert.equal(stillMixed.legajo, LEGAJO_INVALID_MESSAGE)
  const unlocked = validateEmpleadoValues(
    { ...complete, legajo: '000123' },
    { initialValues: initial },
  )
  assert.equal(unlocked.legajo, undefined)

  const form = read('src/components/empleado-form.js')
  assert.match(form, /submitButton\.disabled = inspection\.blocksSave/)
  assert.match(form, /fields\.validateAll\(\)/)
  assert.match(form, /if \(result\.hasErrors\)/)
  assert.match(form, /LEGAJO_EDIT_ALERT/)
  assert.match(form, /inspectLegajo/)
  assert.match(form, /live: true/)
  assert.equal(LEGAJO_EDIT_ALERT.includes('únicamente por números'), true)
})

check('No se realizan llamadas a la API cuando la validación falla', () => {
  const form = read('src/components/empleado-form.js')
  const submitStart = form.indexOf("form.addEventListener(")
  const submitFn = form.slice(submitStart)
  const hasErrorsReturn = submitFn.indexOf('if (result.hasErrors)')
  const onSubmitCall = submitFn.indexOf('await onSubmit')
  assert.equal(hasErrorsReturn !== -1, true)
  assert.equal(onSubmitCall !== -1, true)
  assert.equal(hasErrorsReturn < onSubmitCall, true)
  const afterErrors = submitFn.slice(hasErrorsReturn, onSubmitCall)
  assert.match(afterErrors, /return/)
  assert.equal(afterErrors.includes('createEmpleado'), false)
  assert.equal(afterErrors.includes('persistUpdate'), false)
  assert.equal(form.includes("name === 'legajo' && sanitizeDigits"), false)
})

check('La sugerencia de legajo no se presenta como número reservado', () => {
  const sources = [
    read('src/utils/empleado-data.js'),
    read('src/components/empleado-form.js'),
    read('src/views/empleados.js'),
    read('src/api/empleados.js'),
  ].join('\n')
  assert.equal(/disponible garantizado/i.test(sources), false)
  assert.equal(/reservado/i.test(sources), false)
  assert.equal(sources.includes("type: 'number'"), false)
  const data = read('src/utils/empleado-data.js')
  assert.match(data, /padStart\(LEGAJO_SUGGESTION_MIN_DIGITS/)
  const form = read('src/components/empleado-form.js')
  assert.match(form, /id: 'empleado-legajo'/)
  assert.match(form, /type: 'text'/)
  assert.match(form, /inputMode: 'numeric'/)
  assert.match(form, /pattern: '\[0-9\]\*'/)
  assert.match(read('src/utils/empleado-data.js'), /export function getRecommendedLegajo/)
})

check('La validación de legajo está centralizada', () => {
  const data = read('src/utils/empleado-data.js')
  const form = read('src/components/empleado-form.js')
  const table = read('src/components/empleados-table.js')
  assert.match(data, /export function validateLegajo/)
  assert.match(data, /export function isInvalidHistoricalLegajo/)
  assert.match(data, /export function inspectLegajo/)
  assert.match(data, /export function findDuplicateEmpleados/)
  assert.match(data, /export function getRecommendedLegajo/)
  assert.match(form, /validateEmpleadoValues/)
  assert.match(form, /inspectLegajo/)
  assert.match(table, /listLegajoWarnings/)
  assert.equal(data.includes("['legajo', 'departamento', 'categoria', 'sucursal']"), false)
  assert.match(data, /solo usa empleados en memoria/)
  assert.match(data, /EmpresaId, Legajo/)
})

const twins = [
  { id: 1, nombre: 'Ana', apellido: 'Perez', legajo: 'EMP-004' },
  { id: 2, nombre: 'Bruno', apellido: 'Diaz', legajo: 'EMP-004' },
]

check('Dos empleados con EMP-004 aparecen como duplicados', () => {
  const first = listLegajoWarnings(twins[0], twins)
  const second = listLegajoWarnings(twins[1], twins)
  assert.equal(first.some((item) => item.kind === 'duplicate'), true)
  assert.equal(second.some((item) => item.kind === 'duplicate'), true)
  assert.match(legajoCellHtml(twins[0], twins), /EMP-004/)
  assert.match(legajoCellHtml(twins[0], twins), /Bruno Diaz/)
  assert.match(legajoCellHtml(twins[1], twins), /Ana Perez/)
})

check('emp-004 y EMP-004 se consideran duplicados históricos', () => {
  const mixed = [
    { id: 1, nombre: 'Ana', apellido: 'Perez', legajo: 'emp-004' },
    { id: 2, nombre: 'Bruno', apellido: 'Diaz', legajo: 'EMP-004' },
  ]
  assert.equal(findDuplicateEmpleados('emp-004', mixed, 1).length, 1)
  assert.equal(inspectLegajo('EMP-004', { empleados: mixed, excludeId: 1 }).duplicate, true)
})

check('Espacios externos no evitan detectar el duplicado', () => {
  const mixed = [
    { id: 1, nombre: 'Ana', apellido: 'Perez', legajo: ' EMP-004 ' },
    { id: 2, nombre: 'Bruno', apellido: 'Diaz', legajo: 'EMP-004' },
  ]
  assert.equal(inspectLegajo('EMP-004', { empleados: mixed, excludeId: 2 }).duplicate, true)
  assert.equal(inspectLegajo(' EMP-004', { empleados: mixed, excludeId: 2 }).duplicate, true)
})

check('null y vacío no son duplicados', () => {
  const blanks = [
    { id: 1, nombre: 'Ana', apellido: 'Perez', legajo: null },
    { id: 2, nombre: 'Bruno', apellido: 'Diaz', legajo: '' },
    { id: 3, nombre: 'Carla', apellido: 'Lopez', legajo: '   ' },
  ]
  assert.equal(inspectLegajo(null, { empleados: blanks }).duplicate, false)
  assert.equal(inspectLegajo('', { empleados: blanks }).duplicate, false)
  assert.equal(findDuplicateEmpleados(null, blanks).length, 0)
  assert.equal(listLegajoWarnings(blanks[0], blanks).some((item) => item.kind === 'duplicate'), false)
  assert.notEqual(inspectLegajo('123', { empleados: [{ id: 9, legajo: '000123' }] }).duplicate, true)
})

check('El propio empleado se excluye al editar', () => {
  const onlySelf = [{ id: 4, nombre: 'Ana', apellido: 'Perez', legajo: '123' }]
  assert.equal(inspectLegajo('123', { empleados: onlySelf, excludeId: 4 }).duplicate, false)
  assert.equal(inspectLegajo('123', { empleados: onlySelf, excludeId: 4 }).blocksSave, false)
  const withOther = [...onlySelf, { id: 5, nombre: 'Bruno', apellido: 'Diaz', legajo: '123' }]
  assert.equal(inspectLegajo('123', { empleados: withOther, excludeId: 4 }).duplicate, true)
})

check('Un valor duplicado bloquea el guardado', () => {
  const catalog = [{ id: 8, nombre: 'Bruno', apellido: 'Diaz', legajo: '555' }]
  const blocked = validateEmpleadoValues(
    { ...complete, legajo: '555' },
    { initialValues: { ...complete, id: 1, legajo: '555' }, empleados: catalog, excludeId: 1 },
  )
  assert.equal(blocked.legajoDuplicado, LEGAJO_CREATE_DUPLICATE)
  assert.equal(inspectLegajo('555', { empleados: catalog, excludeId: 1 }).blocksSave, true)
  const form = read('src/components/empleado-form.js')
  assert.match(form, /LEGAJO_EDIT_DUPLICATE_ALERT/)
  assert.equal(LEGAJO_EDIT_DUPLICATE_ALERT.includes('más de un empleado'), true)
})

check('Un valor único habilita el guardado', () => {
  const catalog = [{ id: 8, nombre: 'Bruno', apellido: 'Diaz', legajo: '555' }]
  const unlocked = inspectLegajo('556', { empleados: catalog, excludeId: 1 })
  assert.equal(unlocked.duplicate, false)
  assert.equal(unlocked.formatError, '')
  assert.equal(unlocked.blocksSave, false)
  const errors = validateEmpleadoValues(
    { ...complete, legajo: '556' },
    { initialValues: { ...complete, id: 1, legajo: 'EMP-004' }, empleados: catalog, excludeId: 1 },
  )
  assert.equal(errors.legajo, undefined)
  assert.equal(errors.legajoDuplicado, undefined)
})

check('Un valor puede mostrar simultáneamente formato inválido y duplicado', () => {
  const warnings = listLegajoWarnings(twins[0], twins)
  assert.equal(warnings.some((item) => item.kind === 'invalid'), true)
  assert.equal(warnings.some((item) => item.kind === 'duplicate'), true)
  const inspection = inspectLegajo('EMP-004', { empleados: twins, excludeId: 1 })
  assert.equal(inspection.formatError, LEGAJO_INVALID_MESSAGE)
  assert.equal(inspection.duplicate, true)
  const errors = validateEmpleadoValues(
    { ...complete, legajo: 'EMP-004' },
    { initialValues: { ...complete, id: 1, legajo: 'EMP-004' }, empleados: twins, excludeId: 1 },
  )
  assert.equal(errors.legajo, LEGAJO_INVALID_MESSAGE)
  assert.equal(errors.legajoDuplicado, LEGAJO_CREATE_DUPLICATE)
  const markup = legajoCellHtml(twins[0], twins)
  assert.match(markup, new RegExp(LEGAJO_LIST_WARNING.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  assert.match(markup, /Bruno Diaz/)
  assert.match(markup, /EMP-004/)
})

check('Ante validación fallida no se realiza POST\/PUT', () => {
  const form = read('src/components/empleado-form.js')
  const submitStart = form.indexOf('form.addEventListener(')
  const submitFn = form.slice(submitStart)
  const hasErrorsReturn = submitFn.indexOf('if (result.hasErrors)')
  const onSubmitCall = submitFn.indexOf('await onSubmit')
  assert.equal(hasErrorsReturn < onSubmitCall, true)
  assert.match(submitFn.slice(hasErrorsReturn, onSubmitCall), /return/)
  assert.equal(form.includes("method: 'POST'"), false)
  assert.equal(form.includes("method: 'PUT'"), false)
  const view = read('src/views/empleados.js')
  assert.match(view, /createEmpleadoForm\(\{/)
  assert.match(view, /empleados,/)
})

check('Una respuesta 409 muestra el mensaje específico', () => {
  const api = read('src/api/empleados.js')
  assert.match(api, /response.status === 409/)
  assert.match(api, /LEGAJO_API_CONFLICT/)
  const createBlock = api.slice(api.indexOf('export async function createEmpleado'))
  const patchBlock = api.slice(api.indexOf('export async function patchEmpleado'))
  assert.match(createBlock, /throw createApiError\(LEGAJO_API_CONFLICT, 409\)/)
  assert.match(patchBlock, /throw createApiError\(LEGAJO_API_CONFLICT, 409\)/)
  assert.equal(LEGAJO_API_CONFLICT, 'No se pudo guardar: el legajo ya está asignado a otro empleado.')
})

console.log(`${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
