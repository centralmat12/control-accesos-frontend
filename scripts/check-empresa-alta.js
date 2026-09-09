import { resetBrowserGlobals } from './browser-globals.js'
import assert from 'node:assert/strict'
import { createEmpresa } from '../src/api/empresas.js'
import {
  buildEmpresaAltaDto,
  formatCuitForApi,
  normalizeEmpresaText,
  sanitizeCuitDigits,
  validateEmpresaAlta,
  validateEmpresaCuit,
  validateNombreComercial,
  validateRazonSocial,
} from '../src/utils/empresa-data.js'

let passed = 0
let failed = 0
const fetchCalls = []

function check(name, fn) {
  try {
    const result = fn()
    if (result && typeof result.then === 'function') {
      throw new Error('use checkAsync')
    }
    passed += 1
    console.log(`ok - ${name}`)
  } catch (error) {
    failed += 1
    console.error(`not ok - ${name}`)
    console.error(error)
  }
}

async function checkAsync(name, fn) {
  resetBrowserGlobals()
  fetchCalls.length = 0
  try {
    await fn()
    passed += 1
    console.log(`ok - ${name}`)
  } catch (error) {
    failed += 1
    console.error(`not ok - ${name}`)
    console.error(error)
  }
}

const VALID = {
  nombreFantasia: '3M Argentina',
  razonSocial: 'Servicios del Sur S.R.L.',
  cuit: '20123456786',
}

check('1. Campos vacíos', () => {
  const errors = validateEmpresaAlta({ nombreFantasia: '', razonSocial: '', cuit: '' })
  assert.equal(errors.nombreFantasia, 'Ingresá el nombre comercial.')
  assert.equal(errors.razonSocial, 'Ingresá la razón social.')
  assert.equal(errors.cuit, 'Ingresá el CUIT.')
})

check('2. Nombre con una sola letra', () => {
  assert.equal(
    validateNombreComercial('A'),
    'El nombre comercial debe tener entre 2 y 100 caracteres.',
  )
})

check('3. Nombre comercial 3M Argentina', () => {
  assert.equal(validateNombreComercial('3M Argentina'), '')
})

check('4. Nombre Roca & Asociados', () => {
  assert.equal(validateNombreComercial('Roca & Asociados'), '')
})

check('5. Razón social Servicios del Sur S.R.L.', () => {
  assert.equal(validateRazonSocial('Servicios del Sur S.R.L.'), '')
})

check('6. Cien caracteres y 101 caracteres', () => {
  const hundred = 'Ab'.repeat(50)
  const hundredOne = `${hundred}x`
  assert.equal(hundred.length, 100)
  assert.equal(hundredOne.length, 101)
  assert.equal(validateNombreComercial(hundred), '')
  assert.equal(
    validateNombreComercial(hundredOne),
    'El nombre comercial debe tener entre 2 y 100 caracteres.',
  )
  assert.equal(validateRazonSocial(hundred), '')
  assert.equal(
    validateRazonSocial(hundredOne),
    'La razón social debe tener entre 3 y 100 caracteres.',
  )
})

check('7. Texto compuesto únicamente por cccccccc', () => {
  assert.equal(
    validateNombreComercial('cccccccc'),
    'El nombre comercial no puede estar formado por un único carácter repetido.',
  )
})

check('8. Espacios al principio, al final y repetidos', () => {
  assert.equal(normalizeEmpresaText('  Roca   &   Asociados  '), 'Roca & Asociados')
  assert.equal(validateNombreComercial('  Roca   &   Asociados  '), '')
})

check('9. Letras y signos en CUIT', () => {
  assert.equal(sanitizeCuitDigits('30A-12.34 56'), '30123456')
  assert.match(validateEmpresaCuit('30-12345678-6'), /solo admite números/)
})

check('10. CUIT de menos y más de 11 dígitos', () => {
  assert.equal(validateEmpresaCuit('2012345678'), 'El CUIT debe tener exactamente 11 dígitos.')
  assert.equal(validateEmpresaCuit('2012345678600'), 'El CUIT debe tener exactamente 11 dígitos.')
  assert.equal(sanitizeCuitDigits('2012345678600'), '20123456786')
})

check('11. CUIT de 11 dígitos con verificador inválido', () => {
  assert.equal(validateEmpresaCuit('20123456789'), 'El dígito verificador del CUIT no es válido.')
})

check('12. CUIT válido y formato enviado a la API', () => {
  assert.equal(validateEmpresaCuit('20123456786'), '')
  assert.equal(formatCuitForApi('20123456786'), '20-12345678-6')
  const { dto, hasErrors } = buildEmpresaAltaDto(VALID)
  assert.equal(hasErrors, false)
  assert.equal(dto.cuit, '20-12345678-6')
  assert.equal(dto.nombreFantasia, '3M Argentina')
})

await checkAsync('13. CUIT duplicado y respuesta 409', async () => {
  sessionStorage.setItem(
    'ca.auth.user',
    JSON.stringify({ nombre: 'SA', email: 'sa@example.com', rol: 'SuperAdmin' }),
  )
  sessionStorage.setItem('ca.auth.token', 'session-jwt')
  globalThis.fetch = async (url, options = {}) => {
    fetchCalls.push({ url, options })
    return {
      ok: false,
      status: 409,
      json: async () => ({ mensaje: 'duplicado' }),
      text: async () => JSON.stringify({ mensaje: 'duplicado' }),
    }
  }

  await assert.rejects(() => createEmpresa(VALID), (error) => {
    assert.equal(error.status, 409)
    assert.equal(error.message, 'Ya existe una empresa con ese CUIT.')
    return true
  })
  assert.equal(fetchCalls.length, 1)
  assert.equal(JSON.parse(fetchCalls[0].options.body).cuit, '20-12345678-6')
})

await checkAsync('14. Un formulario inválido nunca hace POST', async () => {
  sessionStorage.setItem(
    'ca.auth.user',
    JSON.stringify({ nombre: 'SA', email: 'sa@example.com', rol: 'SuperAdmin' }),
  )
  sessionStorage.setItem('ca.auth.token', 'session-jwt')
  globalThis.fetch = async (url, options = {}) => {
    fetchCalls.push({ url, options })
    return { ok: true, status: 201, json: async () => ({}), text: async () => '' }
  }

  await assert.rejects(() => createEmpresa({ nombreFantasia: 'A', razonSocial: '', cuit: '123' }), (error) => {
    assert.equal(error.status, 400)
    return true
  })
  assert.equal(fetchCalls.length, 0)
})

console.log(`${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
