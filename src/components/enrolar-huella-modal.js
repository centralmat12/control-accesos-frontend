import { empleadoPerteneceAEmpresaActiva } from '../utils/empleado-alerts.js'
import { BTN_SECONDARY_CLASS } from './button-styles.js'
import { iconChevronDown, iconFingerprint } from './icons.js'
import { openModal } from './modal.js'

export const ENROLAR_HUELLA_TITLE = 'Enrolar huella biométrica'
export const ENROLAR_HUELLA_UNDERSTOOD_LABEL = 'Entendido'
export const ENROLAR_HUELLA_REFRESH_LABEL = 'Actualizar estado'
export const ENROLAR_HUELLA_NOTICE_TITLE = 'Este proceso se realiza desde el agente local'
export const ENROLAR_HUELLA_STEP1_TITLE = 'Verificá que el lector esté conectado'
export const ENROLAR_HUELLA_STEP2_TITLE = 'Enrolá la huella'
export const ENROLAR_HUELLA_STEP3_TITLE = 'Confirmá la sincronización'

export function enrolarHuellaNombreSeguro(nombre) {
  const value = String(nombre ?? '').trim()
  return value || 'este empleado'
}

export function enrolarHuellaNotice(nombre) {
  return `La huella de ${enrolarHuellaNombreSeguro(nombre)} debe enrolarse desde la computadora conectada al lector.`
}

export function enrolarHuellaLead(nombre) {
  return enrolarHuellaNotice(nombre)
}

export function enrolarHuellaAccordionSteps(nombre) {
  const name = enrolarHuellaNombreSeguro(nombre)
  return [
    {
      id: 'enrolar-huella-paso-1',
      number: 1,
      title: ENROLAR_HUELLA_STEP1_TITLE,
      body: 'Abrí el Agente de Control de Accesos en la computadora del fichador.',
    },
    {
      id: 'enrolar-huella-paso-2',
      number: 2,
      title: ENROLAR_HUELLA_STEP2_TITLE,
      body: `Seleccioná “Enrolar huella”, buscá a ${name} y completá la captura.`,
    },
    {
      id: 'enrolar-huella-paso-3',
      number: 3,
      title: ENROLAR_HUELLA_STEP3_TITLE,
      body: 'Esperá que finalice la sincronización. Después volvé al Dashboard y actualizá el estado.',
    },
  ]
}

export function enrolarHuellaExclusiveOpen(current, next) {
  const index = Number(next)
  if (!Number.isInteger(index) || index < 0) return current
  return index
}

export function canOpenEnrolarHuellaModal({ empleado, empresaId } = {}) {
  return empleadoPerteneceAEmpresaActiva(empleado, empresaId)
}

function lockBackgroundScroll() {
  const html = document.documentElement
  const body = document.body
  const previousHtml = html.style.overflow
  const previousBody = body.style.overflow
  html.style.overflow = 'hidden'
  body.style.overflow = 'hidden'
  return () => {
    html.style.overflow = previousHtml
    body.style.overflow = previousBody
  }
}

function appendNotice(parent, nombre) {
  const box = document.createElement('div')
  box.className =
    'rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 dark:border-amber-700/70 dark:bg-amber-950/50'
  box.setAttribute('data-enrolar-notice', '')

  const title = document.createElement('p')
  title.className = 'text-sm font-semibold text-amber-950 dark:text-amber-100'
  title.textContent = ENROLAR_HUELLA_NOTICE_TITLE

  const description = document.createElement('p')
  description.className = 'mt-1 text-sm leading-5 text-amber-900 dark:text-amber-200'
  description.append('La huella de ')
  const nameNode = document.createElement('strong')
  nameNode.className = 'font-semibold text-amber-950 dark:text-amber-50'
  nameNode.textContent = nombre
  description.append(nameNode)
  description.append(' debe enrolarse desde la computadora conectada al lector.')

  box.append(title, description)
  parent.append(box)
}

