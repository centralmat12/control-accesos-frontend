import { dashboardSummary, ultimasFichadas } from '../data/mock/dashboard.js'

/**
 * Capa de acceso a datos del Dashboard.
 * MOCK: reemplazar por llamada a API cuando el endpoint esté disponible.
 */

export async function getDashboardSummary() {
  // MOCK: GET /api/dashboard/resumen
  return structuredClone(dashboardSummary)
}

export async function getUltimasFichadas() {
  // MOCK: reemplazar por fichadas recientes de la API
  return structuredClone(ultimasFichadas)
}
