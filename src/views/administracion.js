import { createEmpresa, empresaDisplayName, getEmpresas } from '../api/empresas.js'
import { getCurrentUser } from '../api/auth.js'
import { createSucursal, getSucursales, updateSucursal } from '../api/sucursales.js'
import { createUsuario } from '../api/usuarios.js'
import {
  API_ENABLEMENT_HINT,
  empresaIdDeTenant,
  puedeAbrirNuevoUsuario,
  puedeCrearEmpresas,
  puedeCrearSucursales,
  puedeEditarSucursales,
  puedeListarUsuarios,
} from '../config/administracion.js'
import { featureStatusBadge } from '../components/badge.js'
import { createEmpresaForm } from '../components/empresa-form.js'
import { createFeedbackState } from '../components/feedback-state.js'
import { createSucursalForm } from '../components/sucursal-form.js'
import { createUsuarioForm } from '../components/usuario-form.js'
import { openFormModal } from '../components/modal.js'
import { createTableSkeleton } from '../components/skeleton.js'
import { showToast } from '../components/toast.js'
import { isAdmin, isSuperadmin } from '../config/roles.js'
import { displayValue, escapeHtml } from '../utils/format.js'

const CONTROL_CLASS =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'

const TAB_ACTIVE =
  'border-blue-600 bg-white text-blue-700 shadow-sm dark:border-blue-400 dark:text-blue-300'
const TAB_IDLE = 'border-transparent text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'

const SECTIONS = {
  usuarios: 'usuarios',
  empresas: 'empresas',
}

function matchesQuery(empresa, query) {
  if (!query) return true
  const haystack = [empresaDisplayName(empresa), empresa.razonSocial, empresa.cuit, empresa.id]
    .join(' ')
    .toLowerCase()
  return haystack.includes(query)
}

function createActionControl({ id, label, enabled, disabledMessage = '' }) {
  if (enabled) {
    return `
      <button
        type="button"
        id="${id}"
        class="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500"
      >
        ${escapeHtml(label)}
      </button>
    `
  }

  return `
    <div class="flex flex-col items-stretch gap-1.5 sm:items-end">
      <button
        type="button"
        id="${id}"
        disabled
        aria-disabled="true"
        title="${escapeHtml(disabledMessage || API_ENABLEMENT_HINT)}"
        class="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        ${escapeHtml(label)}
      </button>
      ${
        disabledMessage
          ? `<p class="text-xs text-slate-500">${escapeHtml(disabledMessage)}</p>`
          : featureStatusBadge('apiEnable')
      }
    </div>
  `
}

