import { consultarBitacora } from '../api/auditoria.js'
import { badgeHtml } from '../components/badge.js'
import { createBitacoraDetalle } from '../components/bitacora-detalle.js'
import { BTN_SECONDARY_CLASS } from '../components/button-styles.js'
import { refreshEnhancedSelect } from '../components/dropdown.js'
import { createExportMenu } from '../components/export-menu.js'
import { createFeedbackState } from '../components/feedback-state.js'
import { FORM_INPUT_CLASS, FORM_LABEL_CLASS } from '../components/form-field.js'
import { createPagination } from '../components/pagination.js'
import { createTableSkeleton } from '../components/skeleton.js'
import { printReport } from '../components/fichadas-print.js'
import { buildCsv, downloadCsv } from '../utils/csv.js'
import { escapeHtml } from '../utils/format.js'
import {
  COLUMNAS_EXPORTACION,
  MODULOS,
  PERIODOS,
  RESULTADOS,
  filtrarBitacora,
  filasExportacion,
  formatoFechaBitacora,
  normalizarEventoBitacora,
  puedeMostrarMasFiltros,
  textoAccion,
  textoDetalle,
  valoresDisponibles,
} from '../utils/bitacora.js'

const PAGE_SIZES = [10, 25, 50]
const RESULTADO_TONE = {
  Exitoso: 'success',
  Advertencia: 'warning',
  Rechazado: 'orange',
  Error: 'danger',
}
const CONTROL_CLASS = `${FORM_INPUT_CLASS} h-10`

function options(values, selected, placeholder) {
  const items = [`<option value="">${escapeHtml(placeholder)}</option>`]
  for (const value of values) {
    items.push(
      `<option value="${escapeHtml(value)}"${value === selected ? ' selected' : ''}>${escapeHtml(value)}</option>`,
    )
  }
  return items.join('')
}

