import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { CAPABILITY_STATUS, canOpenOperativeForm, isCalendarPayload } from '../src/api/capabilities.js'
import { calendarioFromPayload, etiquetaDiaCalendario } from '../src/api/jornadas.js'
import { registrarMenuActions } from '../src/config/labor-access.js'
import { createRegistrarMenu } from '../src/components/registrar-menu.js'
import { businessNow } from '../src/utils/format.js'
import {
  commitManualFichada,
  FUTURE_FICHADA_MESSAGE,
  limitesFichadaManual,
  manualConfirmModel,
  motivoUnicoEquivalente,
  tryBeginSubmit,
  validateManualFichadaTime,
} from '../src/utils/fichada-manual-time.js'
import {
  clasificarDiaLibre,
  describirResultadoDiaLibre,
  diaLibreConfirmModel,
  diaLibreRequest,
  DIA_LIBRE_EXITO,
  ETIQUETA_DIA_LIBRE,
  fechasReintento,
  inclusiveDateKeys,
  mensajeExitoDiaLibre,
  periodoDiaLibreExitoso,
  registrarPeriodoDiaLibre,
  validateDiaLibreRange,
} from '../src/utils/dia-libre.js'
import {
  describeAlertaReview,
  filtrosMovimientosDeAlerta,
  planAccionAlerta,
  presetSalidaManual,
  resultadoSalidaManual,
  SALIDA_COMPLETA_MESSAGE,
} from '../src/utils/jornada-alerta.js'
import { resolveFichadasView } from '../src/views/fichadas.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (file) => readFileSync(join(root, file), 'utf8')
let failed = 0

function check(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => console.log(`ok - ${name}`))
    .catch((error) => {
      failed += 1
      console.error(`not ok - ${name}`)
      console.error(error)
    })
}

function createFakeDocument() {
  function createNode(tag) {
    const node = {
      tag,
      children: [],
      parent: null,
      attrs: {},
      listeners: [],
      className: '',
      hidden: false,
      textContent: '',
      html: '',
      style: {},
      tabIndex: 0,
      disabled: false,
      dataset: {},
      id: '',
      type: '',
      removed: false,
      scrollHeight: 140,
      setAttribute(name, value) {
        this.attrs[name] = String(value)
        if (name === 'id') this.id = String(value)
      },
      getAttribute(name) {
        return Object.prototype.hasOwnProperty.call(this.attrs, name) ? this.attrs[name] : null
      },
      append(...nodes) {
        nodes.forEach((child) => {
          child.parent = this
          this.children.push(child)
        })
      },
      addEventListener(type, fn, options) {
        const entry = { type, fn }
        this.listeners.push(entry)
        options?.signal?.addEventListener('abort', () => {
          const index = this.listeners.indexOf(entry)
          if (index >= 0) this.listeners.splice(index, 1)
        })
      },
      remove() {
        this.removed = true
        this.parent = null
      },
      focus() {
        this.focused = true
        doc.activeElement = this
      },
      contains(target) {
        let current = target
        while (current) {
          if (current === this) return true
          current = current.parent
        }
        return false
      },
      click() {
        const event = { target: this, stopPropagation() {}, preventDefault() {} }
        ;[...this.listeners].filter((entry) => entry.type === 'click').forEach((entry) => entry.fn(event))
      },
      getBoundingClientRect() {
        return { left: 900, right: 1040, top: 24, bottom: 64, width: 140, height: 40 }
      },
    }
    Object.defineProperty(node, 'innerHTML', {
      configurable: true,
      get() {
        return this.html
      },
      set(value) {
        this.html = String(value)
      },
    })
    return node
  }

  const doc = {
    activeElement: null,
    listeners: [],
    createElement: createNode,
    addEventListener(type, fn, options) {
      const entry = { type, fn }
      this.listeners.push(entry)
      options?.signal?.addEventListener('abort', () => {
        const index = this.listeners.indexOf(entry)
        if (index >= 0) this.listeners.splice(index, 1)
      })
    },
    dispatch(type, event) {
      ;[...this.listeners].filter((entry) => entry.type === type).forEach((entry) => entry.fn(event))
    },
  }
  doc.body = createNode('body')
  return doc
}

