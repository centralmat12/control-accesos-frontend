import { apiUrl } from '../config/api.js'
import { readErrorMessage } from './http.js'

export const MENSAJE_INVITACION_ACEPTADA = 'Invitación aceptada. Ya podés iniciar sesión.'

export async function aceptarInvitacion({ token, password, confirmarPassword }) {
  let response
  try {
    response = await fetch(apiUrl('/api/Auth/invitacion/aceptar'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: globalThis.location?.origin || 'http://127.0.0.1:5173',
      },
      body: JSON.stringify({
        token,
        password,
        confirmarPassword,
      }),
    })
  } catch {
    throw new Error('No se pudo conectar con la API.')
  }
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, 'No se pudo aceptar la invitación.'))
  }
  const cuerpo = await response.json().catch(() => null)
  if (cuerpo?.mensaje !== MENSAJE_INVITACION_ACEPTADA) {
    throw new Error('No se pudo aceptar la invitación.')
  }
  return { mensaje: MENSAJE_INVITACION_ACEPTADA }
}
