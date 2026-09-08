/**
 * Usuarios del panel web.
 *
 * POST /api/usuarios — UsuarioRegistroDto: empresaId, nombreUsuario, email, password, rol.
 * No hay GET/PATCH/DELETE en UsuariosController.
 * Authorize(Roles = "ADMIN"): SuperAdmin recibe 403.
 * Respuesta 201: AuthResponseDto { token, mensaje }. El token no se guarda ni se muestra.
 */
import { puedeCrearUsuarios } from '../config/administracion.js'
import { isAssignableUsuarioRole, normalizeRole, USUARIO_ROLES_API } from '../config/roles.js'
import { getCurrentUser } from './auth.js'
import { apiFetch, createApiError, readErrorMessage } from './http.js'

const PASSWORD_MIN = 8
const PASSWORD_MAX = 255

export { USUARIO_ROLES_API }

export function validateUsuarioEmail(email) {
  const value = String(email ?? '').trim()
  if (!value) return 'Ingresá el correo.'
  if (value.length > 100) return 'El correo no puede superar 100 caracteres.'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Ingresá un correo válido.'
  return ''
}

export function validateUsuarioPassword(password) {
  const value = String(password ?? '')
  if (!value) return 'Ingresá la contraseña inicial.'
  if (value.length < PASSWORD_MIN) return `La contraseña debe tener al menos ${PASSWORD_MIN} caracteres.`
  if (value.length > PASSWORD_MAX) return `La contraseña no puede superar ${PASSWORD_MAX} caracteres.`
  return ''
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

export async function createUsuario({ nombreUsuario, email, password, rol, empresaId }) {
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

  const dto = {
    empresaId: empresa,
    nombreUsuario: String(nombreUsuario ?? '').trim(),
    email: String(email ?? '').trim(),
    password: String(password ?? ''),
    rol: normalizedRol,
  }

  const body = JSON.stringify(dto)
  dto.password = ''

  const { url, response } = await jsonRequest('/api/usuarios', {
    method: 'POST',
    body,
    empresaId: empresa,
  })

  if (response.status === 403) {
    throw createApiError('No tenés permiso para crear usuarios.', 403)
  }

  if (response.status === 400) {
    throw createApiError(await readErrorMessage(response, 'Los datos del usuario no son válidos.'), 400)
  }

  if (response.status === 409) {
    throw createApiError(
      await readErrorMessage(response, 'El correo ya está registrado o la empresa no existe.'),
      409,
    )
  }

  if (response.status >= 500) {
    console.error('Usuarios: la API no pudo completar el alta', { url, status: response.status })
    throw createApiError('La API no pudo crear el usuario. Intentá nuevamente más tarde.', response.status)
  }

  if (!response.ok) {
    console.error('Usuarios: alta HTTP no exitosa', { url, status: response.status })
    throw createApiError(
      await readErrorMessage(response, `No se pudo crear el usuario (${response.status}).`),
      response.status,
    )
  }

  let payload = null
  try {
    payload = await response.json()
  } catch {
    payload = null
  }

  if (payload && typeof payload === 'object') {
    delete payload.token
    delete payload.Token
  }

  return { mensaje: 'Usuario creado correctamente.' }
}
