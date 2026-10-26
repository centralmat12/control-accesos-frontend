import { canOpenOperativeForm, CAPABILITY, CAPABILITY_STATUS, resolveCapability } from '../api/capabilities.js'
import { getAlertasIncompletas } from '../api/jornadas.js'
import { puedeRegistrarFichadaManual, puedeVerAlertasJornada } from '../config/labor-access.js'
import { getCurrentUser } from '../api/auth.js'
import { describeAlertaReview, estadoErrorAlertas, planAccionAlerta } from '../utils/jornada-alerta.js'
import { BTN_SECONDARY_CLASS } from './button-styles.js'
import { badgeHtml } from './badge.js'
import { panelForCapability } from './maintenance-panel.js'
import { openModal, trackFichadasOverlay } from './modal.js'
import { escapeHtml, formatFichadaFecha, formatFichadaHora } from '../utils/format.js'
import { formatMinutosInformados } from '../utils/labor-format.js'
import { bindTooltipRoot } from './tooltip.js'

const PRIMARY_CLASS = 'rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60'

export function createAlertasPanel({ empleados = [], onVerMovimientos, onRegistrarSalida } = {}) {
  const root = document.createElement('section')
  root.className = 'space-y-3'
  const host = document.createElement('div')
  root.append(host)
  bindTooltipRoot(root)
  let painted = false
  let reviewModal = null
  let resolveReady = () => {}
  const ready = new Promise((resolve) => {
    resolveReady = resolve
  })

  function legajoDe(empleadoId) {
    const empleado = empleados.find((item) => Number(item.id) === Number(empleadoId))
    return empleado?.legajo || ''
  }

  function closeReview() {
    reviewModal?.close({ force: true })
    reviewModal = null
  }

  function openReview(alerta, opener) {
    const model = describeAlertaReview(alerta, { legajo: alerta.legajo || legajoDe(alerta.empleadoId) })
    const content = document.createElement('div')
    const list = document.createElement('dl')
    list.className = 'grid grid-cols-[9rem_1fr] gap-x-3 gap-y-2 text-sm'
    model.rows.forEach((row) => {
      const term = document.createElement('dt')
      term.className = 'text-slate-500'
      term.textContent = row.label
      const value = document.createElement('dd')
      value.className = 'text-slate-900 dark:text-slate-100'
      value.textContent = row.value
      list.append(term, value)
    })
    const actions = document.createElement('div')
    actions.className = 'mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end'
    const cerrar = document.createElement('button')
    cerrar.type = 'button'
    cerrar.className = BTN_SECONDARY_CLASS
    cerrar.dataset.autofocus = 'true'
    cerrar.dataset.action = 'cerrar'
    cerrar.textContent = 'Cerrar'
    const movimientos = document.createElement('button')
    movimientos.type = 'button'
    movimientos.className = BTN_SECONDARY_CLASS
    movimientos.dataset.action = 'movimientos'
    movimientos.textContent = 'Ver movimientos del día'
    actions.append(movimientos, cerrar)
    const salida = document.createElement('button')
    salida.type = 'button'
    salida.className = `${PRIMARY_CLASS} hidden`
    salida.dataset.action = 'salida'
    salida.textContent = 'Registrar salida manual'
    salida.addEventListener('click', () => {
      closeReview()
      onRegistrarSalida?.(alerta, opener)
    })
    actions.insertBefore(salida, cerrar)
    content.append(list, actions)
    const modal = trackFichadasOverlay(openModal({
      title: model.title,
      content,
      onClose: () => {
        if (reviewModal === modal) reviewModal = null
      },
    }))
    reviewModal = modal
    void resolveCapability(CAPABILITY.fichadasManual, { force: true }).then((manual) => {
      if (reviewModal !== modal || manual.status === CAPABILITY_STATUS.unauthorized) return
      const disponible = puedeRegistrarFichadaManual(getCurrentUser()) && canOpenOperativeForm(manual)
      if (planAccionAlerta('salida', { manualAvailable: disponible }).openForm) salida.classList.remove('hidden')
    }).catch(() => {})
    cerrar.addEventListener('click', () => {
      if (planAccionAlerta('cerrar').write) return
      modal.close()
    })
    movimientos.addEventListener('click', () => {
      modal.close({ force: true })
      onVerMovimientos?.(alerta)
    })
  }

  function paint(alertas) {
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
              <th class="fichadas-alert-action px-3 py-3">Acción</th>
            </tr>
          </thead>
          <tbody></tbody>
        </table>`
    const body = table.querySelector('tbody')
    alertas.forEach((alerta) => {
      const nombre = [alerta.nombre, alerta.apellido].filter(Boolean).join(' ') || 'Empleado'
      const legajo = alerta.legajo || legajoDe(alerta.empleadoId)
      const row = document.createElement('tr')
      row.className = 'border-t border-slate-100 dark:border-slate-800'
      row.innerHTML = `
          <td class="px-3 py-3 font-medium">${escapeHtml(nombre)} ${alerta.esManual === true ? badgeHtml('Manual', 'info') : ''}</td>
          <td class="px-3 py-3">${escapeHtml(legajo || '—')}</td>
          <td class="px-3 py-3">${escapeHtml(alerta.fechaHora ? formatFichadaFecha(alerta.fechaHora) : '—')}</td>
          <td class="px-3 py-3">${escapeHtml(alerta.fechaHora ? formatFichadaHora(alerta.fechaHora) : '—')}</td>
          <td class="px-3 py-3">${escapeHtml(alerta.ultimaFechaHora ? formatFichadaHora(alerta.ultimaFechaHora) : 'Sin salida')}</td>
          <td class="max-w-xs truncate px-3 py-3" data-tooltip="${escapeHtml(alerta.mensaje || '—')}">${escapeHtml(alerta.mensaje || '—')}</td>
          <td class="px-3 py-3">${escapeHtml(formatMinutosInformados(alerta.minutosHastaCorte) ?? '—')}</td>
          <td class="px-3 py-3" data-tooltip="La API no informa un estado de resolución.">—</td>
          <td class="fichadas-alert-action"><button type="button" data-action="revisar" class="${BTN_SECONDARY_CLASS}">Revisar</button></td>
        `
      const button = row.querySelector('button')
      button.addEventListener('click', (event) => {
        event.preventDefault()
        event.stopPropagation()
        openReview(alerta, button)
      })
      body.append(row)
    })
    host.replaceChildren(table)
  }

  async function load(force = false) {
    if (!painted) host.textContent = 'Cargando alertas...'
    if (!puedeVerAlertasJornada(getCurrentUser())) {
      host.replaceChildren(panelForCapability({ status: CAPABILITY_STATUS.forbidden, reason: 'role' }))
      resolveReady(null)
      return []
    }
    const capability = await resolveCapability(CAPABILITY.fichadasIncompleteAlerts, { force })
    if (capability.status !== CAPABILITY_STATUS.available) {
      if (!painted) host.replaceChildren(panelForCapability(capability, { onRetry: () => load(true) }))
      resolveReady(null)
      return null
    }
    try {
      const alertas = await getAlertasIncompletas()
      paint(alertas)
      painted = true
      resolveReady(alertas)
      return alertas
    } catch (error) {
      resolveReady(null)
      if (error.status === 401) return null
      if (painted) throw error
      const kind = estadoErrorAlertas(error)
      const status = kind === 'mantenimiento'
        ? CAPABILITY_STATUS.unavailable
        : kind === 'restringido'
          ? CAPABILITY_STATUS.forbidden
          : CAPABILITY_STATUS.temporarilyUnavailable
      host.replaceChildren(panelForCapability(
        { status, reason: kind === 'contrato' ? 'contract' : error.status ? 'server' : 'network' },
        { onRetry: () => load(true) },
      ))
      resolveReady(null)
      return null
    }
  }

  load(true)
  return {
    element: root,
    reload: () => load(true),
    close: closeReview,
    openFirst: async () => {
      const list = await ready
      if (Array.isArray(list) && list.length === 1) openReview(list[0])
    },
  }
}

export const JORNADAS_INCOMPLETAS_DETAIL = 'Falta revisar o completar una fichada.'

export function presentarConteoJornadasIncompletas({ phase = 'cargando', count, message } = {}) {
  const base = {
    value: '—',
    tone: 'neutral',
    detail: JORNADAS_INCOMPLETAS_DETAIL,
    action: true,
  }
  if (phase === 'ok') {
    const total = Number(count)
    if (!Number.isInteger(total) || total < 0) return { ...base, detail: 'No se pudo consultar las jornadas incompletas.' }
    return {
      value: String(total),
      tone: total > 0 ? 'amber' : 'neutral',
      detail: JORNADAS_INCOMPLETAS_DETAIL,
      action: true,
    }
  }
  if (phase === 'prohibido') {
    return { ...base, detail: 'Acceso restringido.', action: false }
  }
  if (phase === 'error') {
    return { ...base, detail: message || 'No se pudo consultar las jornadas incompletas.' }
  }
  return base
}
