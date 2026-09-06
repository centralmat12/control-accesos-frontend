import { createEmpleado, deactivateEmpleado, getEmpleadoById, getEmpleados, patchEmpleado } from '../api/empleados.js'
import { getCurrentUser } from '../api/auth.js'
import { canLoadTenantData, getOperativeEmpresaId } from '../api/empresa-context.js'
import { empresaDisplayName, getEmpresaActual } from '../api/empresas.js'
import { isSuperadmin } from '../config/roles.js'
import {
  createDeactivateConfirm,
  createEmpleadoForm,
  createEmpleadoRecord,
} from '../components/empleado-form.js'
import { createEmpleadosTable, fullName } from '../components/empleados-table.js'
import { createFeedbackState, createSelectEmpresaState } from '../components/feedback-state.js'
import { createPagination } from '../components/pagination.js'
import { openModal } from '../components/modal.js'
import { createDetailSkeleton, createTableSkeleton } from '../components/skeleton.js'
import { showToast } from '../components/toast.js'
import { filterEmpleados, sortEmpleados } from '../utils/empleado-list.js'
import { summarizeEmpleadoDatos } from '../utils/empleado-alerts.js'
import { uniqueCatalogValues } from '../utils/format.js'
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS, paginateItems } from '../utils/paginate.js'

const CONTROL_CLASS =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'

function sessionEmpresaId() {
  return getOperativeEmpresaId(getCurrentUser())
}

function catalogsFromEmpleados(empleados) {
  return {
    departamento: uniqueCatalogValues(empleados, 'departamento'),
    categoria: uniqueCatalogValues(empleados, 'categoria'),
    sucursal: uniqueCatalogValues(empleados, 'sucursal'),
  }
}

function fillCatalogSelect(select, values, allLabel, current) {
  select.replaceChildren()

  const addOption = (value, label) => {
    const option = document.createElement('option')
    option.value = value
    option.textContent = label
    select.append(option)
  }

  addOption('todos', allLabel)
  values.forEach((value) => addOption(value, value))

  const stillValid = [...select.options].some((option) => option.value === current)
  select.value = stillValid ? current : 'todos'
}

/**
 * PATCH parcial → GET /api/empleados/{id} para la versión definitiva.
 * `patchDto` solo incluye campos que cambiaron (sin id, empresaId, activo ni biometría).
 */
async function persistEmpleadoUpdate(empleadoId, patchDto) {
  await patchEmpleado(empleadoId, patchDto)
  return getEmpleadoById(empleadoId)
}

