import { CAPABILITY, CAPABILITY_STATUS, resolveCapability } from '../api/capabilities.js'
import { createFichadaManual } from '../api/fichadas-manuales.js'
import { puedeRegistrarFichadaManual } from '../config/labor-access.js'
import { getCurrentUser } from '../api/auth.js'
import { OBSERVACION_MOTIVOS } from '../utils/fichada-observacion.js'
import { BTN_SECONDARY_CLASS } from './button-styles.js'
import { openConfirmModal, openFormModal } from './modal.js'
import { panelForCapability } from './maintenance-panel.js'
import { showToast } from './toast.js'
import { escapeHtml } from '../utils/format.js'

export function manualButtonAllowed(capability) {
  return puedeRegistrarFichadaManual(getCurrentUser()) && capability?.status !== CAPABILITY_STATUS.forbidden
}

export function createFichadaManualControl({ getEmpleados = () => [], onSaved } = {}) {
  const slot = document.createElement('div')

  async function openForm() {
    const empleados = getEmpleados()
    const capability = await resolveCapability(CAPABILITY.fichadasManual, { force: false })
    if (capability.status !== CAPABILITY_STATUS.available) {
      const panel = panelForCapability(capability, {
        onRetry: async () => {
          modal.close({ force: true })
          await resolveCapability(CAPABILITY.fichadasManual, { force: true })
          openForm()
        },
      })
      const modal = openFormModal({ title: 'Registrar fichada manual', content: panel })
      return
    }

    const form = document.createElement('form')
    form.className = 'space-y-3'
    form.innerHTML = `
      <label class="block text-sm">Empleado
        <select name="empleadoId" required class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900">
          <option value="">Seleccioná</option>
          ${empleados.map((item) => `<option value="${item.id}">${escapeHtml([item.nombre, item.apellido].filter(Boolean).join(' ') || item.empleado || 'Empleado')}</option>`).join('')}
        </select>
      </label>
      <div class="grid gap-3 sm:grid-cols-2">
        <label class="block text-sm">Fecha <input name="fecha" type="date" required class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900" /></label>
        <label class="block text-sm">Hora <input name="hora" type="time" required class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900" /></label>
      </div>
      <label class="block text-sm">Tipo
        <select name="tipo" required class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900">
          <option value="Entrada">Entrada</option>
          <option value="Salida">Salida</option>
        </select>
      </label>
      <label class="block text-sm">Motivo
        <select name="motivo" required class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900">
          ${OBSERVACION_MOTIVOS.map((item) => `<option value="${item.value}">${escapeHtml(item.label)}</option>`).join('')}
        </select>
      </label>
      <label class="block text-sm">Observación
        <textarea name="detalle" required maxlength="500" class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"></textarea>
      </label>
      <p data-error class="hidden text-sm text-red-600" role="alert"></p>
      <div class="flex justify-end gap-2">
        <button type="button" data-cancel class="${BTN_SECONDARY_CLASS}">Cancelar</button>
        <button type="submit" class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500">Continuar</button>
      </div>
    `
    const modal = openFormModal({ title: 'Registrar fichada manual', content: form })
    const error = form.querySelector('[data-error]')
    form.querySelector('[data-cancel]').addEventListener('click', () => modal.close())
    form.addEventListener('submit', async (event) => {
      event.preventDefault()
      const input = {
        empleadoId: form.empleadoId.value,
        fecha: form.fecha.value,
        hora: form.hora.value,
        tipo: form.tipo.value,
        motivo: form.motivo.value,
        detalle: form.detalle.value.trim(),
      }
      if (!input.detalle) {
        error.textContent = 'La observación es obligatoria.'
        error.classList.remove('hidden')
        return
      }
      const confirmed = await openConfirmModal({
        title: 'Confirmar fichada manual',
        message: `Se registrará ${input.tipo} el ${input.fecha} a las ${input.hora}. El listado se actualiza con la respuesta del servidor.`,
        confirmLabel: 'Registrar',
        danger: false,
      })
      if (!confirmed) return
      try {
        await createFichadaManual(input)
        showToast({ message: 'Fichada manual registrada.', tone: 'success' })
        modal.close({ force: true })
        await onSaved?.()
      } catch (saveError) {
        error.textContent = saveError.message || 'No se pudo registrar la fichada.'
        error.classList.remove('hidden')
      }
    })
  }

  const button = document.createElement('button')
  button.type = 'button'
  button.className = BTN_SECONDARY_CLASS
  button.textContent = 'Registrar fichada manual'
  button.addEventListener('click', () => {
    void openForm()
  })
  if (!puedeRegistrarFichadaManual(getCurrentUser())) return null
  slot.append(button)
  return slot
}
