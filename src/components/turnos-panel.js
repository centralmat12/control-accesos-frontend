import { CAPABILITY, CAPABILITY_STATUS, resolveCapability } from '../api/capabilities.js'
import { createTurno, deleteTurno, getTurnos, updateTurno } from '../api/turnos.js'
import { puedeAdministrarTurnos } from '../config/labor-access.js'
import { getCurrentUser } from '../api/auth.js'
import { badgeHtml } from './badge.js'
import { BTN_SECONDARY_CLASS } from './button-styles.js'
import { openConfirmModal, openFormModal } from './modal.js'
import { panelForCapability } from './maintenance-panel.js'
import { bindTooltipRoot } from './tooltip.js'
import { showToast } from './toast.js'
import { escapeHtml } from '../utils/format.js'
import { formatMinutosInformados, horarioNocturnoNoSoportado, NOCTURNO_PENDIENTE } from '../utils/labor-format.js'
function loadingState() {
  const node = document.createElement('p')
  node.className = 'rounded-xl border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500 shadow-sm dark:border-slate-700 dark:bg-slate-900'
  node.textContent = 'Cargando turnos...'
  return node
}

const DAY_LABELS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const SHELL = 'max-h-[65vh] overflow-auto rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900'

function diaLabel(dia) {
  return DAY_LABELS[dia] ?? `Día ${dia}`
}

function turnoForm(initial) {
  const form = document.createElement('form')
  form.className = 'space-y-4'
  const dias = initial?.dias?.length ? initial.dias : [{ diaSemana: 1, horaEntrada: '09:00', horaSalida: '18:00', minutosAlmuerzo: 60 }]
  form.innerHTML = `
    <label class="block text-sm font-medium text-slate-700 dark:text-slate-200">Nombre
      <input name="nombre" required maxlength="100" class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900" value="${escapeHtml(initial?.nombre ?? '')}" />
    </label>
    <label class="block text-sm font-medium text-slate-700 dark:text-slate-200">Tolerancia (minutos)
      <input name="tolerancia" type="number" min="0" max="1440" required class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900" value="${Number(initial?.toleranciaMinutos ?? 0)}" />
    </label>
    <div data-dias class="space-y-3"></div>
    <button type="button" data-add-day class="${BTN_SECONDARY_CLASS}">Agregar día</button>
    <p data-night class="hidden text-sm text-slate-600 dark:text-slate-300"></p>
    <p data-error class="hidden text-sm text-red-600" role="alert"></p>
    <div class="flex justify-end gap-2">
      <button type="button" data-cancel class="${BTN_SECONDARY_CLASS}">Cancelar</button>
      <button type="submit" class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500">Guardar</button>
    </div>
  `
  const list = form.querySelector('[data-dias]')
  const night = form.querySelector('[data-night]')
  night.textContent = NOCTURNO_PENDIENTE

  function addDay(dia = { diaSemana: 1, horaEntrada: '', horaSalida: '', minutosAlmuerzo: 60 }) {
    const row = document.createElement('div')
    row.className = 'grid gap-2 sm:grid-cols-4'
    row.innerHTML = `
      <select name="diaSemana" class="rounded-lg border border-slate-200 px-2 py-2 text-sm dark:border-slate-600 dark:bg-slate-900" aria-label="Día">
        ${DAY_LABELS.map((label, index) => `<option value="${index}" ${Number(dia.diaSemana) === index ? 'selected' : ''}>${label}</option>`).join('')}
      </select>
      <input name="horaEntrada" type="time" required class="rounded-lg border border-slate-200 px-2 py-2 text-sm dark:border-slate-600 dark:bg-slate-900" value="${escapeHtml(dia.horaEntrada ?? '')}" aria-label="Hora de entrada" />
      <input name="horaSalida" type="time" required class="rounded-lg border border-slate-200 px-2 py-2 text-sm dark:border-slate-600 dark:bg-slate-900" value="${escapeHtml(dia.horaSalida ?? '')}" aria-label="Hora de salida" />
      <input name="minutosAlmuerzo" type="number" min="0" max="1440" class="rounded-lg border border-slate-200 px-2 py-2 text-sm dark:border-slate-600 dark:bg-slate-900" value="${Number(dia.minutosAlmuerzo ?? 60)}" aria-label="Descanso en minutos" />
    `
    list.append(row)
  }
  dias.forEach(addDay)
  form.querySelector('[data-add-day]').addEventListener('click', () => addDay())
  form.collect = () => {
    const rows = [...list.children]
    const parsed = rows.map((row) => ({
      diaSemana: Number(row.querySelector('[name="diaSemana"]').value),
      horaEntrada: row.querySelector('[name="horaEntrada"]').value,
      horaSalida: row.querySelector('[name="horaSalida"]').value,
      minutosAlmuerzo: Number(row.querySelector('[name="minutosAlmuerzo"]').value),
    }))
    const nocturnal = parsed.some((dia) => horarioNocturnoNoSoportado(dia.horaEntrada, dia.horaSalida))
    night.classList.toggle('hidden', !nocturnal)
    if (nocturnal) return null
    return {
      nombre: form.nombre.value,
      toleranciaMinutos: Number(form.tolerancia.value),
      dias: parsed,
    }
  }
  return form
}

