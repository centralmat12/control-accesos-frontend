import { BTN_SECONDARY_CLASS } from './button-styles.js'
import { openConfirmModal, openModal } from './modal.js'
import { escapeHtml } from '../utils/format.js'
import {
  allColumnIds,
} from '../utils/fichadas-columns.js'
import {
  FICHADAS_CSV_EXPORT_LABEL,
  FICHADAS_CSV_FULL_DESCRIPTION,
  FICHADAS_CSV_FULL_TITLE,
  FICHADAS_CSV_FULL_WARNING,
  FICHADAS_CSV_GENERATING_LABEL,
  FICHADAS_CSV_LARGE_TITLE,
  FICHADAS_CSV_MODAL_SUBTITLE,
  FICHADAS_CSV_MODAL_TITLE,
  FICHADAS_CSV_RECOMMENDED,
  FICHADAS_CSV_VIEW_DESCRIPTION,
  FICHADAS_CSV_VIEW_TITLE,
  csvExportSummaryLabel,
  largeCsvConfirmMessage,
  resolveFichadasCsvSnapshot,
  runFichadasCsvExportAttempt,
} from '../utils/fichadas-export.js'

function optionCardClass(selected) {
  return selected
    ? 'flex cursor-pointer items-start gap-3 rounded-xl border-2 border-blue-600 bg-blue-50 p-3 dark:border-blue-400 dark:bg-blue-950/40'
    : 'flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-500'
}

export function fichadasCsvExportMarkup({
  viewRecordCount = 0,
  viewColumnCount = 0,
  completeRecordCount = null,
  completeColumnCount = 0,
  completeLoading = false,
  selectedMode = 'view',
  busy = false,
  errorMessage = '',
} = {}) {
  const viewSelected = selectedMode !== 'full'
  const completeCountLabel = completeLoading
    ? 'Calculando cantidad…'
    : completeRecordCount == null
      ? 'Se consultarán todos los registros permitidos de la empresa.'
      : csvExportSummaryLabel(completeRecordCount, completeColumnCount)

  return `
    <div class="space-y-4" data-fichadas-csv-export>
      <div role="radiogroup" aria-label="Información a exportar" class="grid gap-3">
        <label class="${optionCardClass(viewSelected)}" data-csv-option="view">
          <input
            type="radio"
            name="fichadas-csv-mode"
            value="view"
            class="mt-1 h-4 w-4 border-slate-300 text-blue-600 focus:ring-blue-500"
            ${viewSelected ? 'checked' : ''}
            ${busy ? 'disabled' : ''}
          />
          <span class="min-w-0 flex-1">
            <span class="flex flex-wrap items-center gap-2">
              <span class="text-sm font-semibold text-slate-900 dark:text-slate-100">${escapeHtml(FICHADAS_CSV_VIEW_TITLE)}</span>
              <span class="rounded-full bg-blue-600 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-white">${escapeHtml(FICHADAS_CSV_RECOMMENDED)}</span>
            </span>
            <span class="mt-1 block text-sm text-slate-600 dark:text-slate-300">${escapeHtml(FICHADAS_CSV_VIEW_DESCRIPTION)}</span>
            <span data-view-summary class="mt-2 block text-sm font-medium text-slate-800 dark:text-slate-200">${escapeHtml(csvExportSummaryLabel(viewRecordCount, viewColumnCount))}</span>
          </span>
        </label>
        <label class="${optionCardClass(!viewSelected)}" data-csv-option="full">
          <input
            type="radio"
            name="fichadas-csv-mode"
            value="full"
            class="mt-1 h-4 w-4 border-slate-300 text-blue-600 focus:ring-blue-500"
            ${viewSelected ? '' : 'checked'}
            ${busy ? 'disabled' : ''}
          />
          <span class="min-w-0 flex-1">
            <span class="text-sm font-semibold text-slate-900 dark:text-slate-100">${escapeHtml(FICHADAS_CSV_FULL_TITLE)}</span>
            <span class="mt-1 block text-sm text-slate-600 dark:text-slate-300">${escapeHtml(FICHADAS_CSV_FULL_DESCRIPTION)}</span>
            <span class="mt-2 block text-sm font-medium text-amber-800 dark:text-amber-200">${escapeHtml(FICHADAS_CSV_FULL_WARNING)}</span>
            <span data-full-summary class="mt-2 block text-sm font-medium text-slate-800 dark:text-slate-200">${escapeHtml(completeCountLabel)}</span>
          </span>
        </label>
      </div>
      <p data-csv-error class="${errorMessage ? '' : 'hidden'} rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200" role="alert">${escapeHtml(errorMessage)}</p>
      <div data-csv-progress class="${busy ? '' : 'hidden'} flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300" role="status" aria-live="polite">
        <span class="h-3.5 w-3.5 animate-pulse rounded-full bg-blue-600" aria-hidden="true"></span>
        <span>${escapeHtml(FICHADAS_CSV_GENERATING_LABEL)}</span>
      </div>
      <div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" data-action="cancel" data-autofocus class="${BTN_SECONDARY_CLASS}" ${busy ? 'disabled' : ''}>Cancelar</button>
        <button type="button" data-action="export" class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60" ${busy ? 'disabled' : ''}>
          ${busy ? escapeHtml(FICHADAS_CSV_GENERATING_LABEL) : escapeHtml(FICHADAS_CSV_EXPORT_LABEL)}
        </button>
      </div>
    </div>
  `
}

