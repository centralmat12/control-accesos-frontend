import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { puedeAplicarEstadoMfa } from '../src/api/mfa-estado.js'

const seguridad = readFileSync(new URL('../src/views/seguridad.js', import.meta.url), 'utf8')
const api = readFileSync(new URL('../src/api/mfa.js', import.meta.url), 'utf8')

assert.equal(puedeAplicarEstadoMfa({ usuarioId: 4, token: 'a' }, { usuarioId: 4, token: 'b' }), true)
assert.equal(puedeAplicarEstadoMfa({ usuarioId: 4, token: 'a' }, { usuarioId: 9, token: 'b' }), false)
assert.equal(puedeAplicarEstadoMfa({ usuarioId: 4, token: 'a' }, { usuarioId: 4, token: '' }), false)
assert.equal(puedeAplicarEstadoMfa({ usuarioId: null, token: 'a' }, { usuarioId: null, token: 'a' }), false)

assert.match(api, /\/api\/Auth\/mfa\/estado/)
assert.match(api, /configuracionDisponible/)
assert.match(seguridad, /consultarEstadoMfa/)
assert.match(seguridad, /puedeAplicarEstadoMfa/)
assert.match(seguridad, /textContent = 'Activo'/)
assert.match(seguridad, /Códigos de recuperación/)
assert.match(seguridad, /Si perdés acceso a tu autenticador, podés iniciar sesión con tu contraseña y uno de estos códigos\. Cada código se puede usar una sola vez\. Guardalos en un lugar seguro/)
assert.match(seguridad, /id="mfa-codigos-ayuda"/)
assert.match(seguridad, /La regeneración de códigos no está habilitada/)
assert.doesNotMatch(seguridad, /Sin configurar/)

console.log('mfa estado ok')
