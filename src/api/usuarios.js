/**
 * Usuarios del panel web.
 *
 * POST /api/usuarios — UsuarioRegistroDto: empresaId, nombreUsuario, email, password, rol.
 * Policy PuedeCrearUsuarios: SuperAdmin | ADMIN.
 * SuperAdmin: X-Empresa-Id y body.empresaId con el mismo ID seleccionado.
 * ADMIN: JWT empresa_id, sin X-Empresa-Id.
 * No hay GET/PATCH/DELETE en UsuariosController.
 * Respuesta 201: AuthResponseDto { token, mensaje }. El token no se guarda ni se muestra.
 */
import {
  validateEmailValue,
  validatePasswordConfirm,
  validateUsuarioPasswordPolicy,
} from '../components/form-field.js'
import { puedeCrearUsuarios } from '../config/administracion.js'
import { isAssignableUsuarioRole, normalizeRole, USUARIO_ROLES_API } from '../config/roles.js'
import { getCurrentUser } from './auth.js'
import { apiFetch, createApiError, readErrorMessage } from './http.js'

const PASSWORD_MIN = 8
const PASSWORD_MAX = 255
const NOMBRE_MAX = 50

export { USUARIO_ROLES_API }

export const USUARIO_ALTA_FIELDS = Object.freeze([
  'empresaId',
  'nombreUsuario',
  'email',
  'password',
  'rol',
])

let usuarioCreateInflight = null

export function validateUsuarioNombre(nombre) {
  const value = String(nombre ?? '').trim()
  if (!value) return 'Ingresá el nombre del usuario.'
  if (value.length > NOMBRE_MAX) return 'El nombre no puede superar 50 caracteres.'
  return ''
}

export function validateUsuarioEmail(email) {
  return validateEmailValue(email)
}

export function validateUsuarioPassword(password) {
  const policyError = validateUsuarioPasswordPolicy(password)
  if (policyError) return policyError

  const value = String(password ?? '')
  if (value.length < PASSWORD_MIN) return `La contraseña debe tener al menos ${PASSWORD_MIN} caracteres.`
  if (value.length > PASSWORD_MAX) return `La contraseña no puede superar ${PASSWORD_MAX} caracteres.`
  return ''
}

export function validateUsuarioPasswordConfirm(password, confirm) {
  return validatePasswordConfirm(password, confirm)
}

export function validateUsuarioEmpresa(empresaId) {
  const id = Number(empresaId)
  if (!Number.isFinite(id) || id <= 0) return 'Seleccioná una empresa.'
  return ''
}

export function validateUsuarioRol(rol) {
  if (!USUARIO_ROLES_API.includes(String(rol ?? '').trim())) return 'Seleccioná un rol.'
  return ''
}

export function validateUsuarioAlta(values = {}) {
  const errors = {
    nombreUsuario: validateUsuarioNombre(values.nombreUsuario),
    email: validateUsuarioEmail(values.email),
    password: validateUsuarioPassword(values.password),
    empresaId: validateUsuarioEmpresa(values.empresaId),
    rol: validateUsuarioRol(values.rol),
  }

  if (Object.prototype.hasOwnProperty.call(values, 'passwordConfirm')) {
    errors.passwordConfirm = validateUsuarioPasswordConfirm(values.password, values.passwordConfirm)
  }

  return errors
}

export function clearPasswordInput(input) {
  if (input && 'value' in input) input.value = ''
  return input?.value ?? ''
}

export function buildUsuarioRegistroDto({ nombreUsuario, email, password, rol, empresaId }) {
  const normalizedRol = normalizeRole(rol)
  return {
    empresaId: Number(empresaId),
    nombreUsuario: String(nombreUsuario ?? '').trim(),
    email: String(email ?? '').trim(),
    password: String(password ?? ''),
    rol: normalizedRol,
  }
}

export function discardUsuarioCreateSecrets(payload) {
  if (!payload || typeof payload !== 'object') return null

  delete payload.token
  delete payload.Token
  delete payload.passwordHash
  delete payload.PasswordHash
  delete payload.password
  delete payload.Password

  return payload
}

function jsonRequest(path, options = {}) {
  return apiFetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
    missingAuthMessage: 'No hay sesión activa. Iniciá sesión para administrar usuarios.',
    logLabel: 'Usuarios',
  })
}

function parseEmpresaId(value) {
  const id = Number(value)
  return Number.isFinite(id) && id > 0 ? id : null
}

function looksInternalMessage(message) {
  const text = String(message ?? '')
  return text.length > 280 || /stack|exception|at\s+\w+\.\w+/i.test(text)
}

async function publicApiMessage(response, fallback) {
  const message = await readErrorMessage(response, fallback)
  if (!message || looksInternalMessage(message)) return fallback
  return message
}

async function createUsuarioOnce({ nombreUsuario, email, password, rol, empresaId }) {
  const empresa = parseEmpresaId(empresaId)
  if (!puedeCrearUsuarios(getCurrentUser(), empresa)) {
    throw createApiError('No tenés permiso para crear usuarios.', 403)
  }

  if (!empresa) {
    throw createApiError('Seleccioná una empresa. La API exige EmpresaId.', 400)
  }

  const normalizedRol = normalizeRole(rol)
  if (!isAssignableUsuarioRole(normalizedRol)) {
    throw createApiError('El rol debe ser ADMIN o RRHH.', 400)
  }

  const dto = buildUsuarioRegistroDto({
    nombreUsuario,
    email,
    password,
    rol: normalizedRol,
    empresaId: empresa,
  })

  const body = JSON.stringify(dto)
  dto.password = ''

  const { url, response } = await jsonRequest('/api/usuarios', {
    method: 'POST',
    body,
    empresaId: empresa,
  })

  if (response.status === 403) {
    throw createApiError('La empresa o los permisos no son correctos.', 403)
  }

  if (response.status === 400) {
    throw createApiError(await publicApiMessage(response, 'Los datos o el rol no son válidos.'), 400)
  }

  if (response.status === 409) {
    throw createApiError(
      await publicApiMessage(response, 'El correo ya está registrado o la empresa no existe.'),
      409,
    )
  }

  if (response.status >= 500) {
    console.error('Usuarios: la API no pudo completar el alta', { url, status: response.status })
    throw createApiError('La API no pudo crear el usuario. Intentá nuevamente más tarde.', response.status)
  }

  if (response.status !== 201) {
    console.error('Usuarios: alta HTTP no exitosa', { url, status: response.status })
    throw createApiError(`No se pudo crear el usuario (${response.status}).`, response.status)
  }

  let payload = null
  try {
    payload = await response.json()
  } catch {
    payload = null
  }

  discardUsuarioCreateSecrets(payload)

  return { mensaje: 'Usuario creado correctamente.' }
}

export async function createUsuario(dto) {
  if (usuarioCreateInflight) return usuarioCreateInflight

  usuarioCreateInflight = createUsuarioOnce(dto).finally(() => {
    usuarioCreateInflight = null
  })

  return usuarioCreateInflight
}