export function openFichadasCsvExportModal({
  viewSelection,
  completeRecordCount = null,
  loadCompleteSelection,
  stamp,
  download,
} = {}) {
  let exporting = false
  let busy = false
  let selectedMode = 'view'
  let completeSelection = null
  let completeCount = completeRecordCount
  let completeLoading = typeof loadCompleteSelection === 'function'
  let loadGeneration = 0

  const viewSnapshot = resolveFichadasCsvSnapshot({ mode: 'view', viewSelection })
  const content = document.createElement('div')

  function paint({ errorMessage = '' } = {}) {
    content.innerHTML = fichadasCsvExportMarkup({
      viewRecordCount: viewSnapshot.recordCount,
      viewColumnCount: viewSnapshot.columnIds.length,
      completeColumnCount: allColumnIds(viewSelection?.view === 'jornadas' ? 'jornadas' : 'movimientos').length,
      completeLoading,
      selectedMode,
      busy,
      errorMessage,
    })
    bind()
  }

  function currentSnapshot() {
    return resolveFichadasCsvSnapshot({
      mode: selectedMode,
      viewSelection,
      completeSelection: completeSelection ?? viewSelection,
    })
  }

  const modal = openModal({
    title: FICHADAS_CSV_MODAL_TITLE,
    subtitle: FICHADAS_CSV_MODAL_SUBTITLE,
    content,
    labelledBy: 'fichadas-csv-export-title',
    dialogClass: 'max-w-xl',
    closeOnBackdrop: () => !busy,
    closeOnEscape: () => !busy,
    canClose: () => !busy,
    unsavedChanges: false,
  })

  const closeButton = modal.dialog.querySelector('[aria-label="Cerrar"]')

  function setBusy(nextBusy) {
    busy = nextBusy
    modal.dialog.setAttribute('aria-busy', nextBusy ? 'true' : 'false')
    if (closeButton) closeButton.disabled = nextBusy
    const cancelBtn = content.querySelector('[data-action="cancel"]')
    const exportBtn = content.querySelector('[data-action="export"]')
    const progress = content.querySelector('[data-csv-progress]')
    const radios = content.querySelectorAll('input[name="fichadas-csv-mode"]')
    if (cancelBtn) cancelBtn.disabled = nextBusy
    if (exportBtn) {
      exportBtn.disabled = nextBusy
      exportBtn.textContent = nextBusy ? FICHADAS_CSV_GENERATING_LABEL : FICHADAS_CSV_EXPORT_LABEL
    }
    progress?.classList.toggle('hidden', !nextBusy)
    radios.forEach((input) => {
      input.disabled = nextBusy
    })
  }

  function showError(message) {
    const errorNode = content.querySelector('[data-csv-error]')
    if (!errorNode) return
    errorNode.textContent = message || ''
    errorNode.classList.toggle('hidden', !message)
  }

  function bind() {
    content.querySelectorAll('input[name="fichadas-csv-mode"]').forEach((input) => {
      input.addEventListener('change', () => {
        if (busy) return
        selectedMode = input.value === 'full' ? 'full' : 'view'
        paint()
      })
    })
    content.querySelector('[data-action="cancel"]')?.addEventListener('click', () => {
      if (busy) return
      modal.close({ force: true })
    })
    content.querySelector('[data-action="export"]')?.addEventListener('click', async () => {
      if (busy || exporting) return
      exporting = true
      showError('')
      try {
        if (selectedMode === 'full' && loadCompleteSelection && !completeSelection) {
          completeLoading = true
          paint()
          completeSelection = await loadCompleteSelection()
          completeCount = completeSelection?.records?.length ?? 0
          completeLoading = false
          paint()
        }

        const snapshot = currentSnapshot()
        const outcome = await runFichadasCsvExportAttempt({
          busy: false,
          snapshot,
          stamp,
          confirmLarge: async (count) =>
            openConfirmModal({
              title: FICHADAS_CSV_LARGE_TITLE,
              message: largeCsvConfirmMessage(count),
              confirmLabel: FICHADAS_CSV_EXPORT_LABEL,
              cancelLabel: 'Cancelar',
            }),
          download: async (filename, csv) => {
            setBusy(true)
            download(filename, csv)
          },
        })

        if (outcome.status === 'busy' || outcome.status === 'cancelled') return
        if (outcome.status === 'ok') {
          modal.close({ force: true })
          return
        }
        showError(outcome.message || 'No se pudo generar el CSV.')
      } catch (error) {
        completeLoading = false
        showError(error?.message || 'No se pudo generar el CSV.')
      } finally {
        exporting = false
        setBusy(false)
      }
    })
  }

  paint()

  if (typeof loadCompleteSelection === 'function') {
    const generation = ++loadGeneration
    Promise.resolve()
      .then(() => loadCompleteSelection())
      .then((selection) => {
        if (generation !== loadGeneration) return
        completeSelection = selection
        completeCount = selection?.records?.length ?? 0
        completeLoading = false
        paint()
      })
      .catch((error) => {
        if (generation !== loadGeneration) return
        completeLoading = false
        paint({ errorMessage: error?.message || 'No se pudieron estimar los registros completos.' })
      })
  }

  return {
    close: (options) => modal.close(options),
    dialog: modal.dialog,
  }
}
