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

export function downloadBlob(filename, data, type = 'application/octet-stream') {
  const blob = data instanceof Blob ? data : new Blob([data], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.rel = 'noopener'
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1500)
}

export function downloadCsv(filename, content) {
  downloadBlob(filename, content, 'text/csv;charset=utf-8')
}
