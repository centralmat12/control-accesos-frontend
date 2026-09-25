import {
  createDepartamento,
  deleteDepartamento,
  getDepartamentosBySucursal,
  updateDepartamento,
  validateDepartamentoNombre,
  DEPARTAMENTO_NOMBRE_MAX,
} from '../api/departamentos.js'
import {
  ADMIN_CARD_CLASS,
  ADMIN_CARD_DESCRIPTION_CLASS,
  ADMIN_CARD_HEADER_CLASS,
  ADMIN_CARD_META_CLASS,
  ADMIN_CARD_TITLE_CLASS,
  ADMIN_FIELD_CONTROL_CLASS,
  ADMIN_SECTION_GAP_CLASS,
  ADMIN_TABLE_HEADER_CELL_CLASS,
  ADMIN_TABLE_ROW_CLASS,
  ADMIN_TABLE_SHELL_CLASS,
} from './admin-panel-layout.js'
import { BTN_DANGER_CLASS, BTN_SECONDARY_CLASS } from './button-styles.js'
import { createDepartamentoForm } from './departamento-form.js'
import { fieldIds, FORM_HELP_CLASS, FORM_INPUT_CLASS, FORM_LABEL_CLASS, formFieldMarkup, validateRequiredText, wireFormFields } from './form-field.js'
import { iconPencil, iconPlus, iconTrash } from './icons.js'
import { openFormModal, openModal } from './modal.js'
import { showToast } from './toast.js'
import { escapeHtml } from '../utils/format.js'

const PRIMARY_BTN_CLASS =
  'inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60'
const ACTION_EDIT_CLASS = `${BTN_SECONDARY_CLASS} h-8 gap-1.5 whitespace-nowrap px-2.5! py-1! text-sm`
const ACTION_DELETE_CLASS = `${BTN_DANGER_CLASS} h-8 gap-1.5 whitespace-nowrap px-2.5! py-1! text-sm`

export const MENSAJE_ELIMINACION_TITULO = 'No se puede eliminar el departamento'

export const MENSAJE_ELIMINACION_ASIGNADOS =
  'No se puede eliminar el departamento porque tiene empleados asignados. Reasigná esos empleados antes de eliminarlo.'

export const MENSAJE_ELIMINACION_GENERICO = 'No se pudo eliminar el departamento. Intentá nuevamente.'

export function mensajeConfirmacionEliminar(nombre, sucursal = '') {
  const lugar = sucursal ? ` de “${sucursal}”` : ''
  return `¿Querés eliminar “${nombre}”${lugar}?\n\nEsta acción no se puede deshacer.`
}

export function asignadosLabel(cantidad) {
  return Number.isInteger(cantidad) ? String(cantidad) : '—'
}

export function tooltipEliminarBloqueado(cantidad) {
  return `No se puede eliminar: tiene ${cantidad} empleados asignados.`
}

export function mensajeRechazoEliminacion(apiMessage) {
  const text = String(apiMessage ?? '').replace(/\s+/g, ' ').trim()
  if (!text || /^bad request$/i.test(text)) return MENSAJE_ELIMINACION_ASIGNADOS
  if (text === 'Este departamento tiene empleados asignados. Reasignalos a otro departamento antes de eliminarlo.') {
    return MENSAJE_ELIMINACION_ASIGNADOS
  }
  return text
}

function sucursalNombre(item, sucursales) {
  const fromItem = String(item?.sucursalNombre ?? '').trim()
  if (fromItem) return fromItem
  const match = (sucursales ?? []).find((sucursal) => Number(sucursal.id) === Number(item?.sucursalId))
  return String(match?.nombre ?? '').trim() || `Sucursal ${item?.sucursalId ?? ''}`
}

