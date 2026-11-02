import { badgeHtml } from './badge.js'
import { BTN_SECONDARY_CLASS } from './button-styles.js'
import { createEmpleadoCombobox } from './empleado-combobox.js'
import { createFichadasEmptyState } from './fichadas-empty-state.js'
import { createFeedbackState } from './feedback-state.js'
import { FORM_LABEL_CLASS } from './form-field.js'
import { iconCalendar } from './icons.js'
import { createExportMenu } from './export-menu.js'
import { printReport } from './fichadas-print.js'
import { showToast } from './toast.js'
import { obtenerInformeAsistencia } from '../api/informe-asistencia.js'
import { downloadCsv } from '../utils/csv.js'
import { escapeHtml, todayDateKey } from '../utils/format.js'
import { formatMinutosInformados } from '../utils/labor-format.js'
import {
  csvInforme,
  FILTROS_INCIDENCIA,
  filtrarDetalle,
  INCIDENCIA,
  indicadoresInforme,
  nombreCsvInforme,
  nombreExportInforme,
  resumirEmpleados,
  textoDiferencia,
  textoExceso,
  textoVacioInforme,
} from '../utils/informe-asistencia.js'

const CONTROL_CLASS =
  'h-11 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100'

const TONO = {
  'a-tiempo': 'success',
  'dentro-tolerancia': 'info',
  'llegada-tarde': 'warning',
  'salida-anticipada': 'warning',
  incompleta: 'warning',
  'sin-informacion': 'neutral',
  'sin-registros': 'neutral',
}

function textoMinutos(valor) {
  return formatMinutosInformados(valor) ?? '—'
}

