import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  ATTENTION_EMPTY_DETAIL,
  ATTENTION_EMPTY_TITLE,
  ATTENTION_HUELLA,
  ATTENTION_LEGAJO_EMPTY,
  ATTENTION_LEGAJO_FORMAT,
  DASHBOARD_CORRECT_DATOS_LABEL,
  DASHBOARD_ENROLL_HUELLA_LABEL,
  DASHBOARD_REVIEW_EMPLEADO_LABEL,
  buildEmployeeAttentionItems,
  buildEmpleadoAlertas,
  classifyEmployeeAttentionActions,
  empleadoPerteneceAEmpresaActiva,
  formatAttentionIssue,
  pendientesBadgeLabel,
  sortAttentionIssues,
} from '../src/utils/empleado-alerts.js'
import { buildDashboardAlertas, dashboardAlertasHeading, employeeAlertActions } from '../src/utils/dashboard-alertas.js'
import {
  DASHBOARD_ALERTS_SCROLL_AFTER,
  DASHBOARD_SEE_ALL_PENDIENTES_LABEL,
  dashboardAlertsListClass,
  dashboardContentLayout,
  dashboardHasAlertas,
} from '../src/components/dashboard-alerts.js'
import {
  canOpenEnrolarHuellaModal,
  ENROLAR_HUELLA_NOTICE_TITLE,
  ENROLAR_HUELLA_REFRESH_LABEL,
  ENROLAR_HUELLA_STEP1_TITLE,
  ENROLAR_HUELLA_STEP2_TITLE,
  ENROLAR_HUELLA_STEP3_TITLE,
  ENROLAR_HUELLA_TITLE,
  ENROLAR_HUELLA_UNDERSTOOD_LABEL,
  enrolarHuellaAccordionSteps,
  enrolarHuellaExclusiveOpen,
  enrolarHuellaLead,
  enrolarHuellaNotice,
} from '../src/components/enrolar-huella-modal.js'

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

const admin = { rol: 'ADMIN', empresaId: 9 }

function complete(overrides) {
  return {
    activo: true,
    dni: '12345678',
    cuil: '20123456786',
    sucursal: 'Centro',
    horario: '08:00-17:00',
    departamento: 'Ops',
    legajo: '100',
    tieneHuella: true,
    ...overrides,
  }
}

check('Un empleado con tres problemas aparece una sola vez', () => {
  const samuel = complete({
    id: 10,
    nombre: 'Samuel',
    apellido: 'Salinas',
    departamento: '',
    legajo: '',
    tieneHuella: false,
  })
  const items = buildEmployeeAttentionItems([samuel, samuel])
  assert.equal(items.length, 1)
  assert.equal(items[0].id, 10)
  assert.equal(items[0].issues.length, 3)
})

check('El badge indica 3 pendientes', () => {
  assert.equal(pendientesBadgeLabel(1), '1 pendiente')
  assert.equal(pendientesBadgeLabel(3), '3 pendientes')
  const samuel = complete({
    id: 10,
    nombre: 'Samuel',
    apellido: 'Salinas',
    departamento: '',
    legajo: '',
    tieneHuella: false,
  })
  const alertas = buildDashboardAlertas({ user: admin, empleados: [samuel] })
  const card = alertas.items.find((item) => item.type === 'empleado')
  assert.equal(card.badge, '3 pendientes')
  assert.equal(card.pendingCount, 3)
})

check('Dos empleados con problemas generan dos tarjetas', () => {
  const empleados = [
    complete({ id: 1, nombre: 'Ana', apellido: 'Perez', tieneHuella: false }),
    complete({ id: 2, nombre: 'Bruno', apellido: 'Diaz', departamento: '' }),
  ]
  const items = buildEmployeeAttentionItems(empleados)
  assert.equal(items.length, 2)
  assert.deepEqual(items.map((item) => item.id).sort(), [1, 2])
})

