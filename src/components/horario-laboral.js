import { CAPABILITY, CAPABILITY_STATUS, resolveCapability } from '../api/capabilities.js'
import { getTurnos } from '../api/turnos.js'
import { assignTurno, getAsignaciones } from '../api/jornadas.js'
import { puedeEscribirJornadas } from '../config/labor-access.js'
import { getCurrentUser } from '../api/auth.js'
import { todayDateKey } from '../utils/format.js'
import { fechaAsignacionVisible, fechaIsoDesdeVisible, mascaraFechaDia, textoHorarioHabitual } from '../utils/turno-presentacion.js'
import { iconCalendar } from './icons.js'
import { enhanceSelectsIn } from './dropdown.js'
import { FORM_HELP_CLASS, FORM_INPUT_CLASS, FORM_LABEL_CLASS } from './form-field.js'

export function selectHorarioLaboralMode(turnosStatus, assignmentsStatus) {
  if (turnosStatus === CAPABILITY_STATUS.available && assignmentsStatus === CAPABILITY_STATUS.available) return 'turno'
  return 'legacy'
}

function turnoVigente(asignaciones, fecha) {
  const vigentes = (asignaciones ?? []).filter((item) => item?.fechaInicio && item.fechaInicio.slice(0, 10) <= fecha && (!item.fechaFin || item.fechaFin.slice(0, 10) >= fecha))
  vigentes.sort((a, b) => String(b.fechaInicio).localeCompare(String(a.fechaInicio)))
  return vigentes[0] ?? null
}

