/**
 * Usuarios del panel web.
 *
 * GET /api/usuarios — Policy PuedeCrearUsuarios: SuperAdmin | ADMIN (RRHH 403).
 * Query opcional: empresaId, rol, nombreUsuario, correo, activo.
 * SuperAdmin: sin empresaId lista todas las empresas; con empresaId filtra ese tenant.
 * ADMIN: la API fuerza el empresa_id del claim, así que el cliente no envía empresaId.
 * Respuesta 200: UsuarioListItemDto[] { id, empresaId, nombreUsuario, correo, rol, activo,
 * requiereCambioPassword, bloqueado, bloqueadoHasta }. Sin hash, temporal ni token.
 *
 * POST /api/usuarios — UsuarioRegistroDto: empresaId, nombreUsuario, email, password, rol.
 * Policy PuedeCrearUsuarios: SuperAdmin | ADMIN.
 * SuperAdmin: X-Empresa-Id y body.empresaId con el mismo ID seleccionado.
 * ADMIN: JWT empresa_id, sin X-Empresa-Id.
 * Respuesta 201: AuthResponseDto { token, mensaje }. El token no se guarda ni se muestra.
 *
 * POST /api/usuarios/{id}/restablecer-password — sin body. 200 { mensaje, passwordTemporal, venceEn }.
 * POST /api/usuarios/{id}/desbloquear — sin body. 200 { mensaje }.
 * PATCH /api/usuarios/{id}/identidad — { nombreUsuario, correo }. 409 si el correo es de otro usuario.
 * PATCH /api/usuarios/{id}/estado — { activo }. PATCH /api/usuarios/{id}/rol — { rol: ADMIN|RRHH }.
 * Fuera de alcance o inexistente: 404. El cambio definitivo no es administrativo.
 */
import {
  validateEmailValue,
  validatePasswordConfirm,
  validateUsuarioPasswordPolicy,
} from '../components/form-field.js'
import {
  USUARIO_ACCION_FUERA_DE_ALCANCE,
  puedeCrearUsuarios,
  puedeListarUsuarios,
} from '../config/administracion.js'
import {
  isAdmin,
  isAssignableUsuarioRole,
  isSuperadmin,
  normalizeRole,
  ROLES,
  rolesAsignablesParaAlta,
  USUARIO_ROLES_API,
} from '../config/roles.js'
import { pick } from '../utils/pick.js'
import { getCurrentUser } from './auth.js'
import { getEmpresaContexto } from './empresa-context.js'
import { apiFetch, createApiError, readErrorMessage } from './http.js'

export const USUARIO_API_CAPABILITIES = Object.freeze({
  listar: true,
  obtenerPorId: false,
  restablecerPassword: true,
  cambiarPassword: false,
  desbloquear: true,
  cambiarEstado: true,
  cambiarRol: true,
  actualizarIdentidad: true,
  requiereCambioPassword: true,
  bloqueoPorIntentos: true,
})

export const USUARIO_API_PATHS = Object.freeze({
  listar: '/api/usuarios',
  crear: '/api/usuarios',
  restablecerPassword: (id) => `/api/usuarios/${id}/restablecer-password`,
  desbloquear: (id) => `/api/usuarios/${id}/desbloquear`,
  estado: (id) => `/api/usuarios/${id}/estado`,
  rol: (id) => `/api/usuarios/${id}/rol`,
  identidad: (id) => `/api/usuarios/${id}/identidad`,
})