check('El encabezado diferencia empleados únicos y cantidad de pendientes', () => {
  assert.equal(dashboardAlertasHeading(3, 7), '3 empleados requieren atención · 7 pendientes')
  const empleados = [
    complete({ id: 1, nombre: 'Ana', apellido: 'Perez', tieneHuella: false, departamento: '' }),
    complete({ id: 2, nombre: 'Bruno', apellido: 'Diaz', legajo: '' }),
  ]
  const alertas = buildDashboardAlertas({ user: admin, empleados })
  assert.equal(alertas.employeeCount, 2)
  assert.equal(alertas.pendingCount, 3)
  assert.equal(dashboardAlertasHeading(alertas.employeeCount, alertas.pendingCount), '2 empleados requieren atención · 3 pendientes')
})

check('Un legajo vacío genera el pendiente correspondiente', () => {
  const items = buildEmployeeAttentionItems([complete({ id: 1, nombre: 'Ana', apellido: 'Perez', legajo: null })])
  assert.equal(items[0].issues.some((issue) => issue.message === ATTENTION_LEGAJO_EMPTY), true)
  assert.equal(items[0].issues.some((issue) => issue.key === 'legajo-format'), false)
})

check('Un legajo inválido genera error de formato', () => {
  const items = buildEmployeeAttentionItems([complete({ id: 1, nombre: 'Ana', apellido: 'Perez', legajo: 'encargada' })])
  assert.equal(items[0].issues.some((issue) => issue.message === ATTENTION_LEGAJO_FORMAT), true)
  assert.equal(items[0].issues.some((issue) => issue.key === 'legajo-empty'), false)
})

check('Un duplicado aparece en todos los empleados involucrados', () => {
  const empleados = [
    complete({ id: 1, nombre: 'Ana', apellido: 'Perez', legajo: 'EMP-004' }),
    complete({ id: 2, nombre: 'Bruno', apellido: 'Diaz', legajo: 'emp-004' }),
    complete({ id: 3, nombre: 'Carla', apellido: 'Lopez', legajo: ' EMP-004 ' }),
  ]
  const items = buildEmployeeAttentionItems(empleados)
  assert.equal(items.length, 3)
  items.forEach((item) => {
    const duplicate = item.issues.find((issue) => issue.key === 'legajo-duplicate')
    assert.equal(Boolean(duplicate), true)
    assert.equal(duplicate.message.includes(item.empleado.nombre), false)
  })
  assert.match(items.find((item) => item.id === 1).issues.find((issue) => issue.key === 'legajo-duplicate').message, /Bruno Diaz/)
  assert.match(items.find((item) => item.id === 1).issues.find((issue) => issue.key === 'legajo-duplicate').message, /Carla Lopez/)
})

check('Un legajo inválido y duplicado muestra ambos problemas', () => {
  const empleados = [
    complete({ id: 1, nombre: 'Ana', apellido: 'Perez', legajo: 'EMP-004' }),
    complete({ id: 2, nombre: 'Bruno', apellido: 'Diaz', legajo: 'EMP-004' }),
  ]
  const ana = buildEmployeeAttentionItems(empleados).find((item) => item.id === 1)
  const keys = ana.issues.map((issue) => issue.key)
  assert.equal(keys.includes('legajo-format'), true)
  assert.equal(keys.includes('legajo-duplicate'), true)
  assert.equal(keys.filter((key) => key === 'legajo-format').length, 1)
})

check('La falta de huella se integra en la misma tarjeta', () => {
  const items = buildEmployeeAttentionItems([
    complete({ id: 1, nombre: 'Ana', apellido: 'Perez', tieneHuella: false, departamento: '' }),
  ])
  assert.equal(items.length, 1)
  assert.equal(items[0].issues.some((issue) => issue.message === ATTENTION_HUELLA), true)
  assert.equal(items[0].issues.some((issue) => issue.message.includes('departamento')), true)
})

check('No hay duplicación de mensajes', () => {
  const items = buildEmployeeAttentionItems([
    complete({ id: 1, nombre: 'Ana', apellido: 'Perez', tieneHuella: false, legajo: '', departamento: '' }),
  ])
  const messages = items[0].issues.map((issue) => issue.message)
  assert.equal(new Set(messages).size, messages.length)
  assert.equal(messages.includes(ATTENTION_LEGAJO_EMPTY), true)
  assert.equal(messages.includes(ATTENTION_LEGAJO_FORMAT), false)
})