export async function mountHorarioLaboral(form, { empleadoId } = {}) {
  const slot = form.querySelector('[data-form-field="horario"]')
  if (!slot) return 'legacy'
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
  let asignaciones = []
  try {
    ;[turnos, asignaciones] = await Promise.all([
      getTurnos(),
      empleadoId ? getAsignaciones(empleadoId).catch(() => []) : Promise.resolve([]),
    ])
  } catch {
    return 'legacy'
  }
  if (!form.isConnected) return 'legacy'

  const vigente = turnoVigente(asignaciones, todayDateKey())
  const actualId = Number(vigente?.turnoId)
  if (vigente && !turnos.some((turno) => Number(turno.id) === actualId)) {
    turnos = [{ id: vigente.turnoId, nombre: vigente.nombreTurno || 'Turno asignado', dias: [] }, ...turnos]
  }

  const canWrite = puedeEscribirJornadas(getCurrentUser())
  const help = slot.querySelector('[id$="-help"]')
  const error = slot.querySelector('[id$="-error"]')
  const helpId = help?.id || 'empleado-horario-help'
  const errorId = error?.id || 'empleado-horario-error'
  form.dataset.horarioLaboral = 'turno'
  form.dataset.turnoActualId = Number.isFinite(actualId) && actualId > 0 ? String(actualId) : ''
  slot.innerHTML = `
    <p class="${FORM_LABEL_CLASS}" id="empleado-horario-label">Turno</p>
    <label for="empleado-turno" class="mb-1.5 block text-xs font-medium text-slate-500">Turno disponible</label>
    <select id="empleado-turno" name="turnoId" class="${FORM_INPUT_CLASS}" aria-describedby="${helpId}" ${canWrite ? '' : 'disabled'}></select>
    <div data-turno-cambio class="mt-3 hidden">
      <label for="empleado-turno-desde" class="mb-1.5 block text-xs font-medium text-slate-500">Vigencia desde</label>
      <div class="relative">
        <input id="empleado-turno-desde" name="turnoDesde" type="text" inputmode="numeric" autocomplete="off" maxlength="10" placeholder="dd/mm/aaaa" class="${FORM_INPUT_CLASS} pr-10" ${canWrite ? '' : 'disabled'} />
        <span class="pointer-events-none absolute inset-y-0 right-0 flex w-10 items-center justify-center text-slate-500" aria-hidden="true">${iconCalendar()}</span>
        <input data-turno-calendario type="date" tabindex="-1" aria-label="Elegir fecha" class="absolute inset-y-0 right-0 w-10 cursor-pointer opacity-0" ${canWrite ? '' : 'disabled'} />
      </div>
    </div>
    <p id="${helpId}" data-efectivo class="${FORM_HELP_CLASS}"></p>
    <p id="${errorId}" class="mt-1 hidden text-sm text-red-600" aria-live="polite"></p>
  `
  const select = slot.querySelector('[name="turnoId"]')
  const desde = slot.querySelector('[name="turnoDesde"]')
  const calendario = slot.querySelector('[data-turno-calendario]')
  const cambio = slot.querySelector('[data-turno-cambio]')
  const efectivo = slot.querySelector('[data-efectivo]')
  const errorEl = slot.querySelector(`#${errorId}`)
  if (!vigente) {
    const empty = document.createElement('option')
    empty.value = ''
    empty.textContent = turnos.length ? 'Seleccioná un turno' : 'No hay turnos cargados'
    select.append(empty)
  }
  turnos.forEach((turno) => {
    const option = document.createElement('option')
    option.value = String(turno.id)
    const asignado = Number(turno.id) === actualId
    option.textContent = asignado ? `${turno.nombre} (asignado)` : turno.nombre
    select.append(option)
  })
  select.value = vigente ? String(vigente.turnoId) : ''
  const hoy = todayDateKey()
  desde.value = fechaAsignacionVisible(hoy)
  calendario.value = hoy

  function pintarFecha(iso) {
    desde.value = iso ? fechaAsignacionVisible(iso) : ''
    calendario.value = iso || ''
  }

  function sync() {
    const turno = turnos.find((item) => String(item.id) === select.value)
    const cambioTurno = Boolean(select.value) && select.value !== form.dataset.turnoActualId
    cambio.classList.toggle('hidden', !canWrite || !cambioTurno)
    const horas = turno ? textoHorarioHabitual(turno.dias) : ''
    if (!canWrite) {
      efectivo.textContent = horas && horas !== '—'
        ? `Horario del turno: ${horas}. La asignación la realiza un administrador.`
        : 'Podés consultar el turno. La asignación la realiza un administrador.'
    } else if (turno && cambioTurno) {
      efectivo.textContent = horas && horas !== '—'
        ? `El empleado pasa a regirse por este turno (${horas}) desde la fecha indicada.`
        : 'El empleado pasa a regirse por este turno desde la fecha indicada.'
    } else if (turno) {
      efectivo.textContent = horas && horas !== '—'
        ? `El empleado se rige por este turno: ${horas}.`
        : 'El empleado se rige por este turno.'
    } else {
      efectivo.textContent = 'Elegí el turno disponible. El empleado se rige por ese turno.'
    }
    const iso = fechaIsoDesdeVisible(desde.value)
    const fechaInvalida = cambioTurno && Boolean(desde.value) && !iso
    form.dataset.turnoId = select.value
    form.dataset.turnoDesde = cambioTurno && iso ? iso : ''
    if (errorEl) {
      errorEl.textContent = fechaInvalida ? 'Ingresá la vigencia con el formato dd/mm/aaaa.' : ''
      errorEl.classList.toggle('hidden', !fechaInvalida)
    }
  }
  select.addEventListener('change', sync)
  desde.addEventListener('input', () => {
    const masked = mascaraFechaDia(desde.value)
    if (desde.value !== masked) {
      const cursor = desde.selectionStart ?? masked.length
      desde.value = masked
      desde.setSelectionRange(cursor, cursor)
    }
    const iso = fechaIsoDesdeVisible(desde.value)
    if (iso) calendario.value = iso
    sync()
  })
  calendario.addEventListener('change', () => {
    pintarFecha(calendario.value)
    sync()
  })
  sync()
  enhanceSelectsIn(slot)
  return 'turno'
}

export function turnoAsignacionDesdeForm(form) {
  if (form?.dataset?.horarioLaboral !== 'turno') return null
  const turnoId = Number(form.dataset.turnoId)
  const actual = Number(form.dataset.turnoActualId)
  const fechaInicio = form.dataset.turnoDesde
  if (!Number.isFinite(turnoId) || turnoId <= 0 || !fechaInicio) return null
  if (Number.isFinite(actual) && actual === turnoId) return null
  return { turnoId, fechaInicio: `${fechaInicio}T00:00:00` }
}

export async function guardarAsignacionSiCorresponde(empleadoId, assignment) {
  if (!assignment || !empleadoId) return null
  return assignTurno(empleadoId, assignment)
}
