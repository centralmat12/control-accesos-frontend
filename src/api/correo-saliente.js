import { apiFetch, createApiError } from './http.js'

export const MENSAJE_CORREO_ENVIADO = 'El servidor de correo aceptó el mensaje. Revisá la bandeja de entrada y spam.'
export const MENSAJE_CORREO_GUARDADO = 'Configuración de correo guardada.'
export const MENSAJE_CORREO_NO_CONFIGURADO = 'El correo saliente no está configurado.'
export const MENSAJE_CORREO_NO_ENVIADO = 'No se pudo enviar el correo de prueba.'
export const AYUDA_CORREO = 'Configurá el remitente y la conexión SMTP que usa el sistema para enviar invitaciones y correos de recuperación.'

const PROHIBIDAS = new Set(['password', 'clave', 'contrasena', 'smtp'])

export async function consultarCorreo() {
  return leer(await pedir('/api/correo-saliente/estado', { method: 'GET' }), 'No se pudo consultar la configuración de correo.')
}

export async function guardarCorreo(datos) {
  const cuerpo = await leer(await pedir('/api/correo-saliente/configuracion', {
    method: 'PUT',
    body: JSON.stringify(cuerpoConfiguracion(datos)),
  }), 'No se pudo guardar la configuración de correo.')
  if (cuerpo?.mensaje !== MENSAJE_CORREO_GUARDADO || !cuerpo.configuracion) {
    throw createApiError('No se pudo guardar la configuración de correo.', 500)
  }
  return { mensaje: cuerpo.mensaje, configuracion: normalizar(cuerpo.configuracion) }
}

export async function probarCorreo(datos) {
  const cuerpo = await leer(await pedir('/api/correo-saliente/prueba', {
    method: 'POST',
    body: JSON.stringify({
      ...cuerpoConfiguracion(datos),
      destinatario: String(datos.destinatario ?? '').trim(),
      usarBorrador: true,
    }),
  }), MENSAJE_CORREO_NO_ENVIADO)
  if (cuerpo?.mensaje !== MENSAJE_CORREO_ENVIADO) {
    throw createApiError(MENSAJE_CORREO_NO_ENVIADO, 500)
  }
  return { mensaje: MENSAJE_CORREO_ENVIADO }
}

function cuerpoConfiguracion(datos) {
  return {
    servidor: String(datos.servidor ?? '').trim(),
    puerto: Number(datos.puerto),
    cifrado: String(datos.cifrado ?? ''),
    usuario: String(datos.usuario ?? '').trim(),
    remitente: String(datos.remitente ?? '').trim(),
    cambiarContrasena: datos.cambiarContrasena === true,
    contrasena: datos.cambiarContrasena === true ? String(datos.contrasena ?? '') : '',
  }
}

async function pedir(path, options) {
  const { response } = await apiFetch(path, {
    ...options,
    skipEmpresaContext: true,
    headers: { 'Content-Type': 'application/json' },
    logLabel: 'Correo',
  })
  return response
}

async function leer(response, fallback) {
  const cuerpo = await response.json().catch(() => null)
  rechazarSecretos(cuerpo)
  if (response.status === 403) throw createApiError('No tenés permiso para configurar el correo.', 403)
  if (response.status === 429) throw createApiError('Demasiadas solicitudes. Intentá más tarde.', 429)
  if (!response.ok) {
    const error = createApiError(cuerpo?.mensaje || fallback, response.status)
    error.errores = cuerpo?.errores && typeof cuerpo.errores === 'object' ? cuerpo.errores : null
    throw error
  }
  if (cuerpo?.configuracion) return cuerpo
  if (typeof cuerpo?.servidor === 'string') return normalizar(cuerpo)
  return cuerpo
}

function normalizar(cuerpo) {
  return {
    servidor: String(cuerpo.servidor ?? ''),
    puerto: Number(cuerpo.puerto) || 0,
    cifrado: String(cuerpo.cifrado ?? ''),
    usuario: String(cuerpo.usuario ?? ''),
    remitente: String(cuerpo.remitente ?? ''),
    contrasenaConfigurada: cuerpo.contrasenaConfigurada === true,
    guardada: cuerpo.guardada === true,
    configurado: cuerpo.configurado === true,
  }
}

function rechazarSecretos(cuerpo) {
  const claves = cuerpo && typeof cuerpo === 'object' ? Object.keys(cuerpo) : []
  if (claves.some((clave) => PROHIBIDAS.has(clave.toLowerCase()))) {
    throw createApiError('La respuesta del correo no es válida.', 500)
  }
}
