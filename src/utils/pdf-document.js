const PAGE = { landscape: { width: 841.89, height: 595.28 }, portrait: { width: 595.28, height: 841.89 } }
const WIN = {
  'á': 0xe1, 'é': 0xe9, 'í': 0xed, 'ó': 0xf3, 'ú': 0xfa,
  'Á': 0xc1, 'É': 0xc9, 'Í': 0xcd, 'Ó': 0xd3, 'Ú': 0xda,
  'ñ': 0xf1, 'Ñ': 0xd1, 'ü': 0xfc, 'Ü': 0xdc,
  '¿': 0xbf, '¡': 0xa1, '°': 0xb0, '–': 0x96, '—': 0x97,
  '“': 0x93, '”': 0x94, '‘': 0x91, '’': 0x92,
}
const LOGO_MAX_WIDTH = 148
const LOGO_MAX_HEIGHT = 32

function sanitizePdfSource(value) {
  return String(value ?? '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\u00b7/g, ' | ')
    .replace(/\u2022/g, ' | ')
    .replace(/\u2026/g, '...')
    .replace(/[—–]/g, '-')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function encodePdfText(value) {
  let out = ''
  for (const ch of sanitizePdfSource(value)) {
    if (ch === '\\' || ch === '(' || ch === ')') out += `\\${ch}`
    else if (ch === '\n' || ch === '\r') out += ' '
    else {
      const code = WIN[ch] ?? (ch.charCodeAt(0) < 128 ? ch.charCodeAt(0) : null)
      if (code == null) continue
      out += String.fromCharCode(code)
    }
  }
  return out
}

function textWidth(value, size) {
  return encodePdfText(value).length * size * 0.5
}

function pad(value) {
  return String(value).padStart(2, '0')
}

export function formatPdfStamp(value) {
  const text = sanitizePdfSource(value)
  if (!text) return ''
  if (/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/.test(text)) return text
  const loose = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})(?:(?:,)?\s+(\d{1,2}):(\d{2}))?/)
  if (loose) {
    const year = loose[3].length === 2 ? `20${loose[3]}` : loose[3]
    let hour = Number(loose[4] ?? 0)
    const minute = loose[5] ?? '00'
    if (/p\.\s*m/i.test(text) && hour < 12) hour += 12
    if (/a\.\s*m/i.test(text) && hour === 12) hour = 0
    return `${pad(loose[1])}/${pad(loose[2])}/${year} ${pad(hour)}:${pad(minute)}`
  }
  const date = new Date(text)
  if (Number.isNaN(date.getTime())) return text
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function formatPdfDate(value) {
  const text = sanitizePdfSource(value)
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|[T\s])/)
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`
  const short = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/)
  if (!short) return text
  const year = short[3].length === 2 ? `20${short[3]}` : short[3]
  return `${pad(short[1])}/${pad(short[2])}/${year}`
}

function formatPdfLegajo(value) {
  const text = sanitizePdfSource(value)
  if (/^\d{1,3}$/.test(text)) return text.padStart(4, '0')
  return text
}

function isBlankCell(value) {
  const text = sanitizePdfSource(value)
  return !text || text === '—' || text === '–' || text === '-'
}

function normalizePeriod(value) {
  let text = sanitizePdfSource(value)
  if (!text) return ''
  text = text.replace(/^(?:per[ií]odo:\s*)+/i, '')
  text = text.replace(/\b(\d{4})-(\d{2})-(\d{2})\b/g, (_, year, month, day) => `${day}/${month}/${year}`)
  text = text.replace(/^últimos\b/i, 'Últimos')
  text = text.replace(/^hoy$/i, 'Hoy')
  return text ? `Período: ${text}` : ''
}

function normalizeSummary(summaryItems, summaryLines) {
  if (Array.isArray(summaryItems) && summaryItems.length) {
    return summaryItems
      .map((item) => ({
        label: sanitizePdfSource(item?.label).replace(/^Revisar$/i, 'En revisión'),
        value: sanitizePdfSource(item?.value),
      }))
      .filter((item) => item.label)
  }
  const items = []
  for (const line of summaryLines ?? []) {
    for (const part of sanitizePdfSource(line).split(/\s+\|\s+/).filter(Boolean)) {
      const match = part.match(/^(.*?):\s*(.*)$/)
      if (!match) continue
      items.push({
        label: match[1].replace(/^Revisar$/i, 'En revisión'),
        value: match[2],
      })
    }
  }
  return items
}

function prepareTable(columns, rows) {
  const headers = (columns.length ? columns : ['Resultado']).map((column) => sanitizePdfSource(column) || 'Columna')
  const source = (rows.length ? rows : [['']]).map((row) => headers.map((_, index) => row?.[index] ?? ''))
  const keep = headers.map((header, index) => {
    if (!/observ/i.test(header)) return true
    return source.some((row) => !isBlankCell(row[index]))
  })
  const nextHeaders = headers.filter((_, index) => keep[index])
  const nextRows = source.map((row) => row.filter((_, index) => keep[index]).map((cell, index) => {
    const header = nextHeaders[index] ?? ''
    if (isBlankCell(cell)) return ''
    if (/^fecha\b/i.test(header)) return formatPdfDate(cell)
    if (/^legajo\b/i.test(header)) return formatPdfLegajo(cell)
    return sanitizePdfSource(cell)
  }))
  return {
    headers: nextHeaders.length ? nextHeaders : ['Resultado'],
    rows: nextRows.length ? nextRows : [['']],
  }
}

function wrap(value, width, size, limit = 3) {
  const max = Math.max(4, Math.floor(width / (size * 0.5)))
  const source = sanitizePdfSource(value)
  if (!source) return ['']
  const words = source.split(' ')
  const lines = []
  let line = ''
  for (const word of words) {
    const piece = word.length > max ? `${word.slice(0, Math.max(1, max - 3))}...` : word
    const next = line ? `${line} ${piece}` : piece
    if (next.length <= max) line = next
    else {
      if (line) lines.push(line)
      line = piece
    }
    if (lines.length === limit) return lines
  }
  if (line) lines.push(line)
  return lines.slice(0, limit)
}

function latin1(text) {
  const out = new Uint8Array(text.length)
  for (let index = 0; index < text.length; index += 1) out[index] = text.charCodeAt(index) & 0xff
  return out
}

function concat(chunks) {
  const size = chunks.reduce((total, chunk) => total + chunk.length, 0)
  const out = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    out.set(chunk, offset)
    offset += chunk.length
  }
  return out
}

function logoBox(logo) {
  if (!logo?.bytes?.length || !logo.width || !logo.height) return null
  const scale = Math.min(LOGO_MAX_WIDTH / logo.width, LOGO_MAX_HEIGHT / logo.height)
  return { width: logo.width * scale, height: logo.height * scale }
}

function drawText(commands, text, x, y, { size = 9, bold = false, color = '0.12 0.16 0.22' } = {}) {
  commands.push(`${color} rg`)
  commands.push(`BT /${bold ? 'F2' : 'F1'} ${size} Tf ${x.toFixed(2)} ${y.toFixed(2)} Td (${encodePdfText(text)}) Tj ET`)
}

export function buildPdfBytes({
  title = '',
  empresa = '',
  periodo = '',
  generatedAt = '',
  filters = '',
  summaryItems = [],
  summaryLines = [],
  columns = [],
  rows = [],
  landscape = false,
  footer = 'Informe operativo',
  logo = null,
} = {}) {
  const page = landscape ? PAGE.landscape : PAGE.portrait
  const margin = 36
  const usable = page.width - margin * 2
  const prepared = prepareTable(columns, rows)
  const headers = prepared.headers
  const body = prepared.rows
  const items = normalizeSummary(summaryItems, summaryLines)
  const periodLine = normalizePeriod(periodo)
  const filterLine = sanitizePdfSource(filters) ? `Filtros: ${sanitizePdfSource(filters)}` : ''
  const stamp = formatPdfStamp(generatedAt)
  const company = sanitizePdfSource(empresa)
  const documentTitle = sanitizePdfSource(title) || 'Informe'
  const widths = headers.map((header, index) => {
    const sample = body.slice(0, 12).reduce((max, row) => Math.max(max, sanitizePdfSource(row[index]).length), header.length)
    return Math.max(42, Math.min(180, 16 + sample * 4.4))
  })
  const widthSum = widths.reduce((total, width) => total + width, 0)
  const columnWidths = widths.map((width) => (width / widthSum) * usable)
  const fontSize = headers.length > 8 ? 8 : 9
  const lineHeight = fontSize + 3
  const headerLines = Math.max(1, ...headers.map((header, index) => wrap(header, columnWidths[index] - 8, fontSize, 2).length))
  const tableHeaderHeight = headerLines * lineHeight + 8
  const image = logoBox(logo)
  const footerReserve = 48
  const summaryHeight = items.length ? 40 : 0
  const introHeight = (periodLine ? 14 : 0) + (filterLine ? 14 : 0) + summaryHeight
  const chromeHeight = Math.max(image?.height ?? 0, 34) + 22

  function rowHeight(row) {
    const lines = Math.max(1, ...headers.map((_, column) => wrap(row[column], columnWidths[column] - 8, fontSize).length))
    return lines * lineHeight + 6
  }

  const pages = []
  let index = 0
  let first = true
  while (index < body.length) {
    const top = page.height - margin - chromeHeight - (first ? introHeight : 0) - 8
    const room = Math.max(rowHeight(body[index]), top - footerReserve - tableHeaderHeight)
    const slice = []
    let used = 0
    while (index < body.length) {
      const height = rowHeight(body[index])
      if (slice.length && used + height > room) break
      slice.push({ cells: body[index], height })
      used += height
      index += 1
    }
    pages.push({ first, slice })
    first = false
  }
  if (!pages.length) pages.push({ first: true, slice: [] })

  const objects = []
  const add = (bodyText, extra = null) => {
    objects.push({ body: bodyText, extra })
    return objects.length
  }
  const font = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>')
  const fontBold = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>')
  let imageId = null
  if (image) {
    imageId = add(
      `<< /Type /XObject /Subtype /Image /Width ${logo.width} /Height ${logo.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${logo.bytes.length} >>`,
      logo.bytes,
    )
  }

  const pageIds = []
  pages.forEach((item, pageIndex) => {
    const commands = []
    const pageNumber = pageIndex + 1
    const pageTotal = pages.length
    let cursor = page.height - margin
    if (imageId) {
      commands.push(`q ${image.width.toFixed(2)} 0 0 ${image.height.toFixed(2)} ${margin.toFixed(2)} ${(cursor - image.height).toFixed(2)} cm /Im1 Do Q`)
    }
    const meta = [company, stamp, `Página ${pageNumber} de ${pageTotal}`].filter(Boolean)
    meta.forEach((line, lineIndex) => {
      const size = 9
      const x = page.width - margin - textWidth(line, size)
      drawText(commands, line, x, cursor - 11 - lineIndex * 12, { size, color: '0.28 0.35 0.45' })
    })
    const titleY = cursor - Math.max(image?.height ?? 0, meta.length * 12) - 16
    drawText(commands, documentTitle, margin, titleY, { size: 14, bold: true })
    const ruleY = titleY - 8
    commands.push(`0.80 0.84 0.89 RG 0.6 w ${margin} ${ruleY.toFixed(2)} m ${(page.width - margin).toFixed(2)} ${ruleY.toFixed(2)} l S`)
    cursor = ruleY - 16
    if (item.first && periodLine) {
      drawText(commands, periodLine, margin, cursor, { size: 10 })
      cursor -= 14
    }
    if (item.first && filterLine) {
      drawText(commands, filterLine, margin, cursor, { size: 9, color: '0.28 0.35 0.45' })
      cursor -= 14
    }
    if (item.first && items.length) {
      const gap = 6
      const boxH = 32
      const boxW = (usable - gap * (items.length - 1)) / items.length
      items.forEach((entry, entryIndex) => {
        const x = margin + entryIndex * (boxW + gap)
        const y = cursor - boxH
        commands.push(`0.96 0.97 0.98 rg ${x.toFixed(2)} ${y.toFixed(2)} ${boxW.toFixed(2)} ${boxH.toFixed(2)} re f`)
        commands.push(`0.82 0.86 0.90 RG 0.7 w ${x.toFixed(2)} ${y.toFixed(2)} ${boxW.toFixed(2)} ${boxH.toFixed(2)} re S`)
        drawText(commands, entry.label, x + 6, y + 16, { size: 8, color: '0.28 0.35 0.45' })
        drawText(commands, entry.value, x + 6, y + 5, { size: 11, bold: true })
      })
      cursor -= boxH + 10
    }
    commands.push(`0.95 0.96 0.98 rg ${margin} ${(cursor - tableHeaderHeight).toFixed(2)} ${usable.toFixed(2)} ${tableHeaderHeight.toFixed(2)} re f`)
    let x = margin
    headers.forEach((header, column) => {
      wrap(header, columnWidths[column] - 8, fontSize, 2).forEach((line, lineIndex) => {
        drawText(commands, line, x + 4, cursor - (lineIndex + 1) * lineHeight, { size: fontSize, bold: true })
      })
      x += columnWidths[column]
    })
    cursor -= tableHeaderHeight
    item.slice.forEach((row, rowIndex) => {
      if (rowIndex % 2 === 1) {
        commands.push(`0.97 0.98 0.99 rg ${margin} ${(cursor - row.height).toFixed(2)} ${usable.toFixed(2)} ${row.height.toFixed(2)} re f`)
      }
      let cellX = margin
      headers.forEach((_, column) => {
        wrap(row.cells[column], columnWidths[column] - 8, fontSize).forEach((line, lineIndex) => {
          drawText(commands, line, cellX + 4, cursor - (lineIndex + 1) * lineHeight, { size: fontSize })
        })
        cellX += columnWidths[column]
      })
      cursor -= row.height
    })
    commands.push(`0.86 0.89 0.92 RG 0.5 w ${margin} 32 m ${(page.width - margin).toFixed(2)} 32 l S`)
    const footerText = [footer, company, stamp ? `Generado el ${stamp}` : '', `Página ${pageNumber} de ${pageTotal}`]
      .filter(Boolean)
      .join(' | ')
    drawText(commands, footerText, margin, 20, { size: 8, color: '0.39 0.45 0.55' })
    const stream = commands.join('\n')
    const contentId = add(`<< /Length ${latin1(stream).length} >>`, latin1(stream))
    const resources = imageId
      ? `/Font << /F1 ${font} 0 R /F2 ${fontBold} 0 R >> /XObject << /Im1 ${imageId} 0 R >>`
      : `/Font << /F1 ${font} 0 R /F2 ${fontBold} 0 R >>`
    pageIds.push(add(`<< /Type /Page /Parent PAGES 0 R /MediaBox [0 0 ${page.width} ${page.height}] /Resources << ${resources} >> /Contents ${contentId} 0 R >>`))
  })
  const pagesId = add(`<< /Type /Pages /Count ${pageIds.length} /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] >>`)
  const catalogId = add(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`)
  objects.forEach((object) => {
    object.body = object.body.replace('PAGES 0 R', `${pagesId} 0 R`)
  })

  const chunks = [latin1('%PDF-1.4\n')]
  const offsets = [0]
  objects.forEach((object, objectIndex) => {
    offsets.push(chunks.reduce((total, chunk) => total + chunk.length, 0))
    const header = latin1(`${objectIndex + 1} 0 obj\n${object.body}\n`)
    if (object.extra) {
      chunks.push(header, latin1('stream\n'), object.extra, latin1('\nendstream\nendobj\n'))
    } else {
      chunks.push(header, latin1('endobj\n'))
    }
  })
  const xref = chunks.reduce((total, chunk) => total + chunk.length, 0)
  let table = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (let offsetIndex = 1; offsetIndex < offsets.length; offsetIndex += 1) {
    table += `${String(offsets[offsetIndex]).padStart(10, '0')} 00000 n \n`
  }
  table += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xref}\n%%EOF`
  chunks.push(latin1(table))
  return concat(chunks)
}
