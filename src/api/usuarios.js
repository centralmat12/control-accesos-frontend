/**
 * Usuarios del panel web.
 *
 * GET /api/usuarios — Policy PuedeCrearUsuarios: SuperAdmin | ADMIN (RRHH 403).
 * Query opcional: empresaId, rol, nombreUsuario, correo, activo.
 * SuperAdmin: sin empresaId lista todas las empresas; con empresaId filtra ese tenant.
 * ADMIN: la API fuerza el empresa_id del claim, así que el cliente no envía empresaId.
 * Respuesta 200: UsuarioListItemDto[] { id, empresaId, nombreUsuario, correo, rol, activo,
 * requiereCambioPassword }. No incluye hash, contraseña temporal ni token.
 *
 * POST /api/usuarios — UsuarioRegistroDto: empresaId, nombreUsuario, email, password, rol.
 * Policy PuedeCrearUsuarios: SuperAdmin | ADMIN.
 * SuperAdmin: X-Empresa-Id y body.empresaId con el mismo ID seleccionado.
 * ADMIN: JWT empresa_id, sin X-Empresa-Id.
 * Respuesta 201: AuthResponseDto { token, mensaje }. El token no se guarda ni se muestra.
 *
 * Auditado contra ControlFichajes.API 632d6d4:
 * - restablecer-password, desbloquear y cambiar-password de otro usuario existen,
 *   pero no verifican la empresa del usuario objetivo: el panel no los expone todavía.
 * - Login responde 401 también cuando la cuenta está bloqueada (no hay 423 ni 429).
 */
import {
  validateEmailValue,
  validatePasswordConfirm,
  validateUsuarioPasswordPolicy,
} from '../components/form-field.js'
import { puedeCrearUsuarios, puedeListarUsuarios } from '../config/administracion.js'
import {
  isAssignableUsuarioRole,
  isSuperadmin,
  normalizeRole,
  USUARIO_ROLES_API,
} from '../config/roles.js'
import { pick } from '../utils/pick.js'
import { getCurrentUser } from './auth.js'
import { getEmpresaContexto } from './empresa-context.js'
import { apiFetch, createApiError, readErrorMessage } from './http.js'

export const USUARIO_API_CAPABILITIES = Object.freeze({
  listar: true,
  obtenerPorId: false,
  restablecerPassword: false,
  cambiarPassword: false,
  desbloquear: false,
  requiereCambioPassword: true,
  bloqueoPorIntentos: true,
})

export const USUARIO_API_PATHS = Object.freeze({
  listar: '/api/usuarios',
  crear: '/api/usuarios',
})

export const USUARIO_LIST_FIELDS = Object.freeze([
  'id',
  'empresaId',
  'nombreUsuario',
  'correo',
  'rol',
  'activo',
  'requiereCambioPassword',
])

export const USUARIO_LIST_FILTERS = Object.freeze([
  'empresaId',
  'rol',
  'nombreUsuario',
  'correo',
  'activo',
])

const PASSWORD_MIN = 8
const PASSWORD_MAX = 255
const NOMBRE_MIN = 3
const NOMBRE_MAX = 50
const NOMBRE_USUARIO_PATTERN = /^[A-Za-z][A-Za-z0-9]*(?:[._-][A-Za-z0-9]+)*$/

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
  const value = String(nombre ?? '')
  if (!value) return 'Ingresá un nombre de usuario.'
  if (/\s/.test(value)) return 'El nombre de usuario no puede contener espacios.'
  if (value.length < NOMBRE_MIN || value.length > NOMBRE_MAX) {
    return 'El nombre de usuario debe tener entre 3 y 50 caracteres.'
  }
  if (!/^[A-Za-z]/.test(value)) return 'El nombre de usuario debe comenzar con una letra.'
  if (/[^A-Za-z0-9._-]/.test(value)) {
    return 'Formato inválido. Solo se permiten letras, números, punto (.), guion (-) y guion bajo (_).'
  }
  if (/[._-]{2,}/.test(value)) return 'No utilices puntos, guiones o guiones bajos consecutivos.'
  if (/[._-]$/.test(value)) return 'El nombre de usuario debe terminar con una letra o un número.'
  if (!NOMBRE_USUARIO_PATTERN.test(value)) {
    return 'Formato inválido. Solo se permiten letras, números, punto (.), guion (-) y guion bajo (_).'
  }
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
    nombreUsuario: String(nombreUsuario ?? ''),
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

