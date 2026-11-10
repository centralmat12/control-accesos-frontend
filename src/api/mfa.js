import { apiUrl } from '../config/api.js'
import { logApiNetworkError, logApiResponse } from '../utils/activity-log.js'
import { encabezadosRenovables, getToken } from './auth.js'

export const MFA_ENROLAMIENTO_NO_DISPONIBLE = 'La activación del autenticador no está habilitada.'
export const MFA_CODIGOS_GUARDAR = 'Guardá estos códigos antes de continuar. No se vuelven a mostrar.'
export const MFA_RESPUESTA_PERDIDA =
  'No se pudo confirmar la respuesta. Si el autenticador ya quedó activo, volvé a entrar con el código de la aplicación. Si no llegaste a ver los códigos, entrá y generá otro conjunto desde Seguridad. Si también se perdió la clave de configuración, esta versión no reemplaza el autenticador.'

async function postMfa(path, body) {
  const token = getToken()
  if (!token) {
    return { estado: 'sesion' }
  }
  let response
  try {
    response = await fetch(apiUrl(path), {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...encabezadosRenovables(),
      },
      body: JSON.stringify(body),
    })
  } catch {
    logApiNetworkError('POST', path)
    return { estado: 'incierto' }
  }
  logApiResponse('POST', path, response.status)
  return clasificar(response)
}

async function clasificar(response) {
  let cuerpo = null
  try {
    cuerpo = await response.json()
  } catch {
    cuerpo = null
  }
  if (response.status === 200 && cuerpo?.operacion && cuerpo?.uri && cuerpo?.claveManual) {
    return {
      estado: 'inicio',
      operacion: cuerpo.operacion,
      uri: cuerpo.uri,
      claveManual: cuerpo.claveManual,
      expiraEn: cuerpo.expiraEn || null,
    }
  }
  if (response.status === 200 && Array.isArray(cuerpo?.codigos)) {
    return { estado: 'codigos', mensaje: String(cuerpo.mensaje || ''), codigos: cuerpo.codigos.map((item) => String(item)) }
  }
  if (response.status === 200 && cuerpo?.mensaje && !cuerpo?.operacion && !Array.isArray(cuerpo?.codigos)) {
    return { estado: 'desactivado', mensaje: String(cuerpo.mensaje) }
  }
  if (response.status === 404) return { estado: 'apagado' }
  if (response.status === 409 && cuerpo?.codigo === 'mfa_obligatorio') return { estado: 'obligatorio' }
  if (response.status === 409) return { estado: 'ya-configurado' }
  if (response.status === 429) return { estado: 'limite' }
  if (response.status === 403) return { estado: 'restringido' }
  if (response.status === 500 || response.status === 503) return { estado: 'incierto' }
  if (cuerpo?.codigo === 'mfa_bloqueado') return { estado: 'bloqueado' }
  if (response.status === 401 && cuerpo?.mensaje) return { estado: 'credencial' }
  return { estado: 'invalido' }
}

export async function consultarEstadoMfa() {
  const token = getToken()
  if (!token) return { estado: 'sesion' }
  const path = '/api/Auth/mfa/estado'
  let response
  try {
    response = await fetch(apiUrl(path), {
      method: 'GET',
      credentials: 'include',
      headers: {
        Authorization: `Bearer ${token}`,
        ...encabezadosRenovables(),
      },
    })
  } catch {
    logApiNetworkError('GET', path)
    return { estado: 'error' }
  }
  logApiResponse('GET', path, response.status)
  let cuerpo = null
  try {
    cuerpo = await response.json()
  } catch {
    cuerpo = null
  }
  if (response.status === 200) {
    if (typeof cuerpo?.totpHabilitado !== 'boolean' ||
      typeof cuerpo?.mfaObligatorio !== 'boolean' ||
      typeof cuerpo?.configuracionDisponible !== 'boolean') {
      return { estado: 'error' }
    }
    return {
      estado: 'listo',
      totpHabilitado: cuerpo.totpHabilitado,
      mfaObligatorio: cuerpo.mfaObligatorio,
      configuracionDisponible: cuerpo.configuracionDisponible,
    }
  }
  if (response.status === 401) return { estado: 'sesion' }
  if (response.status === 403) {
    return String(cuerpo?.mensaje || '').toLowerCase().includes('contraseña')
      ? { estado: 'restringido' }
      : { estado: 'error' }
  }
  return { estado: 'error' }
}

export function iniciarEnrolamiento(password) {
  return postMfa('/api/Auth/mfa/enrolamiento/iniciar', { password })
}

export function confirmarEnrolamiento({ operacion, codigo }) {
  return postMfa('/api/Auth/mfa/enrolamiento/confirmar', { operacion, codigo })
}

export function desactivarMfa({ password, codigo, codigoRecuperacion }) {
  const totp = String(codigo ?? '').trim()
  const recuperacion = String(codigoRecuperacion ?? '').trim()
  return postMfa('/api/Auth/mfa/desactivar', totp
    ? { password, codigo: totp }
    : { password, codigoRecuperacion: recuperacion })
}

export function regenerarCodigos({ password, codigo, codigoRecuperacion }) {
  const totp = String(codigo ?? '').trim()
  const recuperacion = String(codigoRecuperacion ?? '').trim()
  return postMfa('/api/Auth/mfa/recuperacion/regenerar', totp
    ? { password, codigo: totp }
    : { password, codigoRecuperacion: recuperacion })
}