export function createEnrolarHuellaAccordion(nombre, { initialOpen = 0 } = {}) {
  const steps = enrolarHuellaAccordionSteps(nombre)
  let openIndex = enrolarHuellaExclusiveOpen(-1, initialOpen)

  const root = document.createElement('div')
  root.className = 'enrolar-huella-accordion relative'
  root.setAttribute('data-enrolar-accordion', '')

  const rail = document.createElement('span')
  rail.className =
    'pointer-events-none absolute bottom-4 left-[0.875rem] top-4 w-px bg-amber-300/70 dark:bg-amber-600/50'
  rail.setAttribute('aria-hidden', 'true')
  root.append(rail)

  const items = steps.map((step, index) => {
    const item = document.createElement('div')
    item.className = 'relative pl-11'
    if (index > 0) item.classList.add('mt-2')

    const button = document.createElement('button')
    button.type = 'button'
    button.id = `${step.id}-trigger`
    button.className =
      'flex w-full min-w-0 items-center gap-2 rounded-md py-1.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500'
    button.setAttribute('aria-controls', step.id)
    button.setAttribute('data-enrolar-step', String(index))

    const badge = document.createElement('span')
    badge.className =
      'absolute left-0 top-1.5 inline-flex h-7 w-7 items-center justify-center rounded-full bg-amber-200 text-xs font-semibold text-amber-950 ring-1 ring-inset ring-amber-600/40 dark:bg-amber-800 dark:text-amber-50 dark:ring-amber-400/40'
    badge.textContent = String(step.number)
    badge.setAttribute('aria-hidden', 'true')

    const title = document.createElement('span')
    title.className = 'min-w-0 flex-1 text-sm font-semibold text-slate-800 dark:text-slate-100'
    title.textContent = step.title

    const chevron = document.createElement('span')
    chevron.className = 'enrolar-huella-chevron shrink-0 text-amber-800 dark:text-amber-300'
    chevron.setAttribute('data-enrolar-chevron', '')
    chevron.setAttribute('aria-hidden', 'true')
    chevron.innerHTML = iconChevronDown()

    button.append(title, chevron)

    const panel = document.createElement('div')
    panel.id = step.id
    panel.className = 'enrolar-huella-panel'
    panel.setAttribute('role', 'region')
    panel.setAttribute('aria-labelledby', button.id)

    const inner = document.createElement('div')
    inner.className = 'enrolar-huella-panel-inner'
    const body = document.createElement('p')
    body.className = 'pb-2 pl-0 pt-1 text-sm leading-5 text-slate-600 dark:text-slate-300'
    body.textContent = step.body
    inner.append(body)
    panel.append(inner)

    item.append(badge, button, panel)
    root.append(item)
    return { button, panel, chevron }
  })

  function renderOpen() {
    items.forEach((item, index) => {
      const open = index === openIndex
      item.button.setAttribute('aria-expanded', String(open))
      item.panel.dataset.open = String(open)
      item.panel.hidden = !open
      item.panel.inert = !open
      item.panel.setAttribute('aria-hidden', String(!open))
      item.chevron.classList.toggle('rotate-180', open)
      item.chevron.setAttribute('data-chevron', open ? 'up' : 'down')
    })
  }

  items.forEach((item, index) => {
    item.button.addEventListener('click', () => {
      openIndex = enrolarHuellaExclusiveOpen(openIndex, index)
      renderOpen()
    })
  })

  renderOpen()
  return root
}

export function openEnrolarHuellaModal({
  empleadoNombre,
  empleadoId,
  empresaId,
  empleado,
  onRefresh,
} = {}) {
  const target = empleado ?? {
    id: empleadoId,
    empresaId,
    nombre: empleadoNombre,
  }
  if (!canOpenEnrolarHuellaModal({ empleado: target, empresaId })) return null

  const nombre = enrolarHuellaNombreSeguro(empleadoNombre || target.nombre)
  const restoreScroll = lockBackgroundScroll()

  const content = document.createElement('div')
  content.className = 'flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden'

  const scroll = document.createElement('div')
  scroll.className = 'min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto'

  const iconWrap = document.createElement('div')
  iconWrap.className =
    'mb-3 inline-flex h-11 w-11 items-center justify-center rounded-lg bg-amber-100 text-amber-900 ring-1 ring-inset ring-amber-600/40 dark:bg-amber-900 dark:text-amber-200 dark:ring-amber-400/40'
  iconWrap.innerHTML = iconFingerprint()
  scroll.append(iconWrap)

  appendNotice(scroll, nombre)
  const accordion = createEnrolarHuellaAccordion(nombre, { initialOpen: 0 })
  accordion.classList.add('mt-4')
  scroll.append(accordion)
  content.append(scroll)

  const actions = document.createElement('div')
  actions.className =
    'mt-4 flex shrink-0 flex-col-reverse gap-2 border-t border-slate-200 pt-4 sm:flex-row sm:justify-end dark:border-slate-700'
  actions.innerHTML = `
    <button type="button" data-action="entendido" class="${BTN_SECONDARY_CLASS}"></button>
    <button type="button" data-action="actualizar" data-autofocus class="inline-flex items-center justify-center rounded-lg bg-amber-700 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 dark:bg-amber-600 dark:hover:bg-amber-500"></button>
  `
  actions.querySelector('[data-action="entendido"]').textContent = ENROLAR_HUELLA_UNDERSTOOD_LABEL
  actions.querySelector('[data-action="actualizar"]').textContent = ENROLAR_HUELLA_REFRESH_LABEL
  content.append(actions)

  const modal = openModal({
    title: ENROLAR_HUELLA_TITLE,
    content,
    labelledBy: 'enrolar-huella-title',
    closeOnBackdrop: true,
    closeOnEscape: true,
    unsavedChanges: false,
    onClose: restoreScroll,
  })

  const body = modal.dialog.querySelector('.overflow-y-auto')
  if (body) {
    body.className = 'flex min-h-0 flex-1 flex-col overflow-hidden px-5 py-4'
  }

  content.querySelector('[data-action="entendido"]')?.addEventListener('click', () => {
    void modal.close()
  })
  content.querySelector('[data-action="actualizar"]')?.addEventListener('click', () => {
    void modal.close()
    onRefresh?.()
  })

  return modal
}
