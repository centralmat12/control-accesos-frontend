import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { puedeAdministrarCorreoSaliente } from '../src/config/roles.js'
import { AYUDA_CORREO, MENSAJE_CORREO_ENVIADO } from '../src/api/correo-saliente.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const admin = readFileSync(join(root, 'src/views/administracion.js'), 'utf8')
const panel = readFileSync(join(root, 'src/components/correo-saliente-panel.js'), 'utf8')
const api = readFileSync(join(root, 'src/api/correo-saliente.js'), 'utf8')
const turnos = admin.indexOf('Turnos de trabajo')
const correo = admin.indexOf('Correo', turnos)

assert.equal(puedeAdministrarCorreoSaliente({ rol: 'SUPERADMIN' }), true)
assert.equal(puedeAdministrarCorreoSaliente({ rol: 'ADMIN' }), false)
assert.equal(puedeAdministrarCorreoSaliente({ rol: 'RRHH' }), false)
assert.match(admin, /puedeAdministrarCorreoSaliente\(user\)/)
assert.match(admin, /data-section="\$\{SECTIONS\.correo\}"/)
assert.ok(turnos > 0 && correo > turnos)
assert.doesNotMatch(admin, /Correo saliente/)
assert.match(panel, /Configuración de correo/)
assert.match(panel, /Conexión SMTP/)
assert.match(panel, /Correo de prueba/)
assert.match(panel, /Cargando configuración…/)
assert.match(panel, /Reintentar/)
assert.match(panel, /Cambiar contraseña SMTP/)
assert.match(panel, /Guardar cambios/)
assert.match(panel, /Descartar cambios/)
assert.match(panel, /Enviando…/)
assert.match(panel, /Guardando…/)
assert.match(panel, /Los valores actuales todavía no se probaron/)
assert.equal(AYUDA_CORREO, 'Configurá el remitente y la conexión SMTP que usa el sistema para enviar invitaciones y correos de recuperación.')
assert.equal(MENSAJE_CORREO_ENVIADO, 'El servidor de correo aceptó el mensaje. Revisá la bandeja de entrada y spam.')
assert.match(admin, /transform-none/)
assert.match(admin, /focus-visible:outline/)
assert.match(api, /skipEmpresaContext: true/)
assert.match(api, /usarBorrador: true/)
assert.doesNotMatch(panel, /smtp\.hostinger\.com/)
console.log('correo saliente ok')
