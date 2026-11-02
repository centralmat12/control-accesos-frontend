import { escapeHtml } from '../utils/format.js'
import { FICHADAS_EXPORT_TITLE } from '../utils/fichadas-export.js'
import { BRAND_LOGO } from '../config/branding.js'
import { buildPdfBytes } from '../utils/pdf-document.js'
import { downloadBlob } from '../utils/csv.js'

function rowHtml(cells) {
  return `<tr>${cells.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`
}

export function buildFichadasPrintDocument({
  title = FICHADAS_EXPORT_TITLE,
  empresa,
  periodo,
  generatedAt,
  filters,
  totals,
  columns,
  rows,
  notes,
  summaryLines,
  landscape = false,
  logoSrc = '',
} = {}) {
  const empresaLine = empresa ? `<p><strong>Empresa:</strong> ${escapeHtml(empresa)}</p>` : ''
  const periodoLine = periodo ? `<p><strong>Período consultado:</strong> ${escapeHtml(periodo)}</p>` : ''
  const notesHtml = notes?.length
    ? `<ul class="notes">${notes.map((note) => `<li>${escapeHtml(note)}</li>`).join('')}</ul>`
    : ''
  const lines = Array.isArray(summaryLines) && summaryLines.length
    ? summaryLines
    : [
        `<p><strong>Cantidad total:</strong> ${escapeHtml(String(totals?.total ?? 0))}</p>`,
        `<p><strong>Entradas:</strong> ${escapeHtml(String(totals?.entradas ?? 0))} · <strong>Salidas:</strong> ${escapeHtml(String(totals?.salidas ?? 0))}</p>`,
      ]
  const filtersLine = filters
    ? `<p class="filters"><strong>Filtros activos:</strong> ${escapeHtml(filters)}</p>`
    : ''

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    @page { size: A4 ${landscape ? 'landscape' : 'portrait'}; margin: 12mm 12mm 16mm; @bottom-right { content: "Página " counter(page); font-size: 10px; color: #475569; } }
    body { font-family: Arial, sans-serif; color: #0f172a; font-size: 12px; }
    h1 { font-size: 18px; margin: 0 0 8px; }
    p, li { margin: 0 0 4px; }
    .meta { margin-bottom: 12px; }
    .filters { color: #475569; font-size: 11px; }
    .logo { height: 36px; width: auto; margin-bottom: 8px; }
    .doc-foot { margin-top: 14px; color: #64748b; font-size: 10px; }
    .notes { margin: 8px 0 14px; padding-left: 18px; color: #334155; }
    table { width: 100%; border-collapse: collapse; }
    thead { display: table-header-group; }
    tr { break-inside: avoid; page-break-inside: avoid; }
    th, td { border: 1px solid #cbd5e1; padding: 6px; text-align: left; vertical-align: top; overflow-wrap: anywhere; }
    td { white-space: pre-line; }
    th { background: #f1f5f9; font-size: 10px; text-transform: uppercase; white-space: nowrap; }
  </style>
</head>
<body>
  ${logoSrc ? `<img class="logo" src="${escapeHtml(logoSrc)}" alt="" />` : ''}
  <h1>${escapeHtml(title)}</h1>
  <div class="meta">
    ${empresaLine}
    ${periodoLine}
    <p><strong>Generado:</strong> ${escapeHtml(generatedAt ?? '')}</p>
    ${filtersLine}
    ${lines.join('\n    ')}
  </div>
  ${notesHtml}
  <table>
    <thead>
      <tr>${(columns ?? []).map((column) => `<th>${escapeHtml(column)}</th>`).join('')}</tr>
    </thead>
    <tbody>
      ${(rows ?? []).map((row) => rowHtml(row)).join('')}
    </tbody>
  </table>
  <p class="doc-foot">Informe operativo</p>
</body>
</html>`
}

async function logoJpeg(src) {
  if (!src || typeof document === 'undefined' || typeof Image === 'undefined') return null
  const image = new Image()
  image.crossOrigin = 'anonymous'
  await new Promise((resolve, reject) => {
    image.onload = () => resolve()
    image.onerror = () => reject(new Error('No se pudo leer el logo.'))
    image.src = src
  })
  const canvas = document.createElement('canvas')
  const maxWidth = 480
  const scale = Math.min(1, maxWidth / Math.max(1, image.naturalWidth))
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
  const context = canvas.getContext('2d')
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.drawImage(image, 0, 0, canvas.width, canvas.height)
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92))
  if (!blob) return null
  return { bytes: new Uint8Array(await blob.arrayBuffer()), width: canvas.width, height: canvas.height }
}

function plainSummary(lines) {
  return (Array.isArray(lines) ? lines : [])
    .map((line) => String(line ?? '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
}

export async function printReport(options = {}) {
  const origin = globalThis.location?.origin || ''
  const logoSrc = options.logoSrc || (origin ? `${origin}${BRAND_LOGO.horizontalBlue}` : '')
  let logo = null
  try {
    logo = await logoJpeg(logoSrc)
  } catch (error) {
    console.error(error)
  }
  const bytes = buildPdfBytes({
    title: options.title || FICHADAS_EXPORT_TITLE,
    empresa: options.empresa,
    periodo: options.periodo,
    generatedAt: options.generatedAt,
    filters: options.filters,
    summaryItems: options.summaryItems,
    summaryLines: plainSummary(options.summaryLines),
    columns: options.columns,
    rows: options.rows,
    landscape: Boolean(options.landscape),
    footer: 'Informe operativo',
    logo,
  })
  const filename = options.filename || 'reporte.pdf'
  downloadBlob(filename, bytes, 'application/pdf')
}
