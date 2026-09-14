import { resetBrowserGlobals } from './browser-globals.js'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { movimientoCellHtml } from '../src/components/fichadas-table.js'
import { jornadaCellHtml } from '../src/components/jornadas-table.js'
import { jornadaEstadoBadge } from '../src/components/badge.js'
import {
  applyObservacionToFichada,
  countObservacionesJornada,
  describeObservacionesJornada,
  hasObservacionHumana,
  isObservacionEndpointUnavailable,
  mapFichadaObservacionFromItem,
  mapObservacionHumana,
  OBSERVACION_DETALLE_MAX,
  OBSERVACION_UNAVAILABLE_MESSAGE,
  observacionAddAriaLabel,
  observacionEditAriaLabel,
  puedeEditarObservacionFichada,
  replaceFichadaObservacionInList,
  shouldAppendObservacionExportColumns,
  shouldApplyObservacionResponse,
  validateObservacionForm,
} from '../src/utils/fichada-observacion.js'
import { buildFichadasExportSnapshot, buildFichadasViewSelection } from '../src/utils/fichadas-export.js'
import { annotateMovimientos, describeDetalleLinea } from '../src/utils/movimientos.js'
import { buildCsv } from '../src/utils/csv.js'
import { ROLES } from '../src/config/roles.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
let passed = 0
let failed = 0

function read(relative) {
  return readFileSync(join(root, relative), 'utf8')
}

function check(name, fn) {
  try {
    fn()
    passed += 1
    console.log(`ok - ${name}`)
  } catch (error) {
    failed += 1
    console.error(`not ok - ${name}`)
    console.error(error)
  }
}

resetBrowserGlobals()

const note = {
  motivo: 'LlegadaTarde',
  detalle: 'El empleado informó una demora por un turno médico.',
  creadoPor: 'Laura Gómez',
  creadoEn: '2026-09-14T12:42:00Z',
}

const fichadaBase = {
  id: 12,
  empleado: 'Ana Pérez',
  fechaHora: '2024-01-08T10:00:00',
  tipo: 'Entrada',
  metodo: 'Biometrico',
  observacionLabel: '',
}