/**
 * Solo los campos del contrato. Cualquier otro dato de la respuesta se descarta.
 */
export function mapUsuario(item) {
  const id = parseEmpresaId(pick(item, 'id', 'Id'))
  if (!id) return null

  return {
    id,
    empresaId: parseEmpresaId(pick(item, 'empresaId', 'EmpresaId')),
    nombreUsuario: String(pick(item, 'nombreUsuario', 'NombreUsuario') ?? '').trim(),
    correo: String(pick(item, 'correo', 'Correo') ?? '').trim(),
    rol: String(pick(item, 'rol', 'Rol') ?? '').trim(),
    activo: Boolean(pick(item, 'activo', 'Activo')),
    requiereCambioPassword: Boolean(
      pick(item, 'requiereCambioPassword', 'RequiereCambioPassword'),
    ),
  }
}

function normalizeUsuarios(payload) {
  const items = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.items)
      ? payload.items
      : Array.isArray(payload?.data)
        ? payload.data
        : []

  return items.map(mapUsuario).filter(Boolean)
}

export function filterUsuariosByEmpresa(usuarios, empresaId) {
  const empresa = parseEmpresaId(empresaId)
  const items = Array.isArray(usuarios) ? usuarios : []
  if (!empresa) return items

  return items.filter((usuario) => Number(usuario.empresaId) === empresa)
}

export function buildUsuariosQuery(filtros = {}) {
  const params = new URLSearchParams()
  const empresa = parseEmpresaId(filtros.empresaId)
  if (empresa) params.set('empresaId', String(empresa))

  for (const key of ['rol', 'nombreUsuario', 'correo']) {
    const value = String(filtros[key] ?? '').trim()
    if (value) params.set(key, value)
  }

  if (typeof filtros.activo === 'boolean') params.set('activo', String(filtros.activo))

  const query = params.toString()
  return query ? `?${query}` : ''
}

/**
 * GET /api/usuarios. El empresaId de la query solo se envía como SuperAdmin:
 * para ADMIN el aislamiento lo aplica la API con el claim empresa_id.
 */
export async function getUsuarios(filtros = {}) {
  const user = getCurrentUser()
  if (!puedeListarUsuarios(user)) {
    throw createApiError('No tenés permiso para consultar usuarios.', 403)
  }

  const empresaSeleccionada = isSuperadmin(user)
    ? (parseEmpresaId(filtros.empresaId) ?? getEmpresaContexto()?.id ?? null)
    : null

  const query = buildUsuariosQuery({ ...filtros, empresaId: empresaSeleccionada })

  const { url, response } = await apiFetch(`${USUARIO_API_PATHS.listar}${query}`, {
    empresaId: empresaSeleccionada ?? undefined,
    missingAuthMessage: 'No hay sesión activa. Iniciá sesión para consultar usuarios.',
    logLabel: 'Usuarios',
  })

  if (response.status === 403) {
    throw createApiError('No tenés permiso para consultar usuarios.', 403)
  }

  if (response.status >= 500) {
    console.error('Usuarios: la API no pudo listar usuarios', { url, status: response.status })
    throw createApiError(
      'La API no pudo listar los usuarios. Intentá nuevamente más tarde.',
      response.status,
    )
  }

  if (!response.ok) {
    throw createApiError(
      await publicApiMessage(response, `No se pudieron cargar los usuarios (${response.status}).`),
      response.status,
    )
  }

  const usuarios = normalizeUsuarios(await response.json())
  return filterUsuariosByEmpresa(usuarios, empresaSeleccionada)
}

async function createUsuarioOnce({ nombreUsuario, email, password, rol, empresaId }) {
  const empresa = parseEmpresaId(empresaId)
  if (!puedeCrearUsuarios(getCurrentUser(), empresa)) {
    throw createApiError('No tenés permiso para crear usuarios.', 403)
  }

  if (!empresa) {
    throw createApiError('Seleccioná una empresa.', 400)
  }

  const nombreError = validateUsuarioNombre(nombreUsuario)
  if (nombreError) throw createApiError(nombreError, 400)

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

  const { url, response } = await jsonRequest(USUARIO_API_PATHS.crear, {
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