const view = read('src/views/fichadas.js')
const manual = read('src/components/fichada-manual-panel.js')
const libre = read('src/components/dia-libre-panel.js')
const alertas = read('src/components/jornadas-alertas-panel.js')
const heading = read('src/components/page-heading.js')
const header = read('src/components/header.js')
const http = read('src/api/http.js')
const capabilities = read('src/api/capabilities.js')
const instant = new Date('2026-10-25T02:30:00.000Z')
const admin = { rol: 'ADMIN' }
const rrhh = { rol: 'RRHH' }
const superadmin = { rol: 'SUPERADMIN' }

const checks = [
  check('Registrar está en la cabecera y no en la barra global ni como botón inferior', () => {
    const slot = view.indexOf("actionsId: registrarActions.length ? 'fichadas-registrar'")
    const tabs = view.indexOf('id="fichadas-tab-timeline"')
    assert.ok(slot > 0 && slot < tabs)
    assert.equal(view.includes('Registrar fichada manual'), false)
    assert.equal(view.includes('createFichadaManualControl'), false)
    assert.equal(header.includes('fichadas-registrar'), false)
    assert.equal(header.includes('Registrar'), false)
    assert.match(heading, /flex-col/)
    assert.match(heading, /sm:flex-row/)
    assert.match(heading, /sm:justify-between/)
    assert.match(heading, /w-full min-w-0 sm:w-auto/)
    assert.match(view, /id="fichadas-tab-timeline"/)
    assert.match(view, /id="fichadas-tab-jornadas"/)
    assert.match(view, /id="fichadas-tab-movimientos"/)
    assert.ok(view.indexOf('id="fichadas-tab-timeline"') < view.indexOf('id="fichadas-tab-jornadas"'))
    assert.ok(view.indexOf('id="fichadas-tab-jornadas"') < view.indexOf('id="fichadas-tab-movimientos"'))
    assert.equal(resolveFichadasView(undefined), 'timeline')
    assert.match(view, /ArrowRight/)
    assert.match(view, /ArrowLeft/)
    assert.match(view, /Calendario de jornadas/)
    assert.match(view, /Alertas de jornadas/)
  }),

  check('El menú abre, cierra, responde a Escape y no duplica listeners', () => {
    const doc = createFakeDocument()
    let selected = null
    const actions = registrarMenuActions(admin)
    const menu = createRegistrarMenu({
      actions,
      document: doc,
      onSelect: (action) => {
        selected = action.id
      },
    })
    assert.equal(menu.trigger.getAttribute('aria-haspopup'), 'menu')
    assert.equal(menu.trigger.getAttribute('aria-expanded'), 'false')
    assert.equal(menu.trigger.getAttribute('aria-controls'), menu.panel.id)
    assert.equal(doc.listeners.length, 2)
    menu.trigger.click()
    assert.equal(menu.expanded, true)
    assert.equal(menu.trigger.getAttribute('aria-expanded'), 'true')
    menu.trigger.click()
    assert.equal(menu.expanded, false)
    menu.expand()
    assert.equal(menu.items[0].focused, true)
    let prevented = false
    doc.dispatch('keydown', {
      key: 'Escape',
      preventDefault() { prevented = true },
      stopPropagation() {},
      stopImmediatePropagation() {},
    })
    assert.equal(prevented, true)
    assert.equal(menu.expanded, false)
    assert.equal(menu.trigger.focused, true)
    menu.expand()
    doc.dispatch('pointerdown', { target: doc.body })
    assert.equal(menu.expanded, false)
    menu.expand()
    menu.items[0].click()
    assert.equal(selected, 'fichada-manual')
    assert.equal(menu.expanded, false)
    const afterToggle = doc.listeners.length
    menu.expand()
    menu.collapse()
    menu.expand()
    assert.equal(doc.listeners.length, afterToggle)
    const replacement = createRegistrarMenu({ actions, document: doc, onSelect() {} })
    assert.equal(menu.panel.removed, true)
    assert.equal(doc.listeners.length, 2)
    replacement.destroy()
    assert.equal(doc.listeners.length, 0)
    assert.equal(createRegistrarMenu({ actions: [], document: doc, onSelect() {} }), null)
  }),

  check('Registrar respeta permisos de ADMIN, SuperAdmin y RRHH', () => {
    assert.deepEqual(registrarMenuActions(rrhh), [])
    assert.deepEqual(registrarMenuActions(admin).map((item) => item.id), ['fichada-manual', 'dia-libre'])
    assert.deepEqual(registrarMenuActions(superadmin).map((item) => item.label), ['Fichada manual', 'Vacaciones / día libre'])
    assert.equal(registrarMenuActions(admin)[0].description, 'Agregar una entrada o salida puntual.')
    assert.equal(registrarMenuActions(admin)[1].description, 'Marcar uno o varios días sin jornada.')
    assert.equal(canOpenOperativeForm({ status: CAPABILITY_STATUS.available }), true)
    assert.equal(canOpenOperativeForm({ status: CAPABILITY_STATUS.unavailable }), false)
    assert.equal(canOpenOperativeForm({ status: CAPABILITY_STATUS.forbidden }), false)
    assert.equal(canOpenOperativeForm({ status: CAPABILITY_STATUS.unauthorized }), false)
    assert.equal(canOpenOperativeForm({ status: CAPABILITY_STATUS.unknown, reason: 'needs-employee' }), true)
    assert.equal(isCalendarPayload([]), true)
    assert.match(capabilities, /method: 'GET'/)
    assert.match(http, /X-Empresa-Id/)
    assert.match(capabilities, /EMPRESA_CONTEXTO_EVENT/)
    assert.match(view, /closeFichadasOverlays/)
    assert.match(view, /registrarMenu\?\.destroy/)
  }),

  check('La fichada manual bloquea el futuro en America/Argentina/Buenos_Aires aunque el proceso esté en UTC', () => {
    assert.equal(businessNow(instant).dateKey, '2026-10-24')
    assert.equal(businessNow(instant).timeKey, '23:30')
    if ((process.env.TZ || '').toUpperCase() === 'UTC') assert.equal(instant.getUTCDate(), instant.getDate())
    assert.equal(instant.getUTCDate(), 25)
    assert.equal(validateManualFichadaTime({ fecha: '2026-10-25', hora: '00:01' }, instant).ok, false)
    assert.equal(validateManualFichadaTime({ fecha: '2026-10-24', hora: '23:31' }, instant).message, FUTURE_FICHADA_MESSAGE)
    assert.equal(validateManualFichadaTime({ fecha: '2026-10-24', hora: '23:30' }, instant).ok, true)
    assert.equal(validateManualFichadaTime({ fecha: '2026-10-24', hora: '23:30:00' }, instant).ok, true)
    assert.equal(validateManualFichadaTime({ fecha: '2026-10-23', hora: '23:59' }, instant).ok, true)
    assert.equal(limitesFichadaManual('2026-10-24', instant).maxTime, '23:30')
    assert.equal(limitesFichadaManual('2026-10-23', instant).maxTime, '')
    assert.match(manual, /form\.fecha\.max/)
    assert.match(manual, /validateManualFichadaTime/)
    assert.match(manual, /commitManualFichada/)
    assert.equal(manual.includes('form.hora.value = limits'), false)
  }),

  check('No se escribe una fichada inválida, se revalida antes del POST y se impide el doble envío', async () => {
    let calls = 0
    const create = async () => {
      calls += 1
      return { id: 1 }
    }
    await assert.rejects(
      commitManualFichada({ empleadoId: 1, fecha: '2026-10-25', hora: '10:00', tipo: 'Entrada', motivo: 'Otro', detalle: 'Nota' }, { now: instant, create }),
      (error) => error.code === 'future-fichada',
    )
    assert.equal(calls, 0)
    const valid = { empleadoId: 1, fecha: '2026-10-23', hora: '22:15', tipo: 'Salida', motivo: 'Otro', detalle: 'Nota' }
    await commitManualFichada(valid, { now: instant, confirmed: valid, create })
    assert.equal(calls, 1)
    await assert.rejects(
      commitManualFichada({ ...valid, hora: '23:00' }, { now: instant, confirmed: valid, create }),
      (error) => error.code === 'stale-fichada',
    )
    assert.equal(calls, 1)
    const state = { pending: false }
    let release
    const gate = new Promise((resolve) => { release = resolve })
    const first = commitManualFichada(valid, {
      now: instant,
      submitState: state,
      create: () => gate,
    })
    await Promise.resolve()
    await assert.rejects(
      commitManualFichada(valid, { now: instant, submitState: state, create }),
      (error) => error.code === 'duplicate-submit',
    )
    release({ id: 2 })
    await first
    assert.equal(calls, 1)
    const guard = { pending: false }
    assert.equal(tryBeginSubmit(guard), true)
    assert.equal(tryBeginSubmit(guard), false)
    assert.match(manual, /tryBeginSubmit/)
    assert.match(read('src/components/modal.js'), /if \(busy \|\| settled\) return/)
    assert.equal(manual.includes('createFichadaManual('), false)
    assert.match(manual, /create: createFichadaManual/)
    const model = manualConfirmModel({
      tipo: 'Salida',
      empleado: 'Ana <Pérez>',
      fecha: '2026-10-23',
      hora: '22:15',
      motivo: 'OlvidoDeFichaje',
      detalle: '',
    })
    assert.equal(model.title, 'Confirmar fichada manual')
    assert.equal(model.intro, 'Vas a registrar manualmente una Salida para Ana <Pérez>.')
    assert.equal(model.rows.find((row) => row.label === 'Fecha').value, '23/10/2026')
    assert.equal(model.rows.find((row) => row.label === 'Hora').value, '22:15')
    assert.equal(model.rows.find((row) => row.label === 'Tipo').value, 'Salida')
    assert.equal(model.rows.find((row) => row.label === 'Motivo').value, 'Olvido de fichaje')
    assert.equal(model.rows.find((row) => row.label === 'Observación').value, 'Sin observación')
    assert.match(model.legend, /identificada como manual/)
    assert.equal(model.cancel, 'Volver y corregir')
    assert.equal(model.confirm, 'Confirmar fichada')
    assert.equal(manual.includes('listado se actualiza'), false)
  }),

  check('Vacaciones / día libre acepta pasado, presente y futuro, y rechaza un hasta anterior', () => {
    assert.equal(validateDiaLibreRange({ desde: '2020-01-01', hasta: '2020-01-03' }).ok, true)
    assert.equal(validateDiaLibreRange({ desde: '2026-10-24', hasta: '2026-10-24' }).dias, 1)
    assert.equal(validateDiaLibreRange({ desde: '2031-05-01', hasta: '2031-05-02' }).ok, true)
    assert.equal(validateDiaLibreRange({ desde: '2026-04-02', hasta: '2026-04-01' }).ok, false)
    assert.deepEqual(inclusiveDateKeys('2024-02-28', '2024-03-01'), ['2024-02-28', '2024-02-29', '2024-03-01'])
    assert.equal(ETIQUETA_DIA_LIBRE, 'Vacaciones / día libre')
    assert.equal(etiquetaDiaCalendario({ esDiaLibre: true, tieneTurnoAsignado: false }), 'Vacaciones / día libre')
    assert.equal(etiquetaDiaCalendario({ esDiaLibre: false, esExcepcionManual: true, tieneTurnoAsignado: true }), 'Excepción')
    const request = diaLibreRequest(15, '2026-04-01')
    assert.equal(request.method, 'PUT')
    assert.equal(request.path, '/api/jornadas/empleados/15/dias/2026-04-01')
    assert.deepEqual(request.body, { esDiaLibre: true })
    assert.deepEqual(Object.keys(request.body), ['esDiaLibre'])
    assert.equal(libre.includes('localStorage'), false)
    assert.equal(libre.includes('FichadasManuales'), false)
    assert.equal(libre.includes('.max'), false)
    assert.equal((libre.match(/showToast\(/g) || []).length, 1)
    const copy = diaLibreConfirmModel({ empleado: 'Juan', desde: '2026-04-01', hasta: '2026-04-03', dias: 3 })
    assert.equal(copy.title, 'Confirmar vacaciones / día libre')
    assert.match(copy.intro, /Vacaciones \/ día libre los días del 01\/04\/2026 al 03\/04\/2026 para Juan/)
    assert.equal(copy.rows.find((row) => row.label === 'Días calendario').value, '3')
    assert.match(copy.legend, /no genera movimientos de entrada o salida/)
    assert.equal(copy.confirm, 'Confirmar período')
  }),

  check('El período informa total, parcial, omitidas, horarios personalizados y reintento', async () => {
    const writes = []
    const total = await registrarPeriodoDiaLibre({
      fechas: ['2026-04-01', '2026-04-02'],
      readDias: async () => [{ fecha: '2026-04-01', esDiaLibre: true }, { fecha: '2026-04-02', esDiaLibre: false, esExcepcionManual: false }],
      writeDia: async (fecha) => writes.push(fecha),
    })
    assert.deepEqual(writes, ['2026-04-02'])
    assert.deepEqual(total.omitidas, ['2026-04-01'])
    assert.equal(periodoDiaLibreExitoso(total), true)
    assert.match(mensajeExitoDiaLibre(total), new RegExp(DIA_LIBRE_EXITO))
    assert.equal(clasificarDiaLibre({ esDiaLibre: true, esExcepcionManual: true }), 'omitida')
    assert.equal(clasificarDiaLibre({ esDiaLibre: false, esExcepcionManual: true, horaEntrada: '10:00' }), 'bloqueada')

    let partialWrites = 0
    const partial = await registrarPeriodoDiaLibre({
      fechas: ['2026-05-01', '2026-05-02', '2026-05-03'],
      readDias: async () => [
        { fecha: '2026-05-01', esExcepcionManual: true, esDiaLibre: false },
      ],
      writeDia: async (fecha) => {
        partialWrites += 1
        if (fecha === '2026-05-03') {
          const error = new Error('Error interno')
          error.status = 500
          throw error
        }
      },
    })
    assert.equal(partialWrites, 2)
    assert.deepEqual(partial.bloqueadas, ['2026-05-01'])
    assert.deepEqual(partial.registradas, ['2026-05-02'])
    assert.deepEqual(partial.fallidas.map((item) => item.fecha), ['2026-05-03'])
    assert.equal(periodoDiaLibreExitoso(partial), false)
    assert.deepEqual(fechasReintento(partial), ['2026-05-03'])
    const summary = describirResultadoDiaLibre(partial)
    assert.match(summary, /Fechas registradas/)
    assert.match(summary, /horario personalizado/)
    assert.match(summary, /Fechas que fallaron/)
    assert.equal(summary.includes('\n\n'), false)

    const retried = []
    const retry = await registrarPeriodoDiaLibre({
      fechas: fechasReintento(partial),
      readDias: async () => [],
      writeDia: async (fecha) => retried.push(fecha),
    })
    assert.deepEqual(retried, ['2026-05-03'])
    assert.equal(periodoDiaLibreExitoso(retry), true)

    const emptyCalendar = await registrarPeriodoDiaLibre({
      fechas: ['2026-06-01'],
      readDias: async () => [],
      writeDia: async () => {},
    })
    assert.equal(periodoDiaLibreExitoso(emptyCalendar), true)
    assert.deepEqual(calendarioFromPayload([]), [])
    assert.throws(() => calendarioFromPayload({ dias: [] }), (error) => error.code === 'invalid-contract')
  }),

  check('Errores 401, 403, 404, 500, red y contrato inválido no simulan éxito', async () => {
    async function fail(status, code) {
      let calls = 0
      const result = await registrarPeriodoDiaLibre({
        fechas: ['2026-07-01', '2026-07-02'],
        readDias: async () => [],
        writeDia: async () => {
          calls += 1
          const error = new Error('fallo')
          error.status = status
          if (code) error.code = code
          throw error
        },
      })
      return { calls, result }
    }
    const unauthorized = await fail(401)
    assert.equal(unauthorized.calls, 1)
    assert.equal(unauthorized.result.unauthorized, true)
    assert.equal(periodoDiaLibreExitoso(unauthorized.result), false)
    const forbidden = await fail(403)
    assert.equal(forbidden.result.forbidden, true)
    assert.equal(fechasReintento(forbidden.result).length, 0)
    const missing = await fail(404, 'maintenance')
    assert.equal(missing.result.maintenance, true)
    assert.equal(fechasReintento(missing.result).length, 0)
    const server = await fail(500)
    assert.equal(server.calls, 2)
    assert.equal(server.result.fallidas.length, 2)
    const network = await fail(0)
    assert.equal(network.result.fallidas.length, 2)
    assert.deepEqual(fechasReintento(network.result), ['2026-07-01', '2026-07-02'])
    let writes = 0
    const invalid = await registrarPeriodoDiaLibre({
      fechas: ['2026-07-01'],
      readDias: async () => {
        const error = new Error('contrato')
        error.code = 'invalid-contract'
        throw error
      },
      writeDia: async () => { writes += 1 },
    })
    assert.equal(invalid.invalidContract, true)
    assert.equal(writes, 0)
    assert.equal(periodoDiaLibreExitoso(invalid), false)
  }),

  check('Revisar muestra datos escapables, navega sin escribir y precarga la salida sin hora', () => {
    const alerta = {
      fichadaId: 9,
      empleadoId: 4,
      nombre: 'Ana <script>',
      apellido: 'Ríos',
      fechaHora: '2026-10-25T02:30:00.000Z',
      minutosHastaCorte: 90,
      mensaje: 'Falta una salida antes del cierre del día.',
    }
    const review = describeAlertaReview(alerta, { legajo: 'A-10' })
    assert.equal(review.title, 'Revisar jornada incompleta')
    assert.equal(review.rows.find((row) => row.label === 'Empleado').value, 'Ana <script> Ríos')
    assert.equal(review.rows.find((row) => row.label === 'Legajo').value, 'A-10')
    assert.equal(review.rows.find((row) => row.label === 'Última fichada').value, 'Sin salida')
    assert.equal(describeAlertaReview({ ...alerta, legajo: '' }).rows.some((row) => row.label === 'Legajo'), false)
    assert.match(alertas, /value\.textContent = row\.value/)
    assert.equal(alertas.includes("method: 'POST'"), false)
    assert.equal(alertas.includes("method: 'PUT'"), false)
    assert.equal(planAccionAlerta('cerrar').write, false)
    assert.equal(planAccionAlerta('movimientos').write, false)
    assert.equal(planAccionAlerta('movimientos').view, 'movimientos')
    assert.equal(planAccionAlerta('salida', { manualAvailable: false }).openForm, false)
    assert.equal(planAccionAlerta('salida', { manualAvailable: true }).write, false)
    const salida = alertas.indexOf('closeReview()')
    const abrir = alertas.indexOf('onRegistrarSalida?.')
    assert.ok(salida > 0 && salida < abrir)
    const filtros = filtrosMovimientosDeAlerta(alerta)
    assert.deepEqual(filtros, {
      view: 'movimientos',
      periodo: 'personalizado',
      desde: '2026-10-24',
      hasta: '2026-10-24',
      empleadoId: '4',
      tipo: 'todos',
      metodo: 'todos',
    })
    assert.match(view, /filtrosMovimientosDeAlerta/)
    const preset = presetSalidaManual(alerta)
    assert.equal(preset.tipo, 'Salida')
    assert.equal(preset.hora, '')
    assert.equal(preset.fecha, '2026-10-24')
    assert.equal(preset.detalle, '')
    assert.equal(preset.motivo, '')
    assert.equal(motivoUnicoEquivalente('Olvido de fichaje'), 'OlvidoDeFichaje')
    assert.equal(motivoUnicoEquivalente('Falta una salida antes del cierre del día.'), '')
    assert.equal(presetSalidaManual({ ...alerta, mensaje: 'Olvido de fichaje' }).motivo, 'OlvidoDeFichaje')
    const pending = resultadoSalidaManual(alerta, [{ ...alerta, mensaje: 'Sigue incompleta' }])
    assert.equal(pending.completa, false)
    assert.equal(pending.message, 'Sigue incompleta')
    const done = resultadoSalidaManual(alerta, [])
    assert.equal(done.completa, true)
    assert.equal(done.message, SALIDA_COMPLETA_MESSAGE)
    assert.match(view, /resultadoSalidaManual/)
    assert.match(alertas, /getAlertasIncompletas/)
  }),
]

await Promise.all(checks)
if (failed) process.exit(1)
