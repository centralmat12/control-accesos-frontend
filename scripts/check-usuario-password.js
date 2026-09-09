import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  bindPasswordVisibilityToggle,
  formPasswordFieldMarkup,
  passwordConfirmStatus,
  passwordMeetsAllRequirements,
  passwordRequirementsMarkup,
  pendingPasswordRules,
  validatePasswordConfirm,
  validateUsuarioPasswordPolicy,
} from '../src/components/form-field.js'
import { validateUsuarioAlta } from '../src/api/usuarios.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
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

function pendingIds(password) {
  return pendingPasswordRules(password).map((rule) => rule.id)
}

const VALID = 'Abcdef1!'

check('1. Menos de 8 caracteres', () => {
  assert.equal(pendingIds('Abc1!').includes('length'), true)
  assert.match(validateUsuarioPasswordPolicy('Abc1!'), /entre 8 y 20/)
})

check('2. Exactamente 8 caracteres válidos', () => {
  assert.equal(VALID.length, 8)
  assert.equal(validateUsuarioPasswordPolicy(VALID), '')
  assert.equal(passwordMeetsAllRequirements(VALID), true)
  assert.deepEqual(pendingIds(VALID), [])
})

check('3. Más de 20 caracteres', () => {
  const long = `${VALID}xxxxxxxxxxxxx`
  assert.equal(long.length > 20, true)
  assert.equal(pendingIds(long).includes('length'), true)
  assert.match(validateUsuarioPasswordPolicy(long), /entre 8 y 20/)
})

check('4. Sin letra', () => {
  assert.equal(pendingIds('12345678!').includes('letter'), true)
  assert.equal(validateUsuarioPasswordPolicy('12345678!'), 'La contraseña debe incluir al menos una letra.')
})

check('5. Sin número', () => {
  assert.equal(pendingIds('Abcdefgh!').includes('number'), true)
  assert.equal(validateUsuarioPasswordPolicy('Abcdefgh!'), 'La contraseña debe incluir al menos un número.')
})

check('6. Sin carácter especial', () => {
  assert.equal(pendingIds('Abcdefg12').includes('special'), true)
  assert.equal(validateUsuarioPasswordPolicy('Abcdefg12'), 'La contraseña debe incluir al menos un carácter especial.')
})

check('7. Con cualquier tipo de espacio', () => {
  const message = 'La contraseña no puede contener espacios, tabulaciones ni saltos de línea.'
  assert.equal(pendingIds('Secreto12! ').includes('spaces'), true)
  assert.equal(pendingIds('Secreto12!\t').includes('spaces'), true)
  assert.equal(pendingIds('Secreto12!\n').includes('spaces'), true)
  assert.equal(validateUsuarioPasswordPolicy('Secreto 12!'), message)
  assert.equal(validateUsuarioPasswordPolicy('Secreto12!\t'), message)
  assert.equal(validateUsuarioPasswordPolicy('Secreto12!\n'), message)
})

check('8. Todos los requisitos cumplidos', () => {
  assert.equal(validateUsuarioPasswordPolicy('Ñandú12!'), '')
  assert.equal(passwordMeetsAllRequirements('Ñandú12!'), true)
})

check('9. Desaparición progresiva de requisitos', () => {
  assert.deepEqual(pendingIds(''), ['length', 'letter', 'number', 'special', 'spaces'])
  assert.equal(pendingIds('A').includes('letter'), false)
  assert.equal(pendingIds('A1').includes('number'), false)
  assert.equal(pendingIds('A1!').includes('special'), false)
  assert.equal(pendingIds('A1!xxxxx').includes('length'), false)
  assert.deepEqual(pendingIds('A1!xxxxx'), [])
})

check('10. Confirmación vacía', () => {
  assert.equal(passwordConfirmStatus(VALID, ''), 'help')
  assert.equal(validatePasswordConfirm(VALID, ''), 'Volvé a ingresar la contraseña.')
  assert.notEqual(passwordConfirmStatus('', ''), 'match')
})

check('11. Confirmación diferente', () => {
  assert.equal(passwordConfirmStatus(VALID, 'Abcdef2!'), 'mismatch')
  assert.equal(validatePasswordConfirm(VALID, 'Abcdef2!'), 'Las contraseñas no coinciden.')
})

check('12. Confirmación coincidente', () => {
  assert.equal(passwordConfirmStatus(VALID, VALID), 'match')
  assert.equal(validatePasswordConfirm(VALID, VALID), '')
})

check('13. Cambiar la contraseña inicial después de confirmarla', () => {
  assert.equal(passwordConfirmStatus(VALID, VALID), 'match')
  assert.equal(passwordConfirmStatus('Zyxwvut1!', VALID), 'mismatch')
})

