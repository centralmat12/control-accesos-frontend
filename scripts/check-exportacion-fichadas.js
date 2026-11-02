import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildCsv } from '../src/utils/csv.js'
import { buildPdfBytes, formatPdfStamp } from '../src/utils/pdf-document.js'
import { buildFichadasCsvPayload, buildFichadasExportSnapshot, buildFichadasViewSelection } from '../src/utils/fichadas-export.js'
import { csvInforme, nombreCsvInforme, nombreExportInforme } from '../src/utils/informe-asistencia.js'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const read = (path) => readFileSync(join(root, path), 'utf8')

const csv = buildCsv(['Empleado', 'Nota'], [['=cmd', 'Ana'], ['+1', ''], ['-2', ''], ['@x', '']])
assert.equal(csv.charCodeAt(0), 0xfeff)
assert.match(csv, /'=cmd/)
assert.match(csv, /'\+1/)
assert.match(csv, /'-2/)
assert.match(csv, /'@x/)
assert.match(csv, /\r\n/)

const records = Array.from({ length: 40 }, (_, index) => ({
  empleado: `Empleado ${index + 1}`,
  legajo: String(1000 + index),
  fecha: '2026-11-02',
  hora: '08:00',
  tipo: 'Entrada',
  metodo: 'Biometrico',
}))
const selection = buildFichadasViewSelection({
  view: 'movimientos',
  records,
  filters: { periodo: '30', tipo: 'Entrada', metodo: 'todos' },
  empresa: 'Empresa Norte',
  empleadoLabel: '',
  generatedAt: '02/11/2026 10:00',
})
const snapshot = buildFichadasExportSnapshot(selection, { mode: 'view' })
assert.equal(snapshot.recordCount, 40)
const payload = buildFichadasCsvPayload(snapshot, '2026-11-02')
assert.equal(payload.ok, true)
assert.equal(payload.content.split('\r\n').filter(Boolean).length, 41)

const empty = buildFichadasCsvPayload(buildFichadasExportSnapshot(buildFichadasViewSelection({ records: [] }), { mode: 'view' }), '2026-11-02')
assert.equal(empty.ok, false)

const detalle = [{ fecha: '2026-11-02', empleado: 'Ana', horarioPrevisto: '09:00 a 18:00', entrada: '09:05', salida: '18:00', resultados: [], diferenciaEntrada: null, diferenciaSalida: null, excesoEntrada: 0, excesoSalida: 0 }]
const detalleCsv = csvInforme('detalle', detalle)
assert.match(detalleCsv, /Ana/)
assert.match(detalleCsv, /Informe operativo/)
assert.equal(nombreCsvInforme('detalle', '2026-11-02'), 'informe-asistencia-detalle-2026-11-02.csv')
assert.equal(nombreExportInforme('resumen', '2026-11-02', 'pdf'), 'informe-asistencia-resumen-2026-11-02.pdf')

assert.equal(formatPdfStamp('2/11/26, 12:53 a. m.'), '02/11/2026 00:53')
assert.equal(formatPdfStamp('2026-11-02T00:53:00'), '02/11/2026 00:53')

const pdf = buildPdfBytes({
  title: 'Consulta de fichadas',
  empresa: 'Empresa Norte',
  periodo: 'Período: últimos 60 días',
  generatedAt: '02/11/2026 10:00',
  filters: 'Tipo: Entrada',
  summaryItems: [
    { label: 'Completas', value: 25 },
    { label: 'En curso', value: 0 },
    { label: 'Incompletas', value: 6 },
    { label: 'En revisión', value: 0 },
  ],
  columns: snapshot.headers,
  rows: snapshot.printRows,
  landscape: true,
  footer: 'Informe operativo',
})
const pdfText = Buffer.from(pdf).toString('latin1')
assert.match(pdfText, /^%PDF-1\.4/)
assert.match(pdfText, /Consulta de fichadas/)
assert.equal(pdfText.includes('Control de Accesos'), false)
assert.match(pdfText, /Empresa Norte/)
assert.match(pdfText, /Período: Últimos 60 días/)
assert.equal(pdfText.includes('Período: Período'), false)
assert.match(pdfText, /Completas/)
assert.match(pdfText, /En revisión/)
assert.equal(pdfText.includes('Completas: 25 ?'), false)
assert.match(pdfText, /Informe operativo \| Empresa Norte \| Generado el 02\/11\/2026 10:00 \| Página 1 de /)
assert.match(pdfText, /Página 1 de /)
assert.match(pdfText, /Página 2 de /)
assert.equal(pdfText.includes('nav'), false)

const informe = buildPdfBytes({
  title: 'Informe de asistencia',
  empresa: 'Peña Ñandú',
  periodo: 'Período: últimos 60 días',
  generatedAt: '2/11/26, 12:53 a. m.',
  summaryLines: ['Completas: 25 · En curso: 0 · Incompletas: 6 · Revisar: 0'],
  columns: ['Empleado', 'Legajo', 'Fecha', 'Observaciones', 'Nota'],
  rows: [
    ['Nuñez', '0003', '2026-10-31', '—', '¿Llegó?'],
    ['José', '3', '31/10/26', '', 'áéíóú ñ'],
    ...Array.from({ length: 36 }, (_, index) => [`Empleado ${index + 3}`, '12', '2026-10-30', '—', '']),
  ],
  landscape: true,
})
const informeText = Buffer.from(informe).toString('latin1')
assert.match(informeText, /Informe de asistencia/)
assert.match(informeText, /Peña Ñandú/)
assert.match(informeText, /áéíóú ñ/)
assert.match(informeText, /Nuñez/)
assert.match(informeText, /\(0003\)/)
assert.match(informeText, /\(0012\)/)
assert.equal(informeText.includes('\n3\n') || /[^0]3 \(/.test(informeText), false)
assert.match(informeText, /31\/10\/2026/)
assert.match(informeText, /En revisión/)
assert.equal(informeText.includes('Observaciones'), false)
assert.equal(informeText.includes('? En curso'), false)
assert.match(informeText, /¿Llegó\?/)
assert.match(informeText, /Página 1 de /)
assert.match(informeText, /Página 2 de /)
assert.equal(informeText.includes('Control de Accesos'), false)

const menu = read('src/components/export-menu.js')
assert.match(menu, /Exportar CSV/)
assert.match(menu, /Exportar PDF/)
assert.match(menu, /Generando…/)
assert.match(menu, /No pudimos generar el archivo/)
assert.match(menu, /Escape/)
assert.match(menu, /stopPropagation/)
assert.match(menu, /aria-expanded/)
const view = read('src/views/fichadas.js')
const panel = read('src/components/informe-asistencia-panel.js')
assert.match(view, /fichadas-\$\{stamp\}\.csv/)
assert.match(view, /fichadas-\$\{stamp\}\.pdf/)
assert.match(view, /title: 'Consulta de fichadas'/)
assert.match(panel, /fichadas-scroll/)
assert.match(panel, /sticky top-0/)
assert.match(panel, /max-h-\[clamp\(360px,52vh,680px\)\]/)
assert.match(panel, /Informe de asistencia — Detalle de jornadas/)
assert.match(panel, /Informe de asistencia — Resumen por empleado/)
assert.match(panel, /No hay datos para exportar con los filtros seleccionados/)
assert.equal(view.includes('window.open'), false)
assert.equal(panel.includes('window.open'), false)

function walk(dir, found = []) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry)
    if (entry === 'node_modules' || entry === 'dist') continue
    const stat = statSync(path)
    if (stat.isDirectory()) walk(path, found)
    else if (entry.endsWith('.js')) found.push(path)
  }
  return found
}

const redundant = []
for (const file of walk(join(root, 'src'))) {
  const source = readFileSync(file, 'utf8')
  const buttons = source.match(/<button\b[\s\S]*?<\/button>/g) || []
  for (const button of buttons) {
    const tip = button.match(/\b(?:title|data-tooltip)="([^"]+)"/)
    if (!tip) continue
    const text = button.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
    if (text && text === tip[1]) redundant.push(`${file}: ${text}`)
  }
}
assert.deepEqual(redundant, [])

console.log('check-exportacion-fichadas: ok')
