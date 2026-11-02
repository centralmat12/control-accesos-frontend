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
import { guardarAsignacionSiCorresponde } from '../components/horario-laboral.js'
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
import { paginateItems } from '../utils/paginate.js'

const CONTROL_CLASS = `h-11 min-w-0 max-w-full ${FORM_INPUT_CLASS}`

const FILTER_FIELD_CLASS = 'flex min-w-0 w-full flex-col'
const FILTER_LABEL_CLASS = 'mb-1.5 block text-sm font-medium text-slate-700'
const EMPLEADOS_PAGE_SIZES = [10, 25, 50]
const EMPLEADOS_DEFAULT_PAGE_SIZE = 10
let sessionPageSize = EMPLEADOS_DEFAULT_PAGE_SIZE

export function textoRangoEmpleados(from, to, total) {
  const noun = total === 1 ? 'empleado' : 'empleados'
  return `Mostrando ${from}–${to} de ${total} ${noun}`
}
const FILTERS_GRID_CLASS =
  'grid min-w-0 grid-cols-1 items-end gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,1fr))_auto_auto]'

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
        description: 'Administrá la nómina, sus asignaciones y su estado.',
      })}
    `
    view.append(createSelectEmpresaState())
    container.replaceChildren(view)
    return
  }

  const view = document.createElement('div')
  view.className = 'mx-auto w-full max-w-[1200px] space-y-4'

  view.innerHTML = `
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div class="min-w-0 flex-1">
        ${pageHeadingMarkup({
          description: 'Administrá la nómina, sus asignaciones y su estado.',
        })}
      </div>
      <button
        type="button"
        id="empleados-new"
        class="inline-flex h-11 w-full shrink-0 items-center justify-center rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
      >
        + Nuevo empleado
      </button>
    </div>
    <div id="empleados-banner"></div>
    <div id="empleados-summary" class="grid gap-3 sm:grid-cols-3"></div>
    <section class="min-w-0 max-w-full rounded-xl border border-slate-200 bg-white px-3 py-3 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:px-4">
      <div id="empleados-filters" class="${FILTERS_GRID_CLASS}">
        <div class="${FILTER_FIELD_CLASS} sm:col-span-2 xl:col-span-1">
          <label for="empleados-search" class="${FILTER_LABEL_CLASS}">Buscar</label>
          <input
            id="empleados-search"
            type="search"
            placeholder="Buscar por nombre, DNI o legajo"
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
        <div class="flex min-w-0">
          <button
            type="button"
            id="empleados-more-filters"
            class="${BTN_SECONDARY_CLASS} h-11 w-full"
            aria-expanded="false"
            aria-controls="empleados-more-panel"
          >
            Más filtros
          </button>
        </div>
        <div class="flex min-w-0">
          <button
            type="button"
            id="empleados-clear-filters"
            class="${BTN_SECONDARY_CLASS} h-11 w-full"
            aria-label="Limpiar filtros"
            disabled
          >
            Limpiar
          </button>
        </div>
      </div>
      <div id="empleados-more-panel" class="mt-3 hidden border-t border-slate-100 pt-3 dark:border-slate-800">
        <div class="${FILTER_FIELD_CLASS} max-w-xs">
          <label for="empleados-estado" class="${FILTER_LABEL_CLASS}">
            <span aria-hidden="true">Información</span>
            <span class="sr-only">Estado de datos</span>
          </label>
          <select id="empleados-estado" class="${CONTROL_CLASS}" aria-label="Estado de datos">
            <option value="todos">Todos</option>
            <option value="completo">Datos completos</option>
            <option value="pendientes">Con pendientes</option>
          </select>
        </div>
      </div>
    </section>
    <section id="empleados-list" class="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div id="empleados-table-bar" class="hidden flex-col gap-2 border-b border-slate-100 px-3 py-2 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
        <p id="empleados-count" class="text-sm font-medium text-slate-700 dark:text-slate-200"></p>
        <label for="empleados-page-size" class="ml-auto flex items-center justify-end gap-2 text-sm text-slate-600 dark:text-slate-300">
          <span>Mostrar</span>
          <select id="empleados-page-size" class="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-900 outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100">
            ${EMPLEADOS_PAGE_SIZES.map((size) => `<option value="${size}" ${size === sessionPageSize ? 'selected' : ''}>${size}</option>`).join('')}
          </select>
        </label>
      </div>
      <div id="empleados-results"></div>
      <div id="empleados-pagination" class="border-t border-slate-100 empty:hidden dark:border-slate-800"></div>
    </section>
  `

  const banner = view.querySelector('#empleados-banner')
  const summary = view.querySelector('#empleados-summary')
  const results = view.querySelector('#empleados-results')
  const paginationContainer = view.querySelector('#empleados-pagination')
  const countLabel = view.querySelector('#empleados-count')
  const tableBar = view.querySelector('#empleados-table-bar')
  const listCard = view.querySelector('#empleados-list')
  const moreFiltersButton = view.querySelector('#empleados-more-filters')
  const moreFiltersPanel = view.querySelector('#empleados-more-panel')
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
  let pageSize = sessionPageSize
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
    const pendienteNeutral = stats.conPendientes === 0
    const pendienteCard = pendienteNeutral
      ? 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900'
      : 'border-amber-300 bg-amber-50/70 dark:border-amber-500/40 dark:bg-amber-950/20'
    const pendienteNumber = pendienteNeutral
      ? 'text-slate-900 dark:text-slate-100'
      : 'text-amber-800 dark:text-amber-200'
    const card = 'flex h-full min-h-[4.5rem] items-center justify-between gap-3 rounded-xl border px-4 py-3'
    const label = 'text-sm font-medium text-slate-500 dark:text-slate-400'
    const number = 'text-2xl font-semibold tabular-nums tracking-tight'
    summary.innerHTML = `
      <article class="${card} border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
        <p class="${label}">Empleados activos</p>
        <p class="${number} text-slate-900 dark:text-slate-100">${stats.activos}</p>
      </article>
      <article class="${card} border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
        <p class="${label}">Datos completos</p>
        <p class="${number} text-slate-900 dark:text-slate-100">${stats.completos}</p>
      </article>
      <article class="${card} ${pendienteCard}">
        <p class="${label}">Con pendientes</p>
        <p class="${number} ${pendienteNumber}">${stats.conPendientes}</p>
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

  function setTableBarVisible(visible) {
    tableBar.className = visible
      ? 'flex flex-col gap-2 border-b border-slate-100 px-3 py-2 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between'
      : 'hidden'
  }

  function setListChrome(active) {
    listCard.className = active
      ? 'min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900'
      : 'min-w-0'
  }

  function renderFilteredEmpty() {
    const box = document.createElement('div')
    box.className = 'px-6 py-12 text-center'
    const title = document.createElement('p')
    title.className = 'text-sm text-slate-600 dark:text-slate-300'
    title.textContent = 'No encontramos empleados con los filtros aplicados.'
    const action = document.createElement('button')
    action.type = 'button'
    action.className = `${BTN_SECONDARY_CLASS} mt-4`
    action.textContent = 'Limpiar filtros'
    action.addEventListener('click', () => {
      void clearAllFilters()
    })
    box.append(title, action)
    return box
  }

  function renderResults() {
    paginationContainer.replaceChildren()
    countLabel.textContent = ''

    if (!loaded) {
      setTableBarVisible(false)
      return
    }

    const sorted = visibleEmpleados()
    const paged = paginateItems(sorted, currentPage, pageSize)
    currentPage = paged.page

    if (empleados.length === 0) {
      setTableBarVisible(false)
      setListChrome(false)
      results.replaceChildren(
        createFeedbackState({
          title: 'No hay empleados',
          message: 'Todavía no hay empleados. Creá el primero con “Nuevo empleado”.',
        }),
      )
      return
    }

    setListChrome(true)
    setTableBarVisible(true)
    const total = sorted.length
    countLabel.textContent = total === 1 ? '1 empleado' : `${total} empleados`

    if (total === 0) {
      results.replaceChildren(renderFilteredEmpty())
      return
    }

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
          summary: textoRangoEmpleados(paged.from, paged.to, paged.total),
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
    setTableBarVisible(false)
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
      setTableBarVisible(false)

      if (error.message === 'Sesión expirada o no autorizada.') {
        results.replaceChildren()
        return
      }

      results.replaceChildren(
        createFeedbackState({
          title: 'No se pudo cargar la lista',
          message: 'No pudimos consultar los empleados. Reintentá en unos segundos.',
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
        const { turnoAsignacion, ...empleado } = dto
        const created = await createEmpleado(empleado)
        if (turnoAsignacion && created?.id) {
          await guardarAsignacionSiCorresponde(created.id, turnoAsignacion)
        }
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
    setMoreFiltersOpen(true)
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

  let moreFiltersOpen = false
  function setMoreFiltersOpen(open) {
    moreFiltersOpen = open
    moreFiltersPanel.classList.toggle('hidden', !open)
    moreFiltersButton.setAttribute('aria-expanded', String(open))
  }

  newButton.addEventListener('click', openCreateForm)
  searchInput.addEventListener('input', onFilterChange)
  actividadSelect.addEventListener('change', onFilterChange)
  estadoSelect.addEventListener('change', onFilterChange)
  departamentoSelect.addEventListener('change', onFilterChange)
  clearFiltersButton.addEventListener('click', () => {
    void clearAllFilters()
  })
  moreFiltersButton.addEventListener('click', () => {
    setMoreFiltersOpen(!moreFiltersOpen)
  })
  pageSizeSelect.addEventListener('change', () => {
    const nextSize = EMPLEADOS_PAGE_SIZES.includes(Number(pageSizeSelect.value))
      ? Number(pageSizeSelect.value)
      : EMPLEADOS_DEFAULT_PAGE_SIZE
    pageSize = nextSize
    sessionPageSize = nextSize
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