export async function renderAdministracion(container) {
  const user = getCurrentUser()
  const canCreateUsuarios = puedeAbrirNuevoUsuario(user)
  const canCreateEmpresas = puedeCrearEmpresas(user)
  const canListUsuarios = puedeListarUsuarios()
  const tenantEmpresaId = empresaIdDeTenant(user)
  const usuarioDisabledMessage =
    isAdmin(user) && !tenantEmpresaId
      ? 'La sesión ADMIN no incluye una empresa válida.'
      : API_ENABLEMENT_HINT
  const empresaDisabledMessage = isAdmin(user)
    ? 'La API autoriza el alta de empresas únicamente al rol SuperAdmin.'
    : API_ENABLEMENT_HINT
  const view = document.createElement('div')
  view.className = 'space-y-6'

  view.innerHTML = `
    <section class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 class="text-xl font-semibold tracking-tight text-slate-900">Administración</h2>
        <p class="mt-1 text-sm text-slate-500">
          Usuarios del panel y empresas. Las sucursales se administran dentro de cada empresa.
        </p>
      </div>
    </section>
    <div class="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-slate-50 p-1" role="tablist" aria-label="Secciones de administración">
      <button type="button" data-section="${SECTIONS.usuarios}" role="tab" class="rounded-lg border px-4 py-2 text-sm font-medium">
        Usuarios
      </button>
      <button type="button" data-section="${SECTIONS.empresas}" role="tab" class="rounded-lg border px-4 py-2 text-sm font-medium">
        Empresas
      </button>
    </div>
    <div id="admin-panel"></div>
  `

  const panel = view.querySelector('#admin-panel')
  const tabButtons = [...view.querySelectorAll('[data-section]')]
  let section = SECTIONS.usuarios
  let selectedEmpresa = null
  let empresas = []
  let sucursales = []
  let empresasLoaded = false
  let empresasError = false
  let empresasErrorMessage = 'Ocurrió un error al consultar la API.'
  let sucursalesLoaded = false
  let sucursalesError = false
  let sucursalesErrorMessage = 'Ocurrió un error al consultar la API.'
  let empresaQuery = ''
  let activeModalClose = null

  function closeActiveModal(options) {
    activeModalClose?.(options)
  }

  function setSection(next) {
    section = next
    if (next !== SECTIONS.empresas) selectedEmpresa = null
    tabButtons.forEach((button) => {
      const active = button.dataset.section === section
      button.className = `rounded-lg border px-4 py-2 text-sm font-medium ${active ? TAB_ACTIVE : TAB_IDLE}`
      button.setAttribute('aria-selected', String(active))
    })
    renderPanel()
    if (section === SECTIONS.empresas && !selectedEmpresa && !empresasLoaded) {
      void loadEmpresas()
    }
  }

  function renderPanel() {
    if (section === SECTIONS.usuarios) {
      renderUsuarios()
      return
    }
    if (selectedEmpresa) {
      renderEmpresaDetail()
      return
    }
    renderEmpresasList()
  }

  function renderUsuarios() {
    panel.innerHTML = `
      <div class="space-y-4">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p class="text-sm text-slate-500">Usuarios del panel web.</p>
          ${createActionControl({
            id: 'admin-usuario-new',
            label: 'Nuevo usuario',
            enabled: canCreateUsuarios,
            disabledMessage: usuarioDisabledMessage,
          })}
        </div>
        <div id="admin-usuarios-state"></div>
      </div>
    `
    const usuariosState = panel.querySelector('#admin-usuarios-state')
    if (!canListUsuarios) {
      usuariosState.replaceChildren(
        createFeedbackState({
          title: 'Listado no disponible',
          message: 'El listado de usuarios requiere GET /api/usuarios.',
        }),
      )
    }
    if (canCreateUsuarios) {
      panel.querySelector('#admin-usuario-new')?.addEventListener('click', openUsuarioCreate)
    }
  }

  function openUsuarioCreate() {
    if (!canCreateUsuarios) return
    const form = createUsuarioForm({
      empresaIdPermitida: tenantEmpresaId,
      permitirElegirEmpresa: isSuperadmin(user),
      onCancel: () => closeActiveModal(),
      onSubmit: async (dto) => {
        await createUsuario(dto)
        closeActiveModal({ force: true })
        showToast({ message: 'Usuario creado correctamente.', tone: 'success' })
      },
    })
    const modal = openFormModal({
      title: 'Nuevo usuario',
      content: form,
      labelledBy: 'usuario-create-title',
      onClose: () => {
        activeModalClose = null
      },
    })
    activeModalClose = modal.close
  }

  function renderEmpresasList() {
    panel.innerHTML = `
      <div class="space-y-4">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div class="min-w-0 flex-1">
            <label for="admin-empresas-search" class="mb-1.5 block text-sm font-medium text-slate-700">Buscar</label>
            <input id="admin-empresas-search" type="search" placeholder="Nombre, razón social, CUIT o ID" class="${CONTROL_CLASS}" />
          </div>
          ${createActionControl({
            id: 'admin-empresa-new',
            label: 'Nueva empresa',
            enabled: canCreateEmpresas,
            disabledMessage: empresaDisabledMessage,
          })}
        </div>
        <div id="admin-empresas-results"></div>
      </div>
    `
    const search = panel.querySelector('#admin-empresas-search')
    search.value = empresaQuery
    search.addEventListener('input', () => {
      empresaQuery = search.value.trim().toLowerCase()
      paintEmpresasResults()
    })
    if (canCreateEmpresas) {
      panel.querySelector('#admin-empresa-new')?.addEventListener('click', openEmpresaCreate)
    }
    paintEmpresasResults()
  }

  function paintEmpresasResults() {
    const results = panel.querySelector('#admin-empresas-results')
    if (!results) return

    if (!empresasLoaded) {
      results.replaceChildren(createTableSkeleton({ rows: 6, columns: 4, label: 'Cargando empresas' }))
      return
    }

    if (empresasError) {
      results.replaceChildren(
        createFeedbackState({
          title: 'No se pudieron cargar las empresas',
          message: empresasErrorMessage,
          tone: 'error',
          actionLabel: 'Reintentar',
          onAction: () => loadEmpresas(),
        }),
      )
      return
    }

    const filtered = empresas.filter((empresa) => matchesQuery(empresa, empresaQuery))

    if (empresas.length === 0) {
      results.replaceChildren(
        createFeedbackState({
          title: 'No hay empresas',
          message: canCreateEmpresas
            ? 'Todavía no hay empresas. Creá la primera con “Nueva empresa”.'
            : 'Todavía no hay empresas.',
        }),
      )
      return
    }

    if (filtered.length === 0) {
      results.replaceChildren(
        createFeedbackState({
          title: 'Sin resultados',
          message: 'No hay empresas que coincidan con la búsqueda.',
        }),
      )
      return
    }

    const sectionEl = document.createElement('section')
    sectionEl.className = 'overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm'
    sectionEl.innerHTML = `
      <div class="max-h-[65vh] overflow-auto">
        <table class="min-w-full divide-y divide-slate-200">
          <thead class="sticky top-0 z-10 bg-slate-50">
            <tr>
              <th scope="col" class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Nombre</th>
              <th scope="col" class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Razón social</th>
              <th scope="col" class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">CUIT</th>
              <th scope="col" class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">ID</th>
              <th scope="col" class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Acciones</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            ${filtered
              .map(
                (empresa) => `
                  <tr class="hover:bg-slate-50">
                    <td class="whitespace-nowrap px-4 py-3 text-sm font-medium text-slate-900">${displayValue(empresaDisplayName(empresa))}</td>
                    <td class="whitespace-nowrap px-4 py-3 text-sm text-slate-600">${displayValue(empresa.razonSocial)}</td>
                    <td class="whitespace-nowrap px-4 py-3 text-sm text-slate-600">${displayValue(empresa.cuit)}</td>
                    <td class="whitespace-nowrap px-4 py-3 text-sm text-slate-600">${displayValue(empresa.id)}</td>
                    <td class="whitespace-nowrap px-4 py-3 text-right">
                      <button type="button" data-action="view" data-id="${Number(empresa.id)}" class="rounded-lg px-2.5 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-50">
                        Ver sucursales
                      </button>
                    </td>
                  </tr>
                `,
              )
              .join('')}
          </tbody>
        </table>
      </div>
    `
    sectionEl.querySelectorAll('[data-action="view"]').forEach((button) => {
      button.addEventListener('click', () => {
        const id = Number(button.dataset.id)
        selectedEmpresa = empresas.find((empresa) => Number(empresa.id) === id) ?? null
        sucursalesLoaded = false
        sucursalesError = false
        sucursales = []
        renderPanel()
        if (selectedEmpresa) void loadSucursales()
      })
    })
    results.replaceChildren(sectionEl)
  }

  function openEmpresaCreate() {
    if (!canCreateEmpresas) return
    const form = createEmpresaForm({
      onCancel: () => closeActiveModal(),
      onSubmit: async (dto) => {
        await createEmpresa(dto)
        closeActiveModal({ force: true })
        showToast({ message: 'Empresa creada correctamente.', tone: 'success' })
        await loadEmpresas()
      },
    })
    const modal = openFormModal({
      title: 'Nueva empresa',
      content: form,
      labelledBy: 'empresa-create-title',
      onClose: () => {
        activeModalClose = null
      },
    })
    activeModalClose = modal.close
  }

  function renderEmpresaDetail() {
    const nombre = empresaDisplayName(selectedEmpresa)
    const canCreateHere = puedeCrearSucursales(user, selectedEmpresa?.id)
    panel.innerHTML = `
      <div class="space-y-4">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <button type="button" id="admin-empresa-back" class="text-sm font-medium text-blue-700 hover:text-blue-600">
              ← Volver a empresas
            </button>
            <h3 class="mt-2 text-lg font-semibold text-slate-900">${escapeHtml(nombre)}</h3>
            <p class="mt-1 text-sm text-slate-500">
              ID ${escapeHtml(String(selectedEmpresa.id))}
              ${selectedEmpresa.cuit ? ` · CUIT ${escapeHtml(selectedEmpresa.cuit)}` : ''}
            </p>
          </div>
          ${
            canCreateHere
              ? createActionControl({ id: 'admin-sucursal-new', label: 'Agregar sucursal', enabled: true })
              : ''
          }
        </div>
        <div id="admin-sucursales-results"></div>
      </div>
    `
    panel.querySelector('#admin-empresa-back')?.addEventListener('click', () => {
      selectedEmpresa = null
      renderPanel()
    })
    if (canCreateHere) {
      panel.querySelector('#admin-sucursal-new')?.addEventListener('click', openSucursalCreate)
    }
    paintSucursalesResults()
  }

  function paintSucursalesResults() {
    const results = panel.querySelector('#admin-sucursales-results')
    if (!results) return
    const canEditHere = puedeEditarSucursales(user, selectedEmpresa?.id)

    if (!sucursalesLoaded) {
      results.replaceChildren(
        createTableSkeleton({ rows: 5, columns: canEditHere ? 4 : 3, label: 'Cargando sucursales' }),
      )
      return
    }

    if (sucursalesError) {
      results.replaceChildren(
        createFeedbackState({
          title: 'No se pudieron cargar las sucursales',
          message: sucursalesErrorMessage,
          tone: 'error',
          actionLabel: 'Reintentar',
          onAction: () => loadSucursales(),
        }),
      )
      return
    }

    if (sucursales.length === 0) {
      results.replaceChildren(
        createFeedbackState({
          title: 'No hay sucursales',
          message: puedeCrearSucursales(user, selectedEmpresa?.id)
            ? 'Esta empresa todavía no tiene sucursales. Agregá la primera.'
            : 'Esta empresa todavía no tiene sucursales.',
        }),
      )
      return
    }

    const sectionEl = document.createElement('section')
    sectionEl.className = 'overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm'
    sectionEl.innerHTML = `
      <div class="max-h-[65vh] overflow-auto">
        <table class="min-w-full divide-y divide-slate-200">
          <thead class="sticky top-0 z-10 bg-slate-50">
            <tr>
              <th scope="col" class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Nombre</th>
              <th scope="col" class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Serial del lector</th>
              <th scope="col" class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">ID</th>
              ${
                canEditHere
                  ? '<th scope="col" class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Acciones</th>'
                  : ''
              }
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            ${sucursales
              .map((sucursal) => {
                const sameEmpresa = Number(sucursal.empresaId) === Number(selectedEmpresa?.id)
                const canEditSucursal =
                  sameEmpresa && puedeEditarSucursales(user, sucursal.empresaId)
                return `
                  <tr class="hover:bg-slate-50">
                    <td class="whitespace-nowrap px-4 py-3 text-sm font-medium text-slate-900">${displayValue(sucursal.nombre)}</td>
                    <td class="whitespace-nowrap px-4 py-3 text-sm text-slate-600">${displayValue(sucursal.serialLector)}</td>
                    <td class="whitespace-nowrap px-4 py-3 text-sm text-slate-600">${displayValue(sucursal.id)}</td>
                    ${
                      canEditHere
                        ? `<td class="whitespace-nowrap px-4 py-3 text-right">
                            ${
                              canEditSucursal
                                ? `<button
                                    type="button"
                                    data-action="edit-sucursal"
                                    data-id="${Number(sucursal.id)}"
                                    class="rounded-lg px-2.5 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                                  >
                                    Editar
                                  </button>`
                                : ''
                            }
                          </td>`
                        : ''
                    }
                  </tr>
                `
              })
              .join('')}
          </tbody>
        </table>
      </div>
    `
    sectionEl.querySelectorAll('[data-action="edit-sucursal"]').forEach((button) => {
      button.addEventListener('click', () => {
        const id = Number(button.dataset.id)
        const sucursal = sucursales.find((item) => Number(item.id) === id)
        if (sucursal) openSucursalEdit(sucursal)
      })
    })
    results.replaceChildren(sectionEl)
  }

  function openSucursalCreate() {
    if (!selectedEmpresa?.id) {
      showToast({ message: 'No se puede crear una sucursal sin empresa.', tone: 'error' })
      return
    }

    if (!puedeCrearSucursales(user, selectedEmpresa.id)) return

    const form = createSucursalForm({
      empresaNombre: empresaDisplayName(selectedEmpresa),
      onCancel: () => closeActiveModal(),
      onSubmit: async (dto) => {
        await createSucursal({
          ...dto,
          empresaId: Number(selectedEmpresa.id),
        })
        closeActiveModal({ force: true })
        showToast({ message: 'Sucursal creada correctamente.', tone: 'success' })
        await loadSucursales()
      },
    })
    const modal = openFormModal({
      title: 'Agregar sucursal',
      content: form,
      labelledBy: 'sucursal-create-title',
      onClose: () => {
        activeModalClose = null
      },
    })
    activeModalClose = modal.close
  }

  function openSucursalEdit(sucursal) {
    const sucursalId = Number(sucursal?.id)
    const empresaId = Number(sucursal?.empresaId)
    const selectedEmpresaId = Number(selectedEmpresa?.id)

    if (
      !Number.isFinite(sucursalId) ||
      sucursalId <= 0 ||
      !Number.isFinite(empresaId) ||
      empresaId <= 0 ||
      empresaId !== selectedEmpresaId ||
      !puedeEditarSucursales(user, empresaId)
    ) {
      showToast({ message: 'No tenés permiso para editar esta sucursal.', tone: 'error' })
      return
    }

    const form = createSucursalForm({
      mode: 'edit',
      sucursal,
      empresaNombre: empresaDisplayName(selectedEmpresa),
      onCancel: () => closeActiveModal(),
      onSubmit: async (dto) => {
        await updateSucursal({
          id: sucursalId,
          nombre: dto.nombre,
          empresaId,
          serialLector: dto.serialLector,
        })
        closeActiveModal({ force: true })
        showToast({ message: 'Sucursal actualizada correctamente', tone: 'success' })
        await loadSucursales()
      },
    })
    const modal = openFormModal({
      title: 'Editar sucursal',
      content: form,
      labelledBy: 'sucursal-edit-title',
      onClose: () => {
        activeModalClose = null
      },
    })
    activeModalClose = modal.close
  }

  async function loadEmpresas() {
    empresasLoaded = false
    empresasError = false
    paintEmpresasResults()
    try {
      empresas = await getEmpresas()
      empresasLoaded = true
      empresasError = false
    } catch (error) {
      if (error.message === 'Sesión expirada o no autorizada.') return
      empresas = []
      empresasLoaded = true
      empresasError = true
      empresasErrorMessage = error.message || 'No se pudieron cargar las empresas.'
      showToast({
        message: error.message || 'No se pudieron cargar las empresas.',
        tone: 'error',
      })
    }
    paintEmpresasResults()
  }

  async function loadSucursales() {
    if (!selectedEmpresa?.id) return
    sucursalesLoaded = false
    sucursalesError = false
    paintSucursalesResults()
    try {
      sucursales = await getSucursales({ empresaId: selectedEmpresa.id })
      sucursalesLoaded = true
      sucursalesError = false
    } catch (error) {
      if (error.message === 'Sesión expirada o no autorizada.') return
      sucursales = []
      sucursalesLoaded = true
      sucursalesError = true
      sucursalesErrorMessage = error.message || 'No se pudieron cargar las sucursales.'
      showToast({
        message: error.message || 'No se pudieron cargar las sucursales.',
        tone: 'error',
      })
    }
    paintSucursalesResults()
  }

  tabButtons.forEach((button) => {
    button.addEventListener('click', () => setSection(button.dataset.section))
  })

  container.replaceChildren(view)
  setSection(SECTIONS.usuarios)

  return () => closeActiveModal({ force: true })
}
