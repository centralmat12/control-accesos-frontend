import { displayMetodoLabel, escapeHtml, fichadaDateKey, fichadaSortKey, formatFichadaFecha, formatFichadaHora } from '../utils/format.js'
import { JORNADA_ESTADO } from '../utils/jornadas.js'
import { FICHADAS_BODY_CLASS } from './fichadas-frame.js'
import { indicadorObservacionesHtml, bindObservacionesJornada } from './jornada-observaciones.js'
import { iconClock } from './icons.js'

export const TIMELINE_LEGEND =
  'Primera fichada: entrada · Última: salida · Restantes: intermedias'

export const TIMELINE_TOOLTIP =
  'La clasificación se reinicia cada día según la zona horaria de Argentina. La barra representa la permanencia estimada entre la primera y la última fichada y no equivale necesariamente a horas netas trabajadas. Los turnos que cruzan la medianoche requieren una regla específica.'

const OFFICE_START = 6 * 60
const OFFICE_END = 20 * 60

function minutesOfDay(value) {
  const key = fichadaSortKey(value)
  const match = key.match(/T(\d{2}):(\d{2})/)
  if (!match) return null
  return Number(match[1]) * 60 + Number(match[2])
}

function clock(minutes) {
  const safe = ((Math.round(minutes) % (24 * 60)) + 24 * 60) % (24 * 60)
  const hours = Math.floor(safe / 60)
  const rest = safe % 60
  return `${String(hours).padStart(2, '0')}:${String(rest).padStart(2, '0')}`
}

function formatDuration(minutes) {
  const safe = Math.max(0, Math.round(minutes))
  const hours = Math.floor(safe / 60)
  const rest = safe % 60
  if (hours === 0) return `${rest} min`
  if (rest === 0) return `${hours} h`
  return `${hours} h ${String(rest).padStart(2, '0')} min`
}

function parseHorario(label) {
  const match = String(label ?? '').match(/(\d{1,2}):(\d{2}).*?(\d{1,2}):(\d{2})/)
  if (!match) return null
  const start = Number(match[1]) * 60 + Number(match[2])
  const end = Number(match[3]) * 60 + Number(match[4])
  if (end <= start) return null
  return { start, end }
}

export function resolveFranja(mode, minutes, custom = {}) {
  const points = minutes.filter((value) => Number.isFinite(value))
  if (mode === 'day') return { start: 0, end: 24 * 60, outside: false }
  if (mode === 'office') {
    const outside = points.some((value) => value < OFFICE_START || value > OFFICE_END)
    return { start: OFFICE_START, end: OFFICE_END, outside }
  }
  if (mode === 'custom') {
    const start = custom.start
    const end = custom.end
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null
    const outside = points.some((value) => value < start || value > end)
    return { start, end, outside }
  }
  let start = OFFICE_START
  let end = OFFICE_END
  points.forEach((value) => {
    if (value < start) start = Math.floor(value / 60) * 60
    if (value > end) end = Math.ceil(value / 60) * 60
  })
  if (end <= start) end = Math.min(24 * 60, start + 60)
  return { start, end, outside: false }
}

export function barGeometry(start, end, bandStart, bandEnd) {
  const span = Math.max(1, bandEnd - bandStart)
  const pct = (minute) => Math.max(0, Math.min(100, ((minute - bandStart) / span) * 100))
  const left = pct(Math.min(start, end))
  const right = pct(Math.max(start, end))
  return { left, width: Math.max(0, right - left) }
}

export function visibleScaleTicks(ticks, width) {
  if (ticks.length <= 3 || width >= 1024) return ticks
  const last = ticks.length - 1
  if (width < 480) {
    const middle = ticks[Math.round(last / 2)]
    return [...new Set([ticks[0], middle, ticks[last]])]
  }
  return ticks.filter((_, index) => index === 0 || index === last || index % 2 === 0)
}

export function cruzaMedianoche(jornada) {
  return (jornada?.movimientos ?? []).some((item) => {
    const date = fichadaDateKey(item.fechaHora)
    return date && jornada.fecha && date !== jornada.fecha
  })
}

export function nightAxisMinute(minute) {
  return minute < 12 * 60 ? minute + 24 * 60 : minute
}

export const NIGHT_SCALE = { start: 22 * 60, end: 30 * 60 }