export function createDepartamentosAdmin({
  sucursalId,
  sucursales = [],
  empresaId,
  onChanged,
  addLabel = 'Agregar departamento',
  heading = null,
} = {}) {
  const disponibles = (sucursales ?? []).filter((item) => Number(item?.id) > 0)
  let currentSucursalId = Number(sucursalId) || Number(disponibles[0]?.id) || null
  const root = document.createElement('div')
  root.className = heading
    ? `${ADMIN_CARD_CLASS} max-w-[880px]`
    : 'flex min-h-0 flex-1 flex-col gap-4'
  const listHost = document.createElement('div')
  const addButton = document.createElement('button')
  addButton.type = 'button'
  addButton.className =
    'inline-flex h-10 w-auto grow-0 shrink-0 items-center justify-center self-end gap-2 whitespace-nowrap rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60'
  addButton.innerHTML = `${iconPlus('h-4 w-4')}<span>${escapeHtml(addLabel)}</span>`
  addButton.addEventListener('click', () => openAlta())

  let items = []
  let disposed = false
  let busy = false

  function syncAddButton() {
    addButton.disabled = busy || !currentSucursalId
  }

  function renderContext() {
    const toolbar = document.createElement('div')
    toolbar.className = `${heading ? ADMIN_SECTION_GAP_CLASS : ''} grid w-full grid-cols-[minmax(0,320px)_max-content] items-end gap-2`
    const field = document.createElement('div')
    field.className = 'w-full min-w-0'
    field.innerHTML = `
      <label for="departamentos-admin-sucursal" class="${FORM_LABEL_CLASS}">Sucursal</label>
      <select id="departamentos-admin-sucursal" class="${FORM_INPUT_CLASS} ${ADMIN_FIELD_CONTROL_CLASS}"></select>
    `
    const select = field.querySelector('select')
    if (!disponibles.length) {
      const option = document.createElement('option')
      option.value = ''
      option.textContent = 'Sin sucursal'
      select.append(option)
      select.disabled = true
      currentSucursalId = null
    } else {
      for (const sucursal of disponibles) {
        const option = document.createElement('option')
        option.value = String(sucursal.id)
        option.textContent = String(sucursal.nombre ?? `Sucursal ${sucursal.id}`)
        option.selected = Number(sucursal.id) === Number(currentSucursalId)
        select.append(option)
      }
      if (!currentSucursalId) currentSucursalId = Number(select.value) || null
      select.addEventListener('change', () => {
        currentSucursalId = Number(select.value) || null
        syncAddButton()
        load()
      })
    }
    toolbar.append(field, addButton)
    if (heading) {
      const intro = document.createElement('div')
      intro.className = ADMIN_CARD_HEADER_CLASS
      intro.innerHTML = `
        <div>
          <h2 class="${ADMIN_CARD_TITLE_CLASS}">${escapeHtml(heading.title)}</h2>
          <p class="${ADMIN_CARD_DESCRIPTION_CLASS}">${escapeHtml(heading.description)}</p>
        </div>
        <p data-dept-count class="${ADMIN_CARD_META_CLASS}"></p>
      `
      root.append(intro)
    }
    root.append(toolbar, listHost)
    syncAddButton()
  }

  function setBusy(next) {
    busy = next
    root.querySelectorAll('button').forEach((button) => {
      if (button === addButton || button.dataset.allowDuringBusy === 'true') return
      button.disabled = next || button.dataset.blocked === 'true'
    })
    syncAddButton()
  }

  async function load() {
    listHost.innerHTML = `<p class="text-sm text-slate-500" role="status">Cargando departamentos…</p>`
    try {
      items = await getDepartamentosBySucursal(currentSucursalId)
      if (disposed) return
      renderList()
    } catch (error) {
      if (disposed) return
      console.error(error)
      listHost.innerHTML = `
        <div data-error-scope="list" class="rounded-lg border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-800" role="alert">
          <p>No se pudieron cargar los departamentos.</p>
          <button type="button" data-action="retry-load" class="mt-3 inline-flex h-9 items-center rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-500">Reintentar</button>
        </div>
      `
      listHost.querySelector('[data-action="retry-load"]')?.addEventListener('click', () => {
        load()
      })
    }
  }

  function renderList() {
    if (!items.length) {
      const count = root.querySelector('[data-dept-count]')
      if (count) count.textContent = '0 departamentos'
      listHost.innerHTML = `
        <div class="rounded-lg border border-slate-200 bg-slate-50 px-4 py-6 text-center dark:border-slate-700 dark:bg-slate-800/60" role="status">
          <p class="text-sm text-slate-700 dark:text-slate-200">No hay departamentos registrados para esta sucursal.</p>
          <p class="mt-1 text-sm text-slate-500">Creá el primero para poder asignarlo a los empleados.</p>
          <button type="button" data-action="empty-add" class="${PRIMARY_BTN_CLASS} mt-4">+ ${escapeHtml(addLabel)}</button>
        </div>
      `
      listHost.querySelector('[data-action="empty-add"]').addEventListener('click', () => openAlta())
      return
    }

    const count = root.querySelector('[data-dept-count]')
    if (count) count.textContent = `${items.length} departamento${items.length === 1 ? '' : 's'}`
    const rows = items.map((item) => rowMarkup(item)).join('')
    listHost.innerHTML = `
      <div class="${heading ? ADMIN_TABLE_SHELL_CLASS : ''} dept-admin-scroll max-h-[min(22rem,calc(100dvh-16rem))] overflow-x-hidden overflow-y-auto">
        <div class="grid grid-cols-1 text-left sm:grid-cols-[minmax(220px,1fr)_180px_auto]">
          <div class="${ADMIN_TABLE_HEADER_CELL_CLASS}">Departamento</div>
          <div class="${ADMIN_TABLE_HEADER_CELL_CLASS}">Sucursal</div>
          <div class="${ADMIN_TABLE_HEADER_CELL_CLASS} justify-end">Acciones</div>
          ${rows}
        </div>
      </div>
    `
    bindRowActions(listHost)
  }

  function rowMarkup(item) {
    return `<div class="${ADMIN_TABLE_ROW_CLASS} sm:col-span-3 sm:grid-cols-subgrid sm:h-[50px] sm:gap-0 sm:py-0" data-departamento-id="${item.id}">
      <div class="min-w-0 text-sm font-semibold text-slate-900 dark:text-slate-100">${escapeHtml(item.nombre)}</div>
      <div class="min-w-0 text-sm text-slate-600 dark:text-slate-300">${escapeHtml(sucursalNombre(item, disponibles))}</div>
      <div class="flex justify-end">${actionsMarkup(item, 'nowrap')}</div>
    </div>`
  }

  function actionsMarkup(item, layout) {
    const rowClass = layout === 'wrap' ? 'flex flex-wrap items-center gap-2' : 'inline-flex flex-nowrap items-center gap-2'
    const blocked = Number.isInteger(item.cantidadEmpleados) && item.cantidadEmpleados > 0
    const reason = blocked ? tooltipEliminarBloqueado(item.cantidadEmpleados) : ''
    const reasonId = `dept-delete-reason-${item.id}-${layout}`
    return `<div class="${rowClass}">
      <button type="button" data-action="edit" class="${ACTION_EDIT_CLASS}" aria-label="Editar">${iconPencil()}<span>Editar</span></button>
      <button type="button" data-action="delete" class="${ACTION_DELETE_CLASS} disabled:cursor-not-allowed disabled:opacity-50" aria-label="Eliminar" ${blocked ? 'disabled data-blocked="true"' : ''} ${reason ? `title="${escapeHtml(reason)}" aria-describedby="${reasonId}"` : ''}>${iconTrash()}<span>Eliminar</span></button>
      ${reason ? `<span id="${reasonId}" class="sr-only">${escapeHtml(reason)}</span>` : ''}
    </div>`
  }

  function bindRowActions(host) {
    host.querySelectorAll('[data-action="edit"]').forEach((button) => {
      button.addEventListener('click', () => {
        const item = findItem(button)
        if (item) openEdit(item)
      })
    })
    host.querySelectorAll('[data-action="delete"]').forEach((button) => {
      button.addEventListener('click', () => {
        const item = findItem(button)
        if (item) requestDelete(item)
      })
    })
  }

  function findItem(button) {
    const id = Number(button.closest('[data-departamento-id]')?.dataset.departamentoId)
    return items.find((entry) => entry.id === id)
  }

  function openAlta() {
    if (busy || !currentSucursalId) return
    const formEl = createDepartamentoForm({
      sucursales: disponibles,
      sucursalId: currentSucursalId,
      onCancel: () => closeAlta?.(),
      onSubmit: async (dto) => {
        const created = await createDepartamento({ ...dto, empresaId })
        closeAlta?.({ force: true })
        await onChanged?.({ type: 'create', departamento: created })
        if (Number(created.sucursalId) !== Number(currentSucursalId)) {
          currentSucursalId = Number(created.sucursalId)
          const select = root.querySelector('#departamentos-admin-sucursal')
          if (select) select.value = String(currentSucursalId)
        }
        await load()
        showToast({ message: 'Departamento creado.', tone: 'success' })
      },
    })
    let closeAlta = null
    const modal = openFormModal({
      title: 'Agregar departamento',
      content: formEl,
      labelledBy: 'departamento-create-title',
      stacked: true,
      dialogClass: 'max-w-md',
    })
    closeAlta = modal.close
  }

  function openEdit(item) {
    if (busy) return
    const nombreIds = fieldIds('departamento-edit-nombre')
    const panel = document.createElement('form')
    panel.className = 'space-y-3'
    panel.noValidate = true
    const sucursal = sucursalNombre({ sucursalId: item.sucursalId, sucursalNombre: item.sucursalNombre }, disponibles)
    panel.innerHTML = `
      <p id="departamento-edit-error" class="hidden rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert"></p>
      <div>
        <p class="${FORM_LABEL_CLASS}">Sucursal</p>
        <p class="text-sm text-slate-700 dark:text-slate-200">${escapeHtml(sucursal)}</p>
        <p class="${FORM_HELP_CLASS}">La sucursal no se modifica.</p>
      </div>
      ${formFieldMarkup({
        id: 'departamento-edit-nombre',
        name: 'nombre',
        label: 'Nombre del departamento',
        required: true,
        maxLength: DEPARTAMENTO_NOMBRE_MAX,
        value: item.nombre,
      })}
      <div class="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
        <button type="button" data-action="cancel" class="${BTN_SECONDARY_CLASS} h-11">Cancelar</button>
        <button type="submit" class="${PRIMARY_BTN_CLASS} h-11">Guardar nombre</button>
      </div>
    `
    const fields = wireFormFields(panel, [
      {
        name: 'nombre',
        helpId: nombreIds.helpId,
        errorId: nombreIds.errorId,
        normalizeOnBlur: (value) => String(value ?? '').trim(),
        getError: () =>
          validateRequiredText(
            panel.querySelector('[name="nombre"]').value,
            'Ingresá el nombre del departamento.',
            DEPARTAMENTO_NOMBRE_MAX,
            `El nombre no puede superar ${DEPARTAMENTO_NOMBRE_MAX} caracteres.`,
          ),
      },
    ])
    const input = panel.querySelector('[name="nombre"]')
    const errorEl = panel.querySelector('#departamento-edit-error')
    errorEl.textContent = ''
    errorEl.classList.add('hidden')
    const submit = panel.querySelector('[type="submit"]')
    let closeEdit = null

    panel.querySelector('[data-action="cancel"]').addEventListener('click', () => closeEdit?.())
    panel.addEventListener('submit', async (event) => {
      event.preventDefault()
      if (panel.dataset.submitting === 'true') return
      const result = fields.validateAll()
      const message = validateDepartamentoNombre(input.value)
      if (result.hasErrors || message) {
        errorEl.textContent = message || 'Revisá el nombre del departamento.'
        errorEl.classList.remove('hidden')
        result.firstInvalid?.focus()
        return
      }
      panel.dataset.submitting = 'true'
      submit.disabled = true
      submit.textContent = 'Guardando...'
      errorEl.classList.add('hidden')
      try {
        const updated = await updateDepartamento({
          id: item.id,
          nombre: input.value,
          sucursalId: item.sucursalId,
          empresaId,
        })
        closeEdit?.({ force: true })
        await onChanged?.({ type: 'update', departamento: { ...item, ...updated } })
        await load()
        showToast({ message: 'Departamento actualizado correctamente.', tone: 'success' })
      } catch (error) {
        errorEl.textContent = error.message || 'No se pudo editar el departamento.'
        errorEl.classList.remove('hidden')
        delete panel.dataset.submitting
        submit.disabled = false
        submit.textContent = 'Guardar nombre'
      }
    })

    const modal = openFormModal({
      title: 'Editar departamento',
      content: panel,
      labelledBy: 'departamento-edit-title',
      stacked: true,
      dialogClass: 'max-w-md',
    })
    closeEdit = modal.close
    queueMicrotask(() => input?.focus())
  }

  function requestDelete(item) {
    if (busy) return

    let deleteError = ''
    const content = document.createElement('div')
    content.dataset.errorScope = 'delete'
    const text = document.createElement('p')
    text.className = 'whitespace-pre-line text-sm text-slate-600 dark:text-slate-300'
    text.textContent = mensajeConfirmacionEliminar(item.nombre, sucursalNombre(item, disponibles))
    const alert = document.createElement('p')
    alert.dataset.deleteError = 'true'
    alert.className = 'mt-3 hidden whitespace-pre-line rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800'
    alert.setAttribute('role', 'alert')
    const row = document.createElement('div')
    row.className = 'mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end'
    content.append(text, alert, row)

    const clearDeleteError = () => {
      deleteError = ''
      alert.textContent = ''
      alert.classList.add('hidden')
    }

    let closeNotice = null
    const modal = openModal({
      title: 'Eliminar departamento',
      content,
      labelledBy: 'departamento-delete-title',
      stacked: true,
      dialogClass: 'max-w-md',
      closeOnBackdrop: false,
      onClose: () => clearDeleteError(),
    })
    closeNotice = modal.close

    const cancel = document.createElement('button')
    cancel.type = 'button'
    cancel.className = BTN_SECONDARY_CLASS
    cancel.textContent = 'Cancelar'
    cancel.addEventListener('click', () => closeNotice())

    const confirm = document.createElement('button')
    confirm.type = 'button'
    confirm.className = BTN_DANGER_CLASS
    confirm.textContent = 'Eliminar departamento'
    confirm.addEventListener('click', async () => {
      if (root.dataset.deleting === 'true') return
      root.dataset.deleting = 'true'
      setBusy(true)
      confirm.disabled = true
      confirm.textContent = 'Eliminando...'
      clearDeleteError()
      try {
        await deleteDepartamento({ id: item.id, empresaId })
        closeNotice({ force: true })
        await onChanged?.({ type: 'delete', departamentoId: item.id })
        await load()
        showToast({ message: 'Departamento eliminado correctamente.', tone: 'success' })
      } catch (error) {
        if (error.status === 401 || error.code === 'UNAUTHORIZED') return
        if (error.status === 409) {
          deleteError = mensajeRechazoEliminacion(error.message)
          const heading = modal.dialog.querySelector('#departamento-delete-title')
          if (heading) heading.textContent = MENSAJE_ELIMINACION_TITULO
          text.textContent = deleteError
          alert.textContent = ''
          alert.classList.add('hidden')
          row.replaceChildren()
          const understood = document.createElement('button')
          understood.type = 'button'
          understood.className = BTN_SECONDARY_CLASS
          understood.textContent = 'Entendido'
          understood.addEventListener('click', () => closeNotice({ force: true }))
          row.append(understood)
          await load()
          return
        }
        const raw = String(error.message ?? '').trim()
        deleteError = raw && !/^bad request$/i.test(raw) ? raw : MENSAJE_ELIMINACION_GENERICO
        alert.textContent = deleteError
        alert.classList.remove('hidden')
        if (confirm.isConnected) {
          confirm.disabled = false
          confirm.textContent = 'Eliminar departamento'
        }
      } finally {
        delete root.dataset.deleting
        setBusy(false)
      }
    })
    row.append(cancel, confirm)
  }

  renderContext()
  load()
  return {
    element: root,
    reload: load,
    dispose() {
      disposed = true
    },
  }
}
