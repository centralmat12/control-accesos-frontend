import { getEmpleadosByEmpresa } from '../api/empleados.js'
import { DEFAULT_EMPRESA_ID } from '../config/api.js'
import { createEmpleadosTable } from '../components/empleados-table.js'
import { createFeedbackState, createLoadingState } from '../components/feedback-state.js'

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

function matchesStatus(empleado, status) {
  if (status === 'activo') return Boolean(empleado.activo)
  if (status === 'inactivo') return !empleado.activo
  return true
}

function filterEmpleados(empleados, { query, status }) {
  const normalizedQuery = query.trim().toLowerCase()

  return empleados.filter(
    (empleado) =>
      matchesSearch(empleado, normalizedQuery) && matchesStatus(empleado, status),
  )
}

export async function renderEmpleados(container, empresaId = DEFAULT_EMPRESA_ID) {
  const view = document.createElement('div')
  view.className = 'space-y-6'

  view.innerHTML = `
    <section class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div class="min-w-0 flex-1">
          <label for="empleados-search" class="mb-1.5 block text-sm font-medium text-slate-700">Buscar</label>
          <input
            id="empleados-search"
            type="search"
            placeholder="Nombre, apellido, DNI o legajo"
            class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
        <div class="w-full lg:w-56">
          <label for="empleados-status" class="mb-1.5 block text-sm font-medium text-slate-700">Estado</label>
          <select
            id="empleados-status"
            class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="todos">Todos</option>
            <option value="activo">Activo</option>
            <option value="inactivo">Inactivo</option>
          </select>
        </div>
      </div>
    </section>
    <div id="empleados-results"></div>
  `

  const results = view.querySelector('#empleados-results')
  const searchInput = view.querySelector('#empleados-search')
  const statusSelect = view.querySelector('#empleados-status')

  let empleados = []
  let loaded = false

  function getFilters() {
    return {
      query: searchInput.value,
      status: statusSelect.value,
    }
  }

  function renderResults() {
    if (!loaded) return

    const filtered = filterEmpleados(empleados, getFilters())

    if (filtered.length === 0) {
      results.replaceChildren(
        createFeedbackState({
          title: 'Sin resultados',
          message: 'No hay empleados que coincidan con la búsqueda o el filtro de estado.',
        }),
      )
      return
    }

    results.replaceChildren(createEmpleadosTable(filtered))
  }

  async function loadEmpleados() {
    loaded = false
    results.replaceChildren(createLoadingState())

    try {
      empleados = await getEmpleadosByEmpresa(empresaId)
      loaded = true
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
          onAction: loadEmpleados,
        }),
      )
    }
  }

  searchInput.addEventListener('input', renderResults)
  statusSelect.addEventListener('change', renderResults)

  container.replaceChildren(view)
  await loadEmpleados()
}