export const USUARIO_LIST_FIELDS = Object.freeze([
  'id',
  'empresaId',
  'nombreUsuario',
  'correo',
  'rol',
  'activo',
  'requiereCambioPassword',
  'bloqueado',
  'bloqueadoHasta',
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

export function validateUsuarioRol(rol, allowed = USUARIO_ROLES_API) {
  const value = String(rol ?? '').trim()
  const permitidos = Array.isArray(allowed) && allowed.length ? allowed : USUARIO_ROLES_API
  if (!permitidos.includes(value)) return 'Seleccioná un rol.'
  return ''
}

export const USUARIO_CORREO_DUPLICADO = 'Ese correo ya está registrado.'
export const USUARIO_IDENTIDAD_CORREO_CONFIRM =
  'El usuario deberá iniciar sesión con el nuevo correo. Sus sesiones actuales quedarán invalidadas.'

export function validateUsuarioAlta(values = {}, { rolesPermitidos = USUARIO_ROLES_API } = {}) {
  const errors = {
    nombreUsuario: validateUsuarioNombre(values.nombreUsuario),
    email: validateUsuarioEmail(values.email),
    password: validateUsuarioPassword(values.password),
    empresaId: validateUsuarioEmpresa(values.empresaId),
    rol: validateUsuarioRol(values.rol, rolesPermitidos),
  }

  if (Object.prototype.hasOwnProperty.call(values, 'passwordConfirm')) {
    errors.passwordConfirm = validateUsuarioPasswordConfirm(values.password, values.passwordConfirm)
  }

  return errors
}

export function validateUsuarioIdentidad(values = {}) {
  return {
    nombreUsuario: validateUsuarioNombre(values.nombreUsuario),
    correo: validateUsuarioEmail(values.correo ?? values.email),
  }
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

async function publicApiMessage(response, fallback) {
  return readErrorMessage(response, fallback)
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
    bloqueado: Boolean(pick(item, 'bloqueado', 'Bloqueado')),
    bloqueadoHasta: pick(item, 'bloqueadoHasta', 'BloqueadoHasta') ?? null,
  }
}

export function estadoCuentaUsuario(usuario) {
  if (!usuario?.activo) return 'Inactivo'
  if (usuario?.bloqueado) return 'Bloqueado'
  return 'Activo'
}

export function estadoPasswordUsuario(usuario) {
  return usuario?.requiereCambioPassword ? 'Cambio requerido' : 'Normal'
}

export function discardPasswordTemporal(payload) {
  if (!payload || typeof payload !== 'object') return null
  payload.passwordTemporal = ''
  payload.PasswordTemporal = ''
  return payload
}

export function takePasswordTemporal(payload) {
  const taken = {
    passwordTemporal: String(payload?.passwordTemporal ?? payload?.PasswordTemporal ?? ''),
    venceEn: payload?.venceEn ?? payload?.VenceEn ?? null,
  }
  discardPasswordTemporal(payload)
  return taken
}

export async function completeUsuarioResetReveal({ result, isAlive = () => true, reveal, refresh } = {}) {
  const taken = takePasswordTemporal(result)
  if (!isAlive()) {
    taken.passwordTemporal = ''
    return { refreshed: false }
  }

  await reveal?.(taken)
  taken.passwordTemporal = ''
  if (!isAlive()) return { refreshed: false }
  await refresh?.()
  return { refreshed: true }
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

/**
 * Visibilidad en el cliente. La API también debería excluir SuperAdmin
 * en las respuestas a ADMIN para que esas cuentas no lleguen al navegador.
 *
 * SuperAdmin ve todos. ADMIN nunca ve SuperAdmin (cualquier casing) y
 * se limita a su empresa. RRHH no consulta este listado.
 */
export function filterUsuariosByOperador(usuarios, operador) {
  const items = Array.isArray(usuarios) ? usuarios : []
  if (isSuperadmin(operador)) return items

  let visibles = items.filter((usuario) => !isSuperadmin(usuario))

  if (isAdmin(operador)) {
    const empresa = parseEmpresaId(operador?.empresaId)
    if (empresa) visibles = filterUsuariosByEmpresa(visibles, empresa)
  }

  return visibles
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
  const scoped = filterUsuariosByEmpresa(usuarios, empresaSeleccionada)
  return filterUsuariosByOperador(scoped, user)
}

function parseUsuarioId(value) {
  const id = Number(value)
  return Number.isFinite(id) && id > 0 ? id : null
}

async function postUsuarioAccion(path, empresaId) {
  const { url, response } = await jsonRequest(path, {
    method: 'POST',
    empresaId: empresaId ?? undefined,
  })

  if (response.status === 404 || response.status === 403) {
    throw createApiError(USUARIO_ACCION_FUERA_DE_ALCANCE, response.status)
  }

  if (response.status >= 500) {
    console.error('Usuarios: la API no pudo completar la operación', { url, status: response.status })
    throw createApiError('La API no pudo completar la operación. Intentá nuevamente más tarde.', response.status)
  }

  if (!response.ok) {
    throw createApiError(
      await publicApiMessage(response, `No se pudo completar la operación (${response.status}).`),
      response.status,
    )
  }

  try {
    return await response.json()
  } catch {
    return {}
  }
}

export async function restablecerPasswordUsuario(usuarioId, { empresaId } = {}) {
  const id = parseUsuarioId(usuarioId)
  if (!id) throw createApiError(USUARIO_ACCION_FUERA_DE_ALCANCE, 404)

  const payload = await postUsuarioAccion(USUARIO_API_PATHS.restablecerPassword(id), empresaId)
  return {
    mensaje: String(payload?.mensaje ?? payload?.Mensaje ?? 'Contraseña temporal creada y marcada para cambio obligatorio.'),
    passwordTemporal: String(payload?.passwordTemporal ?? payload?.PasswordTemporal ?? ''),
    venceEn: payload?.venceEn ?? payload?.VenceEn ?? null,
  }
}

export async function desbloquearUsuario(usuarioId, { empresaId } = {}) {
  const id = parseUsuarioId(usuarioId)
  if (!id) throw createApiError(USUARIO_ACCION_FUERA_DE_ALCANCE, 404)

  const payload = await postUsuarioAccion(USUARIO_API_PATHS.desbloquear(id), empresaId)
  return {
    mensaje: String(payload?.mensaje ?? payload?.Mensaje ?? 'Cuenta desbloqueada.'),
  }
}

async function patchUsuarioAccion(path, body, empresaId) {
  const { url, response } = await jsonRequest(path, {
    method: 'PATCH',
    body: JSON.stringify(body),
    empresaId: empresaId ?? undefined,
  })

  if (response.status === 404 || response.status === 403) {
    throw createApiError(USUARIO_ACCION_FUERA_DE_ALCANCE, response.status)
  }

  if (response.status === 400) {
    throw createApiError(await publicApiMessage(response, 'Los datos enviados no son válidos.'), 400)
  }

  if (response.status >= 500) {
    console.error('Usuarios: la API no pudo completar la operación', { url, status: response.status })
    throw createApiError('La API no pudo completar la operación. Intentá nuevamente más tarde.', response.status)
  }

  if (!response.ok) {
    throw createApiError(
      await publicApiMessage(response, `No se pudo completar la operación (${response.status}).`),
      response.status,
    )
  }

  try {
    return await response.json()
  } catch {
    return {}
  }
}

function mapUsuarioActualizado(payload, fallbackMensaje) {
  const usuario = mapUsuario(payload?.usuario ?? payload?.Usuario ?? {})
  return {
    mensaje: String(payload?.mensaje ?? payload?.Mensaje ?? fallbackMensaje),
    usuario,
  }
}

export async function cambiarEstadoUsuario(usuarioId, activo, { empresaId } = {}) {
  const id = parseUsuarioId(usuarioId)
  if (!id) throw createApiError(USUARIO_ACCION_FUERA_DE_ALCANCE, 404)

  const payload = await patchUsuarioAccion(USUARIO_API_PATHS.estado(id), { activo: Boolean(activo) }, empresaId)
  return mapUsuarioActualizado(payload, 'Usuario actualizado correctamente.')
}

export async function cambiarRolUsuario(usuarioId, rol, { empresaId } = {}) {
  const id = parseUsuarioId(usuarioId)
  if (!id) throw createApiError(USUARIO_ACCION_FUERA_DE_ALCANCE, 404)
  if (!isAssignableUsuarioRole(rol)) {
    throw createApiError('El rol debe ser ADMIN o RRHH.', 400)
  }

  const payload = await patchUsuarioAccion(USUARIO_API_PATHS.rol(id), { rol: normalizeRole(rol) }, empresaId)
  return mapUsuarioActualizado(payload, 'Usuario actualizado correctamente.')
}

export async function actualizarIdentidadUsuario(usuarioId, { nombreUsuario, correo } = {}, { empresaId } = {}) {
  const id = parseUsuarioId(usuarioId)
  if (!id) throw createApiError(USUARIO_ACCION_FUERA_DE_ALCANCE, 404)

  const nombreError = validateUsuarioNombre(nombreUsuario)
  if (nombreError) throw createApiError(nombreError, 400)

  const correoError = validateUsuarioEmail(correo)
  if (correoError) throw createApiError(correoError, 400)

  const body = {
    nombreUsuario: String(nombreUsuario ?? ''),
    correo: String(correo ?? ''),
  }

  const { url, response } = await jsonRequest(USUARIO_API_PATHS.identidad(id), {
    method: 'PATCH',
    body: JSON.stringify(body),
    empresaId: empresaId ?? undefined,
  })

  if (response.status === 404 || response.status === 403) {
    throw createApiError(USUARIO_ACCION_FUERA_DE_ALCANCE, response.status)
  }

  if (response.status === 409) {
    throw createApiError(USUARIO_CORREO_DUPLICADO, 409)
  }

  if (response.status === 400) {
    throw createApiError(await publicApiMessage(response, 'Los datos enviados no son válidos.'), 400)
  }

  if (response.status >= 500) {
    console.error('Usuarios: la API no pudo actualizar la identidad', { url, status: response.status })
    throw createApiError('La API no pudo completar la operación. Intentá nuevamente más tarde.', response.status)
  }

  if (!response.ok) {
    throw createApiError(
      await publicApiMessage(response, `No se pudo completar la operación (${response.status}).`),
      response.status,
    )
  }

  let payload = {}
  try {
    payload = await response.json()
  } catch {
    payload = {}
  }

  return mapUsuarioActualizado(payload, 'Datos del usuario actualizados correctamente.')
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
  const rolesPermitidos = rolesAsignablesParaAlta(getCurrentUser())
  if (!rolesPermitidos.includes(normalizedRol) || !isAssignableUsuarioRole(normalizedRol)) {
    throw createApiError(
      rolesPermitidos.length === 1 && rolesPermitidos[0] === ROLES.Rrhh
        ? 'El rol debe ser RRHH.'
        : 'El rol debe ser ADMIN o RRHH.',
      400,
    )
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
