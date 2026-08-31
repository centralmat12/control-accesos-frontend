import { getToken, logout } from './auth.js'
import { apiUrl } from '../config/api.js'

function pick(item, ...keys) {
  for (const key of keys) {
    if (item?.[key] !== undefined && item?.[key] !== null) {
      return item[key]
    }
  }

  return null
}

function mapEmpresa(item) {
  return {
    id: pick(item, 'id', 'Id'),
    nombreFantasia: pick(item, 'nombreFantasia', 'NombreFantasia'),
    razonSocial: pick(item, 'razonSocial', 'RazonSocial'),
    cuit: pick(item, 'cuit', 'CUIT', 'Cuit'),
  }
}

export async function getEmpresaActual() {
  const token = getToken()
  if (!token) return null

  const url = apiUrl('/api/empresas')
  let response

  try {
    response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    })
  } catch {
    return null
  }

  if (response.status === 401) {
    logout()
    window.dispatchEvent(new CustomEvent('ca:unauthorized'))
    throw new Error('Sesión expirada o no autorizada.')
  }

  if (!response.ok) return null

  const payload = await response.json()
  const list = Array.isArray(payload) ? payload : payload ? [payload] : []
  return list[0] ? mapEmpresa(list[0]) : null
}
