import { createEmpleado, deactivateEmpleado, getEmpleadoById, getEmpleados, patchEmpleado } from '../api/empleados.js'
import { getCurrentUser } from '../api/auth.js'
import { getEmpresaActual } from '../api/empresas.js'
import {
  createDeactivateConfirm,
  createEmpleadoForm,
  createEmpleadoRecord,
} from '../components/empleado-form.js'
import { createEmpleadosTable, fullName } from '../components/empleados-table.js'
import { createFeedbackState, createLoadingState } from '../components/feedback-state.js'
import { openModal } from '../components/modal.js'
import { uniqueCatalogValues } from '../utils/format.js'

function sessionEmpresaId() {
  const raw = getCurrentUser()?.empresaId
  const empresaId = Number(raw)
  return Number.isFinite(empresaId) && empresaId > 0 ? empresaId : null
}

function matchesSearch(empleado, query) {
  if (!query) return true

  const haystack = [
    empleado.nombre,
    empleado.apellido,
    `${empleado.nombre ?? ''} ${empleado.apellido ?? ''}`,
    empleado.dni,
    empleado.legajo,
  ]
    .join(' ')
    .toLowerCase()

  return haystack.includes(query)
}

function matchesDepartamento(empleado, departamento) {
  if (departamento === 'todos') return true
  if (departamento === '__sin__') return !String(empleado.departamento ?? '').trim()
  return String(empleado.departamento ?? '').trim() === departamento
}

function filterEmpleados(empleados, { query, departamento }) {
  const normalizedQuery = query.trim().toLowerCase()

  return empleados.filter(
    (empleado) =>
      matchesSearch(empleado, normalizedQuery) && matchesDepartamento(empleado, departamento),
  )
}

function catalogsFromEmpleados(empleados) {
  return {
    departamento: uniqueCatalogValues(empleados, 'departamento'),
    categoria: uniqueCatalogValues(empleados, 'categoria'),
    sucursal: uniqueCatalogValues(empleados, 'sucursal'),
  }
}

function empresaDisplayName(empresa, empresaId) {
  if (empresa?.nombreFantasia || empresa?.razonSocial) {
    return empresa.nombreFantasia || empresa.razonSocial
  }
  return empresaId ? `Empresa ${empresaId}` : ''
}

/**
 * PATCH parcial → GET /api/empleados/{id} para la versión definitiva.
 * `patchDto` solo incluye campos que cambiaron (sin id, empresaId, activo ni biometría).
 */
async function persistEmpleadoUpdate(empleadoId, patchDto) {
  await patchEmpleado(empleadoId, patchDto)
  return getEmpleadoById(empleadoId)
}