export async function renderEmpleados(container, { initialQuery } = {}) {
  const user = getCurrentUser()
  const empresaId = sessionEmpresaId()

  if (isSuperadmin(user) && !canLoadTenantData(user)) {
    const view = document.createElement('div')
    view.className = 'space-y-6'
    view.innerHTML = `
      <section>
        <h2 class="text-xl font-semibold tracking-tight text-slate-900">Empleados</h2>
        <p class="mt-1 text-sm text-slate-500">
          Alta, consulta y baja lógica de las personas que registran fichadas. El enrolamiento de huella se realiza desde el agente local.
        </p>
      </section>
    `
    view.append(createSelectEmpresaState())
    container.replaceChildren(view)
    return
  }

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
    <div id="empleados-summary" class="grid gap-3 sm:grid-cols-3"></div>
    <section class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 xl:items-end">
        <div class="min-w-0 sm:col-span-2">
          <label for="empleados-search" class="mb-1.5 block text-sm font-medium text-slate-700">Buscar</label>
          <input
            id="empleados-search"
            type="search"
            placeholder="Nombre, apellido, DNI o legajo"
            class="${CONTROL_CLASS}"
          />
        </div>
        <div class="min-w-0">
          <label for="empleados-departamento" class="mb-1.5 block text-sm font-medium text-slate-700">Departamento</label>
          <select id="empleados-departamento" class="${CONTROL_CLASS}">
            <option value="todos">Todos</option>
          </select>
        </div>
        <div class="min-w-0">
          <label for="empleados-sucursal" class="mb-1.5 block text-sm font-medium text-slate-700">Sucursal</label>
          <select id="empleados-sucursal" class="${CONTROL_CLASS}">
            <option value="todos">Todas</option>
          </select>
        </div>
        <div class="min-w-0 sm:col-span-2 xl:col-span-1">
          <label for="empleados-estado" class="mb-1.5 block text-sm font-medium text-slate-700">Estado de datos</label>
          <select id="empleados-estado" class="${CONTROL_CLASS}">
            <option value="todos">Todos</option>
            <option value="completo">Completo</option>
            <option value="pendientes">Con pendientes</option>
          </select>
        </div>
      </div>
    </section>
    <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-4">
      <label for="empleados-page-size" class="flex items-center gap-2 text-sm text-slate-600">
        <span>Mostrar</span>
        <select id="empleados-page-size" class="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20">
          ${PAGE_SIZE_OPTIONS.map((size) => `<option value="${size}" ${size === DEFAULT_PAGE_SIZE ? 'selected' : ''}>${size}</option>`).join('')}
        </select>
      </label>
      <p id="empleados-count" class="text-sm text-slate-500"></p>
    </div>
    <div id="empleados-results"></div>
    <div id="empleados-pagination"></div>
  `

  const banner = view.querySelector('#empleados-banner')
  const summary = view.querySelector('#empleados-summary')
  const results = view.querySelector('#empleados-results')
  const paginationContainer = view.querySelector('#empleados-pagination')
  const countLabel = view.querySelector('#empleados-count')
  const searchInput = view.querySelector('#empleados-search')
  const departamentoSelect = view.querySelector('#empleados-departamento')
  const sucursalSelect = view.querySelector('#empleados-sucursal')
  const estadoSelect = view.querySelector('#empleados-estado')
  const pageSizeSelect = view.querySelector('#empleados-page-size')
  const newButton = view.querySelector('#empleados-new')

  let empleados = []
  let loaded = false
  let loadError = false
  let currentPage = 1
  let pageSize = DEFAULT_PAGE_SIZE
  let sortKey = 'nombre'
  let sortDir = 'asc'
  let highlightId = null
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
      sucursal: sucursalSelect.value,
      estado: estadoSelect.value,
    }
  }

  function resetPage() {
    currentPage = 1
  }

  function renderSummary() {
    if (!loaded || loadError) {
      summary.replaceChildren()
      return
    }

    const stats = summarizeEmpleadoDatos(empleados)
    summary.innerHTML = `
      <article class="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <p class="text-sm font-medium text-slate-500">Empleados activos</p>
        <p class="mt-1 text-2xl font-semibold tracking-tight text-slate-900">${stats.activos}</p>
      </article>
      <article class="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <p class="text-sm font-medium text-slate-500">Completos</p>
        <p class="mt-1 text-2xl font-semibold tracking-tight text-slate-900">${stats.completos}</p>
      </article>
      <article class="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <p class="text-sm font-medium text-slate-500">Con pendientes</p>
        <p class="mt-1 text-2xl font-semibold tracking-tight text-slate-900">${stats.conPendientes}</p>
      </article>
    `
  }

  function syncFilterOptions() {
    fillCatalogSelect(departamentoSelect, uniqueCatalogValues(empleados, 'departamento'), 'Todos', departamentoSelect.value)
    fillCatalogSelect(sucursalSelect, uniqueCatalogValues(empleados, 'sucursal'), 'Todas', sucursalSelect.value)
  }

  function visibleEmpleados() {
    const filtered = filterEmpleados(empleados, getFilters())
    return sortEmpleados(filtered, sortKey, sortDir)
  }

  function renderResults() {
    paginationContainer.replaceChildren()
    countLabel.textContent = ''

    if (!loaded) return

    const sorted = visibleEmpleados()
    const paged = paginateItems(sorted, currentPage, pageSize)
    currentPage = paged.page

    if (empleados.length === 0) {
      results.replaceChildren(
        createFeedbackState({
          title: 'No hay empleados',
          message: 'Todavía no hay empleados activos. Creá el primero con “Nuevo empleado”.',
        }),
      )
      return
    }

    if (sorted.length === 0) {
      results.replaceChildren(
        createFeedbackState({
          title: 'Sin resultados',
          message: 'No hay empleados que coincidan con la búsqueda o los filtros seleccionados.',
        }),
      )
      return
    }

    countLabel.textContent = `Mostrando ${paged.from}–${paged.to} de ${paged.total} empleados`
    results.replaceChildren(
      createEmpleadosTable(paged.items, {
        sortKey,
        sortDir,
        highlightId,
        onSort: (key) => {
          if (sortKey === key) {
            sortDir = sortDir === 'asc' ? 'desc' : 'asc'
          } else {
            sortKey = key
            sortDir = 'asc'
          }
          resetPage()
          renderResults()
        },
        onView: openDetail,
        onDeactivate: openDeactivate,
      }),
    )

    if (paged.pageCount > 1) {
      paginationContainer.replaceChildren(
        createPagination({
          page: paged.page,
          pageCount: paged.pageCount,
          onPageChange: (nextPage) => {
            currentPage = nextPage
            renderResults()
          },
        }),
      )
    }
  }

  async function loadEmpleados({ keepBanner = false } = {}) {
    loaded = false
    loadError = false
    summary.replaceChildren()
    paginationContainer.replaceChildren()
    countLabel.textContent = ''
    if (!keepBanner) clearBanner()
    results.replaceChildren(
      createTableSkeleton({ rows: 8, columns: 6, label: 'Cargando empleados' }),
    )

    try {
      empleados = await getEmpleados()
      loaded = true
      loadError = false
      syncFilterOptions()
      renderSummary()
      renderResults()
    } catch (error) {
      loaded = false
      loadError = true
      empleados = []
      summary.replaceChildren()
      paginationContainer.replaceChildren()
      countLabel.textContent = ''

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
    const currentEmpresaId = sessionEmpresaId()
    if (!currentEmpresaId) {
      showBanner({
        title: 'No se puede crear el empleado',
        message: 'La sesión no tiene una empresa válida. Volvé a iniciar sesión o contactá al administrador.',
        tone: 'error',
      })
      return
    }

    const form = createEmpleadoForm({
      empresaId: currentEmpresaId,
      catalogs: catalogsFromEmpleados(empleados),
      onCancel: () => closeActiveModal(),
      onSubmit: async (dto) => {
        await createEmpleado(dto)
        closeActiveModal()
        showToast({ message: 'Empleado creado correctamente.', tone: 'success' })
        await loadEmpleados()
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
    const loading = createDetailSkeleton()

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
            syncFilterOptions()
            renderSummary()
            renderResults()
            showToast({ message: 'Cambios guardados.', tone: 'success' })
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
        syncFilterOptions()
        renderSummary()
        renderResults()
        showToast({ message: 'Empleado desactivado.', tone: 'success' })
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

  if (!empresaId && !isSuperadmin(user)) {
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

  if (initialQuery) {
    searchInput.value = initialQuery
    departamentoSelect.value = 'todos'
    sucursalSelect.value = 'todos'
    estadoSelect.value = 'todos'
    resetPage()
  }

  function onFilterChange() {
    highlightId = null
    resetPage()
    renderResults()
  }

  newButton.addEventListener('click', openCreateForm)
  searchInput.addEventListener('input', onFilterChange)
  departamentoSelect.addEventListener('change', onFilterChange)
  sucursalSelect.addEventListener('change', onFilterChange)
  estadoSelect.addEventListener('change', onFilterChange)
  pageSizeSelect.addEventListener('change', () => {
    pageSize = Number(pageSizeSelect.value) || DEFAULT_PAGE_SIZE
    resetPage()
    renderResults()
  })

  container.replaceChildren(view)
  await loadEmpleados({ keepBanner: Boolean(!empresaId && !isSuperadmin(user)) })

  if (initialQuery && loaded) {
    const hinted = visibleEmpleados()[0]
    highlightId = hinted?.id ?? null
    if (highlightId) renderResults()
  }
}
