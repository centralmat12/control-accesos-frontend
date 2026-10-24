import { CAPABILITY, CAPABILITY_STATUS, resolveCapability } from '../api/capabilities.js'
import { getAlertasIncompletas } from '../api/jornadas.js'
import { puedeVerAlertasJornada } from '../config/labor-access.js'
import { getCurrentUser } from '../api/auth.js'
import { BTN_SECONDARY_CLASS } from './button-styles.js'
import { badgeHtml } from './badge.js'
import { panelForCapability } from './maintenance-panel.js'
import { escapeHtml, formatFichadaFecha, formatFichadaHora } from '../utils/format.js'
import { formatMinutosInformados } from '../utils/labor-format.js'
import { bindTooltipRoot } from './tooltip.js'

export function createAlertasPanel({ empleados = [], onRevisar } = {}) {
  const root = document.createElement('section')
  root.className = 'space-y-3'
  const host = document.createElement('div')
  root.append(host)
  bindTooltipRoot(root)

  function legajoDe(empleadoId) {
    const empleado = empleados.find((item) => Number(item.id) === Number(empleadoId))
    return empleado?.legajo || null
  }

  async function load(force = false) {
    host.textContent = 'Cargando alertas...'
    if (!puedeVerAlertasJornada(getCurrentUser())) {
      host.replaceChildren(panelForCapability({ status: CAPABILITY_STATUS.forbidden, reason: 'role' }))
      return
    }
    const capability = await resolveCapability(CAPABILITY.fichadasIncompleteAlerts, { force })
    if (capability.status !== CAPABILITY_STATUS.available) {
      host.replaceChildren(panelForCapability(capability, { onRetry: () => load(true) }))
      return
    }
    try {
      const alertas = await getAlertasIncompletas()
      if (!alertas.length) {
        host.innerHTML = '<div class="rounded-xl border border-slate-200 bg-white px-4 py-10 text-center shadow-sm dark:border-slate-700 dark:bg-slate-900"><p class="text-sm font-semibold">No hay jornadas incompletas informadas</p><p class="mt-1 text-sm text-slate-500">La API respondió sin alertas para el período que consulta.</p></div>'
        return
      }
      const table = document.createElement('div')
      table.className = 'max-h-[65vh] overflow-auto rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900'
      table.innerHTML = `
        <table class="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-700">
          <thead class="sticky top-0 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800">
            <tr>
              <th class="px-3 py-3">Empleado</th>
              <th class="px-3 py-3">Legajo</th>
              <th class="px-3 py-3">Fecha</th>
              <th class="px-3 py-3">Primera fichada</th>
              <th class="px-3 py-3">Última fichada</th>
              <th class="px-3 py-3">Motivo</th>
              <th class="px-3 py-3">Diferencia</th>
              <th class="px-3 py-3">Resolución</th>
              <th class="px-3 py-3">Acción</th>
            </tr>
          </thead>
          <tbody></tbody>
        </table>`
      const body = table.querySelector('tbody')
      alertas.forEach((alerta) => {
        const nombre = [alerta.nombre, alerta.apellido].filter(Boolean).join(' ') || 'Empleado'
        const legajo = legajoDe(alerta.empleadoId)
        const row = document.createElement('tr')
        row.className = 'border-t border-slate-100 dark:border-slate-800'
        row.innerHTML = `
          <td class="px-3 py-3 font-medium">${escapeHtml(nombre)} ${alerta.esManual === true ? badgeHtml('Manual', 'info') : ''}</td>
          <td class="px-3 py-3">${escapeHtml(legajo || '—')}</td>
          <td class="px-3 py-3">${escapeHtml(alerta.fechaHora ? formatFichadaFecha(alerta.fechaHora) : '—')}</td>
          <td class="px-3 py-3">${escapeHtml(alerta.fechaHora ? formatFichadaHora(alerta.fechaHora) : '—')}</td>
          <td class="px-3 py-3">Sin salida</td>
          <td class="max-w-xs truncate px-3 py-3" data-tooltip="${escapeHtml(alerta.mensaje || '—')}">${escapeHtml(alerta.mensaje || '—')}</td>
          <td class="px-3 py-3">${escapeHtml(formatMinutosInformados(alerta.minutosHastaCorte) ?? '—')}</td>
          <td class="px-3 py-3" data-tooltip="La API no informa un estado de resolución.">—</td>
          <td class="px-3 py-3"><button type="button" class="${BTN_SECONDARY_CLASS}">Revisar</button></td>
        `
        row.querySelector('button').addEventListener('click', () => onRevisar?.(alerta.empleadoId))
        body.append(row)
      })
      host.replaceChildren(table)
    } catch (error) {
      if (error.status === 401) return
      host.replaceChildren(panelForCapability(
        { status: error.status === 403 ? CAPABILITY_STATUS.forbidden : CAPABILITY_STATUS.temporarilyUnavailable, reason: error.status ? 'server' : 'network' },
        { onRetry: () => load(true) },
      ))
    }
  }

  load(false)
  return { element: root, reload: () => load(true) }
}

export function createJornadasPendientesIndicator() {
  const card = document.createElement('article')
  card.className = 'rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900'
  card.innerHTML = `
    <p class="text-sm font-medium text-slate-500">Jornadas pendientes</p>
    <p data-value class="mt-2 text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-100" tabindex="0">—</p>
  `
  const value = card.querySelector('[data-value]')

  async function load(force = false) {
    if (!puedeVerAlertasJornada(getCurrentUser())) {
      value.textContent = '—'
      value.dataset.tooltip = 'No tenés permiso para consultar las alertas de jornadas.'
      return
    }
    const capability = await resolveCapability(CAPABILITY.fichadasIncompleteAlerts, { force })
    if (capability.status === CAPABILITY_STATUS.available) {
      try {
        const alertas = await getAlertasIncompletas()
        value.textContent = String(alertas.length)
        delete value.dataset.tooltip
        return
      } catch (error) {
        if (error.status === 403) {
          value.textContent = '—'
          value.dataset.tooltip = 'No tenés permiso para consultar las alertas de jornadas.'
          return
        }
      }
    }
    if (capability.status === CAPABILITY_STATUS.forbidden) {
      value.textContent = '—'
      value.dataset.tooltip = 'No tenés permiso para consultar las alertas de jornadas.'
      return
    }
    value.textContent = '—'
    value.dataset.tooltip = capability.status === CAPABILITY_STATUS.unavailable
      ? 'Esta información se habilitará cuando la API publique las alertas de jornadas.'
      : 'No se pudo consultar las jornadas pendientes.'
  }

  load(false)
  bindTooltipRoot(card)
  card.reload = () => load(true)
  return card
}