export function nowLabelAlign(percent) {
  if (percent <= 18) return 'start'
  if (percent >= 82) return 'end'
  return 'center'
}

const ROW_GRID_COMPACT = 'grid w-full min-w-0 items-center gap-2 grid-cols-[clamp(132px,20%,220px)_minmax(0,1fr)]'
const ROW_GRID_FULL = 'grid w-full min-w-0 items-center grid-cols-[280px_minmax(0,1fr)]'

function ticksForVariant(ticks, width, compact) {
  if (compact) return visibleScaleTicks(ticks, width)
  if (width >= 640) return ticks
  if (width >= 420) return ticks.filter((_, index) => index === ticks.length - 1 || index % 2 === 0)
  const last = ticks.length - 1
  const middle = ticks[Math.round(last / 2)]
  return [...new Set([ticks[0], middle, ticks[last]])]
}

let activeNowTimer = null
let scaleObserver = null

function clearNowTimer() {
  if (activeNowTimer) {
    clearInterval(activeNowTimer)
    activeNowTimer = null
  }
  scaleObserver?.disconnect()
  scaleObserver = null
}

function axisPoint(value, inset) {
  if (!inset) return `${value}%`
  return `calc(1.5rem + (100% - 3rem) * ${Number(value)} / 100)`
}

function axisSpan(start, width, inset) {
  if (!inset) return `left:${start}%;width:${width}%`
  return `left:${axisPoint(start, true)};width:calc((100% - 3rem) * ${Number(width)} / 100)`
}

function applyNowLabel(node, percent) {
  const inset = node.closest('section')?.dataset.axisInset === 'true'
  const align = inset ? 'center' : nowLabelAlign(percent)
  node.dataset.align = align
  node.style.left = inset ? axisPoint(percent, true) : align === 'end' ? '100%' : align === 'start' ? '0%' : `${percent}%`
  node.style.right = 'auto'
  node.style.transform = align === 'end' ? 'translateX(-100%)' : align === 'start' ? 'none' : 'translateX(-50%)'
}

export function scaleTicks(start, end) {
  const span = Math.max(60, end - start)
  const step = span <= 16 * 60 ? 120 : span <= 20 * 60 ? 180 : 240
  const ticks = []
  const first = Math.ceil(start / step) * step
  for (let minute = first; minute <= end; minute += step) ticks.push(minute)
  if (!ticks.length || ticks[0] !== start) ticks.unshift(start)
  if (ticks.at(-1) !== end) ticks.push(end)
  return ticks
}

function punchesOf(jornada) {
  return [...(jornada.movimientos ?? [])]
    .filter((item) => !item.esPosibleDuplicado)
    .sort(
      (a, b) => fichadaSortKey(a.fechaHora).localeCompare(fichadaSortKey(b.fechaHora)) || Number(a.id) - Number(b.id),
    )
}

function barText(jornada, punches, nowMinutes) {
  const first = punches[0]
  const last = punches.length >= 2 ? punches.at(-1) : null
  const open = jornada.estado === JORNADA_ESTADO.enCurso
  const start = first ? minutesOfDay(first.fechaHora) : null
  const end = last ? minutesOfDay(last.fechaHora) : open ? nowMinutes : start
  const range = start == null ? '' : last ? `${clock(start)}–${clock(end)}` : open ? `${clock(start)}–Ahora` : clock(start)
  const duration = start != null && end != null && (last || open) ? formatDuration(end - start) : ''
  return { first, last, open, start, end, range, duration, full: duration ? `${range} · ${duration}` : range }
}

function barTip(jornada, punches, text) {
  const lines = []
  if (text.start != null) lines.push(`Primera fichada: ${clock(text.start)}`)
  const middles = punches.slice(1, -1).map((item) => formatFichadaHora(item.fechaHora)).filter(Boolean)
  if (middles.length === 1) lines.push(`Fichada intermedia: ${middles[0]}`)
  if (middles.length > 1) lines.push(`Fichadas intermedias: ${middles.join(', ')}`)
  if (text.last) lines.push(`Última fichada: ${clock(text.end)}`)
  else if (text.open) lines.push('Última fichada: en curso')
  if (text.duration) lines.push(`Permanencia estimada: ${text.duration}`)
  const horario = jornada.horarioPrevisto && jornada.horarioPrevisto !== 'No asignado' ? jornada.horarioPrevisto : ''
  if (horario) lines.push(`Horario previsto: ${horario}`)
  const metodo = displayMetodoLabel(text.first?.metodo)
  if (metodo) lines.push(`Método: ${metodo}`)
  if (jornada.estado) lines.push(`Estado: ${jornada.estado}`)
  return lines.join('\n')
}