export function renderRegistros(container) {
  const view = document.createElement('div')
  view.className = 'space-y-4'
  let eventos = []
  let error = ''
  let loading = true
  let page = 1
  let pageSize = 10
  let selectedId = ''
  let loadSeq = 0
  let cancelled = false
  let exportMenu = null

  view.innerHTML = `
    <section class="rounded-xl border border-slate-200 bg-white px-3 py-3 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:px-4">
      <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-6 xl:items-end">
        <div class="min-w-0 sm:col-span-2">
          <label for="registros-search" class="${FORM_LABEL_CLASS}">Buscar</label>
          <input id="registros-search" type="search" placeholder="Usuario, acción, detalle o elemento" class="${CONTROL_CLASS}" />
        </div>
        <div class="min-w-0">
          <label for="registros-periodo" class="${FORM_LABEL_CLASS}">Período</label>
          <select id="registros-periodo" class="${CONTROL_CLASS}">
            ${PERIODOS.map((item) => `<option value="${item.value}">${item.label}</option>`).join('')}
          </select>
        </div>
        <div class="min-w-0">
          <label for="registros-usuario" class="${FORM_LABEL_CLASS}">Usuario</label>
          <select id="registros-usuario" class="${CONTROL_CLASS}"><option value="">Todos</option></select>
        </div>
        <div class="min-w-0">
          <label for="registros-modulo" class="${FORM_LABEL_CLASS}">Módulo</label>
          <select id="registros-modulo" class="${CONTROL_CLASS}">
            <option value="">Todos</option>
            ${MODULOS.map((item) => `<option value="${item}">${item}</option>`).join('')}
          </select>
        </div>
        <div class="min-w-0">
          <label for="registros-resultado" class="${FORM_LABEL_CLASS}">Resultado</label>
          <select id="registros-resultado" class="${CONTROL_CLASS}">
            <option value="">Todos</option>
            ${RESULTADOS.map((item) => `<option value="${item}">${item}</option>`).join('')}
          </select>
        </div>
      </div>
      <div id="registros-rango" class="mt-3 hidden grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <div>
          <label for="registros-desde" class="${FORM_LABEL_CLASS}">Desde</label>
          <input id="registros-desde" type="date" class="${CONTROL_CLASS}" />
        </div>
        <div>
          <label for="registros-hasta" class="${FORM_LABEL_CLASS}">Hasta</label>
          <input id="registros-hasta" type="date" class="${CONTROL_CLASS}" />
        </div>
      </div>
      <div id="registros-mas" class="mt-3 hidden gap-3 sm:grid-cols-2 xl:grid-cols-4"></div>
      <div class="mt-3 flex flex-wrap items-center justify-end gap-2">
        <button type="button" id="registros-mas-toggle" class="${BTN_SECONDARY_CLASS} hidden h-10">Más filtros</button>
        <button type="button" id="registros-limpiar" class="${BTN_SECONDARY_CLASS} h-10">Limpiar</button>
        <div id="registros-export"></div>
      </div>
    </section>
    <div id="registros-results"></div>
    <div id="registros-detalle"></div>
  `

  const searchInput = view.querySelector('#registros-search')
  const periodSelect = view.querySelector('#registros-periodo')
  const userSelect = view.querySelector('#registros-usuario')
  const moduleSelect = view.querySelector('#registros-modulo')
  const resultSelect = view.querySelector('#registros-resultado')
  const range = view.querySelector('#registros-rango')
  const fromInput = view.querySelector('#registros-desde')
  const toInput = view.querySelector('#registros-hasta')
  const more = view.querySelector('#registros-mas')
  const moreButton = view.querySelector('#registros-mas-toggle')
  const clearButton = view.querySelector('#registros-limpiar')
  const exportHost = view.querySelector('#registros-export')
  const results = view.querySelector('#registros-results')
  const detailHost = view.querySelector('#registros-detalle')

  function filtros() {
    return {
      q: searchInput.value,
      periodo: periodSelect.value,
      desde: fromInput.value,
      hasta: toInput.value,
      usuario: userSelect.value,
      modulo: moduleSelect.value,
      resultado: resultSelect.value,
      accion: more.querySelector('#registros-accion')?.value || '',
      empresa: more.querySelector('#registros-empresa')?.value || '',
      sucursal: more.querySelector('#registros-sucursal')?.value || '',
      origen: more.querySelector('#registros-origen')?.value || '',
    }
  }

  function visibles() {
    return filtrarBitacora(eventos, filtros())
  }

  function syncPeriodo() {
    range.classList.toggle('hidden', periodSelect.value !== 'personalizado')
    range.classList.toggle('grid', periodSelect.value === 'personalizado')
  }

  function fillSelect(select, values, placeholder) {
    const current = select.value
    select.innerHTML = options(values, values.includes(current) ? current : '', placeholder)
    refreshEnhancedSelect(select)
  }

  function syncFiltrosDisponibles() {
    fillSelect(userSelect, valoresDisponibles(eventos, 'usuario'), 'Todos')
    const showMore = puedeMostrarMasFiltros(eventos)
    moreButton.classList.toggle('hidden', !showMore)
    if (!showMore) {
      more.classList.add('hidden')
      more.replaceChildren()
      return
    }
    const campos = [
      ['accion', 'registros-accion', 'Tipo de acción', valoresDisponibles(eventos, 'accion')],
      ['empresa', 'registros-empresa', 'Empresa', valoresDisponibles(eventos, 'empresa')],
      ['sucursal', 'registros-sucursal', 'Sucursal', valoresDisponibles(eventos, 'sucursal')],
      ['origen', 'registros-origen', 'Origen', valoresDisponibles(eventos, 'origen')],
    ].filter(([, , , values]) => values.length)
    const current = Object.fromEntries(campos.map(([, id]) => [id, more.querySelector(`#${id}`)?.value || '']))
    more.innerHTML = campos
      .map(
        ([, id, label, values]) => `
          <div>
            <label for="${id}" class="${FORM_LABEL_CLASS}">${label}</label>
            <select id="${id}" class="${CONTROL_CLASS}">${options(values, current[id] || '', 'Todos')}</select>
          </div>
        `,
      )
      .join('')
    more.querySelectorAll('select').forEach((select) => {
      select.addEventListener('change', () => {
        page = 1
        renderResults()
      })
    })
  }

  function closeDetail() {
    selectedId = ''
    detailHost.replaceChildren()
  }

  function openDetail(evento) {
    selectedId = evento.id
    detailHost.replaceChildren(createBitacoraDetalle({ evento, onClose: closeDetail }))
    detailHost.querySelector('[data-close]')?.focus()
  }

  function renderResults() {
    exportMenu?.destroy()
    exportMenu = null
    exportHost.replaceChildren()
    if (loading) {
      results.replaceChildren(createTableSkeleton({ rows: 6, columns: 6, label: 'Cargando actividad' }))
      return
    }
    if (error) {
      results.replaceChildren(
        createFeedbackState({
          title: 'No pudimos cargar la actividad',
          message: 'Volvé a intentar. Si el problema continúa, la bitácora no está disponible.',
          tone: 'error',
          actionLabel: 'Reintentar',
          onAction: () => void load(),
        }),
      )
      return
    }
    const items = visibles()
    if (!items.length) {
      results.replaceChildren(
        createFeedbackState({
          title: 'No hay actividad para mostrar',
          message: 'No encontramos registros para los filtros seleccionados.',
        }),
      )
      return
    }

    exportMenu = createExportMenu({
      id: 'registros-exportar',
      onCsv: () => exportarCsv(items),
      onPdf: () => exportarPdf(items),
    })
    exportHost.append(exportMenu.root)

    const pageCount = Math.max(1, Math.ceil(items.length / pageSize))
    if (page > pageCount) page = pageCount
    const start = (page - 1) * pageSize
    const slice = items.slice(start, start + pageSize)
    const section = document.createElement('section')
    section.className = 'overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900'
    section.innerHTML = `
      <div class="max-h-[min(32rem,calc(100dvh-16rem))] overflow-auto">
        <table class="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
          <thead class="sticky top-0 z-10 bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500 shadow-[0_1px_0_0_var(--color-slate-200)] dark:bg-slate-800 dark:text-slate-400">
            <tr>
              <th class="px-3 py-2">Fecha y hora</th>
              <th class="px-3 py-2">Usuario</th>
              <th class="px-3 py-2">Módulo</th>
              <th class="px-3 py-2">Acción</th>
              <th class="px-3 py-2">Detalle</th>
              <th class="px-3 py-2">Resultado</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
            ${slice
              .map((evento, index) => {
                const selected = evento.id && evento.id === selectedId
                return `<tr class="cursor-pointer text-sm hover:bg-slate-50 dark:hover:bg-slate-800/60 ${selected ? 'bg-slate-50 dark:bg-slate-800/60' : ''}" data-index="${start + index}" tabindex="0">
                  <td class="whitespace-nowrap px-3 py-2 text-slate-600 dark:text-slate-300">${escapeHtml(formatoFechaBitacora(evento.fechaHora))}</td>
                  <td class="whitespace-nowrap px-3 py-2">${escapeHtml(evento.usuario?.nombre || '—')}</td>
                  <td class="whitespace-nowrap px-3 py-2">${escapeHtml(evento.modulo || '—')}</td>
                  <td class="px-3 py-2 font-medium text-slate-800 dark:text-slate-100">${escapeHtml(textoAccion(evento))}</td>
                  <td class="px-3 py-2 text-slate-600 dark:text-slate-300">${escapeHtml(textoDetalle(evento) || '—')}</td>
                  <td class="whitespace-nowrap px-3 py-2">${badgeHtml(evento.resultado || '—', RESULTADO_TONE[evento.resultado] || 'neutral')}</td>
                </tr>`
              })
              .join('')}
          </tbody>
        </table>
      </div>
      <div class="flex flex-col gap-2 border-t border-slate-200 px-3 py-2 dark:border-slate-700 sm:flex-row sm:items-center sm:justify-between">
        <label class="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
          Mostrar
          <select id="registros-page-size" data-ca-native="true" class="${CONTROL_CLASS} h-8 w-20">
            ${PAGE_SIZES.map((size) => `<option value="${size}"${size === pageSize ? ' selected' : ''}>${size}</option>`).join('')}
          </select>
        </label>
        <div id="registros-pages"></div>
      </div>
    `
    section.querySelector('#registros-page-size').addEventListener('change', (event) => {
      pageSize = Number(event.target.value) || 10
      page = 1
      renderResults()
    })
    section.querySelectorAll('tbody tr').forEach((row) => {
      const open = () => {
        const evento = items[Number(row.dataset.index)]
        if (evento) openDetail(evento)
      }
      row.addEventListener('click', open)
      row.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          open()
        }
      })
    })
    const pages = section.querySelector('#registros-pages')
    pages.append(
      createPagination({
        page,
        pageCount,
        summary: `Mostrando ${start + 1}–${start + slice.length} de ${items.length}`,
        onPageChange: (next) => {
          page = next
          renderResults()
        },
      }),
    )
    results.replaceChildren(section)
  }

  function exportarCsv(items) {
    const stamp = new Date().toISOString().slice(0, 10)
    downloadCsv(`registros-${stamp}.csv`, buildCsv(COLUMNAS_EXPORTACION, filasExportacion(items)))
  }

  function exportarPdf(items) {
    const filtro = filtros()
    const stamp = new Date().toISOString().slice(0, 10)
    printReport({
      title: 'Bitácora operativa',
      periodo: PERIODOS.find((item) => item.value === filtro.periodo)?.label || '',
      generatedAt: new Date().toISOString(),
      filters: [filtro.modulo, filtro.resultado, filtro.usuario].filter(Boolean).join(' | '),
      columns: ['Fecha y hora', 'Usuario', 'Módulo', 'Acción', 'Resultado'],
      rows: items.map((evento) => [
        formatoFechaBitacora(evento.fechaHora),
        evento.usuario?.nombre || '',
        evento.modulo,
        textoAccion(evento),
        evento.resultado,
      ]),
      landscape: true,
      filename: `registros-${stamp}.pdf`,
    })
  }

  function onFilterChange() {
    page = 1
    syncPeriodo()
    renderResults()
  }

  searchInput.addEventListener('input', onFilterChange)
  ;[periodSelect, userSelect, moduleSelect, resultSelect, fromInput, toInput].forEach((control) => {
    control.addEventListener('change', onFilterChange)
  })
  moreButton.addEventListener('click', () => {
    const open = more.classList.contains('hidden')
    more.classList.toggle('hidden', !open)
    more.classList.toggle('grid', open)
  })
  clearButton.addEventListener('click', () => {
    searchInput.value = ''
    periodSelect.value = 'hoy'
    userSelect.value = ''
    moduleSelect.value = ''
    resultSelect.value = ''
    fromInput.value = ''
    toInput.value = ''
    more.querySelectorAll('select').forEach((select) => {
      select.value = ''
    })
    page = 1
    syncPeriodo()
    renderResults()
  })

  function onKeydown(event) {
    if (event.key === 'Escape' && selectedId) closeDetail()
  }

  async function load() {
    const seq = ++loadSeq
    loading = true
    error = ''
    renderResults()
    try {
      const result = await consultarBitacora()
      if (cancelled || seq !== loadSeq) return
      eventos = (Array.isArray(result?.eventos) ? result.eventos : [])
        .map((evento) => normalizarEventoBitacora(evento))
        .filter(Boolean)
    } catch {
      if (cancelled || seq !== loadSeq) return
      error = 'error'
      eventos = []
    } finally {
      if (!cancelled && seq === loadSeq) {
        loading = false
        syncFiltrosDisponibles()
        renderResults()
      }
    }
  }

  window.addEventListener('keydown', onKeydown)
  container.replaceChildren(view)
  syncPeriodo()
  void load()

  return () => {
    cancelled = true
    exportMenu?.destroy()
    window.removeEventListener('keydown', onKeydown)
  }
}
