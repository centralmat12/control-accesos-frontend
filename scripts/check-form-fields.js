import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  FORM_HELP_FOCUS_CLASS,
  classTokens,
  fieldDescribedBy,
  formPasswordFieldMarkup,
  isValidCuitChecksum,
  passwordRuleStates,
  shouldRevealFieldError,
  toggleClassTokens,
  validateCuitValue,
  validateEmailValue,
  validateNameWithLetter,
  validatePasswordConfirm,
  validateUsuarioPasswordPolicy,
} from '../src/components/form-field.js'

let passed = 0
let failed = 0

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

check('Inicialmente no revela error', () => {
  assert.equal(
    shouldRevealFieldError({ error: 'Ingresá el nombre.', dirty: false, blurred: false, submitted: false }),
    false,
  )
})

check('Campo vacío después de interacción revela error', () => {
  assert.equal(
    shouldRevealFieldError({ error: 'Ingresá el nombre.', dirty: true, blurred: true, submitted: false }),
    true,
  )
})

check('Campo opcional vacío no se marca inválido', () => {
  assert.equal(validateEmailValue('', { required: false }), '')
})

check('Campo inválido y corrección', () => {
  assert.equal(validateEmailValue('ana'), 'Ingresá un correo electrónico válido.')
  assert.equal(validateEmailValue('ana@example.com'), '')
  assert.equal(
    validateNameWithLetter('123', 'Ingresá el nombre de la sucursal.', 'El nombre debe contener al menos una letra.'),
    'El nombre debe contener al menos una letra.',
  )
  assert.equal(
    validateNameWithLetter('Sede Central', 'Ingresá el nombre de la sucursal.', 'El nombre debe contener al menos una letra.'),
    '',
  )
})

check('Envío revela todos los errores', () => {
  assert.equal(
    shouldRevealFieldError({ error: 'Seleccioná un rol.', dirty: false, blurred: false, submitted: true }),
    true,
  )
})

check('aria-describedby apunta a ayuda y error cuando es inválido', () => {
  assert.equal(fieldDescribedBy('campo-help', 'campo-error', false), 'campo-help')
  assert.equal(fieldDescribedBy('campo-help', 'campo-error', true), 'campo-help campo-error')
})

check('CUIT: 11 dígitos y verificador', () => {
  assert.equal(validateCuitValue(''), 'Ingresá el CUIT.')
  assert.equal(validateCuitValue('3012345678'), 'El CUIT debe contener 11 dígitos.')
  assert.equal(validateCuitValue('30-12345678-9'), 'El dígito verificador del CUIT no es válido.')
  assert.equal(isValidCuitChecksum('20123456786'), true)
  assert.equal(validateCuitValue('20-12345678-6'), '')
})

check('classList.toggle no recibe varias clases en un token', () => {
  assert.deepEqual(classTokens(FORM_HELP_FOCUS_CLASS), ['text-slate-700', 'dark:text-slate-200'])
  const seen = []
  const element = {
    classList: {
      toggle(token, force) {
        if (/\s/.test(token)) {
          throw new Error(`InvalidCharacterError: token con espacios (${token})`)
        }
        seen.push([token, force])
      },
    },
  }
  toggleClassTokens(element, FORM_HELP_FOCUS_CLASS, true)
  assert.deepEqual(seen, [
    ['text-slate-700', true],
    ['dark:text-slate-200', true],
  ])
})

check('Login no usa la política de contraseña de alta', () => {
  const loginSrc = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../src/views/login.js'), 'utf8')
  assert.equal(loginSrc.includes('validateUsuarioPasswordPolicy'), false)
  assert.match(loginSrc, /Ingresá la contraseña\./)
})

check('extraInputClass se aplica al input de contraseña', () => {
  const markup = formPasswordFieldMarkup({
    id: 'cambio-nuevaPassword',
    name: 'nuevaPassword',
    label: 'Nueva contraseña',
    extraInputClass: 'dark:placeholder:text-slate-500',
  })
  assert.match(markup, /dark:placeholder:text-slate-500/)
  assert.equal(markup.includes('dark:placeholder:slate-500'), false)
})

check('Contraseña: lista dinámica y confirmación', () => {
  const weak = passwordRuleStates('abc')
  assert.equal(weak.find((rule) => rule.id === 'length').met, false)
  const strong = passwordRuleStates('Secreto12!')
  assert.equal(strong.every((rule) => rule.met), true)
  assert.equal(validateUsuarioPasswordPolicy('secreto12'), 'La contraseña debe incluir al menos un carácter especial.')
  assert.equal(
    validateUsuarioPasswordPolicy('Secreto 12!'),
    'La contraseña no puede contener espacios, tabulaciones ni saltos de línea.',
  )
  assert.equal(validateUsuarioPasswordPolicy('Secreto12!'), '')
  assert.equal(validatePasswordConfirm('Secreto12!', 'otra'), 'Las contraseñas no coinciden.')
  assert.equal(validatePasswordConfirm('Secreto12!', 'Secreto12!'), '')
})

console.log(`${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