function accessibleLabel(jornada, text) {
  return [
    jornada.empleado || 'Empleado',
    jornada.estado ? `jornada ${jornada.estado.toLowerCase()}` : '',
    text.start != null ? `primera fichada ${clock(text.start)}` : '',
    text.last ? `última fichada ${clock(text.end)}` : text.open ? 'jornada en curso' : '',
    text.duration ? `permanencia estimada ${text.duration}` : '',
  ]
    .filter(Boolean)
    .join(', ')
}

export function createFichadasTimeline(
  jornadas,
  { now = new Date(), includesToday = false, bodyClass = FICHADAS_BODY_CLASS, variant = 'full', franja = { mode: 'auto' } } = {},
) {
  clearNowTimer()
  const section = document.createElement('section')
  section.className = 'min-w-0 max-w-full bg-white dark:bg-slate-900'
  const compact = variant === 'compact'
  const rowGrid = compact ? ROW_GRID_COMPACT : ROW_GRID_FULL
  section.dataset.axisInset = 'true'
  const nowMinutes = minutesOfDay(now) ?? 0
  const allMinutes = jornadas.flatMap((jornada) => punchesOf(jornada).map((item) => minutesOfDay(item.fechaHora))).filter((value) => value != null)
  const band = resolveFranja(franja.mode || 'auto', allMinutes, franja)
  if (!band) {
    section.innerHTML = `<p class="px-4 py-6 text-sm text-red-600">Indicá una hora desde y una hora hasta válidas. La hora final tiene que ser posterior.</p>`
    return section
  }

  if (!jornadas.length) {
    section.innerHTML = `
      <p class="px-4 py-10 text-center text-sm font-medium text-slate-700 dark:text-slate-200">${compact ? 'No hay jornadas registradas hoy.' : 'Sin fichadas'}</p>
      ${compact ? '' : '<p class="px-4 pb-8 text-center text-sm text-slate-500">No hay fichadas registradas para el período seleccionado.</p>'}
    `
    return section
  }

  const nightScale = jornadas.length > 0 && jornadas.every(cruzaMedianoche)
  const axis = nightScale ? { ...NIGHT_SCALE, outside: false } : band
  const toAxis = (minute) => (nightScale ? nightAxisMinute(minute) : minute)
  const span = Math.max(1, axis.end - axis.start)
  const percent = (minute) => Math.max(0, Math.min(100, ((toAxis(minute) - axis.start) / span) * 100))
  const showNow = includesToday && toAxis(nowMinutes) >= axis.start && toAxis(nowMinutes) <= axis.end
  const ticks = scaleTicks(axis.start, axis.end)
  const nowPercent = percent(nowMinutes)

  const rows = jornadas
    .map((jornada, index) => {
      const punches = punchesOf(jornada)
      const text = barText(jornada, punches, nowMinutes)
      const tip = barTip(jornada, punches, text)
      const label = accessibleLabel(jornada, text)
      const tone =
        jornada.estado === JORNADA_ESTADO.revisar || jornada.estado === JORNADA_ESTADO.incompleta
          ? 'bg-amber-500'
          : jornada.estado === JORNADA_ESTADO.enCurso
            ? 'bg-emerald-500 bg-[repeating-linear-gradient(135deg,transparent,transparent_4px,rgba(255,255,255,0.28)_4px,rgba(255,255,255,0.28)_8px)]'
            : 'bg-emerald-600'
      const geometry =
        text.start == null
          ? { left: 0, width: 0 }
          : barGeometry(toAxis(text.start), toAxis(text.end ?? text.start), axis.start, axis.end)
      const planned = parseHorario(jornada.horarioPrevisto)
      const plan =
        planned == null
          ? ''
          : `<span class="pointer-events-none absolute top-1/2 h-7 max-w-full -translate-y-1/2 rounded-md bg-slate-200/35 ring-1 ring-inset ring-slate-300/40 dark:bg-slate-700/25 dark:ring-slate-600/30" style="${axisSpan(percent(planned.start), Math.max(0, percent(planned.end) - percent(planned.start)), true)}"></span>`
      const incomplete = jornada.estado === JORNADA_ESTADO.incompleta
      const ingresoHora = formatFichadaHora(text.first?.fechaHora) || (text.start == null ? '' : clock(text.start))
      const ingresoTip = `Solo se registró el ingreso a las ${ingresoHora}. Falta la fichada de salida`
      const bar =
        incomplete && ingresoHora
          ? `<button type="button" data-ingreso-label data-percent="${geometry.left}" data-full="Solo ingreso · ${escapeHtml(ingresoHora)}" data-short="Ingreso · ${escapeHtml(ingresoHora)}" class="absolute top-1/2 z-[1] inline-flex h-7 w-max -translate-y-1/2 items-center whitespace-nowrap rounded-md bg-amber-800 px-2.5 text-xs font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300" style="left:${axisPoint(geometry.left, true)}" data-tooltip="${escapeHtml(ingresoTip)}" aria-label="${escapeHtml(`Solo ingreso a las ${ingresoHora}. ${ingresoTip}`)}">Solo ingreso · ${escapeHtml(ingresoHora)}</button>`
          : geometry.width > 0
            ? `<button type="button" class="absolute top-1/2 z-[1] flex h-7 max-w-full min-w-0 -translate-y-1/2 items-center overflow-hidden rounded-md px-3 text-xs font-semibold text-white hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${tone}" style="${axisSpan(geometry.left, geometry.width, true)}" data-tooltip="${escapeHtml(tip)}" aria-label="${escapeHtml(label)}"><span class="truncate" data-timeline-label data-short="${escapeHtml(text.range)}" data-full="${escapeHtml(text.full)}">${escapeHtml(text.full)}</span></button>`
            : ''
      const fecha = formatFichadaFecha(jornada.fecha)
      const detalle = incomplete
        ? `${escapeHtml(fecha)} · <span class="text-amber-700 dark:text-amber-300">Incompleta · Sin salida</span>`
        : `${escapeHtml(fecha)}${jornada.estado ? ` · ${escapeHtml(jornada.estado)}` : ''}`
      return `
        <li class="${rowGrid} h-[60px] border-b border-slate-100 px-4 last:border-0 dark:border-slate-800">
          <div class="min-w-0 self-center border-r border-slate-200 pr-3 dark:border-slate-700">
            <div class="flex min-w-0 items-center gap-2">
              <p class="min-w-0 truncate text-sm font-semibold text-slate-900 dark:text-slate-100">${escapeHtml(jornada.empleado || '—')}</p>
              ${indicadorObservacionesHtml(jornada, index)}
            </div>
            <p class="mt-0.5 truncate text-xs font-normal text-slate-600 dark:text-slate-300">${detalle}</p>
            ${jornada.advertencia ? `<p class="truncate text-[10px] font-normal text-amber-700 dark:text-amber-300">${escapeHtml(jornada.advertencia)}</p>` : ''}
          </div>
          <div class="relative h-7 min-w-0 w-full self-center overflow-hidden" data-timeline-track>
            ${ticks.map((minute) => `<span class="pointer-events-none absolute inset-y-0 w-px bg-slate-200/40 dark:bg-slate-600/30" style="left:${axisPoint(percent(minute), true)}" data-grid-line data-tick="${minute}"></span>`).join('')}
            ${plan}
            ${bar}
            ${showNow ? `<span data-now-line class="pointer-events-none absolute inset-y-0 z-[2] w-px bg-red-500" style="left:${axisPoint(nowPercent, true)}"></span>` : ''}
          </div>
        </li>`
    })
    .join('')

  section.innerHTML = `
    ${band.outside ? '<p class="border-b border-amber-200 bg-amber-50 px-3 py-1.5 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100" role="status">Hay fichadas fuera de la franja visible.</p>' : ''}
    <div class="${bodyClass} overflow-x-hidden">
      <div class="w-full min-w-0" data-timeline-scale>
        <div class="${rowGrid} sticky top-0 z-10 h-10 items-center border-b border-slate-200 bg-slate-50 px-4 dark:border-slate-700 dark:bg-slate-800">
          <p class="border-r border-slate-200 pr-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-700">Jornada</p>
          <div class="relative h-4 min-w-0" data-timeline-track>
            ${ticks.map((minute) => `<span data-scale-tick data-tick="${minute}" class="absolute whitespace-nowrap text-xs font-semibold text-slate-500">${minute === 24 * 60 ? '00:00' : clock(minute >= 24 * 60 ? minute - 24 * 60 : minute)}</span>`).join('')}
            ${showNow ? `<span data-now-label class="absolute bottom-0 z-[3] inline-flex items-center gap-1 rounded-md border border-red-700 bg-red-800 px-1.5 py-0.5 text-[11px] font-semibold leading-none text-white dark:border-red-500 dark:bg-red-950" aria-label="Hora actual: ${clock(nowMinutes)}"><span class="[&_svg]:h-3 [&_svg]:w-3" aria-hidden="true">${iconClock()}</span><span>Ahora</span> <span data-now-clock>${clock(nowMinutes)}</span></span>` : ''}
          </div>
        </div>
        <ol>${rows}</ol>
      </div>
    </div>
  `

  const fitLabels = () => {
    const track = section.querySelector('[data-timeline-track]')
    const width = track?.clientWidth || section.clientWidth || 1280
    const visible = new Set(ticksForVariant(ticks, width, compact))
    section.querySelectorAll('[data-scale-tick], [data-grid-line]').forEach((node) => {
      const minute = Number(node.dataset.tick)
      const hidden = !visible.has(minute)
      node.classList.toggle('hidden', hidden)
      if (hidden || !node.hasAttribute('data-scale-tick')) return
      node.style.left = axisPoint(percent(minute), true)
      node.style.transform = 'translateX(-50%)'
    })
    section.querySelectorAll('[data-ingreso-label]').forEach((node) => {
      const track = node.parentElement
      const limit = Math.max(0, (track?.clientWidth || 0) - 4)
      node.textContent = node.dataset.full
      node.style.left = axisPoint(node.dataset.percent, true)
      if (limit && node.offsetLeft + node.offsetWidth > limit) node.textContent = node.dataset.short
      if (limit && node.offsetLeft + node.offsetWidth > limit) {
        node.style.left = `${Math.max(0, limit - node.offsetWidth)}px`
      }
    })
    section.querySelectorAll('[data-timeline-label]').forEach((label) => {
      label.textContent = label.dataset.full
      if (label.scrollWidth > label.clientWidth + 1) label.textContent = label.dataset.short
    })
    const badge = section.querySelector('[data-now-label]')
    if (badge) applyNowLabel(badge, Number(badge.dataset.percent ?? nowPercent))
  }
  const badge = section.querySelector('[data-now-label]')
  if (badge) badge.dataset.percent = String(nowPercent)
  fitLabels()
  if (typeof ResizeObserver !== 'undefined') {
    scaleObserver = new ResizeObserver(() => fitLabels())
    scaleObserver.observe(section)
  }

  section.querySelectorAll('[data-timeline-label]').forEach((label) => {
    if (label.scrollWidth > label.clientWidth + 1) label.textContent = label.dataset.short
  })
  section.querySelectorAll('button[data-tooltip]').forEach((button) => {
    if (button.dataset.action === 'ver-observaciones-jornada') return
    button.addEventListener('click', () => button.blur())
  })
  bindObservacionesJornada(section, jornadas)

  if (showNow) {
    activeNowTimer = setInterval(() => {
      if (!section.isConnected) {
        clearNowTimer()
        return
      }
      const minute = minutesOfDay(new Date())
      if (minute == null || minute < band.start || minute > band.end) return
      const left = percent(minute)
      const inset = section.dataset.axisInset === 'true'
      section.querySelectorAll('[data-now-line]').forEach((node) => {
        node.style.left = inset ? axisPoint(left, true) : left >= 100 ? 'auto' : `${left}%`
        node.style.right = !inset && left >= 100 ? '0' : 'auto'
      })
      const label = section.querySelector('[data-now-label]')
      const clockNode = section.querySelector('[data-now-clock]')
      if (clockNode) clockNode.textContent = clock(minute)
      if (label) {
        label.dataset.percent = String(left)
        label.setAttribute('aria-label', `Hora actual: ${clock(minute)}`)
        applyNowLabel(label, left)
      }
    }, 60000)
  }

  return section
}
