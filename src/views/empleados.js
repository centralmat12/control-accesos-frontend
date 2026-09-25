import {
  createEmpleado,
  deactivateEmpleado,
  getEmpleadoById,
  getEmpleados,
  patchEmpleado,
  reactivateEmpleado,
} from '../api/empleados.js'
import { getCurrentUser } from '../api/auth.js'
import { canLoadTenantData, getOperativeEmpresaId } from '../api/empresa-context.js'
import { empresaDisplayName, getEmpresaActual } from '../api/empresas.js'
import { filterDepartamentosForSucursalSelection, getDepartamentos, notifyDepartamentosLoadError } from '../api/departamentos.js'
import { getSucursales } from '../api/sucursales.js'
import { pageHeadingMarkup } from '../components/page-heading.js'
import { isSuperadmin } from '../config/roles.js'
import {
  createDeactivateConfirm,
  createEmpleadoForm,
  createEmpleadoRecord,
  createReactivateConfirm,
} from '../components/empleado-form.js'
import { createEmpleadosTable, fullName } from '../components/empleados-table.js'
import { createFeedbackState, createSelectEmpresaState } from '../components/feedback-state.js'
import { createPagination } from '../components/pagination.js'
import { BTN_SECONDARY_CLASS } from '../components/button-styles.js'
import { FORM_INPUT_CLASS } from '../components/form-field.js'
import { openFormModal, openModal } from '../components/modal.js'
import { refreshEnhancedSelect } from '../components/dropdown.js'
import { createDetailSkeleton, createTableSkeleton } from '../components/skeleton.js'
import { DEPARTAMENTO_ALL, fillDepartamentoOptions, parseEntityId, setDepartamentoIdle } from '../components/sucursal-departamento-selects.js'
import { createSucursalMultiSelect } from '../components/sucursal-multi-select.js'
import { showToast } from '../components/toast.js'
import { empleadosFiltersArePristine, filterEmpleados, sortEmpleados } from '../utils/empleado-list.js'
import { empleadoPerteneceAEmpresaActiva, summarizeEmpleadoDatos } from '../utils/empleado-alerts.js'
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS, paginateItems } from '../utils/paginate.js'

const CONTROL_CLASS = `h-11 min-w-0 max-w-full ${FORM_INPUT_CLASS}`

const FILTER_FIELD_CLASS = 'flex min-w-0 w-full flex-col'
const FILTER_LABEL_CLASS = 'mb-1.5 block text-sm font-medium text-slate-700'
const FILTERS_GRID_CLASS =
  'grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-[minmax(0,1.6fr)_repeat(4,minmax(0,1fr))_auto]'

function sessionEmpresaId() {
  return getOperativeEmpresaId(getCurrentUser())
}

function parsePositiveId(value) {
  const id = Number(value)
  return Number.isFinite(id) && id > 0 ? id : null
}

/**
 * PATCH parcial → GET /api/empleados/{id} para la versión definitiva.
 * `patchDto` solo incluye campos que cambiaron (sin id, empresaId, activo ni biometría).
 */
async function persistEmpleadoUpdate(empleadoId, patchDto) {
  await patchEmpleado(empleadoId, patchDto)
  return getEmpleadoById(empleadoId)
}

