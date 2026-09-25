import { observacionesDeJornada } from '../utils/fichada-observacion.js'
import { escapeHtml, formatFichadaFecha } from '../utils/format.js'
import { iconNote } from './icons.js'

let panel = null
let cleanup = null

export function indicadorObservacionesHtml(jornada, index) {
  const items = observacionesDeJornada(jornada)
  if (!items.length) return ''
  const label = items.length === 1 ? 'Ver observación' : `Ver ${items.length} observaciones`
  const count =
    items.length > 1
      ? `<span class="text-xs font-semibold leading-none">${items.length}</span>`
      : ''
  return `<button type="button" data-action="ver-observaciones-jornada" data-index="${index}" class="inline-flex shrink-0 cursor-pointer items-center gap-0.5 rounded text-violet-700 hover:text-violet-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:text-violet-300" data-tooltip="${escapeHtml(label)}" aria-label="${escapeHtml(label)}">${iconNote('h-3.5 w-3.5')}${count}</button>`
}

function closePanel() {
  cleanup?.()
  cleanup = null
  panel?.remove()
  panel = null
}

export function openObservacionesJornada(anchor, jornada) {
  closePanel()
  const items = observacionesDeJornada(jornada)
  if (!items.length || !anchor) return

  panel = document.createElement('div')
  panel.className =
    'fixed z-50 w-[min(22rem,calc(100vw-1.5rem))] rounded-xl border border-slate-200 bg-white p-3 text-sm shadow-lg dark:border-slate-700 dark:bg-slate-900'
  panel.setAttribute('role', 'dialog')
  panel.setAttribute('aria-label', 'Observaciones de la jornada')

  const title = document.createElement('h2')
  title.className = 'text-sm font-semibold text-slate-900 dark:text-slate-100'
  title.textContent = 'Observaciones de la jornada'
  const empleado = document.createElement('p')
  empleado.className = 'mt-1 text-sm text-slate-800 dark:text-slate-200'
  empleado.textContent = String(jornada?.empleado ?? 'Empleado')
  const fecha = document.createElement('p')
  fecha.className = 'text-xs text-slate-500'
  fecha.textContent = jornada?.fecha ? formatFichadaFecha(jornada.fecha) : '—'
  const list = document.createElement('ol')
  list.className = 'mt-3 space-y-3'
  items.forEach((item) => {
    const entry = document.createElement('li')
    const head = document.createElement('p')
    head.className = 'font-medium text-slate-900 dark:text-slate-100'
    head.textContent = `${item.hora} · ${item.movimiento}`
    const motivo = document.createElement('p')
    motivo.className = 'text-violet-800 dark:text-violet-200'
    motivo.textContent = item.motivo
    entry.append(head, motivo)
    if (item.detalle) {
      const detalle = document.createElement('p')
      detalle.className = 'whitespace-pre-wrap break-words text-slate-700 dark:text-slate-300'
      detalle.textContent = item.detalle
      entry.append(detalle)
    }
    list.append(entry)
  })
  panel.append(title, empleado, fecha, list)
  document.body.append(panel)

  const rect = anchor.getBoundingClientRect()
  const width = panel.offsetWidth
  const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8))
  const top = Math.min(rect.bottom + 6, window.innerHeight - panel.offsetHeight - 8)
  panel.style.left = `${left}px`
  panel.style.top = `${Math.max(8, top)}px`

  const onKey = (event) => {
    if (event.key === 'Escape') closePanel()
  }
  const onPointer = (event) => {
    if (panel && !panel.contains(event.target) && event.target !== anchor) closePanel()
  }
  document.addEventListener('keydown', onKey)
  document.addEventListener('pointerdown', onPointer)
  cleanup = () => {
    document.removeEventListener('keydown', onKey)
    document.removeEventListener('pointerdown', onPointer)
  }
}

export function bindObservacionesJornada(root, jornadas) {
  root.addEventListener('click', (event) => {
    const button = event.target.closest('[data-action="ver-observaciones-jornada"]')
    if (!button || !root.contains(button)) return
    event.preventDefault()
    const jornada = jornadas[Number(button.dataset.index)]
    if (jornada) openObservacionesJornada(button, jornada)
  })
}
