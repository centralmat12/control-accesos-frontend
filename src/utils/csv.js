function csvProtect(value) {
  const text = String(value ?? '')
  if (/^[=+\-@\t\r]/.test(text)) return `'${text}`
  return text
}

function csvEscape(value) {
  const protectedValue = csvProtect(value)
  if (/[;"\n\r]/.test(protectedValue)) {
    return `"${protectedValue.replaceAll('"', '""')}"`
  }
  return protectedValue
}

export function buildCsv(headers, rows) {
  const lines = [headers.map(csvEscape).join(';'), ...rows.map((row) => row.map(csvEscape).join(';'))]
  return `\uFEFF${lines.join('\r\n')}`
}

export function downloadCsv(filename, content) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