check('La acción lleva al empleado correcto', () => {
  const empleados = [
    complete({ id: 44, nombre: 'Ana', apellido: 'Perez', tieneHuella: false }),
    complete({ id: 55, nombre: 'Ana', apellido: 'Perez', departamento: '' }),
  ]
  const alertas = buildDashboardAlertas({ user: admin, empleados })
  const cards = alertas.items.filter((item) => item.type === 'empleado')
  assert.equal(cards[0].action.empleadoId, cards[0].empleadoId)
  assert.equal(new Set(cards.map((item) => item.action.empleadoId)).size, 2)
  const dataOnly = cards.find((item) => item.empleadoId === 55)
  assert.equal(dataOnly.action.label, DASHBOARD_REVIEW_EMPLEADO_LABEL)
  assert.equal(dataOnly.action.openEdit, true)
  assert.equal(dataOnly.action.kind, 'edit-empleado')
  const view = read('src/views/empleados.js')
  assert.match(view, /empleadoId/)
  assert.match(view, /openEdit/)
  assert.match(view, /openDetail\(target, \{ edit: openEdit \}\)/)
  assert.match(view, /Number\(item.id\) === focusEmpleadoId/)
  assert.match(view, /empleadoPerteneceAEmpresaActiva/)
  assert.match(view, /initialMode: edit \? 'edit' : 'view'/)
  const form = read('src/components/empleado-form.js')
  assert.match(form, /initialMode === 'edit'/)
  assert.match(form, /showEdit\(\)/)
  const dashboard = read('src/views/dashboard.js')
  assert.match(dashboard, /options.empleadoId = action.empleadoId/)
  assert.match(dashboard, /options.openEdit = true/)
})

check('No se realizan escrituras ni peticiones por empleado', () => {
  const dashboard = read('src/views/dashboard.js')
  const api = read('src/api/dashboard.js')
  assert.equal(dashboard.includes('getEmpleadoById'), false)
  assert.equal(api.includes('getEmpleadoById'), false)
  assert.equal(dashboard.includes('patchEmpleado'), false)
  assert.equal(dashboard.includes('createEmpleado'), false)
  assert.match(dashboard, /getEmpleados\(\{ incluirInactivos: true \}\)/)
  assert.match(dashboard, /empleadoEstaActivo/)
})

check('El estado vacío se muestra correctamente', () => {
  const clean = [complete({ id: 1, nombre: 'Ana', apellido: 'Perez' })]
  const items = buildEmployeeAttentionItems(clean)
  assert.equal(items.length, 0)
  const alertas = buildDashboardAlertas({ user: admin, empleados: clean })
  assert.equal(alertas.showEmpty, true)
  assert.equal(alertas.employeeCount, 0)
  assert.equal(ATTENTION_EMPTY_TITLE, 'Sin pendientes de empleados')
  assert.equal(
    ATTENTION_EMPTY_DETAIL,
    'Los empleados activos no presentan datos que requieran revisión.',
  )
  const alertsUi = read('src/components/dashboard-alerts.js')
  assert.equal(alertsUi.includes('ATTENTION_EMPTY_TITLE'), false)
  assert.equal(alertsUi.includes('Sin pendientes de empleados'), false)
  assert.equal(buildEmpleadoAlertas(clean).count, 0)
})

