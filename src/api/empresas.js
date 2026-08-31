import { pick } from '../utils/pick.js'
import { getToken } from './auth.js'
import { apiFetch } from './http.js'

function mapEmpresa(item) {
  return {
    id: pick(item, 'id', 'Id'),
    nombreFantasia: pick(item, 'nombreFantasia', 'NombreFantasia'),
    razonSocial: pick(item, 'razonSocial', 'RazonSocial'),
    cuit: pick(item, 'cuit', 'CUIT', 'Cuit'),
  }
}

export async function getEmpresaActual() {
  if (!getToken()) return null

  try {
    const { response } = await apiFetch('/api/empresas', {
      logLabel: false,
    })

    if (!response.ok) return null

    const payload = await response.json()
    const list = Array.isArray(payload) ? payload : payload ? [payload] : []
    return list[0] ? mapEmpresa(list[0]) : null
  } catch (error) {
    if (error.message === 'Sesión expirada o no autorizada.') {
      throw error
    }

    return null
  }
}