check('1. Acción por fila y sin botón global ambiguo', () => {
  const view = read('src/views/fichadas.js')
  assert.match(view, /onObservacion:\s*openObservacion/)
  assert.equal(view.includes('id="fichadas-observacion-global"'), false)
  const html = movimientoCellHtml(fichadaBase, 'observacion', { canEditObservacion: true })
  assert.match(html, /\+ Agregar/)
  assert.match(html, /data-action="observacion-fichada"/)
  assert.match(html, /aria-label="Agregar observación a la fichada de Ana Pérez/)
})

check('2. Indicadores automáticos no aparecen en Movimientos; sí en jornadas', () => {
  const withAuto = {
    ...fichadaBase,
    esMovimientoIntermedio: true,
    esPosibleDuplicado: true,
    observacionLabel: 'Posible duplicado · 10 segundos después',
    observacionHumana: note,
  }
  const html = movimientoCellHtml(withAuto, 'observacion', { canEditObservacion: true })
  assert.equal(html.includes('Movimiento intermedio'), false)
  assert.equal(html.includes('Posible duplicado'), false)
  assert.equal(html.includes(withAuto.observacionLabel), false)
  assert.match(html, /Llegada tarde/)
  assert.equal(html.includes('Ver / editar'), false)
  assert.equal(html.includes('>Ver<'), false)
  assert.match(html, /data-action="observacion-fichada"/)
  assert.match(html, /truncate/)
  assert.match(html, /data-tooltip="Llegada tarde"/)
  assert.equal(html.includes(note.detalle), false)
  assert.equal(html.includes('+ Agregar'), false)

  const autoOnly = movimientoCellHtml(
    {
      ...fichadaBase,
      esMovimientoIntermedio: true,
      observacionLabel: 'Movimiento intermedio',
    },
    'observacion',
    { canEditObservacion: true },
  )
  assert.match(autoOnly, /\+ Agregar/)
  assert.equal(autoOnly.includes('Movimiento intermedio'), false)

  const annotated = annotateMovimientos([
    { ...fichadaBase, id: 1, fechaHora: '2024-01-08T08:00:00', tipo: 'Entrada', observacionHumana: note },
    { ...fichadaBase, id: 2, fechaHora: '2024-01-08T12:00:00', tipo: 'Salida' },
    { ...fichadaBase, id: 3, fechaHora: '2024-01-08T18:00:00', tipo: 'Salida' },
  ])
  const intermedio = annotated.find((item) => item.esMovimientoIntermedio)
  assert.equal(Boolean(intermedio), true)
  assert.match(describeDetalleLinea(intermedio), /Movimiento intermedio/)
  assert.equal(annotated[0].observacionHumana.detalle, note.detalle)
  assert.equal(String(annotated[0].observacionLabel || '').includes(note.detalle), false)

  const detalleSrc = read('src/components/jornada-detalle.js')
  assert.match(detalleSrc, /Movimiento intermedio/)
  assert.match(detalleSrc, /esPosibleDuplicado/)
  assert.match(detalleSrc, /item\.observacionLabel/)
  assert.equal(read('src/components/fichadas-table.js').includes('esPosibleDuplicado'), false)
  assert.equal(read('src/components/fichadas-table.js').includes('esMovimientoIntermedio'), false)
})

check('3. Modal con contexto de fichada', () => {
  const form = read('src/components/fichada-observacion-form.js')
  assert.match(form, /Observación de la fichada/)
  assert.match(form, /label: 'Empleado'/)
  assert.match(form, /label: 'Fecha'/)
  assert.match(form, /label: 'Hora'/)
  assert.match(form, /label: 'Movimiento'/)
  assert.match(form, /openModal\(/)
})

check('4. Motivo obligatorio', () => {
  const empty = validateObservacionForm({ motivo: '', detalle: 'Texto válido de seguimiento.' })
  assert.equal(empty.ok, false)
  assert.match(empty.errors.motivo, /motivo/i)
  const ok = validateObservacionForm({ motivo: 'Llegada tarde', detalle: 'Texto válido de seguimiento.' })
  assert.equal(ok.ok, true)
  assert.equal(ok.value.motivo, 'LlegadaTarde')
})

check('5. Detalle obligatorio, trim y máximo 500', () => {
  assert.equal(validateObservacionForm({ motivo: 'Otro', detalle: '   ' }).ok, false)
  const long = 'a'.repeat(OBSERVACION_DETALLE_MAX + 1)
  assert.equal(validateObservacionForm({ motivo: 'Otro', detalle: long }).ok, false)
  const trimmed = validateObservacionForm({ motivo: 'Otro', detalle: '  Nota de RRHH.  ' })
  assert.equal(trimmed.ok, true)
  assert.equal(trimmed.value.detalle, 'Nota de RRHH.')
  assert.match(read('src/components/fichada-observacion-form.js'), /maxLength:\s*OBSERVACION_DETALLE_MAX/)
})

check('6. Protección contra doble envío', () => {
  const form = read('src/components/fichada-observacion-form.js')
  assert.match(form, /dataset\.submitting/)
  assert.match(form, /Guardando\.\.\./)
  assert.match(form, /submitBtn\.disabled = busy/)
  assert.match(form, /if \(form\.dataset\.submitting === 'true'\) return/)
})

check('7. Confirmación de cambios sin guardar', () => {
  const form = read('src/components/fichada-observacion-form.js')
  assert.match(form, /unsavedChanges:\s*canEdit/)
  assert.match(form, /closeOnBackdrop:\s*true/)
  assert.match(form, /isDirty:/)
  assert.match(read('src/components/modal.js'), /shouldAskUnsavedClose/)
})

check('8. Permisos RRHH, ADMIN y SuperAdmin', () => {
  assert.equal(puedeEditarObservacionFichada({ rol: ROLES.Rrhh }), true)
  assert.equal(puedeEditarObservacionFichada({ rol: 'ADMIN' }), true)
  assert.equal(puedeEditarObservacionFichada({ rol: 'SuperAdmin' }), true)
  assert.match(read('src/utils/fichada-observacion.js'), /isSuperadmin\(user\) \|\| isAdmin\(user\) \|\| isRrhh\(user\)/)
})

check('9. Usuarios sin permiso no ven alta ni edición', () => {
  assert.equal(puedeEditarObservacionFichada({ rol: 'AUDITOR' }), false)
  const empty = movimientoCellHtml(fichadaBase, 'observacion', { canEditObservacion: false })
  assert.match(empty, /—/)
  assert.equal(empty.includes('+ Agregar'), false)
  assert.equal(empty.includes('Ver / editar'), false)
  const withNote = movimientoCellHtml(
    { ...fichadaBase, observacionHumana: note },
    'observacion',
    { canEditObservacion: false },
  )
  assert.match(withNote, /Llegada tarde/)
  assert.match(withNote, /data-action="observacion-fichada"/)
  assert.equal(withNote.includes('Ver / editar'), false)
  assert.equal(withNote.includes('>Ver<'), false)
  assert.equal(withNote.includes('+ Agregar'), false)
})

check('10. Escape del contenido de API', () => {
  const html = movimientoCellHtml(
    {
      ...fichadaBase,
      empleado: '<img src=x>',
      observacionHumana: { motivo: 'Otro', detalle: '<script>alert(1)</script>' },
    },
    'observacion',
    { canEditObservacion: true },
  )
  assert.equal(html.includes('<script>'), false)
  assert.equal(html.includes('<img src=x>'), false)
  assert.match(html, /&lt;img src=x&gt;/)
  const form = read('src/components/fichada-observacion-form.js')
  assert.match(form, /escapeHtml\(line\)/)
  assert.match(read('src/components/jornada-detalle.js'), /detail\.textContent/)
})

check('11. Endpoint no disponible no confirma el guardado', () => {
  assert.equal(isObservacionEndpointUnavailable(404), true)
  assert.equal(isObservacionEndpointUnavailable(405), true)
  assert.equal(isObservacionEndpointUnavailable(200), false)
  const api = read('src/api/fichadas.js')
  assert.match(api, /PATCH/)
  assert.match(api, /\/api\/fichadas\/\$\{encodeURIComponent\(String\(id\)\)\}\/observacion/)
  assert.match(api, /OBSERVACION_UNAVAILABLE_MESSAGE/)
  assert.equal(api.includes('localStorage'), false)
  assert.match(read('src/utils/fichada-observacion.js'), new RegExp(OBSERVACION_UNAVAILABLE_MESSAGE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
})

check('12. Actualización de una sola fila', () => {
  const list = [
    applyObservacionToFichada({ id: 1, empleado: 'A' }, null),
    { id: 2, empleado: 'B', observacionHumana: null },
  ]
  const next = replaceFichadaObservacionInList(list, 2, note)
  assert.equal(hasObservacionHumana(next[0]), false)
  assert.equal(next[1].observacionHumana.motivo, 'LlegadaTarde')
  assert.equal(next[0], list[0])
  const stale = shouldApplyObservacionResponse({
    requestFichadaId: 1,
    responseFichadaId: 9,
    openFichadaId: 1,
    modalOpen: true,
  })
  assert.equal(stale.updateRow, false)
})

check('13. Conservación de filtros y paginación', () => {
  const view = read('src/views/fichadas.js')
  assert.match(view, /replaceFichadaObservacionInList/)
  assert.match(view, /renderResults\(\)/)
  assert.match(view, /onSaved: \(saved\) => \{/)
  const savedBlock = view.slice(view.indexOf('onSaved: (saved) => {'), view.indexOf('onSaved: (saved) => {') + 450)
  assert.equal(savedBlock.includes('loadFichadas'), false)
  assert.match(view, /movimientosPage/)
})

check('14. CSV e impresión: columnas extra solo si hay observaciones', () => {
  const without = buildFichadasExportSnapshot(
    buildFichadasViewSelection({ view: 'movimientos', records: [fichadaBase], columnIds: ['empleado', 'observacion'] }),
    { mode: 'view' },
  )
  assert.equal(without.headers.includes('Motivo de observación'), false)
  assert.equal(shouldAppendObservacionExportColumns('movimientos', [fichadaBase]), false)

  const withNote = { ...fichadaBase, observacionHumana: note, observacionLabel: 'Movimiento intermedio' }
  const withSnap = buildFichadasExportSnapshot(
    buildFichadasViewSelection({ view: 'movimientos', records: [withNote], columnIds: ['empleado', 'observacion'] }),
    { mode: 'view' },
  )
  assert.equal(withSnap.headers.includes('Observación'), true)
  assert.equal(withSnap.headers.includes('Motivo de observación'), true)
  assert.equal(withSnap.headers.includes('Detalle de observación'), true)
  assert.equal(withSnap.csvRows[0].includes('Movimiento intermedio'), true)
  assert.equal(withSnap.csvRows[0].includes('Llegada tarde'), true)
  const csv = buildCsv(withSnap.headers, withSnap.csvRows)
  assert.match(csv, /Motivo de observación/)
  assert.equal(csv.includes(note.detalle.split(' ')[0]), true)
})

check('15. Accesibilidad, tema y jornadas', () => {
  assert.match(observacionAddAriaLabel(fichadaBase), /Agregar observación a la fichada de Ana Pérez/)
  assert.match(observacionEditAriaLabel(fichadaBase, { canEdit: true }), /Ver o editar observación/)
  const cell = movimientoCellHtml(fichadaBase, 'observacion', { canEditObservacion: true })
  assert.match(cell, /dark:text-blue-300/)
  assert.match(cell, /focus-visible:ring-2/)
  const jornada = {
    empleado: 'Ana Pérez',
    fecha: '2024-01-08',
    movimientos: [
      { ...fichadaBase, observacionHumana: note },
      { ...fichadaBase, id: 13, observacionHumana: note },
    ],
  }
  assert.equal(countObservacionesJornada(jornada), 2)
  assert.equal(describeObservacionesJornada(2), '2 observaciones')
  const detalle = jornadaCellHtml(jornada, 'detalle', 0)
  assert.match(detalle, /Ver movimientos/)
  assert.match(detalle, />2</)
  assert.match(detalle, /aria-label="2 observaciones en esta jornada"/)
  assert.equal(detalle.includes('consultar-observaciones'), false)
  assert.equal(detalle.includes('Sin observaciones'), false)
  const withoutNotes = jornadaCellHtml(
    { empleado: 'Ana Pérez', fecha: '2024-01-08', movimientos: [{ ...fichadaBase }] },
    'detalle',
    0,
  )
  assert.match(withoutNotes, /Ver movimientos/)
  assert.equal(withoutNotes.includes('bg-violet-600'), false)
  const form = read('src/components/fichada-observacion-form.js')
  assert.match(form, /dark:bg-slate-900/)
  assert.match(form, /formFieldMarkup\(/)
  assert.match(read('src/components/form-field.js'), /<label for=/)
})

check('Normalización de listado y contrato incompleto', () => {
  const mapped = mapFichadaObservacionFromItem({
    Id: 8,
    Observacion: { Motivo: 'salida_anticipada', Detalle: '  Salió por trámite.  ', CreadoPor: 'RRHH' },
  })
  assert.equal(mapped.motivo, 'SalidaAnticipada')
  assert.equal(mapped.detalle, 'Salió por trámite.')
  assert.equal(mapObservacionHumana({ motivo: 'Otro' }), null)
  assert.equal(mapObservacionHumana('texto'), null)
})

check('No hay persistencia local de observaciones', () => {
  const files = [
    read('src/api/fichadas.js'),
    read('src/views/fichadas.js'),
    read('src/components/fichada-observacion-form.js'),
    read('src/utils/fichada-observacion.js'),
  ].join('\n')
  assert.equal(/localStorage[\s\S]{0,40}observacion/i.test(files), false)
  assert.equal(/sessionStorage[\s\S]{0,40}observacion/i.test(files), false)
})

check('Jerarquía visual de estado, badges y modal de movimientos', () => {
  const estado = jornadaEstadoBadge('En curso')
  assert.match(estado, /inline-flex/)
  assert.match(estado, /items-center/)
  assert.match(estado, /whitespace-nowrap/)
  assert.match(estado, /En curso/)
  assert.equal(estado.includes('<svg'), false)
  assert.match(jornadaCellHtml({ estado: 'En curso' }, 'estado', 0), /min-w-\[8\.5rem\]/)
  assert.match(jornadaCellHtml({ estado: 'En curso' }, 'estado', 0), /whitespace-nowrap/)

  const detalleSrc = read('src/components/jornada-detalle.js')
  const badgeSrc = read('src/components/observacion-badge.js')
  assert.equal(detalleSrc.includes('Observación:'), false)
  assert.match(detalleSrc, /esPosibleDuplicado/)
  assert.match(detalleSrc, /badgeHtml\(item\.observacionLabel, 'yellow'\)/)
  assert.match(detalleSrc, /observacionHumanaBadgeButton/)
  assert.match(detalleSrc, /layout: 'modal'/)
  assert.match(detalleSrc, /toggle-observacion/)
  assert.match(detalleSrc, />Editar</)
  assert.match(detalleSrc, /detail\.textContent/)
  assert.match(detalleSrc, /lg:flex-nowrap/)
  assert.match(detalleSrc, /dialogClass: 'max-w-2xl'/)
  assert.match(detalleSrc, /collapseAll/)
  assert.match(badgeSrc, /aria-expanded/)
  assert.match(badgeSrc, /aria-controls/)
  assert.match(badgeSrc, /data-tooltip/)
  assert.equal(read('src/views/fichadas.js').includes('openJornadaObservacionesModal'), false)
  assert.equal(read('src/components/fichada-observacion-form.js').includes('Observaciones de la jornada'), false)
  assert.match(read('src/components/fichadas-table.js'), /observacionHumanaBadgeButton/)
})

if (failed) {
  console.error(`\n${failed} failed, ${passed} passed`)
  process.exit(1)
}

console.log(`\n${passed} passed`)
