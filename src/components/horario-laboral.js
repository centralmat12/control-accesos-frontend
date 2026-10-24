import { CAPABILITY, CAPABILITY_STATUS, resolveCapability } from '../api/capabilities.js'
import { getTurnos } from '../api/turnos.js'
import { assignTurno, getAsignaciones } from '../api/jornadas.js'
import { puedeEscribirJornadas } from '../config/labor-access.js'
import { getCurrentUser } from '../api/auth.js'
import { escapeHtml } from '../utils/format.js'
import { todayDateKey } from '../utils/format.js'

export function selectHorarioLaboralMode(turnosStatus, assignmentsStatus) {
  if (turnosStatus === CAPABILITY_STATUS.available && assignmentsStatus === CAPABILITY_STATUS.available) return 'turno'
  return 'legacy'
}

function horarioTexto(turno) {
  if (!turno?.dias?.length) return 'Sin días configurados'
  return turno.dias
    .map((dia) => `${dia.horaEntrada || '—'}–${dia.horaSalida || '—'}`)
    .join(' · ')
}

export async function mountHorarioLaboral(form, { empleadoId } = {}) {
  const slot = form.querySelector('[data-form-field="horario"]')
  if (!slot || !form.isConnected) return 'legacy'
  const [turnosStatus, assignmentsStatus] = await Promise.all([
    resolveCapability(CAPABILITY.turnosRead),
    empleadoId
      ? resolveCapability(CAPABILITY.jornadasAssignments, { context: { empleadoId } })
      : Promise.resolve({ status: CAPABILITY_STATUS.unknown }),
  ])
  const mode = selectHorarioLaboralMode(
    turnosStatus.status,
    empleadoId ? assignmentsStatus.status : turnosStatus.status,
  )
  if (!form.isConnected || mode !== 'turno') return 'legacy'

  let turnos = []
  try {
    turnos = await getTurnos()
  } catch {
    return 'legacy'
  }
  if (!form.isConnected) return 'legacy'

  const canWrite = puedeEscribirJornadas(getCurrentUser())
  const legacy = form.dataset.horarioConservado || ''
  form.dataset.horarioLaboral = 'turno'
  form.dataset.horarioConservado = legacy
  slot.innerHTML = `
    <p class="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200" id="empleado-horario-label">Horario laboral</p>
    <div class="grid gap-3 sm:grid-cols-2">
      <label class="block text-xs font-medium text-slate-500">Turno asignado
        <select name="turnoId" class="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-900" ${canWrite ? '' : 'disabled'}></select>
      </label>
      <label class="block text-xs font-medium text-slate-500">Vigencia desde
        <input name="turnoDesde" type="date" class="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-900" ${canWrite ? '' : 'disabled'} />
      </label>
    </div>
    <p data-efectivo class="mt-2 text-sm text-slate-600 dark:text-slate-300"></p>
    <ul data-historial class="mt-2 space-y-1 text-xs text-slate-500"></ul>
    <p class="mt-1 text-xs text-slate-500">${canWrite ? 'El horario anterior se conserva y no se reemplaza por este turno.' : 'Podés consultar el turno. La asignación la realiza un administrador.'}</p>
  `
  const select = slot.querySelector('[name="turnoId"]')
  const desde = slot.querySelector('[name="turnoDesde"]')
  const efectivo = slot.querySelector('[data-efectivo]')
  const empty = document.createElement('option')
  empty.value = ''
  empty.textContent = turnos.length ? 'Sin cambio de turno' : 'No hay turnos cargados'
  select.append(empty)
  turnos.forEach((turno) => {
    const option = document.createElement('option')
    option.value = String(turno.id)
    option.textContent = turno.nombre
    select.append(option)
  })
  desde.value = todayDateKey()

  function sync() {
    const turno = turnos.find((item) => String(item.id) === select.value)
    efectivo.textContent = turno ? `Horario efectivo: ${horarioTexto(turno)}` : 'Sin turno nuevo seleccionado.'
    form.dataset.turnoId = select.value
    form.dataset.turnoDesde = select.value ? desde.value : ''
  }
  select.addEventListener('change', sync)
  desde.addEventListener('change', sync)
  sync()

  if (empleadoId) {
    try {
      const historial = await getAsignaciones(empleadoId)
      const list = slot.querySelector('[data-historial]')
      historial.forEach((item) => {
        const li = document.createElement('li')
        li.textContent = `${item.nombreTurno || 'Turno'} desde ${item.fechaInicio}${item.fechaFin ? ` hasta ${item.fechaFin}` : ''}`
        list.append(li)
      })
    } catch {
      /* el historial es complementario */
    }
  }
  return 'turno'
}

export function turnoAsignacionDesdeForm(form) {
  if (form?.dataset?.horarioLaboral !== 'turno') return null
  const turnoId = Number(form.dataset.turnoId)
  const fechaInicio = form.dataset.turnoDesde
  if (!Number.isFinite(turnoId) || turnoId <= 0 || !fechaInicio) return null
  return { turnoId, fechaInicio: `${fechaInicio}T00:00:00` }
}

export async function guardarAsignacionSiCorresponde(empleadoId, assignment) {
  if (!assignment || !empleadoId) return null
  return assignTurno(empleadoId, assignment)
}