check('El agrupamiento es por empleado.id y no por nombre', () => {
  const source = read('src/utils/empleado-alerts.js')
  assert.match(source, /buildEmployeeAttentionItems/)
  assert.match(source, /grouped.set\(id/)
  const sameName = [
    complete({ id: 1, nombre: 'Ana', apellido: 'Perez', tieneHuella: false }),
    complete({ id: 2, nombre: 'Ana', apellido: 'Perez', departamento: '' }),
  ]
  assert.equal(buildEmployeeAttentionItems(sameName).length, 2)
})

check('El Dashboard muestra el subtítulo exacto debajo del título', () => {
  const dashboard = read('src/views/dashboard.js')
  const heading = read('src/components/page-heading.js')
  const header = read('src/components/header.js')
  assert.match(dashboard, /title: 'Dashboard'/)
  assert.match(dashboard, /Resumen general del sistema y la actividad de hoy\./)
  assert.match(dashboard, /pageHeadingMarkup/)
  assert.match(heading, /text-sm text-slate-500 dark:text-slate-400/)
  assert.match(header, />Panel</)
})

check('Un solo empleado no fuerza altura vacía; hasta tres no scrollean', () => {
  const alerts = read('src/components/dashboard-alerts.js')
  const dashboard = read('src/views/dashboard.js')
  assert.equal(DASHBOARD_ALERTS_SCROLL_AFTER, 3)
  assert.match(dashboardAlertsListClass(1), /overflow-visible/)
  assert.match(dashboardAlertsListClass(3), /overflow-visible/)
  assert.equal(dashboardAlertsListClass(1).includes('max-h-'), false)
  assert.equal(dashboardAlertsListClass(3).includes('overflow-y-auto'), false)
  assert.match(alerts, /h-auto/)
  assert.match(alerts, /lg:self-start/)
  assert.equal(/min-h-\[(?:1[6-9]|[2-9]\d)rem\]/.test(alerts), false)
  assert.match(dashboard, /lg:self-start/)
  assert.equal(dashboard.includes("alerts.classList.add(\n          'order-3',\n          'min-h-0',\n          'min-w-0',\n          'lg:col-start-1',\n          'lg:row-start-2',\n          'lg:flex-1'"), false)
})

check('Con más de tres empleados hay altura máxima y scroll interno', () => {
  const alerts = read('src/components/dashboard-alerts.js')
  const scrolled = dashboardAlertsListClass(4)
  assert.match(scrolled, /max-h-\[min\(22rem,50vh\)\]/)
  assert.match(scrolled, /overflow-y-auto/)
  assert.match(alerts, /heading.className = 'mb-4 shrink-0'/)
  assert.match(alerts, /list.className = dashboardAlertsListClass\(employeeCount\)/)
})

check('No se duplica la apertura al hacer clic en la tarjeta o en la acción', () => {
  const alerts = read('src/components/dashboard-alerts.js')
  assert.match(alerts, /aria-label="\$\{escapeHtml\(`\$\{actionLabel\}: \$\{name\}`\)\}"/)
  assert.match(alerts, /Revisar empleado/)
  assert.match(alerts, /iconChevronRight/)
  assert.match(alerts, /stopPropagation/)
  assert.match(alerts, /cardAction/)
  assert.match(alerts, /data-alert-action/)
})

check('Las categorías no reemplazan las descripciones y el orden es estable', () => {
  const samuel = complete({
    id: 10,
    nombre: 'Samuel',
    apellido: 'Salinas',
    sucursal: '',
    departamento: '',
    horario: '',
    legajo: '',
    tieneHuella: false,
  })
  const issues = buildEmployeeAttentionItems([samuel])[0].issues
  assert.deepEqual(
    issues.map((issue) => issue.key),
    ['huella', 'legajo-empty', 'missing-departamento', 'missing-sucursal', 'missing-horario'],
  )
  assert.equal(formatAttentionIssue(issues[0]), `Biometría · ${ATTENTION_HUELLA}`)
  assert.equal(formatAttentionIssue(issues[1]), `Legajo · ${ATTENTION_LEGAJO_EMPTY}`)
  assert.match(formatAttentionIssue(issues.find((issue) => issue.key === 'missing-sucursal')), /Sucursal · /)
  assert.match(formatAttentionIssue(issues.find((issue) => issue.key === 'missing-departamento')), /Departamento · /)
  assert.match(formatAttentionIssue(issues.find((issue) => issue.key === 'missing-horario')), /Horario · /)
  const alerts = read('src/components/dashboard-alerts.js')
  assert.match(alerts, /formatAttentionIssue/)
  assert.deepEqual(
    sortAttentionIssues([
      { key: 'missing-horario', message: 'h' },
      { key: 'huella', message: 'b' },
      { key: 'legajo-duplicate', message: 'd' },
    ]).map((issue) => issue.key),
    ['huella', 'legajo-duplicate', 'missing-horario'],
  )
})

check('Se mantienen agrupación, cantidades, pluralización y el acceso a todos', () => {
  assert.equal(dashboardAlertasHeading(1, 1), '1 empleado requiere atención · 1 pendiente')
  assert.equal(dashboardAlertasHeading(2, 3), '2 empleados requieren atención · 3 pendientes')
  const alerts = read('src/components/dashboard-alerts.js')
  assert.equal(DASHBOARD_SEE_ALL_PENDIENTES_LABEL, 'Ver todos los empleados con pendientes')
  assert.match(alerts, /employeeItems.length > 1/)
  assert.match(alerts, /estadoDatos: 'pendientes'/)
  const view = read('src/views/empleados.js')
  assert.match(view, /option value="pendientes"/)
  assert.match(view, /estadoDatos === 'pendientes'/)
  const dashboard = read('src/views/dashboard.js')
  assert.match(dashboard, /options.estadoDatos = action.estadoDatos/)
})

check('No se muestran sugerencias de legajo en el Dashboard', () => {
  const alerts = read('src/components/dashboard-alerts.js')
  const dashboard = read('src/views/dashboard.js')
  assert.equal(/Recomendado|sugerid|getRecommendedLegajo|Usar sugerido/i.test(alerts), false)
  assert.equal(/getRecommendedLegajo|Usar sugerido/i.test(dashboard), false)
})

check('Sin pendientes desaparece el panel y las fichadas ocupan todo el ancho', () => {
  const clean = [complete({ id: 1, nombre: 'Ana', apellido: 'Perez' })]
  const alertas = buildDashboardAlertas({ user: admin, empleados: clean, catalogReady: true })
  assert.equal(dashboardHasAlertas(alertas), false)
  assert.equal(dashboardContentLayout({ hasDataError: false, alertas }), 'wide')
  const dashboard = read('src/views/dashboard.js')
  assert.match(dashboard, /lg:col-span-2/)
  assert.match(dashboard, /layout === 'split'/)
})

check('No se puede descartar manualmente una alerta', () => {
  const alerts = read('src/components/dashboard-alerts.js')
  assert.equal(/descart|ocultar alerta|dismiss|onDismiss/i.test(alerts), false)
})

check('La navegación y los controles funcionan con teclado', () => {
  const alerts = read('src/components/dashboard-alerts.js')
  assert.match(alerts, /focus-visible:ring-2/)
  assert.match(alerts, /type="button"/)
  assert.match(alerts, /aria-label/)
  assert.match(alerts, /setAttribute\('aria-labelledby', 'dashboard-alertas-title'\)/)
})

check('El modal de edición valida la empresa activa', () => {
  assert.equal(empleadoPerteneceAEmpresaActiva({ id: 1, empresaId: 9 }, 9), true)
  assert.equal(empleadoPerteneceAEmpresaActiva({ id: 1, empresaId: 3 }, 9), false)
  assert.equal(empleadoPerteneceAEmpresaActiva({ id: 1 }, 9), true)
  assert.equal(empleadoPerteneceAEmpresaActiva({ id: 1, empresaId: 9 }, null), false)
})

check('Pendiente únicamente biométrico muestra Cómo enrolar la huella y no Revisar empleado', () => {
  const samuel = complete({ id: 10, nombre: 'Samuel', apellido: 'Salinas', tieneHuella: false })
  assert.equal(classifyEmployeeAttentionActions(buildEmployeeAttentionItems([samuel])[0].issues), 'agent')
  const alertas = buildDashboardAlertas({ user: admin, empleados: [samuel] })
  const card = alertas.items.find((item) => item.type === 'empleado')
  assert.equal(card.attentionKind, 'agent')
  assert.equal(card.actions.length, 1)
  assert.equal(card.actions[0].label, DASHBOARD_ENROLL_HUELLA_LABEL)
  assert.equal(card.actions[0].kind, 'enroll-help')
  assert.equal(card.actions[0].openEdit, undefined)
  assert.equal(card.actions[0].view, undefined)
  assert.equal(card.action.label, DASHBOARD_ENROLL_HUELLA_LABEL)
  assert.equal(card.actions.some((action) => action.label === DASHBOARD_REVIEW_EMPLEADO_LABEL), false)
  const alerts = read('src/components/dashboard-alerts.js')
  assert.match(alerts, /Cómo enrolar la huella|cardAction/)
})

check('La acción biométrica no abre el formulario del empleado', () => {
  const card = buildDashboardAlertas({
    user: admin,
    empleados: [complete({ id: 10, nombre: 'Samuel', apellido: 'Salinas', tieneHuella: false })],
  }).items.find((item) => item.type === 'empleado')
  assert.equal(card.action.kind, 'enroll-help')
  assert.equal(card.action.view, undefined)
  assert.equal(card.action.openEdit, undefined)
  const dashboard = read('src/views/dashboard.js')
  assert.match(dashboard, /kind === 'enroll-help'/)
  assert.match(dashboard, /openEnrolarHuellaModal/)
  assert.match(dashboard, /openEnrollHelp\(action\)/)
  assert.equal(dashboard.includes('patchEmpleado'), false)
})

check('El modal de enrolamiento muestra el aviso y el acordeón de tres pasos', () => {
  const nombre = 'Samuel Salinas'
  assert.equal(ENROLAR_HUELLA_TITLE, 'Enrolar huella biométrica')
  assert.equal(ENROLAR_HUELLA_NOTICE_TITLE, 'Este proceso se realiza desde el agente local')
  assert.equal(
    enrolarHuellaNotice(nombre),
    'La huella de Samuel Salinas debe enrolarse desde la computadora conectada al lector.',
  )
  assert.equal(enrolarHuellaLead(nombre), enrolarHuellaNotice(nombre))
  const steps = enrolarHuellaAccordionSteps(nombre)
  assert.equal(steps.length, 3)
  assert.equal(steps[0].title, 'Verificá que el lector esté conectado')
  assert.equal(steps[0].title, ENROLAR_HUELLA_STEP1_TITLE)
  assert.equal(steps[1].title, ENROLAR_HUELLA_STEP2_TITLE)
  assert.equal(steps[2].title, ENROLAR_HUELLA_STEP3_TITLE)
  assert.equal(steps[1].body.includes('Samuel Salinas'), true)
  assert.equal(steps[1].body.includes('Enrolar huella'), true)
  assert.equal(enrolarHuellaExclusiveOpen(0, 0), 0)
  assert.equal(enrolarHuellaExclusiveOpen(0, 1), 1)
  assert.equal(enrolarHuellaExclusiveOpen(1, 2), 2)
  assert.equal(ENROLAR_HUELLA_UNDERSTOOD_LABEL, 'Entendido')
  assert.equal(ENROLAR_HUELLA_REFRESH_LABEL, 'Actualizar estado')
  const modal = read('src/components/enrolar-huella-modal.js')
  const styles = read('src/style.css')
  assert.match(modal, /openModal/)
  assert.match(modal, /labelledBy: 'enrolar-huella-title'/)
  assert.match(modal, /initialOpen: 0/)
  assert.match(modal, /aria-expanded/)
  assert.match(modal, /aria-controls/)
  assert.match(modal, /data-chevron/)
  assert.match(modal, /rotate-180/)
  assert.match(modal, /type = 'button'/)
  assert.match(modal, /iconChevronDown/)
  assert.match(modal, /nameNode.textContent = nombre/)
  assert.match(modal, /body.textContent = step.body/)
  assert.match(modal, /data-action="entendido"/)
  assert.match(modal, /data-action="actualizar"/)
  assert.match(modal, /onRefresh\?\.\(\)/)
  assert.match(modal, /iconFingerprint/)
  assert.equal(/completado|completed|data-done|checkmark/i.test(modal), false)
  assert.match(styles, /enrolar-huella-panel/)
  assert.match(styles, /prefers-reduced-motion/)
  const dashboard = read('src/views/dashboard.js')
  assert.match(dashboard, /function refreshDashboard/)
  assert.match(dashboard, /onRefresh: refreshDashboard/)
  assert.match(dashboard, /refreshButton.addEventListener\('click'/)
  assert.match(dashboard, /refreshDashboard\(\)/)
})

check('Problemas únicamente editables muestran Revisar empleado', () => {
  const ana = complete({ id: 55, nombre: 'Ana', apellido: 'Perez', departamento: '' })
  const card = buildDashboardAlertas({ user: admin, empleados: [ana] }).items.find((item) => item.type === 'empleado')
  assert.equal(card.attentionKind, 'frontend')
  assert.equal(card.action.label, DASHBOARD_REVIEW_EMPLEADO_LABEL)
  assert.equal(card.action.kind, 'edit-empleado')
  assert.equal(card.action.openEdit, true)
  assert.equal(card.actions.some((action) => action.kind === 'enroll-help'), false)
})

check('Problemas mixtos muestran las dos acciones y cada una su destino', () => {
  const samuel = complete({
    id: 10,
    nombre: 'Samuel',
    apellido: 'Salinas',
    departamento: '',
    tieneHuella: false,
  })
  assert.equal(classifyEmployeeAttentionActions(buildEmployeeAttentionItems([samuel])[0].issues), 'mixed')
  const card = buildDashboardAlertas({ user: admin, empleados: [samuel] }).items.find((item) => item.type === 'empleado')
  assert.equal(card.attentionKind, 'mixed')
  assert.equal(card.cardAction, null)
  assert.deepEqual(card.actions.map((action) => action.label), [
    DASHBOARD_CORRECT_DATOS_LABEL,
    DASHBOARD_ENROLL_HUELLA_LABEL,
  ])
  assert.equal(card.actions[0].kind, 'edit-empleado')
  assert.equal(card.actions[0].openEdit, true)
  assert.equal(card.actions[1].kind, 'enroll-help')
  assert.equal(card.actions[1].view, undefined)
  const resolved = employeeAlertActions(admin, buildEmployeeAttentionItems([samuel])[0])
  assert.equal(resolved.cardAction, null)
  const alerts = read('src/components/dashboard-alerts.js')
  assert.match(alerts, /EXPLICIT_ACTION_CLASS/)
})

check('No se realizan escrituras ni llamadas de enrolamiento y no se exponen datos sensibles', () => {
  const dashboard = read('src/views/dashboard.js')
  const modal = read('src/components/enrolar-huella-modal.js')
  const alerts = read('src/components/dashboard-alerts.js')
  const joined = `${dashboard}\n${modal}\n${alerts}`
  assert.equal(/apiFetch\(|fetch\(/i.test(modal), false)
  assert.equal(/\/api\/huellas|enrolarHuella\(|postHuella|biometricoId|clientSecret|serialLector|plantilla/i.test(joined), false)
  assert.equal(modal.includes('innerHTML = enrolarHuellaLead'), false)
  assert.match(modal, /textContent/)
})

check('El modal de enrolamiento funciona con teclado y valida la empresa', () => {
  const modalSrc = read('src/components/enrolar-huella-modal.js')
  const modalLib = read('src/components/modal.js')
  assert.match(modalSrc, /openModal/)
  assert.match(modalLib, /role', 'dialog'/)
  assert.match(modalLib, /aria-modal/)
  assert.match(modalLib, /aria-labelledby/)
  assert.match(modalLib, /previousFocus/)
  assert.match(modalLib, /event.key !== 'Escape'/)
  assert.match(modalLib, /trapFocus/)
  assert.equal(canOpenEnrolarHuellaModal({ empleado: { id: 10, empresaId: 9 }, empresaId: 9 }), true)
  assert.equal(canOpenEnrolarHuellaModal({ empleado: { id: 10, empresaId: 3 }, empresaId: 9 }), false)
})

console.log(`${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
