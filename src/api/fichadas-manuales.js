import { apiFetch, createApiError, readErrorMessage } from './http.js'

export function buildFichadaManualBody({ empleadoId, fecha, hora, tipo, motivo, detalle }) {
  const fechaHora = `${fecha}T${hora.length === 5 ? `${hora}:00` : hora}`
  return {
    empleadoId: Number(empleadoId),
    fechaHora,
    tipo,
    motivo,
    detalle: String(detalle ?? '').trim(),
  }
}

export async function createFichadaManual(input) {
  const { response } = await apiFetch('/api/FichadasManuales', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(buildFichadaManualBody(input)),
    logLabel: 'Fichada manual',
  })
  if (response.status === 403) throw createApiError('No tenés permiso para registrar fichadas manuales.', 403)
  if (response.status === 409) throw createApiError(await readErrorMessage(response, 'La fichada manual entra en conflicto con un registro existente.'), 409)
  if (!response.ok) throw createApiError(await readErrorMessage(response, 'No se pudo registrar la fichada manual.'), response.status)
  return response.json()
}
