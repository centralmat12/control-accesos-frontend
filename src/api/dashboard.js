import { dashboardSummary, ultimasFichadas } from '../data/mock/dashboard.js'

/**
 * Capa de acceso a datos del Dashboard.
 * Hoy usa datos simulados; más adelante reemplazar el cuerpo por fetch a ASP.NET Core.
 */

export async function getDashboardSummary() {
  // TODO: GET /api/dashboard/resumen
  return structuredClone(dashboardSummary)
}

export async function getUltimasFichadas() {
  // TODO: GET /api/fichadas?limit=10
  return structuredClone(ultimasFichadas)
}