check('14. Markup de ojo independiente por campo', () => {
  const markup = formPasswordFieldMarkup({ id: 'a', name: 'password', label: 'Contraseña inicial' })
  const confirm = formPasswordFieldMarkup({
    id: 'b',
    name: 'passwordConfirm',
    label: 'Confirmar contraseña',
    helpText: 'Volvé a ingresar la contraseña.',
  })
  assert.match(markup, /data-password-toggle/)
  assert.match(markup, /type="button"/)
  assert.match(markup, /aria-label="Mostrar contraseña"/)
  assert.match(markup, /aria-pressed="false"/)
  assert.match(confirm, /data-password-toggle/)
  assert.match(confirm, /Volvé a ingresar la contraseña\./)
})

check('15. Toggle de visibilidad sin enviar ni perder valor', () => {
  const listeners = {}
  const input = {
    type: 'password',
    value: VALID,
    selectionStart: 3,
    selectionEnd: 3,
    focus() {
      this.focused = true
    },
    setSelectionRange(start, end) {
      this.selectionStart = start
      this.selectionEnd = end
    },
  }
  const button = {
    innerHTML: '',
    attrs: {},
    setAttribute(name, value) {
      this.attrs[name] = String(value)
    },
    addEventListener(type, handler) {
      listeners[type] = handler
    },
  }

  bindPasswordVisibilityToggle(input, button)
  assert.equal(input.type, 'password')
  assert.equal(button.attrs['aria-pressed'], 'false')
  assert.equal(button.attrs['aria-label'], 'Mostrar contraseña')
  assert.match(button.innerHTML, /svg/)

  const click = { preventDefault() { this.prevented = true } }
  listeners.click(click)
  assert.equal(click.prevented, true)
  assert.equal(input.type, 'text')
  assert.equal(input.value, VALID)
  assert.equal(input.focused, true)
  assert.equal(input.selectionStart, 3)
  assert.equal(button.attrs['aria-pressed'], 'true')
  assert.equal(button.attrs['aria-label'], 'Ocultar contraseña')

  listeners.click({ preventDefault() {} })
  assert.equal(input.type, 'password')
  assert.equal(input.value, VALID)
})

check('16. Formulario inválido no habilita el alta', () => {
  const errors = validateUsuarioAlta({
    nombreUsuario: 'Ana',
    email: 'ana@example.com',
    password: 'corta',
    passwordConfirm: 'corta',
    empresaId: 4,
    rol: 'ADMIN',
  })
  assert.equal(Boolean(errors.password), true)
  const mismatch = validateUsuarioAlta({
    nombreUsuario: 'Ana',
    email: 'ana@example.com',
    password: VALID,
    passwordConfirm: 'OtraClav1!',
    empresaId: 4,
    rol: 'ADMIN',
  })
  assert.equal(mismatch.passwordConfirm, 'Las contraseñas no coinciden.')
  const ok = validateUsuarioAlta({
    nombreUsuario: 'Ana',
    email: 'ana@example.com',
    password: VALID,
    passwordConfirm: VALID,
    empresaId: 4,
    rol: 'ADMIN',
  })
  assert.equal(Object.values(ok).every((error) => !error), true)
})

check('17. El formulario no deja texto redundante ni loguea la contraseña', () => {
  const formSrc = readFileSync(join(root, 'src/components/usuario-form.js'), 'utf8')
  const usuariosSrc = readFileSync(join(root, 'src/api/usuarios.js'), 'utf8')
  assert.equal(formSrc.includes('Debe tener entre 8 y 20 caracteres e incluir'), false)
  assert.match(formSrc, /passwordRequirementsMarkup/)
  assert.match(formSrc, /result\.hasErrors \|\| hasAltaErrors/)
  assert.match(formSrc, /clearPasswords\(\)/)
  assert.equal(usuariosSrc.includes('console.log(dto.password'), false)
  assert.match(usuariosSrc, /dto\.password = ''/)
  assert.match(usuariosSrc, /discardUsuarioCreateSecrets/)
})

check('Lista dinámica y mensaje de cumplimiento', () => {
  const html = passwordRequirementsMarkup('usuario-password-rules')
  assert.match(html, /Entre 8 y 20 caracteres\./)
  assert.match(html, /Al menos una letra\./)
  assert.match(html, /Al menos un número\./)
  assert.match(html, /Al menos un carácter especial\./)
  assert.match(html, /Sin espacios\./)
  assert.match(html, /La contraseña cumple todos los requisitos\./)
  assert.match(html, /data-password-complete/)
})

console.log(`${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