export async function renderEmpleados(container) {
  const empresaId = sessionEmpresaId()
  const view = document.createElement('div')
  view.className = 'space-y-6'

  view.innerHTML = `
    <section class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 class="text-xl font-semibold tracking-tight text-slate-900">Empleados</h2>
        <p class="mt-1 text-sm text-slate-500">
          Alta, consulta y baja lógica de las personas que registran fichadas. El enrolamiento de huella se realiza desde el agente local.
        </p>
      </div>
      <button
        type="button"
        id="empleados-new"
        class="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        Nuevo empleado
      </button>
    </section>
    <div id="empleados-banner"></div>
    <section class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div class="flex flex-col gap-4 lg:flex-row lg:items-end">
        <div class="min-w-0 flex-1">
          <label for="empleados-search" class="mb-1.5 block text-sm font-medium text-slate-700">Buscar</label>
          <input
            id="empleados-search"
            type="search"
            placeholder="Nombre, apellido, DNI o legajo"
            class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
        <div class="w-full lg:w-64">
          <label for="empleados-departamento" class="mb-1.5 block text-sm font-medium text-slate-700">Departamento</label>
          <select
            id="empleados-departamento"
            class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="todos">Todos</option>
          </select>
        </div>
      </div>
    </section>
    <div id="empleados-results"></div>
  `

  const banner = view.querySelector('#empleados-banner')
  const results = view.querySelector('#empleados-results')
  const searchInput = view.querySelector('#empleados-search')
  const departamentoSelect = view.querySelector('#empleados-departamento')
  const newButton = view.querySelector('#empleados-new')

  let empleados = []
  let loaded = false
  let activeModalClose = null

  function closeActiveModal() {
    activeModalClose?.()
    activeModalClose = null
  }

  function showBanner({ title, message, tone = 'success' }) {
    banner.replaceChildren(
      createFeedbackState({
        title,
        message,
        tone,
      }),
    )
  }

  function clearBanner() {
    banner.replaceChildren()
  }

  function getFilters() {
    return {
      query: searchInput.value,
      departamento: departamentoSelect.value,
    }
  }

  function syncDepartamentoOptions() {
    const current = departamentoSelect.value
    const options = uniqueCatalogValues(empleados, 'departamento')
    const hasSinDepartamento = empleados.some((item) => !String(item.departamento ?? '').trim())

    departamentoSelect.replaceChildren()

    const addOption = (value, label) => {
      const option = document.createElement('option')
      option.value = value
      option.textContent = label
      departamentoSelect.append(option)
    }

    addOption('todos', 'Todos')
    options.forEach((value) => addOption(value, value))
    if (hasSinDepartamento) addOption('__sin__', 'Sin departamento')

    const stillValid = [...departamentoSelect.options].some((option) => option.value === current)
    departamentoSelect.value = stillValid ? current : 'todos'
  }

  function renderResults() {
    if (!loaded) return

    const filtered = filterEmpleados(empleados, getFilters())

    if (empleados.length === 0) {
      results.replaceChildren(
        createFeedbackState({
          title: 'No hay empleados',
          message: 'Todavía no hay empleados activos. Creá el primero con “Nuevo empleado”.',
        }),
      )
      return
    }

    if (filtered.length === 0) {
      results.replaceChildren(
        createFeedbackState({
          title: 'Sin resultados',
          message: 'No hay empleados que coincidan con la búsqueda o el departamento seleccionado.',
        }),
      )
      return
    }

    results.replaceChildren(
      createEmpleadosTable(filtered, {
        onView: openDetail,
        onDeactivate: openDeactivate,
      }),
    )
  }

  async function loadEmpleados({ keepBanner = false } = {}) {
    loaded = false
    if (!keepBanner) clearBanner()
    results.replaceChildren(createLoadingState())

    try {
      empleados = await getEmpleados()
      loaded = true
      syncDepartamentoOptions()
      renderResults()
    } catch (error) {
      loaded = false

      if (error.message === 'Sesión expirada o no autorizada.') {
        return
      }

      results.replaceChildren(
        createFeedbackState({
          title: 'No se pudo cargar la lista',
          message: error.message || 'Ocurrió un error al consultar la API.',
          tone: 'error',
          actionLabel: 'Reintentar',
          onAction: () => loadEmpleados(),
        }),
      )
    }
  }

  function openCreateForm() {
    if (!empresaId) {
      showBanner({
        title: 'No se puede crear el empleado',
        message: 'La sesión no tiene una empresa válida. Volvé a iniciar sesión o contactá al administrador.',
        tone: 'error',
      })
      return
    }

    const form = createEmpleadoForm({
      empresaId,
      catalogs: catalogsFromEmpleados(empleados),
      onCancel: () => closeActiveModal(),
      onSubmit: async (dto) => {
        await createEmpleado(dto)
        closeActiveModal()
        showBanner({
          title: 'Empleado creado',
          message: 'El alta se registró correctamente. El enrolamiento de huella se hace desde el agente local.',
        })
        await loadEmpleados({ keepBanner: true })
      },
    })

    const modal = openModal({
      title: 'Nuevo empleado',
      content: form,
      labelledBy: 'empleado-create-title',
      onClose: () => {
        activeModalClose = null
      },
    })
    activeModalClose = modal.close
  }

  async function openDetail(empleado) {
    const loading = document.createElement('p')
    loading.className = 'text-sm text-slate-500'
    loading.textContent = 'Cargando empleado...'

    const modal = openModal({
      title: fullName(empleado) || 'Empleado',
      content: loading,
      labelledBy: 'empleado-detail-title',
      onClose: () => {
        activeModalClose = null
      },
    })
    activeModalClose = modal.close

    try {
      const [detail, empresa] = await Promise.all([getEmpleadoById(empleado.id), getEmpresaActual()])
      loading.replaceWith(
        createEmpleadoRecord({
          empleado: detail,
          empresaLabel: empresaDisplayName(empresa, detail.empresaId),
          catalogs: catalogsFromEmpleados(empleados),
          persistUpdate: persistEmpleadoUpdate,
          onUpdated: (updated) => {
            empleados = empleados.map((item) => (Number(item.id) === Number(updated.id) ? { ...item, ...updated } : item))
            syncDepartamentoOptions()
            renderResults()
            showBanner({
              title: 'Empleado actualizado correctamente',
              message: 'Los datos se refrescaron desde la API.',
            })
          },
        }),
      )
    } catch (error) {
      if (error.message === 'Sesión expirada o no autorizada.') {
        closeActiveModal()
        return
      }

      loading.replaceWith(
        createFeedbackState({
          title: 'No se pudo cargar el detalle',
          message: error.message || 'Ocurrió un error al consultar el empleado.',
          tone: 'error',
        }),
      )
    }
  }

  function openDeactivate(empleado) {
    const confirm = createDeactivateConfirm({
      empleado,
      onCancel: () => closeActiveModal(),
      onConfirm: async () => {
        await deactivateEmpleado(empleado.id)
        empleados = empleados.filter((item) => Number(item.id) !== Number(empleado.id))
        closeActiveModal()
        syncDepartamentoOptions()
        renderResults()
        showBanner({
          title: 'Empleado desactivado',
          message: `${fullName(empleado) || 'El empleado'} ya no figura en el listado de activos.`,
        })
      },
    })

    const modal = openModal({
      title: 'Desactivar empleado',
      content: confirm,
      labelledBy: 'empleado-deactivate-title',
      onClose: () => {
        activeModalClose = null
      },
    })
    activeModalClose = modal.close
  }

  if (!empresaId) {
    newButton.disabled = true
    banner.replaceChildren(
      createFeedbackState({
        title: 'Empresa no disponible',
        message:
          'La sesión no incluye una empresa válida. El listado puede consultarse, pero el alta queda bloqueada hasta que el token tenga empresa_id.',
        tone: 'error',
      }),
    )
  }

  newButton.addEventListener('click', openCreateForm)
  searchInput.addEventListener('input', renderResults)
  departamentoSelect.addEventListener('change', renderResults)

  container.replaceChildren(view)
  await loadEmpleados({ keepBanner: !empresaId })
}