export async function renderEmpleados(container, { initialQuery, empleadoId, openEdit = false, estadoDatos } = {}) {
  const user = getCurrentUser()
  const empresaId = sessionEmpresaId()

  if (isSuperadmin(user) && !canLoadTenantData(user)) {
    const view = document.createElement('div')
    view.className = 'space-y-6'
    view.innerHTML = `
      ${pageHeadingMarkup({
        title: 'Gestioná los empleados',
        description: 'Administrá sus datos laborales, asignaciones y estado.',
      })}
    `
    view.append(createSelectEmpresaState())
    container.replaceChildren(view)
    return
  }

  const view = document.createElement('div')
  view.className = 'space-y-6'

  view.innerHTML = `
    <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div class="min-w-0 flex-1">
        ${pageHeadingMarkup({
          title: 'Gestioná los empleados',
          description: 'Administrá sus datos laborales, asignaciones y estado.',
        })}
      </div>
      <button
        type="button"
        id="empleados-new"
        class="inline-flex h-11 w-full shrink-0 items-center justify-center rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
      >
        Nuevo empleado
      </button>
    </div>
    <div id="empleados-banner"></div>
    <div id="empleados-summary" class="grid gap-3 sm:grid-cols-3"></div>
    <section class="min-w-0 max-w-full overflow-x-visible rounded-xl border border-slate-200 bg-white px-3 py-3 shadow-sm sm:px-4">
      <div id="empleados-filters" class="${FILTERS_GRID_CLASS}">
        <div class="${FILTER_FIELD_CLASS} sm:col-span-2 md:col-span-1">
          <label for="empleados-search" class="${FILTER_LABEL_CLASS}">Buscar</label>
          <input
            id="empleados-search"
            type="search"
            placeholder="Nombre, DNI o legajo"
            aria-label="Buscar por nombre, DNI o legajo"
            class="${CONTROL_CLASS}"
          />
        </div>
        <div class="${FILTER_FIELD_CLASS}">
          <label id="empleados-sucursal-label" class="${FILTER_LABEL_CLASS}">Sucursal</label>
          <div id="empleados-sucursal-host" class="min-w-0 w-full [&_button]:min-w-0"></div>
        </div>
        <div class="${FILTER_FIELD_CLASS}">
          <label for="empleados-departamento" class="${FILTER_LABEL_CLASS}">Departamento</label>
          <select
            id="empleados-departamento"
            class="${CONTROL_CLASS}"
            disabled
            aria-label="Departamento"
            aria-describedby="empleados-departamento-hint"
          >
            <option value="${DEPARTAMENTO_ALL}">Todos</option>
          </select>
          <p id="empleados-departamento-hint" class="sr-only">Según las sucursales seleccionadas</p>
        </div>
        <div class="${FILTER_FIELD_CLASS}">
          <label for="empleados-actividad" class="${FILTER_LABEL_CLASS}">Estado</label>
          <select id="empleados-actividad" class="${CONTROL_CLASS}" aria-label="Estado del empleado">
            <option value="activos" selected>Activos</option>
            <option value="inactivos">Inactivos</option>
            <option value="todos">Todos</option>
          </select>
        </div>
        <div class="${FILTER_FIELD_CLASS}">
          <label for="empleados-estado" class="${FILTER_LABEL_CLASS}">
            <span aria-hidden="true">Datos</span>
            <span class="sr-only">Estado de datos</span>
          </label>
          <select id="empleados-estado" class="${CONTROL_CLASS}" aria-label="Estado de datos">
            <option value="todos">Todos</option>
            <option value="completo">Completo</option>
            <option value="pendientes">Con pendientes</option>
          </select>
        </div>
        <div class="flex min-w-0 w-full items-end sm:col-span-2 md:col-span-1">
          <button
            type="button"
            id="empleados-clear-filters"
            class="${BTN_SECONDARY_CLASS} h-11 w-full min-w-0 max-w-full xl:w-auto"
            aria-label="Limpiar filtros"
            disabled
          >
            Limpiar
          </button>
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
  const departamentoHint = view.querySelector('#empleados-departamento-hint')
  const sucursalHost = view.querySelector('#empleados-sucursal-host')
  const actividadSelect = view.querySelector('#empleados-actividad')
  const estadoSelect = view.querySelector('#empleados-estado')
  const pageSizeSelect = view.querySelector('#empleados-page-size')
  const clearFiltersButton = view.querySelector('#empleados-clear-filters')
  const newButton = view.querySelector('#empleados-new')
  const sucursalFilter = createSucursalMultiSelect({
    id: 'empleados-sucursal-multi',
    labelledBy: 'empleados-sucursal-label',
    onChange: () => {
      void syncDepartamentoFilter()
      onFilterChange()
    },
  })
  sucursalHost.replaceChildren(sucursalFilter.element)

  let empleados = []
  let loaded = false
  let loadError = false
  let currentPage = 1
  let pageSize = DEFAULT_PAGE_SIZE
  let sortKey = 'nombre'
  let sortDir = 'asc'
  let highlightId = null
  let activeModalClose = null
  let sucursalCatalog = []
  let departamentoCatalog = []
  let departamentoLoadGeneration = 0

  function closeActiveModal(options) {
    activeModalClose?.(options)
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
    const sucursal = sucursalFilter.getValue()
    const departamentoId = parseEntityId(departamentoSelect.value)

    return {
      query: searchInput.value,
      sucursalIds: sucursal.sucursalIds,
      includeUnassigned: sucursal.includeUnassigned,
      departamentoId:
        !departamentoSelect.disabled && departamentoId ? String(departamentoId) : DEPARTAMENTO_ALL,
      estado: estadoSelect.value,
      estadoActividad: actividadSelect.value,
    }
  }

  function updateClearFiltersState() {
    const pristine = empleadosFiltersArePristine(getFilters())
    clearFiltersButton.disabled = pristine
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

  const DEPT_HINT_UNASSIGNED = 'Sin sucursal no hay departamentos asociados'

  function sucursalNameMap() {
    const names = new Map()
    for (const item of sucursalCatalog) {
      const id = Number(item?.id)
      if (!Number.isFinite(id) || id <= 0) continue
      const nombre = String(item.nombre ?? '').trim()
      if (nombre) names.set(id, nombre)
    }
    for (const empleado of empleados) {
      const id = Number(empleado?.sucursalId)
      if (!Number.isFinite(id) || id <= 0 || names.has(id)) continue
      const nombre = String(empleado.sucursal ?? '').trim()
      if (nombre) names.set(id, nombre)
    }
    return names
  }

  function applySucursalCatalog() {
    if (!sucursalFilter.element.isConnected) return
    sucursalFilter.setSucursales([
      ...sucursalCatalog,
      ...empleados.map((empleado) => ({ id: empleado.sucursalId, nombre: empleado.sucursal })),
    ])
  }

  async function syncDepartamentoFilter({ preserveDepartamentoId } = {}) {
    const sucursal = sucursalFilter.getValue()
    const onlyUnassigned = sucursal.sucursalIds.length === 0 && sucursal.includeUnassigned
    const currentId =
      preserveDepartamentoId === null
        ? null
        : (preserveDepartamentoId ?? parseEntityId(departamentoSelect.value))

    departamentoLoadGeneration += 1
    const current = departamentoLoadGeneration

    if (onlyUnassigned) {
      setDepartamentoIdle(departamentoSelect, departamentoHint, {
        includeAll: true,
        message: DEPT_HINT_UNASSIGNED,
      })
      return
    }

    if (!departamentoCatalog.length && departamentoSelect.isConnected) {
      departamentoSelect.disabled = true
      departamentoSelect.replaceChildren()
      const loading = document.createElement('option')
      loading.value = ''
      loading.textContent = 'Cargando...'
      departamentoSelect.append(loading)
      departamentoSelect.value = ''
      refreshEnhancedSelect(departamentoSelect)
      if (departamentoHint) {
        departamentoHint.textContent = ''
        departamentoHint.classList.add('hidden')
      }
    }

    try {
      if (!departamentoCatalog.length) {
        departamentoCatalog = await getDepartamentos()
      }
      if (current !== departamentoLoadGeneration) return

      const departamentos = filterDepartamentosForSucursalSelection(departamentoCatalog, sucursal)
      fillDepartamentoOptions(departamentoSelect, departamentos, departamentoHint, {
        includeAll: true,
        currentId,
        sucursalNames: sucursalNameMap(),
      })
    } catch (error) {
      if (current !== departamentoLoadGeneration) return
      setDepartamentoIdle(departamentoSelect, departamentoHint, {
        includeAll: true,
        message: error.message || 'No se pudieron cargar los departamentos.',
      })
      if (error.message !== 'Sesión expirada o no autorizada.') {
        notifyDepartamentosLoadError((notice) => showToast(notice), error)
      }
    }
  }

  async function loadDepartamentos() {
    try {
      departamentoCatalog = await getDepartamentos()
      await syncDepartamentoFilter()
    } catch (error) {
      if (error.message === 'Sesión expirada o no autorizada.') return
      departamentoCatalog = []
      setDepartamentoIdle(departamentoSelect, departamentoHint, {
        includeAll: true,
        message: error.message || 'No se pudieron cargar los departamentos.',
      })
      notifyDepartamentosLoadError((notice) => showToast(notice), error)
    }
  }

  async function loadSucursales() {
    try {
      sucursalCatalog = await getSucursales()
      applySucursalCatalog()
      await syncDepartamentoFilter()
    } catch (error) {
      if (error.message === 'Sesión expirada o no autorizada.') return
      sucursalCatalog = []
      applySucursalCatalog()
      await syncDepartamentoFilter()
      showToast({
        message: error.message || 'No se pudieron cargar las sucursales.',
        tone: 'error',
      })
    }
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
          message: 'Todavía no hay empleados. Creá el primero con “Nuevo empleado”.',
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
        catalog: empleados,
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
      empleados = await getEmpleados({ incluirInactivos: true })
      loaded = true
      loadError = false
      applySucursalCatalog()
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

  async function verEmpleadosDepartamento({ departamentoId } = {}) {
    sucursalFilter.clear()
    actividadSelect.value = 'todos'
    departamentoCatalog = []
    await syncDepartamentoFilter({ preserveDepartamentoId: departamentoId })
    departamentoSelect.value = departamentoId ? String(departamentoId) : ''
    refreshEnhancedSelect(departamentoSelect)
    resetPage()
    updateClearFiltersState()
    renderResults()
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
      empleados: loaded && !loadError ? empleados : null,
      onVerEmpleadosDepartamento: verEmpleadosDepartamento,
      onDepartamentosChanged: loadDepartamentos,
      onCancel: () => closeActiveModal(),
      onSubmit: async (dto) => {
        await createEmpleado(dto)
        closeActiveModal({ force: true })
        showToast({ message: 'Empleado creado correctamente.', tone: 'success' })
        await loadEmpleados()
      },
    })

    const modal = openFormModal({
      title: 'Nuevo empleado',
      content: form,
      labelledBy: 'empleado-create-title',
      onClose: () => {
        activeModalClose = null
      },
    })
    activeModalClose = modal.close
  }

  async function openDetail(empleado, { edit = false } = {}) {
    const loading = createDetailSkeleton()

    const modal = openModal({
      title: fullName(empleado) || 'Empleado',
      content: loading,
      labelledBy: 'empleado-detail-title',
      closeOnBackdrop: () => !modal.dialog.querySelector('form'),
      unsavedChanges: true,
      onClose: () => {
        activeModalClose = null
      },
    })
    activeModalClose = modal.close

    try {
      const inactive = empleado.activo === false
      const [detail, empresa] = await Promise.all([
        inactive ? Promise.resolve(empleado) : getEmpleadoById(empleado.id),
        getEmpresaActual(),
      ])
      loading.replaceWith(
        createEmpleadoRecord({
          empleado: detail,
          empleados: loaded && !loadError ? empleados : null,
          empresaLabel: empresaDisplayName(empresa, detail.empresaId),
          initialMode: edit ? 'edit' : 'view',
          persistUpdate: persistEmpleadoUpdate,
          onDeactivate: openDeactivate,
          onReactivate: openReactivate,
          onVerEmpleadosDepartamento: verEmpleadosDepartamento,
          onDepartamentosChanged: loadDepartamentos,
          onUpdated: (updated) => {
            empleados = empleados.map((item) => (Number(item.id) === Number(updated.id) ? { ...item, ...updated } : item))
            renderSummary()
            renderResults()
            showToast({ message: 'Cambios guardados.', tone: 'success' })
          },
        }),
      )
    } catch (error) {
      if (error.message === 'Sesión expirada o no autorizada.') {
        closeActiveModal({ force: true })
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

  function openDeactivate(empleado, { onError } = {}) {
    return new Promise((resolve) => {
      let settled = false
      let confirmClose = null

      const confirm = createDeactivateConfirm({
        empleado,
        onCancel: () => confirmClose?.(),
        onFailure: onError,
        onConfirm: async () => {
          await deactivateEmpleado(empleado.id)
          empleados = empleados.map((item) =>
            Number(item.id) === Number(empleado.id) ? { ...item, activo: false } : item,
          )
          settled = true
          confirmClose?.({ force: true })
          closeActiveModal({ force: true })
          renderSummary()
          renderResults()
          showToast({ message: 'Empleado desactivado.', tone: 'success' })
          resolve(true)
        },
      })

      const modal = openModal({
        title: 'Desactivar empleado',
        content: confirm,
        labelledBy: 'empleado-deactivate-title',
        stacked: true,
        closeOnBackdrop: true,
        onClose: () => {
          if (!settled) resolve(false)
        },
      })
      confirmClose = modal.close
    })
  }

  function openReactivate(empleado, { onError } = {}) {
    return new Promise((resolve) => {
      let settled = false
      let confirmClose = null

      const confirm = createReactivateConfirm({
        empleado,
        onCancel: () => confirmClose?.(),
        onFailure: onError,
        onConfirm: async () => {
          await reactivateEmpleado(empleado.id)
          empleados = empleados.map((item) =>
            Number(item.id) === Number(empleado.id) ? { ...item, activo: true } : item,
          )
          settled = true
          confirmClose?.({ force: true })
          closeActiveModal({ force: true })
          renderSummary()
          renderResults()
          showToast({ message: 'Empleado activado.', tone: 'success' })
          resolve(true)
        },
      })

      const modal = openModal({
        title: 'Activar empleado',
        content: confirm,
        labelledBy: 'empleado-reactivate-title',
        stacked: true,
        closeOnBackdrop: true,
        onClose: () => {
          if (!settled) resolve(false)
        },
      })
      confirmClose = modal.close
    })
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

  const focusEmpleadoId = parsePositiveId(empleadoId)

  if (estadoDatos === 'pendientes') {
    estadoSelect.value = 'pendientes'
  }

  if (focusEmpleadoId) {
    sucursalFilter.clear()
    if (estadoDatos !== 'pendientes') estadoSelect.value = 'todos'
    resetPage()
  } else if (initialQuery) {
    searchInput.value = initialQuery
    sucursalFilter.clear()
    estadoSelect.value = 'todos'
    resetPage()
  }

  function onFilterChange() {
    highlightId = null
    resetPage()
    updateClearFiltersState()
    renderResults()
  }

  async function clearAllFilters() {
    searchInput.value = ''
    sucursalFilter.clear()
    actividadSelect.value = 'activos'
    estadoSelect.value = 'todos'
    await syncDepartamentoFilter({ preserveDepartamentoId: null })
    onFilterChange()
  }

  newButton.addEventListener('click', openCreateForm)
  searchInput.addEventListener('input', onFilterChange)
  actividadSelect.addEventListener('change', onFilterChange)
  estadoSelect.addEventListener('change', onFilterChange)
  departamentoSelect.addEventListener('change', onFilterChange)
  clearFiltersButton.addEventListener('click', () => {
    void clearAllFilters()
  })
  pageSizeSelect.addEventListener('change', () => {
    pageSize = Number(pageSizeSelect.value) || DEFAULT_PAGE_SIZE
    resetPage()
    renderResults()
  })

  container.replaceChildren(view)
  updateClearFiltersState()
  setDepartamentoIdle(departamentoSelect, departamentoHint, {
    includeAll: true,
    message: 'Cargando departamentos...',
  })
  await Promise.all([
    loadEmpleados({ keepBanner: Boolean(!empresaId && !isSuperadmin(user)) }),
    loadSucursales(),
    loadDepartamentos(),
  ])

  if (loaded && focusEmpleadoId) {
    const target = empleados.find((item) => Number(item.id) === focusEmpleadoId)
    if (target && empleadoPerteneceAEmpresaActiva(target, empresaId)) {
      if (target.activo === false) actividadSelect.value = 'todos'
      highlightId = target.id
      renderResults()
      await openDetail(target, { edit: openEdit })
    } else if (initialQuery) {
      searchInput.value = initialQuery
      const hinted = visibleEmpleados()[0]
      highlightId = hinted?.id ?? null
      if (highlightId) renderResults()
    }
  } else if (initialQuery && loaded) {
    const hinted = visibleEmpleados()[0]
    highlightId = hinted?.id ?? null
    if (highlightId) renderResults()
  }

  return () => {
    sucursalFilter.destroy()
  }
}
