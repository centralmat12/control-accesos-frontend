import { escapeHtml } from '../utils/format.js'

function rowHtml(cells) {
  return `<tr>${cells.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`
}

export function printReport({ title, empresa, generatedAt, filters, totals, columns, rows, notes }) {
  const empresaLine = empresa ? `<p><strong>Empresa:</strong> ${escapeHtml(empresa)}</p>` : ''
  const notesHtml = notes?.length
    ? `<ul class="notes">${notes.map((note) => `<li>${escapeHtml(note)}</li>`).join('')}</ul>`
    : ''

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    @page { size: A4; margin: 14mm; }
    body { font-family: Arial, sans-serif; color: #0f172a; font-size: 12px; }
    h1 { font-size: 18px; margin: 0 0 8px; }
    p, li { margin: 0 0 4px; }
    .meta { margin-bottom: 12px; }
    .notes { margin: 8px 0 14px; padding-left: 18px; color: #334155; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #cbd5e1; padding: 6px; text-align: left; }
    th { background: #f1f5f9; font-size: 11px; text-transform: uppercase; }
  </style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <div class="meta">
    ${empresaLine}
    <p><strong>Generado:</strong> ${escapeHtml(generatedAt)}</p>
    <p><strong>Filtros:</strong> ${escapeHtml(filters)}</p>
    <p><strong>Cantidad total:</strong> ${escapeHtml(String(totals.total))}</p>
    <p><strong>Entradas:</strong> ${escapeHtml(String(totals.entradas))} · <strong>Salidas:</strong> ${escapeHtml(String(totals.salidas))}</p>
  </div>
  ${notesHtml}
  <table>
    <thead>
      <tr>${columns.map((column) => `<th>${escapeHtml(column)}</th>`).join('')}</tr>
    </thead>
    <tbody>
      ${rows.map((row) => rowHtml(row)).join('')}
    </tbody>
  </table>
</body>
</html>`

  const popup = window.open('', '_blank', 'width=900,height=700')
  if (!popup) {
    throw new Error('El navegador bloqueó la ventana de impresión. Permití ventanas emergentes e intentá de nuevo.')
  }

  popup.opener = null
  popup.document.open()
  popup.document.write(html)
  popup.document.close()
  popup.focus()
  popup.print()
}