function renderTable(turnos, canWrite, host, reload) {
  if (!turnos.length) {
    host.innerHTML = `<div class="${SHELL} px-4 py-10 text-center"><p class="text-sm font-semibold">No hay turnos cargados</p><p class="mt-1 text-sm text-slate-500">Cuando existan turnos de la empresa van a aparecer en esta tabla.</p></div>`
    return
  }
  const section = document.createElement('div')
  section.className = SHELL
  section.innerHTML = `
    <table class="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-700">
      <thead class="sticky top-0 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800 dark:text-slate-400">
        <tr>
          <th class="px-3 py-3">Nombre</th>
          <th class="px-3 py-3">Horario</th>
          <th class="px-3 py-3">Duración prevista</th>
          <th class="px-3 py-3">Descanso</th>
          <th class="px-3 py-3">Estado</th>
          <th class="px-3 py-3">Empleados asignados</th>
          ${canWrite ? '<th class="px-3 py-3">Acciones</th>' : ''}
        </tr>
      </thead>
      <tbody></tbody>
    </table>
  `
  const body = section.querySelector('tbody')
  turnos.forEach((turno) => {
    const horario = turno.dias.map((dia) => `${diaLabel(dia.diaSemana)} ${dia.horaEntrada || '—'}–${dia.horaSalida || '—'}`).join(' · ') || '—'
    const duracion = turno.dias.map((dia) => dia.duracionReloj).filter(Boolean).join(' · ') || '—'
    const descanso = turno.dias.map((dia) => (dia.minutosAlmuerzo == null ? null : formatMinutosInformados(dia.minutosAlmuerzo))).filter(Boolean).join(' · ') || '—'
    const estado = turno.activo === true ? 'Activo' : turno.activo === false ? 'Inactivo' : '—'
    const row = document.createElement('tr')
    row.className = 'border-t border-slate-100 dark:border-slate-800'
    row.innerHTML = `
      <td class="px-3 py-3 font-medium">${escapeHtml(turno.nombre)}</td>
      <td class="max-w-xs truncate px-3 py-3" data-tooltip="${escapeHtml(horario)}">${escapeHtml(horario)}</td>
      <td class="px-3 py-3">${escapeHtml(duracion)}</td>
      <td class="px-3 py-3">${escapeHtml(descanso)}</td>
      <td class="px-3 py-3">${badgeHtml(estado, estado === 'Activo' ? 'success' : 'neutral')}</td>
      <td class="px-3 py-3 text-slate-500" data-tooltip="La API no informa la cantidad de empleados asignados.">—</td>
      ${canWrite ? `<td class="px-3 py-3"><button type="button" data-edit class="${BTN_SECONDARY_CLASS}">Editar</button> <button type="button" data-delete class="text-sm font-semibold text-red-700">Eliminar</button></td>` : ''}
    `
    row.querySelector('[data-edit]')?.addEventListener('click', () => openEditor(turno, reload))
    row.querySelector('[data-delete]')?.addEventListener('click', async () => {
      const confirmed = await openConfirmModal({
        title: '¿Eliminar este turno?',
        message: 'La baja solo se confirma si el servicio la acepta. Si el turno está en uso, se mostrará el mensaje que devuelva la API.',
        confirmLabel: 'Eliminar',
        danger: true,
      })
      if (!confirmed) return
      try {
        await deleteTurno(turno.id)
        showToast({ message: 'Turno eliminado.', tone: 'success' })
        reload()
      } catch (error) {
        showToast({ message: error.message || 'No se pudo eliminar el turno.', tone: 'error' })
      }
    })
    body.append(row)
  })
  host.replaceChildren(section)
}

function openEditor(turno, reload) {
  const form = turnoForm(turno)
  const error = form.querySelector('[data-error]')
  const modal = openFormModal({
    title: turno ? 'Editar turno' : 'Nuevo turno',
    content: form,
  })
  form.querySelector('[data-cancel]').addEventListener('click', () => modal.close())
  form.addEventListener('submit', async (event) => {
    event.preventDefault()
    const body = form.collect()
    if (!body) {
      error.textContent = NOCTURNO_PENDIENTE
      error.classList.remove('hidden')
      return
    }
    try {
      if (turno?.id) await updateTurno(turno.id, body)
      else await createTurno(body)
      showToast({ message: turno?.id ? 'Turno actualizado.' : 'Turno creado.', tone: 'success' })
      modal.close({ force: true })
      reload()
    } catch (saveError) {
      error.textContent = saveError.message || 'No se pudo guardar el turno.'
      error.classList.remove('hidden')
    }
  })
}

export function createTurnosPanel() {
  const root = document.createElement('section')
  root.className = 'space-y-4'
  const actions = document.createElement('div')
  actions.className = 'flex flex-wrap items-center justify-end gap-2'
  const host = document.createElement('div')
  root.append(actions, host)

  async function load(force = false) {
    host.replaceChildren(loadingState())
    const user = getCurrentUser()
    const read = await resolveCapability(CAPABILITY.turnosRead, { force })
    if (read.status !== CAPABILITY_STATUS.available) {
      actions.replaceChildren()
      host.replaceChildren(panelForCapability(read, { onRetry: () => load(true) }))
      return
    }
    const write = await resolveCapability(CAPABILITY.turnosWrite, { force })
    const canWrite = write.status === CAPABILITY_STATUS.available && puedeAdministrarTurnos(user)
    actions.replaceChildren()
    if (canWrite) {
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-500'
      button.textContent = 'Nuevo turno'
      button.addEventListener('click', () => openEditor(null, () => load(false)))
      actions.append(button)
    }
    try {
      const turnos = await getTurnos()
      renderTable(turnos, canWrite, host, () => load(false))
    } catch (error) {
      if (error.status === 401) return
      host.replaceChildren(panelForCapability(
        { status: error.status === 403 ? CAPABILITY_STATUS.forbidden : CAPABILITY_STATUS.temporarilyUnavailable, reason: error.status ? 'server' : 'network' },
        { onRetry: () => load(true) },
      ))
    }
  }

  load(false)
  bindTooltipRoot(root)
  return root
}