export function createInformeAsistenciaPanel({ contexto, empresaNombre } = {}) {
  const root = document.createElement('div')
  root.className = 'space-y-4'
  root.dataset.informeAsistencia = 'true'
  let filtros = {
    periodo: 'mes',
    empleadoId: '',
    departamentoId: '',
    sucursalId: '',
    incidencia: INCIDENCIA.todas,
    indicador: '',
    customDesde: '',
    customHasta: '',
  }
  let vista = 'detalle'
  let informe = null
  let carga = 0
  let destruido = false
  const empleados = () => (contexto?.empleados ?? []).filter((empleado) => empleado.activo !== false)

  root.innerHTML = `
    <section class="rounded-xl border border-slate-200 bg-white px-3 py-3 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div id="informe-filtros" class="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 xl:grid-cols-5"></div>
      <div id="informe-filter-actions" class="mt-2 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
        <button type="button" id="informe-limpiar" class="${BTN_SECONDARY_CLASS}">Limpiar filtros</button>
      </div>
    </section>
    <p id="informe-limite" class="hidden text-sm text-slate-500 dark:text-slate-400"></p>
    <div id="informe-indicadores" class="grid grid-cols-2 gap-3 lg:grid-cols-4"></div>
    <div class="flex flex-wrap items-center justify-between gap-2">
      <div id="informe-vistas" class="inline-flex w-fit max-w-full flex-wrap gap-0.5 rounded-lg border border-slate-200 bg-white p-0.5 dark:border-slate-700 dark:bg-slate-900" role="tablist" aria-label="Vista del informe">
        <button type="button" id="informe-tab-detalle" role="tab" aria-selected="true" aria-controls="informe-contenido" class="inline-flex h-8 items-center rounded-md px-2.5 text-xs font-medium">Detalle de jornadas</button>
        <button type="button" id="informe-tab-resumen" role="tab" aria-selected="false" aria-controls="informe-contenido" class="inline-flex h-8 items-center rounded-md px-2.5 text-xs font-medium">Resumen por empleado</button>
      </div>
    </div>
    <div id="informe-contenido" class="min-w-0 rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"></div>
  `

  const filtrosHost = root.querySelector('#informe-filtros')
  const periodo = select('informe-periodo', 'Período', [
    ['mes', 'Este mes'],
    ['hoy', 'Hoy'],
    ['7', 'Últimos 7 días'],
    ['30', 'Últimos 30 días'],
    ['personalizado', 'Personalizado'],
  ])
  const sucursales = contexto?.sucursales ?? []
  const departamentos = contexto?.departamentos ?? []
  const departamento = select('informe-departamento', 'Departamento', opcionesDepartamento(''))
  const sucursal = select('informe-sucursal', 'Sucursal', [['', 'Todas'], ...sucursales.map((item) => [String(item.id), item.nombre || 'Sucursal'])])
  const incidencia = select('informe-incidencia', 'Tipo de incidencia', FILTROS_INCIDENCIA.map((item) => [item.id, item.label]))
  const empleadoWrap = document.createElement('div')
  empleadoWrap.className = 'min-w-0'
  const combobox = createEmpleadoCombobox({
    id: 'informe-empleado',
    placeholder: 'Buscar por nombre, apellido o legajo',
    rootClass: 'w-full',
    onChange: () => {
      filtros.empleadoId = combobox.getEmpleadoId()
      void cargar()
    },
  })
  combobox.setEmpleados(empleadosFiltrados())
  empleadoWrap.append(combobox.root)
  filtrosHost.append(periodo.wrap, empleadoWrap)
  if (departamento) filtrosHost.append(departamento.wrap)
  if (sucursal) filtrosHost.append(sucursal.wrap)
  filtrosHost.append(incidencia.wrap)
  const fechas = document.createElement('div')
  fechas.id = 'informe-fechas'
  fechas.className = 'hidden grid gap-3 sm:col-span-2 sm:grid-cols-2'
  fechas.innerHTML = `
    <div>
      <label for="informe-desde" class="${FORM_LABEL_CLASS}">Desde</label>
      <input id="informe-desde" type="date" class="${CONTROL_CLASS}" />
    </div>
    <div>
      <label for="informe-hasta" class="${FORM_LABEL_CLASS}">Hasta</label>
      <input id="informe-hasta" type="date" class="${CONTROL_CLASS}" />
    </div>
  `
  filtrosHost.after(fechas)

  function opcionesDepartamento(sucursalId) {
    const lista = departamentos.filter((item) => !sucursalId || String(item.sucursalId ?? '') === String(sucursalId))
    return [['', 'Todos'], ...lista.map((item) => [String(item.id), item.nombre || 'Departamento'])]
  }

  function select(id, label, options) {
    const wrap = document.createElement('div')
    wrap.className = 'min-w-0'
    wrap.innerHTML = `<label for="${id}" class="${FORM_LABEL_CLASS}">${escapeHtml(label)}</label><select id="${id}" class="${CONTROL_CLASS}"></select>`
    const control = wrap.querySelector('select')
    const pintar = (items, selected = '') => {
      control.innerHTML = items.map(([value, text]) => `<option value="${escapeHtml(value)}">${escapeHtml(text)}</option>`).join('')
      control.value = selected
    }
    pintar(options)
    return { wrap, control, pintar }
  }

  function empleadosFiltrados() {
    return empleados().filter((empleado) => {
      if (filtros.sucursalId && String(empleado.sucursalId ?? '') !== String(filtros.sucursalId)) return false
      if (filtros.departamentoId && String(empleado.departamentoId ?? '') !== String(filtros.departamentoId)) return false
      return true
    })
  }

  function sincronizarEmpleados() {
    const lista = empleadosFiltrados()
    combobox.setEmpleados(lista)
    if (filtros.empleadoId && !lista.some((empleado) => String(empleado.id) === String(filtros.empleadoId))) {
      combobox.setEmpleadoId('', { silent: true })
      filtros.empleadoId = ''
    }
  }

  function prístino() {
    return filtros.periodo === 'mes'
      && !filtros.empleadoId
      && !filtros.departamentoId
      && !filtros.sucursalId
      && filtros.incidencia === INCIDENCIA.todas
      && !filtros.indicador
      && !filtros.customDesde
      && !filtros.customHasta
  }

  function actualizarLimpiar() {
    const boton = root.querySelector('#informe-limpiar')
    boton.disabled = prístino()
  }

  function filasVisibles() {
    const base = informe?.detalle ?? []
    const incidenciaActiva = filtros.indicador === INCIDENCIA.fueraHorario ? INCIDENCIA.fueraHorario : filtros.incidencia
    return filtrarDetalle(base, incidenciaActiva)
  }

  function pintarIndicadores() {
    const datos = indicadoresInforme(informe?.detalle ?? [])
    const tarjetas = [
      ['llegadas-tarde', 'Llegadas tarde', datos.llegadasTarde, INCIDENCIA.llegadaTarde],
      ['salidas-anticipadas', 'Salidas anticipadas', datos.salidasAnticipadas, INCIDENCIA.salidaAnticipada],
      ['incompletas', 'Jornadas incompletas', datos.incompletas, INCIDENCIA.incompleta],
      ['fuera-horario', 'Tiempo fuera de horario', datos.minutosFuera, INCIDENCIA.fueraHorario],
    ]
    const host = root.querySelector('#informe-indicadores')
    host.innerHTML = tarjetas.map(([id, label, valor, filtro]) => {
      const activo = filtros.indicador === filtro || (filtro !== INCIDENCIA.fueraHorario && filtros.incidencia === filtro && !filtros.indicador)
      const numero = filtro === INCIDENCIA.fueraHorario ? (textoMinutos(valor) === '—' ? '0 min' : textoMinutos(valor)) : String(valor)
      const acento = valor > 0 ? 'text-amber-700 dark:text-amber-300' : 'text-slate-900 dark:text-slate-100'
      const borde = activo ? 'border-blue-500' : 'border-slate-200 dark:border-slate-700'
      return `<button type="button" data-indicador="${id}" aria-pressed="${activo}" class="flex h-full min-h-[5.5rem] flex-col justify-between rounded-xl border bg-white p-4 text-left shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:bg-slate-900 ${borde}">
        <span class="text-sm text-slate-500 dark:text-slate-400">${escapeHtml(label)}</span>
        <span class="text-2xl font-semibold ${acento}">${escapeHtml(numero)}</span>
      </button>`
    }).join('')
  }

  const MARCO_RESULTADOS = 'min-w-0 rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900'
  const SCROLL_RESULTADOS = `${MARCO_RESULTADOS} fichadas-scroll max-h-[clamp(360px,52vh,680px)] overflow-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500`

  function prepararContenido(conScroll) {
    const host = root.querySelector('#informe-contenido')
    host.className = conScroll ? SCROLL_RESULTADOS : MARCO_RESULTADOS
    if (conScroll) {
      host.tabIndex = 0
      host.setAttribute('aria-label', 'Resultados del informe')
    } else {
      host.removeAttribute('tabindex')
      host.removeAttribute('aria-label')
    }
    host.scrollTop = 0
    host.scrollLeft = 0
    return host
  }

  function pintarTabla(columnas, filas, celdas) {
    const host = prepararContenido(filas.length > 0)
    if (!filas.length) {
      const vacio = textoVacioInforme({ cantidad: 0 })
      host.replaceChildren(createFichadasEmptyState({ title: vacio.titulo, description: vacio.detalle, icon: iconCalendar() }))
      return
    }
    host.innerHTML = `<table class="w-full min-w-[720px] text-sm">
      <thead class="sticky top-0 z-10 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 shadow-[0_1px_0_0_var(--color-slate-200)] dark:bg-slate-800 dark:text-slate-400 dark:shadow-[0_1px_0_0_var(--color-slate-700)]"><tr>${columnas.map((columna) => `<th class="whitespace-nowrap bg-slate-50 px-3 py-2 font-medium dark:bg-slate-800">${escapeHtml(columna)}</th>`).join('')}</tr></thead>
      <tbody>${filas.map((fila) => `<tr class="border-t border-slate-100 dark:border-slate-800">${celdas(fila).map((celda) => `<td class="whitespace-nowrap px-3 py-2 align-top">${celda}</td>`).join('')}</tr>`).join('')}</tbody>
    </table>`
    host.scrollTop = 0
  }

  function pintar() {
    pintarIndicadores()
    const filas = filasVisibles()
    const activo = 'inline-flex h-8 items-center rounded-md bg-blue-600 px-2.5 text-xs font-medium text-white'
    const idle = 'inline-flex h-8 items-center rounded-md px-2.5 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
    root.querySelector('#informe-tab-detalle').className = vista === 'detalle' ? activo : idle
    root.querySelector('#informe-tab-resumen').className = vista === 'resumen' ? activo : idle
    root.querySelector('#informe-tab-detalle').setAttribute('aria-selected', String(vista === 'detalle'))
    root.querySelector('#informe-tab-resumen').setAttribute('aria-selected', String(vista === 'resumen'))
    const limite = root.querySelector('#informe-limite')
    limite.textContent = informe?.truncado ? 'Mostramos los primeros 500 registros del período. Afiná el empleado o las fechas para ver el resto.' : ''
    limite.classList.toggle('hidden', !informe?.truncado)
    if (vista === 'resumen') {
      const resumen = resumirEmpleados(filas)
      pintarTabla(
        ['Empleado', 'Jornadas', 'Llegadas tarde', 'Minutos de tardanza', 'Salidas anticipadas', 'Minutos anticipados', 'Incompletas', 'Programados', 'Trabajados', 'Saldo'],
        resumen,
        (fila) => [
          escapeHtml(fila.empleado || '—'),
          String(fila.jornadasEvaluadas),
          String(fila.llegadasTarde),
          escapeHtml(textoMinutos(fila.minutosTardanza)),
          String(fila.salidasAnticipadas),
          escapeHtml(textoMinutos(fila.minutosSalidaAnticipada)),
          String(fila.jornadasIncompletas),
          escapeHtml(textoMinutos(fila.minutosProgramados)),
          escapeHtml(textoMinutos(fila.minutosTrabajados)),
          escapeHtml(textoMinutos(fila.saldo)),
        ],
      )
      syncExport()
      return
    }
    pintarTabla(
      ['Fecha', 'Empleado', 'Horario previsto', 'Entrada', 'Salida', 'Resultado', 'Diferencia', 'Exceso'],
      filas,
      (fila) => [
        escapeHtml(fila.fecha),
        escapeHtml(fila.empleado || '—'),
        escapeHtml(fila.horarioPrevisto || '—'),
        escapeHtml(fila.entrada || '—'),
        escapeHtml(fila.salida || '—'),
        (fila.resultados ?? []).map((item) => badgeHtml(item.etiqueta, TONO[item.codigo] ?? 'neutral')).join(' '),
        escapeHtml(textoDiferencia(fila) || '—'),
        escapeHtml(textoExceso(fila) || '—'),
      ],
    )
    syncExport()
  }

  async function cargar() {
    const ticket = ++carga
    actualizarLimpiar()
    syncExport()
    root.querySelector('#informe-fechas').classList.toggle('hidden', filtros.periodo !== 'personalizado')
    prepararContenido(false).replaceChildren(createFeedbackState({ title: 'Cargando informe', message: 'Estamos consultando las jornadas del período.' }))
    try {
      const siguiente = await obtenerInformeAsistencia({
        periodo: filtros.periodo,
        empleadoId: filtros.empleadoId,
        departamentoId: filtros.departamentoId,
        sucursalId: filtros.sucursalId,
        customDesde: filtros.customDesde,
        customHasta: filtros.customHasta,
        hoy: contexto?.hoy,
      }, { empleados: empleadosFiltrados() })
      if (destruido || ticket !== carga) return
      informe = siguiente
      pintar()
    } catch {
      if (destruido || ticket !== carga) return
      const estado = createFeedbackState({
        title: 'No se pudo cargar el informe',
        message: 'Reintentá en unos segundos.',
        tone: 'error',
        actionLabel: 'Reintentar',
        onAction: () => void cargar(),
      })
      prepararContenido(false).replaceChildren(estado)
      syncExport()
    }
  }

  function elegirIndicador(id) {
    const mapa = {
      'llegadas-tarde': INCIDENCIA.llegadaTarde,
      'salidas-anticipadas': INCIDENCIA.salidaAnticipada,
      incompletas: INCIDENCIA.incompleta,
      'fuera-horario': INCIDENCIA.fueraHorario,
    }
    const filtro = mapa[id]
    if (filtro === INCIDENCIA.fueraHorario) {
      const activo = filtros.indicador === INCIDENCIA.fueraHorario
      filtros.indicador = activo ? '' : INCIDENCIA.fueraHorario
      if (!activo) filtros.incidencia = INCIDENCIA.todas
    } else {
      const activo = filtros.incidencia === filtro && !filtros.indicador
      filtros.indicador = ''
      filtros.incidencia = activo ? INCIDENCIA.todas : filtro
    }
    incidencia.control.value = filtros.incidencia
    actualizarLimpiar()
    pintar()
  }

  periodo.control.addEventListener('change', () => {
    filtros.periodo = periodo.control.value
    if (filtros.periodo === 'personalizado' && (!filtros.customDesde || !filtros.customHasta)) {
      root.querySelector('#informe-fechas').classList.remove('hidden')
      actualizarLimpiar()
      return
    }
    void cargar()
  })
  sucursal?.control.addEventListener('change', () => {
    filtros.sucursalId = sucursal.control.value
    if (departamento) {
      departamento.pintar(opcionesDepartamento(filtros.sucursalId), '')
      filtros.departamentoId = ''
    }
    sincronizarEmpleados()
    void cargar()
  })
  departamento?.control.addEventListener('change', () => {
    filtros.departamentoId = departamento.control.value
    sincronizarEmpleados()
    void cargar()
  })
  incidencia.control.addEventListener('change', () => {
    filtros.incidencia = incidencia.control.value
    filtros.indicador = ''
    actualizarLimpiar()
    pintar()
  })
  fechas.querySelector('#informe-desde').addEventListener('change', (event) => {
    filtros.customDesde = event.target.value
    if (filtros.customDesde && filtros.customHasta) void cargar()
  })
  fechas.querySelector('#informe-hasta').addEventListener('change', (event) => {
    filtros.customHasta = event.target.value
    if (filtros.customDesde && filtros.customHasta) void cargar()
  })
  root.querySelector('#informe-limpiar').addEventListener('click', () => {
    filtros = {
      periodo: 'mes',
      empleadoId: '',
      departamentoId: '',
      sucursalId: '',
      incidencia: INCIDENCIA.todas,
      indicador: '',
      customDesde: '',
      customHasta: '',
    }
    periodo.control.value = 'mes'
    if (sucursal) sucursal.control.value = ''
    if (departamento) departamento.pintar(opcionesDepartamento(''), '')
    incidencia.control.value = INCIDENCIA.todas
    fechas.querySelector('#informe-desde').value = ''
    fechas.querySelector('#informe-hasta').value = ''
    combobox.setEmpleadoId('', { silent: true })
    sincronizarEmpleados()
    void cargar()
  })
  root.querySelector('#informe-indicadores').addEventListener('click', (event) => {
    const boton = event.target.closest('[data-indicador]')
    if (!boton) return
    elegirIndicador(boton.dataset.indicador)
  })
  const tabs = [root.querySelector('#informe-tab-detalle'), root.querySelector('#informe-tab-resumen')]
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => {
      vista = index === 0 ? 'detalle' : 'resumen'
      pintar()
    })
    tab.addEventListener('keydown', (event) => {
      if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return
      event.preventDefault()
      const delta = event.key === 'ArrowRight' ? 1 : -1
      const next = tabs[(index + delta + tabs.length) % tabs.length]
      next.focus()
      next.click()
    })
  })

  function textoPeriodo() {
    return periodo.control.selectedOptions[0]?.textContent || ''
  }

  function textoFiltros() {
    return [
      textoPeriodo(),
      filtros.empleadoId ? 'Empleado seleccionado' : 'Todos los empleados',
      departamento.control.selectedOptions[0]?.textContent,
      sucursal.control.selectedOptions[0]?.textContent,
      incidencia.control.selectedOptions[0]?.textContent,
    ].filter(Boolean).join(' · ')
  }

  function filasDocumento() {
    const filas = filasVisibles()
    if (vista === 'resumen') {
      const resumen = resumirEmpleados(filas)
      return {
        columns: ['Legajo', 'Empleado', 'Jornadas', 'Llegadas tarde', 'Minutos de tardanza', 'Salidas anticipadas', 'Minutos anticipados', 'Incompletas', 'Programados', 'Trabajados', 'Saldo'],
        rows: resumen.map((fila) => [
          fila.legajo ?? '',
          fila.empleado || '—',
          String(fila.jornadasEvaluadas),
          String(fila.llegadasTarde),
          textoMinutos(fila.minutosTardanza),
          String(fila.salidasAnticipadas),
          textoMinutos(fila.minutosSalidaAnticipada),
          String(fila.jornadasIncompletas),
          textoMinutos(fila.minutosProgramados),
          textoMinutos(fila.minutosTrabajados),
          textoMinutos(fila.saldo),
        ]),
      }
    }
    return {
      columns: ['Fecha', 'Legajo', 'Empleado', 'Horario previsto', 'Entrada', 'Salida', 'Resultado', 'Diferencia', 'Exceso'],
      rows: filas.map((fila) => [
        fila.fecha,
        fila.legajo ?? '',
        fila.empleado || '—',
        fila.horarioPrevisto || '—',
        fila.entrada || '—',
        fila.salida || '—',
        (fila.resultados ?? []).map((item) => item.etiqueta).join(', ') || '—',
        textoDiferencia(fila) || '—',
        textoExceso(fila) || '—',
      ]),
    }
  }

  function exportarCsv() {
    const filas = filasVisibles()
    if (!filas.length) {
      showToast({ message: 'No hay datos para exportar con los filtros seleccionados.', tone: 'warning' })
      return
    }
    const tipo = vista === 'resumen' ? 'resumen' : 'detalle'
    downloadCsv(nombreCsvInforme(tipo, todayDateKey()), csvInforme(tipo, filas))
  }

  function exportarPdf() {
    const documento = filasDocumento()
    if (!documento.rows.length) {
      showToast({ message: 'No hay datos para exportar con los filtros seleccionados.', tone: 'warning' })
      return
    }
    const tipo = vista === 'resumen' ? 'resumen' : 'detalle'
    const titulo = tipo === 'resumen'
      ? 'Informe de asistencia — Resumen por empleado'
      : 'Informe de asistencia — Detalle de jornadas'
    return printReport({
      filename: nombreExportInforme(tipo, todayDateKey(), 'pdf'),
      title: titulo,
      empresa: empresaNombre?.() || '',
      periodo: textoPeriodo(),
      generatedAt: new Date().toISOString(),
      filters: textoFiltros(),
      columns: documento.columns,
      rows: documento.rows,
      summaryItems: [{ label: 'Registros', value: documento.rows.length }],
      landscape: true,
    })
  }

  const informeExport = createExportMenu({
    id: 'informe-exportar',
    onCsv: () => exportarCsv(),
    onPdf: () => exportarPdf(),
  })
  root.querySelector('#informe-filter-actions')?.append(informeExport.root)

  function syncExport() {
    const hayDatos = filasVisibles().length > 0
    informeExport.setEnabled({
      csv: hayDatos,
      pdf: hayDatos,
      reason: hayDatos ? '' : 'No hay datos para exportar',
    })
  }

  void cargar()

  return {
    root,
    exportarCsv,
    exportarPdf,
    destroy() {
      destruido = true
      informeExport.destroy()
      combobox.destroy()
    },
  }
}
